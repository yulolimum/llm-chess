import type { PlayerName } from '../game/players.js'
import type { EffortLevel, PlayerConfig, Provider, ProviderOption } from '../game/providers.js'

import input from '@inquirer/input'
import select from '@inquirer/select'
import { render } from 'ink'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import React from 'react'
import { $, fs, minimist, nothrow, quiet, quote } from 'zx'

import { ChessBoard } from '../components/ChessBoard.js'
import { createGameStartedEvent } from '../game/events.js'
import { appendGameEvent, ensureGamesDirectory, getGameJsonlPath, getGameLogPath } from '../game/files.js'
import { colorToPlayerName } from '../game/players.js'
import { createBoardPlayers, createMoveFeed } from '../game/presentation.js'
import {
  getEffortOptions,
  getModelOption,
  getProviderLabel,
  isEffortLevel,
  isProvider,
  modelOptionsByProvider,
  providerCommandByProvider,
  providerOptions,
} from '../game/providers.js'
import { readGameState } from '../game/state.js'
import { createLogger, setSessionLogFile } from '../utils/create-logger.js'
import { renderPlayerPrompt } from '../utils/player-prompt.js'
import { createGameGuid } from '../utils/strings.js'
import {
  getSupervisorPlayerSessionName,
  renderSupervisorInstruction,
  sendSupervisorInstruction,
  type SupervisorPlayerSession,
} from '../utils/supervisor-instruct.js'

//
// Constants
//
const scriptName = 'game-start'
const scriptCommand = 'pnpm game:start'
const sessionPrefix = 'llm-chess'
const turnInstructionRetryMs = 120_000
type InstalledProviders = Record<Provider, boolean>
type PlayerSessions = Record<PlayerName, SupervisorPlayerSession>
type TurnInstructionState = {
  lastInstructionAt: number | null
  moveCount: number | null
  player: PlayerName | null
  stalledInstructionCount: number
}

//
// Arguments
//
const args = minimist(process.argv.slice(2), {
  alias: { h: 'help' },
  boolean: ['help'],
  string: [
    'blackEffort',
    'blackModel',
    'blackProvider',
    'blackStrategy',
    'whiteEffort',
    'whiteModel',
    'whiteProvider',
    'whiteStrategy',
  ],
})

const parsedArgs = {
  blackEffort: readStringArg(args['blackEffort']),
  blackModel: readStringArg(args['blackModel']),
  blackProvider: parseProvider(args['blackProvider']),
  blackStrategy: readStringArg(args['blackStrategy']),
  help: Boolean(args['help']),
  whiteEffort: readStringArg(args['whiteEffort']),
  whiteModel: readStringArg(args['whiteModel']),
  whiteProvider: parseProvider(args['whiteProvider']),
  whiteStrategy: readStringArg(args['whiteStrategy']),
}

type ArgNames = keyof typeof parsedArgs
type Args = { [K in ArgNames]: NonNullable<(typeof parsedArgs)[K]> }
type PlayerConfigFields = {
  effort: 'blackEffort' | 'whiteEffort'
  model: 'blackModel' | 'whiteModel'
  provider: 'blackProvider' | 'whiteProvider'
  strategy: 'blackStrategy' | 'whiteStrategy'
}

const accumulatedArgs: Partial<Args> = {
  help: parsedArgs.help,
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
  --whiteEffort <effort>       Effort for white when supported by the selected model
  --whiteStrategy <text>       Optional strategy guidance for white
  --blackProvider <provider>   Provider for black: claude, codex
  --blackModel <model>         Model for black
  --blackEffort <effort>       Effort for black when supported by the selected model
  --blackStrategy <text>       Optional strategy guidance for black
  --help, -h          Show help.
`)
  process.exit(0)
}

await assertTmuxInstalled()
await assertStockfishInstalled()
const installedProviders = await detectInstalledProviders()
assertAnyProviderInstalled(installedProviders)

const whitePlayer = await selectPlayerConfig(
  'White',
  {
    effort: 'whiteEffort',
    model: 'whiteModel',
    provider: 'whiteProvider',
    strategy: 'whiteStrategy',
  },
  {
    effort: parsedArgs.whiteEffort,
    model: parsedArgs.whiteModel,
    provider: parsedArgs.whiteProvider,
    strategy: parsedArgs.whiteStrategy,
  },
)
const blackPlayer = await selectPlayerConfig(
  'Black',
  {
    effort: 'blackEffort',
    model: 'blackModel',
    provider: 'blackProvider',
    strategy: 'blackStrategy',
  },
  {
    effort: parsedArgs.blackEffort,
    model: parsedArgs.blackModel,
    provider: parsedArgs.blackProvider,
    strategy: parsedArgs.blackStrategy,
  },
)

const cwd = process.cwd()
const gameGuid = createGameGuid({
  black: blackPlayer,
  white: whitePlayer,
})
const gameStartedEvent = createGameStartedEvent({
  players: {
    black: createStartedPlayer(blackPlayer),
    white: createStartedPlayer(whitePlayer),
  },
})

await ensureGamesDirectory()
setSessionLogFile(getGameLogPath(gameGuid))

const logger = createLogger({
  prefix: '[game:start]',
})

logger.debug('parsed args:', parsedArgs)
logger.debug('selected players:', { black: blackPlayer, white: whitePlayer })
logger.debug('paths:', {
  gameJsonlPath: getGameJsonlPath(gameGuid),
  gameLogPath: getGameLogPath(gameGuid),
})

await appendGameEvent(gameGuid, gameStartedEvent)
logger.debug('appended game started event:', gameStartedEvent)
const initialWhiteInstruction =
  gameStartedEvent.turn === 'w'
    ? await renderSupervisorInstruction({
        gameGuid,
        player: 'white',
        reason: 'turn',
      })
    : undefined
const promptA = await renderPlayerPrompt({
  ...(initialWhiteInstruction === undefined ? {} : { appendInitialInstruction: initialWhiteInstruction }),
  color: 'w',
  gameGuid,
  initialFen: gameStartedEvent.initialFen,
  initialTurn: gameStartedEvent.turn,
  strategy: whitePlayer.strategy,
})
const promptB = await renderPlayerPrompt({
  color: 'b',
  gameGuid,
  initialFen: gameStartedEvent.initialFen,
  initialTurn: gameStartedEvent.turn,
  strategy: blackPlayer.strategy,
})

const whiteCommand = createProviderCommand(whitePlayer, cwd)
const blackCommand = createProviderCommand(blackPlayer, cwd)
const whiteSession = getSupervisorPlayerSessionName(gameGuid, 'white')
const blackSession = getSupervisorPlayerSessionName(gameGuid, 'black')
const whiteActor = `cd ${quote(cwd)} && ${whiteCommand} ${quote(promptA)}`
const blackActor = `cd ${quote(cwd)} && ${blackCommand} ${quote(promptB)}`
const playerSessions: PlayerSessions = {
  black: {
    provider: blackPlayer.provider,
    session: blackSession,
  },
  white: {
    provider: whitePlayer.provider,
    session: whiteSession,
  },
}
const createdSessions: string[] = []
const repeatGameCommand = createRepeatGameCommand()

let cleanupPromise: Promise<void> | null = null
let gameCompleted = false

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

  await streamBoardState(gameGuid, playerSessions)
  gameCompleted = true
} finally {
  await cleanupPlayerSessions(createdSessions)
}

if (gameCompleted) {
  print('')
  print('Re-run this game with:')
  print(repeatGameCommand)
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

async function assertStockfishInstalled(): Promise<void> {
  const result = await quiet(nothrow($`command -v stockfish`))

  if (result.exitCode !== 0) {
    print('Stockfish is required to start a game.')
    print('Install it with: brew install stockfish')
    process.exit(1)
  }
}

async function detectInstalledProviders(): Promise<InstalledProviders> {
  const detectedProviders = {} as InstalledProviders

  for (const provider of providerOptions) {
    const result = await quiet(nothrow($`command -v ${providerCommandByProvider[provider.value]}`))
    detectedProviders[provider.value] = result.exitCode === 0
  }

  return detectedProviders
}

function assertAnyProviderInstalled(detectedProviders: InstalledProviders): void {
  if (providerOptions.some(provider => detectedProviders[provider.value])) {
    return
  }

  print('At least one LLM provider CLI is required to start a game.')
  print('Install Claude Code or Codex, then run the command again.')
  process.exit(1)
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
  fields: PlayerConfigFields,
  defaults: {
    effort: string | undefined
    model: string | undefined
    provider: Provider | undefined
    strategy: string | undefined
  },
): Promise<PlayerConfig> {
  const availableProviderOptions = getAvailableProviderOptions()
  const provider =
    defaults.provider ??
    (await select<Provider>({
      choices: availableProviderOptions.map(provider => ({ name: provider.label, value: provider.value })),
      default: readCachedProvider(fields.provider) ?? availableProviderOptions[0]?.value,
      message: `${label} provider?`,
    }))

  validateProviderInstalled(provider)
  recordArg(fields.provider, provider)
  cache.args[fields.provider] = provider
  await writeCache(cache)

  const model = defaults.model ?? (await selectModel(label, provider, readCachedModel(fields.model, provider)))

  validateModel(provider, model)

  recordArg(fields.model, model)
  cache.args[fields.model] = model
  await writeCache(cache)

  const effort =
    defaults.effort ?? (await selectEffort(label, provider, model, readCachedEffort(fields.effort, provider, model)))

  validateEffort(provider, model, effort)
  recordArg(fields.effort, effort)

  if (effort === undefined) {
    delete cache.args[fields.effort]
  } else {
    cache.args[fields.effort] = effort
  }

  await writeCache(cache)

  const strategy = defaults.strategy ?? (await selectStrategy(label, readCachedStrategy(fields.strategy)))

  recordArg(fields.strategy, strategy)

  if (strategy === undefined) {
    delete cache.args[fields.strategy]
  } else {
    cache.args[fields.strategy] = strategy
  }

  await writeCache(cache)

  return {
    effort,
    model,
    provider,
    strategy,
  }
}

async function selectModel(
  providerLabel: string,
  provider: Provider,
  defaultModel: string | undefined,
): Promise<string> {
  const models = modelOptionsByProvider[provider]

  return select<string>({
    choices: models.map(model => ({ name: model.label, value: model.value })),
    default: defaultModel ?? models[0]?.value,
    message: `${providerLabel} model?`,
  })
}

async function selectEffort(
  label: string,
  provider: Provider,
  model: string,
  defaultEffort: EffortLevel | undefined,
): Promise<EffortLevel | undefined> {
  const efforts = getEffortOptions(provider, model)

  if (efforts.length === 0) {
    return undefined
  }

  const modelOption = getModelOption(provider, model)

  return select<EffortLevel>({
    choices: efforts.map(effort => ({ name: effort.label, value: effort.value })),
    default: defaultEffort ?? modelOption?.defaultEffort ?? efforts[0]?.value,
    message: `${label} effort?`,
  })
}

async function selectStrategy(label: string, defaultStrategy: string | undefined): Promise<string | undefined> {
  const strategy = await input({
    default: defaultStrategy ?? '',
    message: `${label} strategy?`,
  })

  return strategy.trim() === '' ? undefined : strategy
}

function createProviderCommand(player: PlayerConfig, cwd: string): string {
  if (player.provider === 'codex') {
    return [
      'codex',
      `--cd ${quote(cwd)}`,
      `--model ${quote(player.model)}`,
      ...(player.effort === undefined ? [] : [`-c ${quote(`model_reasoning_effort="${player.effort}"`)}`]),
      '--sandbox danger-full-access',
      '--ask-for-approval never',
    ].join(' ')
  }

  return [
    'claude',
    `--model ${quote(player.model)}`,
    ...(player.effort === undefined ? [] : [`--effort ${quote(player.effort)}`]),
    '--permission-mode bypassPermissions',
  ].join(' ')
}

function createStartedPlayer(player: PlayerConfig) {
  const startedPlayer = {
    model: player.model,
    provider: player.provider,
    strategy: player.strategy ?? '',
  }

  if (player.effort === undefined) {
    return startedPlayer
  }

  return {
    ...startedPlayer,
    effort: player.effort,
  }
}

async function streamBoardState(gameGuid: string, playerSessions: PlayerSessions): Promise<void> {
  let consumedLines = 0
  let boardRender: ReturnType<typeof render> | null = null
  const turnInstructionState: TurnInstructionState = {
    lastInstructionAt: Date.now(),
    moveCount: 0,
    player: 'white',
    stalledInstructionCount: 0,
  }

  while (true) {
    const raw = await readFile(getGameJsonlPath(gameGuid), 'utf8')
    const lines = raw.split('\n').filter(Boolean)
    const nextLines = lines.slice(consumedLines)
    const state = await readGameState(gameGuid)

    if (nextLines.length > 0) {
      const boardPlayers = createBoardPlayers(state)
      const board = React.createElement(ChessBoard, {
        blackPlayer: boardPlayers.blackPlayer,
        board: state.chess.board(),
        moveFeed: createMoveFeed(state),
        whitePlayer: boardPlayers.whitePlayer,
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

    await dispatchTurnInstruction({
      gameGuid,
      playerSessions,
      state,
      turnInstructionState,
    })

    consumedLines = lines.length

    await setTimeout(500)
  }
}

async function dispatchTurnInstruction(options: {
  gameGuid: string
  playerSessions: PlayerSessions
  state: Awaited<ReturnType<typeof readGameState>>
  turnInstructionState: TurnInstructionState
}): Promise<void> {
  if (options.state.chess.isGameOver()) {
    return
  }

  const now = Date.now()
  const player = colorToPlayerName(options.state.chess.turn())
  const moveCount = options.state.events.filter(event => event.type === 'move').length
  const turnChanged = options.turnInstructionState.player !== player
  const moveChanged = options.turnInstructionState.moveCount !== moveCount

  if (turnChanged || moveChanged) {
    options.turnInstructionState.player = player
    options.turnInstructionState.moveCount = moveCount
    options.turnInstructionState.lastInstructionAt = now
    options.turnInstructionState.stalledInstructionCount = 0
    await sendSupervisorInstruction({
      gameGuid: options.gameGuid,
      logger,
      player,
      reason: 'turn',
      session: options.playerSessions[player],
    })
    return
  }

  if (
    options.turnInstructionState.lastInstructionAt === null ||
    now - options.turnInstructionState.lastInstructionAt < turnInstructionRetryMs
  ) {
    return
  }

  options.turnInstructionState.lastInstructionAt = now
  options.turnInstructionState.stalledInstructionCount += 1

  await sendSupervisorInstruction({
    gameGuid: options.gameGuid,
    logger,
    player,
    reason: 'stalled',
    session: options.playerSessions[player],
  })
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
function getAvailableProviderOptions(): ProviderOption[] {
  return providerOptions.filter(provider => installedProviders[provider.value])
}

function validateProviderInstalled(provider: Provider): void {
  if (installedProviders[provider]) {
    return
  }

  print(
    `${getProviderLabel(provider)} is not available because the "${providerCommandByProvider[provider]}" CLI was not found.`,
  )
  print(`Install ${getProviderLabel(provider)} or choose another provider.`)
  process.exit(1)
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

function validateEffort(
  provider: Provider,
  model: string,
  effort: string | undefined,
): asserts effort is EffortLevel | undefined {
  if (effort === undefined) {
    return
  }

  const efforts = getEffortOptions(provider, model)

  if (efforts.some(option => option.value === effort)) {
    return
  }

  const modelLabel = getModelOption(provider, model)?.label ?? model

  if (efforts.length === 0) {
    print(`${modelLabel} does not support effort selection.`)
  } else {
    print(`Unknown ${provider} effort "${effort}" for ${modelLabel}.`)
    print(`Expected one of: ${efforts.map(option => option.value).join(', ')}`)
  }

  process.exit(1)
}

function createRepeatGameCommand(): string {
  return Object.entries(accumulatedArgs).reduce((command, [name, value]) => {
    if (value === undefined || value === false || name === 'help') {
      return command
    }

    if (typeof value === 'boolean') {
      return `${command} --${name}`
    }

    return `${command} --${name} ${quote(value)}`
  }, scriptCommand)
}

function readCachedProvider(name: 'blackProvider' | 'whiteProvider'): Provider | undefined {
  const value = cache.args[name]

  return typeof value === 'string' && isProvider(value) ? value : undefined
}

function readCachedModel(name: 'blackModel' | 'whiteModel', provider: Provider): string | undefined {
  const value = cache.args[name]

  if (typeof value !== 'string') {
    return undefined
  }

  return modelOptionsByProvider[provider].some(option => option.value === value) ? value : undefined
}

function readCachedEffort(
  name: 'blackEffort' | 'whiteEffort',
  provider: Provider,
  model: string,
): EffortLevel | undefined {
  const value = cache.args[name]

  if (typeof value !== 'string') {
    return undefined
  }

  if (!isEffortLevel(value)) {
    return undefined
  }

  return getEffortOptions(provider, model).some(option => option.value === value) ? value : undefined
}

function readCachedStrategy(name: 'blackStrategy' | 'whiteStrategy'): string | undefined {
  const value = cache.args[name]

  return typeof value === 'string' ? value : undefined
}

function recordArg(name: 'blackProvider' | 'whiteProvider', value: Provider): void
function recordArg(
  name: 'blackEffort' | 'blackModel' | 'blackStrategy' | 'whiteEffort' | 'whiteModel' | 'whiteStrategy',
  value: string | undefined,
): void
function recordArg(name: ArgNames, value: boolean | string | undefined): void {
  if (value === undefined || value === false) {
    return
  }

  ;(accumulatedArgs as Record<string, unknown>)[name] = value
}
