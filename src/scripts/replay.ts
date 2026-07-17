if (process.env['NO_COLOR'] === undefined) {
  process.env['FORCE_COLOR'] ||= '1'
}

import type { GameEndedEvent, GameEvent, GameStartedEvent, GameStartedPlayer, MoveEvent } from '../game/types.js'

import select from '@inquirer/select'
import { render } from 'ink'
import path from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import React from 'react'
import { fs, minimist, quote } from 'zx'

import { ChessBoard } from '../components/ChessBoard.js'
import { ensureGamesDirectory, getGamesDirectory, readGameEvents } from '../game/files.js'
import { createBoardPlayers, createMoveFeed } from '../game/presentation.js'
import { getEffortLabel, getModelLabel, getProviderLabel } from '../game/providers.js'
import { replayGameEvents } from '../game/state.js'

//
// Constants
//
const scriptName = 'game-replay'
const scriptCommand = 'pnpm game:replay'
const speedOptions = [
  { delayMs: 1500, label: 'Slow', value: 'slow' },
  { delayMs: 750, label: 'Normal', value: 'normal' },
  { delayMs: 250, label: 'Fast', value: 'fast' },
  { delayMs: 0, label: 'Instant', value: 'instant' },
] as const

type Speed = (typeof speedOptions)[number]['value']
type CompletedGame = {
  ended: GameEndedEvent
  events: GameEvent[]
  guid: string
  moves: MoveEvent[]
  started: GameStartedEvent
}

//
// Arguments
//
const args = minimist(process.argv.slice(2), {
  alias: { h: 'help', v: 'verbose' },
  boolean: ['help', 'verbose'],
  string: ['game', 'speed'],
})

const parsedArgs = {
  game: readStringArg(args['game']),
  help: Boolean(args['help']),
  speed: parseSpeedArg(args['speed']),
  verbose: Boolean(args['verbose']),
}

type ArgNames = keyof typeof parsedArgs
type Args = { [K in ArgNames]: NonNullable<(typeof parsedArgs)[K]> }

const accumulatedArgs: Partial<Args> = {
  help: parsedArgs.help,
  verbose: parsedArgs.verbose,
}

//
// Cache
//
type Cache = {
  args: Partial<Args>
}

const repoRoot = process.cwd()
const cacheDir = path.join(repoRoot, 'node_modules', '.cache', scriptName)
const cacheFile = path.join(cacheDir, 'cache.json')

async function readCache(): Promise<Cache> {
  try {
    const cache = (await fs.readJson(cacheFile)) as Cache
    cache.args = cache.args || {}
    return cache
  } catch {
    return { args: {} }
  }
}

async function writeCache(cache: Cache): Promise<void> {
  await fs.ensureDir(cacheDir)
  await fs.writeJson(cacheFile, cache, { spaces: 2 })
}

const cache = await readCache()

//
// Logging
//
function log(...args: Parameters<typeof console.log>): void {
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
  log(`Usage: ${scriptCommand} [options]

Options:
  --game <game-id>    Game record id to replay
  --speed <speed>     Replay speed: slow, normal, fast, instant
  --verbose, -v       Enable debug logs
  --help, -h          Show help
`)
  process.exit(0)
}

const completedGames = await listCompletedGames()
debug('completed games:', completedGames.length)

if (completedGames.length === 0) {
  log('No completed games found in .games.')
  process.exit(1)
}

const selectedGame = await (async function () {
  const gameByGuid = new Map(completedGames.map(game => [game.guid, game]))
  const requestedGameGuid = parsedArgs.game

  if (requestedGameGuid !== undefined) {
    const requestedGame = gameByGuid.get(requestedGameGuid)

    if (requestedGame === undefined) {
      log(`Completed game not found: ${requestedGameGuid}`)
      process.exit(1)
    }

    accumulatedArgs.game = requestedGameGuid
    cache.args.game = requestedGameGuid
    debug('selected game:', requestedGameGuid)
    await writeCache(cache)
    return requestedGame
  }

  const cachedGame = typeof cache.args.game === 'string' ? cache.args.game : undefined
  const selectedGameGuid = await select<string>({
    choices: completedGames.map(game => ({
      name: formatGameLabel(game),
      value: game.guid,
    })),
    default: cachedGame !== undefined && gameByGuid.has(cachedGame) ? cachedGame : completedGames[0]?.guid,
    message: 'Replay which completed game?',
  })
  const selectedGame = gameByGuid.get(selectedGameGuid)

  if (selectedGame === undefined) {
    throw new Error(`Selected game not found: ${selectedGameGuid}`)
  }

  accumulatedArgs.game = selectedGameGuid
  cache.args.game = selectedGameGuid
  debug('selected game:', selectedGameGuid)
  await writeCache(cache)
  return selectedGame
})()

const selectedSpeed = await (async function () {
  if (parsedArgs.speed !== undefined) {
    accumulatedArgs.speed = parsedArgs.speed
    cache.args.speed = parsedArgs.speed
    debug('selected speed:', parsedArgs.speed)
    await writeCache(cache)
    return parsedArgs.speed
  }

  const cachedSpeed = typeof cache.args.speed === 'string' ? parseSpeedArg(cache.args.speed) : undefined
  const speed = await select<Speed>({
    choices: speedOptions.map(option => ({
      name: `${option.label}${option.delayMs === 0 ? '' : ` (${option.delayMs}ms per move)`}`,
      value: option.value,
    })),
    default: cachedSpeed ?? 'normal',
    message: 'Replay speed?',
  })

  accumulatedArgs.speed = speed
  cache.args.speed = speed
  debug('selected speed:', speed)
  await writeCache(cache)
  return speed
})()
const selectedSpeedOption = speedOptions.find(option => option.value === selectedSpeed) ?? speedOptions[1]

await replayGame(selectedGame, selectedSpeedOption.delayMs)

//
// Repeatable CLI command
//
const stringArgs = Object.entries(accumulatedArgs).reduce((args, [key, value]) => {
  if (value === undefined || value === false || key === 'help') {
    return args
  }

  if (typeof value === 'boolean') {
    return `${args} --${key}`
  }

  return `${args} --${key} ${quote(value)}`
}, '')

log(`\nRe-run this replay with:`)
log(`${scriptCommand}${stringArgs}`)

async function listCompletedGames(): Promise<CompletedGame[]> {
  await ensureGamesDirectory()

  const files = (await fs.readdir(getGamesDirectory())) as string[]
  const games = await Promise.all(
    files.filter(file => file.endsWith('.jsonl')).map(async file => readCompletedGame(path.basename(file, '.jsonl'))),
  )

  return games
    .filter((game): game is CompletedGame => game !== null)
    .sort((a, b) => Date.parse(b.ended.timestamp) - Date.parse(a.ended.timestamp))
}

async function readCompletedGame(guid: string): Promise<CompletedGame | null> {
  try {
    const events = await readGameEvents(guid)
    const state = replayGameEvents(events)
    const started = events.find((event): event is GameStartedEvent => event.type === 'game_started')
    const ended = state.ended

    if (started === undefined || ended === null) {
      debug('skipping incomplete game:', guid)
      return null
    }

    return {
      ended,
      events,
      guid,
      moves: events.filter((event): event is MoveEvent => event.type === 'move'),
      started,
    }
  } catch (error) {
    debug('skipping unreadable game:', guid, error)
    return null
  }
}

async function replayGame(game: CompletedGame, delayMs: number): Promise<void> {
  let boardRender: ReturnType<typeof render> | null = null

  for (let moveCount = 0; moveCount <= game.moves.length; moveCount += 1) {
    if (moveCount > 0 && delayMs > 0) {
      await setTimeout(delayMs)
    }

    const state = replayGameEvents(createReplayFrameEvents(game, moveCount))
    const boardPlayers = createBoardPlayers(state)
    const board = React.createElement(ChessBoard, {
      blackPlayer: boardPlayers.blackPlayer,
      board: state.chess.board(),
      moveFeed: createMoveFeed(state),
      showMoveFeed: moveCount === game.moves.length,
      whitePlayer: boardPlayers.whitePlayer,
    })

    if (boardRender === null) {
      boardRender = render(board)
    } else {
      boardRender.rerender(board)
    }
  }

  if (boardRender !== null) {
    boardRender.unmount()
    await boardRender.waitUntilExit()
  }
}

function createReplayFrameEvents(game: CompletedGame, moveCount: number): GameEvent[] {
  const events: GameEvent[] = [game.started, ...game.moves.slice(0, moveCount)]

  if (moveCount === game.moves.length) {
    events.push(game.ended)
  }

  return events
}

function formatGameLabel(game: CompletedGame): string {
  const completedAt = formatTimestamp(game.ended.timestamp)
  const white = formatPlayerLabel(game.started.players?.white, 'White')
  const black = formatPlayerLabel(game.started.players?.black, 'Black')

  return `${completedAt} - ${white} vs ${black} - ${game.ended.result} ${game.ended.reason} - ${game.moves.length} ply`
}

function formatPlayerLabel(player: GameStartedPlayer | undefined, fallback: string): string {
  if (player === undefined) {
    return fallback
  }

  const effort = player.effort === undefined ? '' : ` ${getEffortLabel(player.effort)}`

  return `${getProviderLabel(player.provider)} ${getModelLabel(player.provider, player.model)}${effort}`
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return timestamp
  }

  return date.toLocaleString()
}

function readStringArg(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return readStringArg(value.at(-1))
  }

  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function parseSpeedArg(value: unknown): Speed | undefined {
  const speed = readStringArg(value)

  if (speed === undefined) {
    return undefined
  }

  if (isSpeed(speed)) {
    return speed
  }

  throw new Error(`Unknown speed "${speed}". Expected slow, normal, fast, or instant.`)
}

function isSpeed(value: string): value is Speed {
  return speedOptions.some(option => option.value === value)
}
