import type { GameState } from './state.js'
import type { Chess } from 'chess.js'

import { colorToPlayerName } from './players.js'

export function formatGameState(state: GameState): string {
  return [
    `Turn: ${colorToPlayerName(state.chess.turn())}`,
    `FEN: ${state.chess.fen()}`,
    '',
    state.chess.ascii(),
    '',
    `Legal moves: ${state.chess.moves().join(', ')}`,
    formatGameStatus(state.chess),
  ]
    .filter(Boolean)
    .join('\n')
}

export function formatGameStatus(chess: Chess): string {
  if (chess.isCheckmate()) {
    return 'Status: checkmate'
  }

  if (chess.isDraw()) {
    return 'Status: draw'
  }

  if (chess.isCheck()) {
    return 'Status: check'
  }

  return 'Status: active'
}
