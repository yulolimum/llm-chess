import type { CapturedPiece, ChessBoardPlayer, PlayerStatus } from '../components/ChessBoard.js'
import type { GameState } from '../game/state.js'
import type { Color, PieceSymbol } from 'chess.js'

import select from '@inquirer/select'
import { render } from 'ink'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import React from 'react'
import { $, minimist, nothrow, quiet, quote } from 'zx'

import { ChessBoard } from '../components/ChessBoard.js'
import { createGameStartedEvent } from '../game/events.js'
import { appendGameEvent, ensureGamesDirectory, getGameJsonlPath, getGameLogPath } from '../game/files.js'
import { colorToPlayerName } from '../game/players.js'
import { readGameState } from '../game/state.js'
import { renderPlayerPrompt } from '../prompts/player-prompt.js'
import { createLogger, setSessionLogFile } from '../utils/create-logger.js'
import { createSortableGuid } from '../utils/strings.js'

//
// Constants
//
const scriptCommand = 'pnpm game:start'
const sessionPrefix = 'llm-chess'
const providerOptions = [
  { label: 'Claude', value: 'claude' },
  { label: 'Codex', value: 'codex' },
] as const
const modelOptionsByProvider = {
  claude: [
    { label: 'Claude Fable 5', value: 'claude-fable-5' },
    { label: 'Claude Opus 4.8', value: 'claude-opus-4-8' },
    { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
    { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
    { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
    { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5' },
    { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
  ],
  codex: [
    { label: 'GPT-5.5', value: 'gpt-5.5' },
    { label: 'GPT-5.4', value: 'gpt-5.4' },
    { label: 'GPT-5.4 Mini', value: 'gpt-5.4-mini' },
    { label: 'GPT-5.3 Codex Spark', value: 'gpt-5.3-codex-spark' },
  ],
} as const

type Provider = (typeof providerOptions)[number]['value']
type Model<P extends Provider = Provider> = (typeof modelOptionsByProvider)[P][number]['value']
type ModelOption = {
  label: string
  value: string
}
type PlayerConfig = {
  model: string
  provider: Provider
}
type CapturedPiecesByPlayer = {
  black: CapturedPiece[]
  white: CapturedPiece[]
}

const capturedPieceOrder: Record<PieceSymbol, number> = {
  b: 2,
  k: 5,
  n: 3,
  p: 4,
  q: 0,
  r: 1,
}

//
// Arguments
//
const args = minimist(process.argv.slice(2), {
  alias: { h: 'help', v: 'verbose' },
  boolean: ['help', 'verbose'],
  string: ['blackModel', 'blackProvider', 'whiteModel', 'whiteProvider'],
})

const parsedArgs = {
  blackModel: readStringArg(args['blackModel']),
  blackProvider: parseProvider(args['blackProvider']),
  help: Boolean(args['help']),
  verbose: Boolean(args['verbose']),
  whiteModel: readStringArg(args['whiteModel']),
  whiteProvider: parseProvider(args['whiteProvider']),
}

//
// Logging
//
function print(...args: Parameters<typeof console.log>): void {
  console.log(...args)
}

//
// Help
//
if (parsedArgs.help) {
  print(`Usage: ${scriptCommand} [options]

Options:
  --whiteProvider <provider>   Provider for white: claude, codex
  --whiteModel <model>         Model for white
  --blackProvider <provider>   Provider for black: claude, codex
  --blackModel <model>         Model for black
  --verbose, -v       Enable debug logs.
  --help, -h          Show help.
`)
  process.exit(0)
}

await assertTmuxInstalled()

const whitePlayer = await selectPlayerConfig('White', {
  model: parsedArgs.whiteModel,
  provider: parsedArgs.whiteProvider,
})
const blackPlayer = await selectPlayerConfig('Black', {
  model: parsedArgs.blackModel,
  provider: parsedArgs.blackProvider,
})

const cwd = process.cwd()
const gameGuid = createSortableGuid()
const gameStartedEvent = createGameStartedEvent()

await ensureGamesDirectory()
setSessionLogFile(getGameLogPath(gameGuid))

const logger = createLogger({
  color: '#7dd3fc',
  fileLevel: parsedArgs.verbose ? 'debug' : 'info',
  prefix: '[game:start]',
  terminalLevel: 'silent',
})

logger.debug('parsed args:', parsedArgs)
logger.debug('selected players:', { black: blackPlayer, white: whitePlayer })
logger.debug('paths:', {
  gameJsonlPath: getGameJsonlPath(gameGuid),
  gameLogPath: getGameLogPath(gameGuid),
})

await appendGameEvent(gameGuid, gameStartedEvent)
logger.debug('appended game started event:', gameStartedEvent)
const gameSessionPrefix = `${sessionPrefix}-${gameGuid}`
const promptA = await renderPlayerPrompt({
  color: 'w',
  gameGuid,
  initialFen: gameStartedEvent.initialFen,
  initialTurn: gameStartedEvent.turn,
})
const promptB = await renderPlayerPrompt({
  color: 'b',
  gameGuid,
  initialFen: gameStartedEvent.initialFen,
  initialTurn: gameStartedEvent.turn,
})

const whiteCommand = createProviderCommand(whitePlayer, cwd)
const blackCommand = createProviderCommand(blackPlayer, cwd)
const whiteSession = `${gameSessionPrefix}-white`
const blackSession = `${gameSessionPrefix}-black`
const whiteActor = `cd ${quote(cwd)} && ${whiteCommand} ${quote(promptA)}`
const blackActor = `cd ${quote(cwd)} && ${blackCommand} ${quote(promptB)}`
const createdSessions: string[] = []

let cleanupPromise: Promise<void> | null = null

installShutdownHandlers(createdSessions)

try {
  await cleanupExistingGameSessions()
  await createPlayerSession(whiteSession, whiteActor)
  createdSessions.push(whiteSession)
  await createPlayerSession(blackSession, blackActor)
  createdSessions.push(blackSession)

  logger.info('started tmux player sessions', {
    black: blackPlayer,
    blackSession,
    gameGuid,
    gameJsonlPath: getGameJsonlPath(gameGuid),
    gameLogPath: getGameLogPath(gameGuid),
    white: whitePlayer,
    whiteSession,
  })
  logger.debug('cwd:', cwd)
  logger.debug('white command:', whiteActor)
  logger.debug('black command:', blackActor)
  logger.debug('white prompt:', promptA)
  logger.debug('black prompt:', promptB)

  await streamBoardState(gameGuid)
} finally {
  await cleanupPlayerSessions(createdSessions)
}

function installShutdownHandlers(sessions: string[]): void {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']

  for (const signal of signals) {
    process.once(signal, () => {
      logger.warn(`Received ${signal}; stopping tmux player sessions.`)
      void cleanupPlayerSessions(sessions).finally(() => {
        process.exit(signal === 'SIGINT' ? 130 : 143)
      })
    })
  }
}

async function cleanupPlayerSessions(sessions: string[]): Promise<void> {
  if (cleanupPromise !== null) {
    logger.debug('cleanup already in progress')
    return cleanupPromise
  }

  cleanupPromise = (async () => {
    if (sessions.length === 0) {
      return
    }

    logger.info('Stopping tmux player sessions...')

    await Promise.all(
      sessions.map(async session => {
        const result = await quiet(nothrow($`tmux kill-session -t ${session}`))
        logger.debug('kill-session result:', {
          exitCode: result.exitCode,
          session,
          stderr: result.stderr,
          stdout: result.stdout,
        })
      }),
    )

    logger.info('Stopped tmux player sessions.')
  })()

  return cleanupPromise
}

async function assertTmuxInstalled(): Promise<void> {
  const result = await quiet(nothrow($`command -v tmux`))

  if (result.exitCode !== 0) {
    print('tmux is required to start a game.')
    print('Install it with: brew install tmux')
    process.exit(1)
  }
}

async function cleanupExistingGameSessions(): Promise<void> {
  const result = await quiet(nothrow($`tmux list-sessions -F '#{session_name}'`))

  if (result.exitCode !== 0) {
    logger.debug('tmux list-sessions failed:', {
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
    })
    return
  }

  const sessions = result.stdout
    .split('\n')
    .filter(session => session.startsWith(`${sessionPrefix}-`) && session.length > sessionPrefix.length + 1)

  logger.debug('existing tmux game sessions:', sessions)

  if (sessions.length === 0) {
    return
  }

  logger.info(`Stopping ${sessions.length} existing tmux game session${sessions.length === 1 ? '' : 's'}...`)

  await Promise.all(
    sessions.map(async session => {
      const result = await quiet(nothrow($`tmux kill-session -t ${session}`))
      logger.debug('existing kill-session result:', {
        exitCode: result.exitCode,
        session,
        stderr: result.stderr,
        stdout: result.stdout,
      })
    }),
  )
}

async function createPlayerSession(session: string, command: string): Promise<void> {
  logger.debug('creating tmux session:', { command, session })
  await quiet($`tmux new-session -d -s ${session} -n player ${command}`)
  logger.debug('created tmux session:', session)
}

async function selectPlayerConfig(
  label: string,
  defaults: {
    model: string | undefined
    provider: Provider | undefined
  },
): Promise<PlayerConfig> {
  const provider =
    defaults.provider ??
    (await select<Provider>({
      choices: providerOptions.map(provider => ({ name: provider.label, value: provider.value })),
      message: `${label} provider?`,
    }))

  const model = defaults.model ?? (await selectModel(label, provider))

  validateModel(provider, model)

  return {
    model,
    provider,
  }
}

async function selectModel(providerLabel: string, provider: Provider): Promise<string> {
  const models = modelOptionsByProvider[provider]

  return select<Model<typeof provider>>({
    choices: models.map(model => ({ name: model.label, value: model.value })),
    message: `${providerLabel} model?`,
  })
}

function createProviderCommand(player: PlayerConfig, cwd: string): string {
  if (player.provider === 'codex') {
    return [
      'codex',
      `--cd ${quote(cwd)}`,
      `--model ${quote(player.model)}`,
      '--sandbox danger-full-access',
      '--ask-for-approval never',
    ].join(' ')
  }

  return `claude --model ${quote(player.model)} --permission-mode bypassPermissions`
}

async function streamBoardState(gameGuid: string): Promise<void> {
  let consumedLines = 0
  let boardRender: ReturnType<typeof render> | null = null

  while (true) {
    const raw = await readFile(getGameJsonlPath(gameGuid), 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const nextLines = lines.slice(consumedLines)

    if (nextLines.length > 0) {
      const state = await readGameState(gameGuid)
      const capturedPieces = collectCapturedPieces(state)
      const board = React.createElement(ChessBoard, {
        blackPlayer: createChessBoardPlayer(blackPlayer, createPlayerStatus('b', state), capturedPieces.black),
        board: state.chess.board(),
        whitePlayer: createChessBoardPlayer(whitePlayer, createPlayerStatus('w', state), capturedPieces.white),
      })

      if (boardRender === null) {
        boardRender = render(board)
      } else {
        boardRender.rerender(board)
      }

      logger.debug('rendered chessboard:', {
        ended: state.ended,
        fen: state.chess.fen(),
        isGameOver: state.chess.isGameOver(),
        turn: colorToPlayerName(state.chess.turn()),
      })

      if (state.chess.isGameOver()) {
        logger.info('game ended; stopping game manager', {
          ended: state.ended,
          fen: state.chess.fen(),
        })
        return
      }
    }

    consumedLines = lines.length

    await setTimeout(500)
  }
}

function readStringArg(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return readStringArg(value.at(-1))
  }

  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function parseProvider(value: unknown): Provider | undefined {
  const provider = readStringArg(value)

  if (provider === undefined) {
    return undefined
  }

  if (isProvider(provider)) {
    return provider
  }

  throw new Error(`Unknown provider "${provider}". Expected claude or codex.`)
}

function isProvider(value: string): value is Provider {
  return providerOptions.some(provider => provider.value === value)
}

function validateModel(provider: Provider, model: string): void {
  if (modelOptionsByProvider[provider].some(option => option.value === model)) {
    return
  }

  const validModels = modelOptionsByProvider[provider].map(option => option.value).join(', ')

  print(`Unknown ${provider} model "${model}".`)
  print(`Expected one of: ${validModels}`)
  process.exit(1)
}

function createChessBoardPlayer(
  player: PlayerConfig,
  status: PlayerStatus | undefined,
  capturedPieces: readonly CapturedPiece[],
): ChessBoardPlayer {
  const displayPlayer = {
    capturedPieces,
    model: getModelLabel(player),
    provider: getProviderLabel(player.provider),
  }

  if (status === undefined) {
    return displayPlayer
  }

  return {
    ...displayPlayer,
    status,
  }
}

function createPlayerStatus(color: Color, state: GameState): PlayerStatus | undefined {
  if (state.chess.isGameOver()) {
    if (state.ended?.winner === color) {
      return 'won'
    }

    if (state.ended?.winner !== undefined) {
      return 'lost'
    }

    return 'draw'
  }

  return state.chess.turn() === color ? 'on-move' : undefined
}

function getProviderLabel(provider: Provider): string {
  return providerOptions.find(option => option.value === provider)?.label ?? provider
}

function getModelLabel(player: PlayerConfig): string {
  const options: readonly ModelOption[] = modelOptionsByProvider[player.provider]

  return options.find(option => option.value === player.model)?.label ?? player.model
}

function collectCapturedPieces(state: GameState): CapturedPiecesByPlayer {
  const capturedPieces: CapturedPiecesByPlayer = {
    black: [],
    white: [],
  }

  for (const event of state.events) {
    if (event.type !== 'move' || event.move.captured === undefined) {
      continue
    }

    const capturedPiece = {
      color: event.move.color === 'w' ? 'b' : 'w',
      type: event.move.captured,
    } as const satisfies CapturedPiece

    if (event.move.color === 'w') {
      capturedPieces.white.push(capturedPiece)
    } else {
      capturedPieces.black.push(capturedPiece)
    }
  }

  capturedPieces.black.sort(compareCapturedPieces)
  capturedPieces.white.sort(compareCapturedPieces)

  return capturedPieces
}

function compareCapturedPieces(a: CapturedPiece, b: CapturedPiece): number {
  return capturedPieceOrder[a.type] - capturedPieceOrder[b.type]
}
