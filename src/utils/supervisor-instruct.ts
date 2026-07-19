import type { PlayerName } from '../game/players.js'
import type { Provider } from '../game/providers.js'
import type { Logger } from './create-logger.js'

import { setTimeout } from 'node:timers/promises'
import { $, nothrow, quiet } from 'zx'

import { formatGameState } from '../game/format.js'
import { colorToPlayerName } from '../game/players.js'
import { isProvider } from '../game/providers.js'
import { readGameState } from '../game/state.js'
import { renderTemplateFile } from './templates.js'

export const supervisorInstructCommand = 'pnpm supervisor:instruct'

export type SupervisorPlayerSession = {
  provider: Provider | undefined
  session: string
}

export type SupervisorInstructionReason = 'stalled' | 'turn'

export function getSupervisorPlayerSessionName(gameGuid: string, player: PlayerName): string {
  return `llm-chess-${gameGuid}-${player}`
}

export async function renderSupervisorInstruction(options: {
  gameGuid: string
  player: PlayerName
  reason: SupervisorInstructionReason
}): Promise<string> {
  const state = await readGameState(options.gameGuid)
  const activePlayer = colorToPlayerName(state.chess.turn())

  if (state.chess.isGameOver()) {
    throw new Error(`Game is complete; no supervisor instruction is needed.`)
  }

  if (activePlayer !== options.player) {
    throw new Error(`Cannot instruct ${options.player}; it is ${activePlayer}'s turn.`)
  }

  const previousMove =
    state.lastMove === null
      ? 'Previous move: none.'
      : `Previous move: ${colorToPlayerName(state.lastMove.move.color)} ${state.lastMove.move.san}.`
  const previousRationale =
    state.lastMove?.rationale === undefined ? '' : `Previous rationale: ${state.lastMove.rationale}`
  const reason =
    options.reason === 'stalled' ? 'The previous instruction has not produced a move yet. Continue now.' : ''

  return renderTemplateFile(new URL('../prompts/supervisor-instruct.md', import.meta.url), {
    gameState: formatGameState(state),
    gameGuid: options.gameGuid,
    moveCommand: `pnpm agent:move --game ${options.gameGuid} --player ${options.player} --move "<move>" --rationale "<public rationale>"`,
    player: options.player,
    previousMove,
    previousRationale,
    reason,
  })
}

export async function sendSupervisorInstruction(options: {
  gameGuid: string
  logger?: Logger
  player: PlayerName
  reason: SupervisorInstructionReason
  session: SupervisorPlayerSession
}): Promise<boolean> {
  const prompt = await renderSupervisorInstruction({
    gameGuid: options.gameGuid,
    player: options.player,
    reason: options.reason,
  })

  const sent = await sendPromptToPlayerSession({
    bufferName: `llm-chess-${options.gameGuid}-${options.player}-instruction`,
    logger: options.logger,
    logLabel: 'supervisor instruction',
    player: options.player,
    prompt,
    session: options.session,
  })

  if (sent) {
    options.logger?.info('sent supervisor instruction', {
      player: options.player,
      provider: options.session.provider,
      reason: options.reason,
      session: options.session.session,
    })
    return true
  }

  return false
}

export async function sendPromptToPlayerSession(options: {
  bufferName: string
  logger: Logger | undefined
  logLabel: string
  player: PlayerName
  prompt: string
  session: SupervisorPlayerSession
}): Promise<boolean> {
  await quiet(nothrow($`tmux send-keys -t ${options.session.session} C-u`))
  const setBufferResult = await quiet(nothrow($`tmux set-buffer -b ${options.bufferName} ${options.prompt}`))

  if (setBufferResult.exitCode !== 0) {
    options.logger?.warn(`failed to stage ${options.logLabel}`, {
      exitCode: setBufferResult.exitCode,
      player: options.player,
      provider: options.session.provider,
      session: options.session.session,
      stderr: setBufferResult.stderr,
      stdout: setBufferResult.stdout,
    })
    return false
  }

  const pasteResult = await quiet(
    nothrow($`tmux paste-buffer -d -b ${options.bufferName} -t ${options.session.session}`),
  )

  if (pasteResult.exitCode !== 0) {
    options.logger?.warn(`failed to send ${options.logLabel}`, {
      exitCode: pasteResult.exitCode,
      player: options.player,
      provider: options.session.provider,
      session: options.session.session,
      stderr: pasteResult.stderr,
      stdout: pasteResult.stdout,
    })
    return false
  }

  const submitResult = await quiet(nothrow($`tmux send-keys -t ${options.session.session} C-m`))

  if (submitResult.exitCode === 0 && options.session.provider === 'codex') {
    await setTimeout(250)
    await quiet(nothrow($`tmux send-keys -t ${options.session.session} C-m`))
  }

  return submitResult.exitCode === 0
}

export function readStartedProvider(value: string | undefined): Provider | undefined {
  return value !== undefined && isProvider(value) ? value : undefined
}
