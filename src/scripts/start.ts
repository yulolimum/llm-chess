import type { GameEvent } from '../game/types.js'

import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { $, minimist, nothrow, quiet, quote } from 'zx'

import { createGameStartedEvent } from '../game/events.js'
import { appendGameEvent, ensureGamesDirectory, getGameJsonlPath, getGameLogPath } from '../game/files.js'
import { renderPlayerPrompt } from '../prompts/player-prompt.js'
import { createLogger, setSessionLogFile } from '../utils/create-logger.js'
import { createSortableGuid } from '../utils/strings.js'

//
// Constants
//
const scriptName = 'game:start'
const scriptCommand = 'pnpm game:start'
const sessionPrefix = 'llm-chess'

//
// Arguments
//
const args = minimist(process.argv.slice(2), {
  alias: { h: 'help', v: 'verbose' },
  boolean: ['help', 'verbose'],
})

const parsedArgs = {
  help: Boolean(args['help']),
  verbose: Boolean(args['verbose']),
}

type ArgNames = keyof typeof parsedArgs
type Args = { [K in ArgNames]: NonNullable<(typeof parsedArgs)[K]> }

const accumulatedArgs: Partial<Args> = removeUndefinedValues({
  help: parsedArgs.help,
  verbose: parsedArgs.verbose,
})

//
// Logging
//
function print(...args: Parameters<typeof console.log>): void {
  console.log(...args)
}

function debug(...args: Parameters<typeof console.log>): void {
  if (parsedArgs.verbose) {
    console.log(`[${scriptName}]`, ...args)
  }
}

//
// Help
//
if (parsedArgs.help) {
  print(`Usage: ${scriptCommand} [options]

Options:
  --verbose, -v       Enable debug logs.
  --help, -h          Show help.
`)
  process.exit(0)
}

await assertTmuxInstalled()

const cwd = process.cwd()
const gameGuid = createSortableGuid()
const gameStartedEvent = createGameStartedEvent()

await ensureGamesDirectory()
setSessionLogFile(getGameLogPath(gameGuid))

const logger = createLogger({
  color: '#7dd3fc',
  level: parsedArgs.verbose ? 'debug' : 'info',
  prefix: '[game:start]',
})

debug('arguments:', parsedArgs)

await appendGameEvent(gameGuid, gameStartedEvent)
const gameSessionPrefix = `${sessionPrefix}-${gameGuid}`
const promptA = await renderPlayerPrompt({
  color: 'white',
  gameGuid,
  initialFen: gameStartedEvent.initialFen,
})
const promptB = await renderPlayerPrompt({
  color: 'black',
  gameGuid,
  initialFen: gameStartedEvent.initialFen,
})

const actorACommand = process.env['PLAYER_A_CMD'] ?? `codex --cd ${quote(cwd)}`
const actorBCommand = process.env['PLAYER_B_CMD'] ?? 'claude'
const actorASession = `${gameSessionPrefix}-player-a`
const actorBSession = `${gameSessionPrefix}-player-b`
const actorA = `cd ${quote(cwd)} && ${actorACommand} ${quote(promptA)}`
const actorB = `cd ${quote(cwd)} && ${actorBCommand} ${quote(promptB)}`
const createdSessions: string[] = []

let cleanupPromise: Promise<void> | null = null

installShutdownHandlers(createdSessions)

try {
  await cleanupExistingGameSessions()
  await createPlayerSession(actorASession, actorA)
  createdSessions.push(actorASession)
  await createPlayerSession(actorBSession, actorB)
  createdSessions.push(actorBSession)

  logger.important('Started tmux player sessions')
  logger.info(`Actor A session: ${actorASession}`)
  logger.info(`Actor B session: ${actorBSession}`)
  logger.info(`Game GUID: ${gameGuid}`)
  logger.info(`Game log: ${getGameLogPath(gameGuid)}`)
  logger.info(`Game state: ${getGameJsonlPath(gameGuid)}`)
  logger.info(`Repeatable command: ${buildRepeatableCommand(accumulatedArgs)}`)
  logger.info('Streaming game events...')

  await streamGameEvents(gameGuid)
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
    return cleanupPromise
  }

  cleanupPromise = (async () => {
    if (sessions.length === 0) {
      return
    }

    logger.info('Stopping tmux player sessions...')

    await Promise.all(
      sessions.map(async session => {
        await quiet(nothrow($`tmux kill-session -t ${session}`))
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
    return
  }

  const sessions = result.stdout
    .split('\n')
    .filter(session => session.startsWith(`${sessionPrefix}-`) && session.length > sessionPrefix.length + 1)

  if (sessions.length === 0) {
    return
  }

  logger.info(`Stopping ${sessions.length} existing tmux game session${sessions.length === 1 ? '' : 's'}...`)

  await Promise.all(
    sessions.map(async session => {
      await quiet(nothrow($`tmux kill-session -t ${session}`))
    }),
  )
}

async function createPlayerSession(session: string, command: string): Promise<void> {
  await $`tmux new-session -d -s ${session} -n player ${command}`
}

async function streamGameEvents(gameGuid: string): Promise<void> {
  let consumedLines = 0

  while (true) {
    const raw = await readFile(getGameJsonlPath(gameGuid), 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const nextLines = lines.slice(consumedLines)

    for (const line of nextLines) {
      const event = JSON.parse(line) as GameEvent
      logger.info(formatGameEvent(event))
    }

    consumedLines = lines.length

    await setTimeout(500)
  }
}

function removeUndefinedValues<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>
}

function buildRepeatableCommand(args: Partial<Args>): string {
  const stringArgs = Object.entries(args).reduce((output, [key, value]) => {
    if (value === undefined) {
      return output
    }

    if (typeof value === 'boolean') {
      return value ? `${output} --${key}` : output
    }

    return `${output} --${key} ${quote(value)}`
  }, '')

  return `${scriptCommand}${stringArgs}`
}

function formatGameEvent(event: GameEvent): string {
  if (event.type === 'game_started') {
    return `game started. ${event.turn} to move. initial FEN: ${event.initialFen}`
  }

  return `game event: ${event.type}`
}
