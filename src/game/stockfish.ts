import type { EngineScore, EngineWdl, MoveAnalysis, MoveQuality, PlayerColor } from './types.js'

import { spawn } from 'node:child_process'

type AnalyzeMoveOptions = {
  depth?: number
  fen: string
  playedMove: string
  turn: PlayerColor
}

type SearchResult = {
  bestMove: string
  depth: number
  pv: string[]
  score: EngineScore
  wdl?: EngineWdl
}

type PendingWait = {
  lines: string[]
  predicate: (line: string) => boolean
  reject: (reason: Error) => void
  resolve: (lines: string[]) => void
  timer: NodeJS.Timeout
}

const defaultDepth = 12
const timeoutMs = 10_000

export async function analyzeMoveWithStockfish(options: AnalyzeMoveOptions): Promise<MoveAnalysis> {
  const engine = createStockfishProcess()

  try {
    const uciReady = engine.waitFor(line => line === 'uciok', 'uci')
    engine.send('uci')
    await uciReady
    engine.send('setoption name Threads value 1')
    engine.send('setoption name UCI_ShowWDL value true')
    const optionsReady = engine.waitFor(line => line === 'readyok', 'isready')
    engine.send('isready')
    await optionsReady

    const depth = options.depth ?? defaultDepth
    const best = await analyzePosition(engine, {
      depth,
      fen: options.fen,
    })
    const played = await analyzePosition(engine, {
      depth,
      fen: options.fen,
      searchMove: options.playedMove,
    })
    const evalBest = normalizeScore(best.score, options.turn)
    const evalPlayed = normalizeScore(played.score, options.turn)
    const expectedPointsBest = expectedPoints(best.wdl)
    const expectedPointsPlayed = expectedPoints(played.wdl)
    const expectedPointsLost =
      expectedPointsBest === undefined || expectedPointsPlayed === undefined
        ? undefined
        : Math.max(0, expectedPointsBest - expectedPointsPlayed)
    const evalLoss = scoreLoss(best.score, played.score)
    const analysis: MoveAnalysis = {
      bestMove: best.bestMove,
      classification: classifyMove({
        bestMove: best.bestMove,
        evalLoss,
        expectedPointsLost,
        playedMove: options.playedMove,
      }),
      depth: Math.min(best.depth, played.depth),
      engine: 'stockfish',
      evalBest,
      evalPlayed,
      playedMove: options.playedMove,
    }

    if (evalLoss !== undefined) {
      analysis.evalLoss = evalLoss
    }

    if (expectedPointsBest !== undefined) {
      analysis.expectedPointsBest = expectedPointsBest
    }

    if (expectedPointsLost !== undefined) {
      analysis.expectedPointsLost = expectedPointsLost
    }

    if (expectedPointsPlayed !== undefined) {
      analysis.expectedPointsPlayed = expectedPointsPlayed
    }

    if (best.pv.length > 0) {
      analysis.pv = best.pv
    }

    if (best.wdl !== undefined) {
      analysis.wdlBest = best.wdl
    }

    if (played.wdl !== undefined) {
      analysis.wdlPlayed = played.wdl
    }

    return analysis
  } finally {
    engine.close()
  }
}

async function analyzePosition(
  engine: ReturnType<typeof createStockfishProcess>,
  options: {
    depth: number
    fen: string
    searchMove?: string
  },
): Promise<SearchResult> {
  engine.send('setoption name Clear Hash')
  const hashReady = engine.waitFor(line => line === 'readyok', 'clear hash')
  engine.send('isready')
  await hashReady
  engine.send(`position fen ${options.fen}`)
  const bestMove = engine.waitFor(line => line.startsWith('bestmove '), 'bestmove')
  engine.send(
    options.searchMove === undefined
      ? `go depth ${options.depth}`
      : `go depth ${options.depth} searchmoves ${options.searchMove}`,
  )

  const lines = await bestMove
  return parseSearchResult(lines, options.depth)
}

function createStockfishProcess() {
  const child = spawn('stockfish', [], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let pending: PendingWait | null = null
  let partialStdout = ''
  let stderr = ''

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  child.stdout.on('data', chunk => {
    partialStdout += chunk
    const lines = partialStdout.split(/\r?\n/)
    partialStdout = lines.pop() ?? ''

    for (const line of lines) {
      if (line.length === 0 || pending === null) {
        continue
      }

      pending.lines.push(line)

      if (pending.predicate(line)) {
        const completed = pending
        pending = null
        clearTimeout(completed.timer)
        completed.resolve(completed.lines)
      }
    }
  })

  child.stderr.on('data', chunk => {
    stderr += chunk
  })

  child.on('error', error => {
    if (pending !== null) {
      const completed = pending
      pending = null
      clearTimeout(completed.timer)
      completed.reject(error)
    }
  })

  child.on('exit', code => {
    if (pending !== null) {
      const completed = pending
      pending = null
      clearTimeout(completed.timer)
      completed.reject(new Error(`Stockfish exited with code ${code ?? 'unknown'}`))
    }
  })

  return {
    close() {
      child.stdin.end('quit\n')
      child.kill()
    },
    send(command: string) {
      child.stdin.write(`${command}\n`)
    },
    waitFor(predicate: (line: string) => boolean, label: string): Promise<string[]> {
      if (pending !== null) {
        throw new Error('Stockfish wait already in progress')
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (pending === null) {
            return
          }

          const completed = pending
          pending = null
          completed.reject(new Error(`Timed out waiting for Stockfish ${label}${stderr.trim() ? `: ${stderr}` : ''}`))
        }, timeoutMs)

        pending = {
          lines: [],
          predicate,
          reject,
          resolve,
          timer,
        }
      })
    },
  }
}

function parseSearchResult(lines: string[], requestedDepth: number): SearchResult {
  const bestMoveLine = lines.findLast(line => line.startsWith('bestmove '))
  const infoLine = lines.findLast(line => line.startsWith('info ') && line.includes(' score '))

  if (bestMoveLine === undefined) {
    throw new Error('Stockfish did not return a best move')
  }

  if (infoLine === undefined) {
    throw new Error('Stockfish did not return an evaluation')
  }

  const bestMove = /^bestmove\s+(\S+)/.exec(bestMoveLine)?.[1]

  if (bestMove === undefined || bestMove === '(none)') {
    throw new Error('Stockfish did not return a playable best move')
  }

  const result: SearchResult = {
    bestMove,
    depth: parseInteger(/\bdepth\s+(-?\d+)/.exec(infoLine)?.[1]) ?? requestedDepth,
    pv: parsePv(infoLine),
    score: parseScore(infoLine),
  }
  const wdl = parseWdl(infoLine)

  if (wdl !== undefined) {
    result.wdl = wdl
  }

  return result
}

function parseScore(line: string): EngineScore {
  const match = /\bscore\s+(cp|mate)\s+(-?\d+)/.exec(line)

  if (match === null) {
    throw new Error(`Stockfish evaluation did not include a score: ${line}`)
  }

  return {
    type: match[1] === 'mate' ? 'mate' : 'cp',
    value: Number.parseInt(match[2] ?? '', 10),
  }
}

function parseWdl(line: string): EngineWdl | undefined {
  const match = /\bwdl\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/.exec(line)

  if (match === null) {
    return undefined
  }

  const win = parseInteger(match[1])
  const draw = parseInteger(match[2])
  const loss = parseInteger(match[3])

  if (win === undefined || draw === undefined || loss === undefined) {
    return undefined
  }

  return { draw, loss, win }
}

function parsePv(line: string): string[] {
  const match = /\bpv\s+(.+)$/.exec(line)

  return match?.[1]?.split(/\s+/).filter(Boolean) ?? []
}

function parseInteger(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function normalizeScore(score: EngineScore, turn: PlayerColor): EngineScore {
  if (turn === 'w') {
    return score
  }

  return {
    type: score.type,
    value: -score.value,
  }
}

function expectedPoints(wdl: EngineWdl | undefined): number | undefined {
  if (wdl === undefined) {
    return undefined
  }

  return (wdl.win + wdl.draw / 2) / 1000
}

function scoreLoss(best: EngineScore, played: EngineScore): number | undefined {
  const bestCp = scoreToCentipawns(best)
  const playedCp = scoreToCentipawns(played)

  if (bestCp === undefined || playedCp === undefined) {
    return undefined
  }

  return Math.max(0, bestCp - playedCp)
}

function scoreToCentipawns(score: EngineScore): number | undefined {
  if (score.type === 'cp') {
    return score.value
  }

  return undefined
}

function classifyMove(options: {
  bestMove: string
  evalLoss: number | undefined
  expectedPointsLost: number | undefined
  playedMove: string
}): MoveQuality {
  if (options.playedMove === options.bestMove) {
    return 'best'
  }

  if (options.expectedPointsLost !== undefined) {
    return classifyExpectedPointsLoss(options.expectedPointsLost)
  }

  if (options.evalLoss !== undefined) {
    return classifyCentipawnLoss(options.evalLoss)
  }

  return 'good'
}

function classifyExpectedPointsLoss(loss: number): MoveQuality {
  if (loss <= 0.005) {
    return 'best'
  }

  if (loss <= 0.02) {
    return 'excellent'
  }

  if (loss <= 0.05) {
    return 'good'
  }

  if (loss <= 0.1) {
    return 'inaccuracy'
  }

  if (loss <= 0.2) {
    return 'mistake'
  }

  return 'blunder'
}

function classifyCentipawnLoss(loss: number): MoveQuality {
  if (loss <= 5) {
    return 'best'
  }

  if (loss <= 20) {
    return 'excellent'
  }

  if (loss <= 50) {
    return 'good'
  }

  if (loss <= 100) {
    return 'inaccuracy'
  }

  if (loss <= 200) {
    return 'mistake'
  }

  return 'blunder'
}
