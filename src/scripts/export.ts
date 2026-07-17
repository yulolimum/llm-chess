if (process.env['NO_COLOR'] === undefined) {
  process.env['FORCE_COLOR'] ||= '1'
}

import type { GameEndedEvent, GameStartedEvent, GameStartedPlayer, MoveEvent } from '../game/types.js'

import select from '@inquirer/select'
import { Chess } from 'chess.js'
import path from 'node:path'
import process from 'node:process'
import { fs, minimist } from 'zx'

import { ensureGamesDirectory, getGamesDirectory, readGameEvents } from '../game/files.js'
import { getEffortLabel, getModelLabel, getProviderLabel } from '../game/providers.js'
import { replayGameEvents } from '../game/state.js'

//
// Constants
//
const scriptName = 'game-export'
const scriptCommand = 'pnpm game:export'
const pgnMaxWidth = 80

type CompletedGame = {
  ended: GameEndedEvent
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
  string: ['game'],
})

const parsedArgs = {
  game: readStringArg(args['game']),
  help: Boolean(args['help']),
  verbose: Boolean(args['verbose']),
}

type ArgNames = keyof typeof parsedArgs
type Args = { [K in ArgNames]: NonNullable<(typeof parsedArgs)[K]> }

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
  --game <game-id>    Game record id to export
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
    message: 'Export which completed game?',
  })
  const selectedGame = gameByGuid.get(selectedGameGuid)

  if (selectedGame === undefined) {
    throw new Error(`Selected game not found: ${selectedGameGuid}`)
  }

  cache.args.game = selectedGameGuid
  debug('selected game:', selectedGameGuid)
  await writeCache(cache)
  return selectedGame
})()

const pgn = exportGameToPgn(selectedGame)

log(pgn)

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
      guid,
      moves: events.filter((event): event is MoveEvent => event.type === 'move'),
      started,
    }
  } catch (error) {
    debug('skipping unreadable game:', guid, error)
    return null
  }
}

function exportGameToPgn(game: CompletedGame): string {
  const chess = new Chess(game.started.initialFen)

  setPgnHeader(chess, 'Event', 'LLM Chess')
  setPgnHeader(chess, 'Site', 'LLM Chess')
  setPgnHeader(chess, 'Date', formatPgnDate(game.started.timestamp))
  setPgnHeader(chess, 'Round', '-')
  setPgnHeader(chess, 'White', formatPlayerLabel(game.started.players?.white, 'White'))
  setPgnHeader(chess, 'Black', formatPlayerLabel(game.started.players?.black, 'Black'))
  setPgnHeader(chess, 'Result', game.ended.result)
  setPgnHeader(chess, 'PlyCount', String(game.moves.length))
  setPgnHeader(chess, 'Termination', 'normal')

  for (const event of game.moves) {
    if (event.move.before !== chess.fen()) {
      throw new Error(`Move ${event.move.lan} does not match PGN export state`)
    }

    const descriptor = {
      from: event.move.from,
      to: event.move.to,
    }

    const move = chess.move(
      event.move.promotion === undefined
        ? descriptor
        : {
            ...descriptor,
            promotion: event.move.promotion,
          },
    )

    if (move.after !== event.move.after) {
      throw new Error(`Move ${event.move.lan} PGN export produced unexpected state`)
    }
  }

  if (game.ended.finalFen !== chess.fen()) {
    throw new Error('Game end event does not match PGN export state')
  }

  return chess.pgn({ maxWidth: pgnMaxWidth, newline: '\n' })
}

function setPgnHeader(chess: Chess, key: string, value: string): void {
  chess.setHeader(key, escapePgnTagValue(value))
}

function escapePgnTagValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll(/\s+/g, ' ').trim()
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

function formatPgnDate(timestamp: string): string {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return '????.??.??'
  }

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('.')
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
