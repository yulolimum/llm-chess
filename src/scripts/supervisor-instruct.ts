import { minimist } from 'zx'

import { getGameLogPath } from '../game/files.js'
import { parsePlayerName } from '../game/players.js'
import { readGameState } from '../game/state.js'
import { createLogger, setSessionLogFile } from '../utils/create-logger.js'
import {
  getSupervisorPlayerSessionName,
  readStartedProvider,
  sendSupervisorInstruction,
  supervisorInstructCommand,
  type SupervisorInstructionReason,
} from '../utils/supervisor-instruct.js'

const args = minimist(process.argv.slice(2), {
  alias: { h: 'help' },
  boolean: ['help', 'stalled'],
  string: ['game', 'player', 'reason', 'session'],
})

const parsedArgs = {
  gameGuid: readStringArg(args['game']),
  help: Boolean(args['help']),
  player: parsePlayerName(args['player']),
  reason: parseReason(args['reason'], Boolean(args['stalled'])),
  session: readStringArg(args['session']),
}

if (parsedArgs.help) {
  console.log(`Usage: ${supervisorInstructCommand} --game <game-id> --player <white|black> [options]

Options:
  --reason <turn|stalled>  Instruction reason. Defaults to turn.
  --stalled                Alias for --reason stalled.
  --session <name>         Override the derived tmux session name.
  --help, -h               Show help.
`)
  process.exit(0)
}

const gameGuid = requireArg(parsedArgs.gameGuid, '--game <game-id>')
const player = requireArg(parsedArgs.player, '--player <white|black>')
const reason = parsedArgs.reason

setSessionLogFile(getGameLogPath(gameGuid))

const logger = createLogger({
  prefix: '[supervisor:instruct]',
})

const state = await readGameState(gameGuid)
const session = parsedArgs.session ?? getSupervisorPlayerSessionName(gameGuid, player)
const provider = readStartedProvider(state.started.players?.[player].provider)

const sent = await sendSupervisorInstruction({
  gameGuid,
  logger,
  player,
  reason,
  session: {
    provider,
    session,
  },
})

process.exit(sent ? 0 : 1)

function parseReason(value: unknown, stalled: boolean): SupervisorInstructionReason {
  if (stalled) {
    return 'stalled'
  }

  const reason = readStringArg(value)

  if (reason === undefined || reason === 'turn') {
    return 'turn'
  }

  if (reason === 'stalled') {
    return 'stalled'
  }

  throw new Error(`Unknown --reason "${reason}". Expected turn or stalled.`)
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
