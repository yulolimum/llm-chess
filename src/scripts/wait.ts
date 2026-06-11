import { setTimeout } from 'node:timers/promises'
import { minimist } from 'zx'

import { getGameLogPath } from '../game/files.js'
import { formatGameState } from '../game/format.js'
import { colorToPlayerName, parsePlayerName, playerNameToColor } from '../game/players.js'
import { readGameState } from '../game/state.js'
import { createLogger, setSessionLogFile } from '../utils/create-logger.js'

const scriptCommand = 'pnpm game:wait'

const args = minimist(process.argv.slice(2), {
  alias: { h: 'help' },
  boolean: ['help', 'verbose'],
  string: ['game', 'player'],
})

const parsedArgs = {
  gameGuid: readStringArg(args['game']),
  help: Boolean(args['help']),
  player: parsePlayerName(args['player']),
  verbose: Boolean(args['verbose']),
}

if (parsedArgs.help) {
  console.log(`Usage: ${scriptCommand} --game <guid> --player <white|black>

Blocks until it is the selected player's turn, then prints the current board state.

Options:
  --verbose       Append debug details to the game log.
`)
  process.exit(0)
}

const gameGuid = requireArg(parsedArgs.gameGuid, '--game <guid>')
const player = requireArg(parsedArgs.player, '--player <white|black>')
const playerColor = playerNameToColor(player)

setSessionLogFile(getGameLogPath(gameGuid))

const logger = createLogger({
  color: '#fbbf24',
  fileLevel: 'debug',
  prefix: '[game:wait]',
  terminalLevel: 'silent',
})

let pollCount = 0

logger.debug('parsed args:', parsedArgs)
output(`Waiting for ${player}'s turn...`)

while (true) {
  const state = await readGameState(gameGuid)
  pollCount += 1

  if (pollCount === 1 || pollCount % 10 === 0) {
    logger.debug('poll state:', {
      fen: state.chess.fen(),
      isGameOver: state.chess.isGameOver(),
      pollCount,
      requestedPlayer: player,
      turn: colorToPlayerName(state.chess.turn()),
    })
  }

  if (state.chess.isGameOver()) {
    output('Game complete. Stop now.')
    output(formatGameState(state))
    process.exit(0)
  }

  if (state.chess.turn() === playerColor) {
    output(`It is ${player}'s turn.`)

    if (state.lastMove !== null) {
      output(`Previous move: ${colorToPlayerName(state.lastMove.move.color)} ${state.lastMove.move.san}`)

      if (state.lastMove.rationale !== undefined) {
        output(`Previous rationale: ${state.lastMove.rationale}`)
      }
    }

    logger.debug('resolved wait state:', {
      fen: state.chess.fen(),
      lastMove: state.lastMove,
      legalMoves: state.chess.moves(),
      pollCount,
    })
    output('')
    output(formatGameState(state))
    output('')
    output(
      `Choose a move, then run: pnpm game:move --game ${gameGuid} --player ${player} --move "<move>" --rationale "<public rationale>"`,
    )
    process.exit(0)
  }

  await setTimeout(500)
}

function readStringArg(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return readStringArg(value.at(-1))
  }

  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function requireArg<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`Expected ${name}`)
  }

  return value
}

function output(...args: Parameters<typeof console.log>): void {
  console.log(...args)
  logger.info(...args)
}
