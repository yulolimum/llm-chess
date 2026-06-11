import type { GameStartedEvent } from './types.js'

import { Chess } from 'chess.js'

export function createGameStartedEvent(): GameStartedEvent {
  const chess = new Chess()

  return {
    initialFen: chess.fen(),
    timestamp: new Date().toISOString(),
    turn: 'white',
    type: 'game_started',
  }
}
