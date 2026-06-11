import type { GameEndedEvent, GameEvent, GameStartedEvent, MoveEvent } from './types.js'
import type { Chess } from 'chess.js'

import { Chess as ChessInstance } from 'chess.js'

import { readGameEvents } from './files.js'

export type GameState = {
  chess: Chess
  ended: GameEndedEvent | null
  events: GameEvent[]
  lastMove: MoveEvent | null
  started: GameStartedEvent
}

export async function readGameState(gameGuid: string): Promise<GameState> {
  return replayGameEvents(await readGameEvents(gameGuid))
}

export function replayGameEvents(events: GameEvent[]): GameState {
  const started = events.find((event): event is GameStartedEvent => event.type === 'game_started')

  if (started === undefined) {
    throw new Error('Game record does not contain a game_started event')
  }

  const chess = new ChessInstance(started.initialFen)
  let ended: GameEndedEvent | null = null
  let lastMove: MoveEvent | null = null

  for (const event of events) {
    if (event.type === 'game_started') {
      continue
    }

    if (event.type === 'game_ended') {
      if (event.finalFen !== chess.fen()) {
        throw new Error(`Game end event does not match replay state`)
      }

      ended = event
      continue
    }

    if (event.move.before !== chess.fen()) {
      throw new Error(`Move ${event.move.lan} does not match replay state`)
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
      throw new Error(`Move ${event.move.lan} replay produced unexpected state`)
    }

    lastMove = event
  }

  return {
    chess,
    ended,
    events,
    lastMove,
    started,
  }
}
