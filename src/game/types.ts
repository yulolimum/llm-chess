import type { Color, Move, PieceSymbol, Square } from 'chess.js'

export type PlayerColor = Color

export type MoveRecord = Pick<Move, 'after' | 'before' | 'color' | 'from' | 'lan' | 'san' | 'to'> & {
  captured?: PieceSymbol
  piece: PieceSymbol
  promotion?: PieceSymbol
}

export type GameStartedEvent = {
  initialFen: string
  timestamp: string
  turn: PlayerColor
  type: 'game_started'
}

export type MoveEvent = {
  move: MoveRecord
  rationale?: string
  timestamp: string
  type: 'move'
}

export type GameResult = '0-1' | '1-0' | '1/2-1/2'

export type GameEndReason =
  | 'checkmate'
  | 'draw'
  | 'fifty_move_rule'
  | 'insufficient_material'
  | 'stalemate'
  | 'threefold_repetition'

export type GameEndedEvent = {
  finalFen: string
  ply: number
  reason: GameEndReason
  result: GameResult
  timestamp: string
  type: 'game_ended'
  winner?: PlayerColor
}

export type GameEvent = GameEndedEvent | GameStartedEvent | MoveEvent

export type MoveDescriptor = {
  from: Square
  promotion?: PieceSymbol
  to: Square
}
