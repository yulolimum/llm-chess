import type { Chess, Move } from 'chess.js'

import { minimist } from 'zx'

import { createGameEndedEvent, createMoveEvent } from '../game/events.js'
import { appendGameEvent, getGameLogPath } from '../game/files.js'
import { formatGameState, formatGameStatus } from '../game/format.js'
import { withGameLock } from '../game/lock.js'
import { colorToPlayerName, parsePlayerName, playerNameToColor } from '../game/players.js'
import { readGameState } from '../game/state.js'
import { analyzeMoveWithStockfish } from '../game/stockfish.js'
import { createLogger, setSessionLogFile } from '../utils/create-logger.js'
import { renderTemplateFile } from '../utils/templates.js'

const scriptCommand = 'pnpm agent:move'

const args = minimist(process.argv.slice(2), {
  alias: { h: 'help' },
  boolean: ['help'],
  string: ['game', 'move', 'player', 'rationale'],
})

const parsedArgs = {
  gameGuid: readStringArg(args['game']),
  help: Boolean(args['help']),
  move: readStringArg(args['move']),
  player: parsePlayerName(args['player']),
  rationale: readStringArg(args['rationale']),
}

if (parsedArgs.help) {
  console.log(`Usage: ${scriptCommand} --game <game-id> --player <white|black> --move <move> --rationale <text>

The move can be SAN or coordinate notation, for example e4, Nf3, or e2e4.
The rationale should be a concise public explanation for the move.
Do not write JSON. This script validates the move and appends the game event.
`)
  process.exit(0)
}

const gameGuid = requireArg(parsedArgs.gameGuid, '--game <game-id>')
const player = requireArg(parsedArgs.player, '--player <white|black>')
const moveInput = requireArg(parsedArgs.move, '--move <move>')
const rationale = requireArg(parsedArgs.rationale, '--rationale <text>')

setSessionLogFile(getGameLogPath(gameGuid))

const logger = createLogger({
  prefix: '[agent:move]',
})

logger.debug('parsed args:', parsedArgs)

const exitCode = await withGameLock(gameGuid, async () => {
  const state = await readGameState(gameGuid)
  const playerColor = playerNameToColor(player)

  logger.debug('loaded game state:', {
    fen: state.chess.fen(),
    lastMove: state.lastMove,
    legalMoves: state.chess.moves(),
    requestedMove: moveInput,
    requestedPlayer: player,
    requestedRationale: rationale,
    turn: colorToPlayerName(state.chess.turn()),
  })

  if (state.chess.isGameOver()) {
    output('Game is already over.')
    output(formatGameState(state))
    return 0
  }

  if (state.chess.turn() !== playerColor) {
    output(`It is ${colorToPlayerName(state.chess.turn())}'s turn.`)
    output('')
    output('Stop now and wait for the next supervisor instruction.')
    return 1
  }

  const move = safeMove(state.chess, moveInput)

  if (move === null) {
    output(`Illegal move: ${moveInput}`)
    output('')
    output(formatGameState(state))
    return 1
  }

  const analysis = await analyzeMoveWithStockfish({
    fen: move.before,
    playedMove: move.lan,
    turn: move.color,
  })
  const moveEvent = createMoveEvent(move, { analysis, rationale })

  logger.debug('accepted move event:', moveEvent)
  await appendGameEvent(gameGuid, moveEvent)
  logger.debug('appended move event')

  const nextState = await readGameState(gameGuid)

  logger.debug('next game state:', {
    fen: nextState.chess.fen(),
    isGameOver: nextState.chess.isGameOver(),
    legalMoves: nextState.chess.moves(),
    turn: colorToPlayerName(nextState.chess.turn()),
  })

  if (nextState.chess.isGameOver()) {
    const gameEndedEvent = createGameEndedEvent(nextState.chess, {
      ply: nextState.events.filter(event => event.type === 'move').length,
    })

    logger.debug('game ended event:', gameEndedEvent)
    await appendGameEvent(gameGuid, gameEndedEvent)
    logger.info('Game ended:', gameEndedEvent)

    output('')
    output(
      await renderMoveOutput({
        lan: move.lan,
        move: move.san,
        nextInstruction: `Game complete: ${gameEndedEvent.result} by ${gameEndedEvent.reason}. Stop now.`,
        nextState,
        rationale,
      }),
    )
  } else {
    output(
      await renderMoveOutput({
        lan: move.lan,
        move: move.san,
        nextInstruction: 'Your turn is complete. Stop now and wait for the next supervisor instruction.',
        nextState,
        rationale,
      }),
    )
  }

  return 0
})

process.exit(exitCode)

function readStringArg(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return readStringArg(value.at(-1))
  }

  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function requireArg<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    console.error(`Expected ${name}`)
    process.exit(1)
  }

  return value
}

function output(...args: Parameters<typeof console.log>): void {
  console.log(...args)
  logger.info(...args)
}

async function renderMoveOutput(options: {
  lan: string
  move: string
  nextInstruction: string
  nextState: Awaited<ReturnType<typeof readGameState>>
  rationale: string
}): Promise<string> {
  return renderTemplateFile(new URL('../prompts/agent-move.md', import.meta.url), {
    gameState: formatGameState(options.nextState),
    lan: options.lan,
    move: options.move,
    nextInstruction: options.nextInstruction,
    rationale: options.rationale,
    status: formatGameStatus(options.nextState.chess),
  })
}

function safeMove(chess: Chess, move: string): Move | null {
  try {
    return chess.move(move)
  } catch {
    return null
  }
}
