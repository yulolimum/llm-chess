import type { EngineScore, GameEndReason, GameResult, MoveQuality, PlayerColor } from '../game/types.js'
import type { Chess, Color, PieceSymbol } from 'chess.js'

export type Board = ReturnType<Chess['board']>
export type BoardSquare = Board[number][number]
export type PlayerStatus = 'draw' | 'lost' | 'on-move' | 'won'

export type ChessBoardPlayer = {
  capturedPieces?: readonly CapturedPiece[]
  effort?: string
  model: string
  provider: string
  status?: PlayerStatus
  strategy?: string
}

export type MoveFeedEntry = {
  analysis?: MoveFeedAnalysis
  color?: Color
  duration?: string
  move?: string
  moveNumber?: number
  reason?: GameEndReason
  rationale?: string
  result?: GameResult
  text?: string
  type: 'game-ended' | 'game-started' | 'move'
  winner?: PlayerColor
}

export type MoveFeedAnalysis = {
  classification: MoveQuality
  eval: EngineScore
}

export type CapturedPiece = {
  color: Color
  type: PieceSymbol
}

export type ChessBoardProps = {
  blackPlayer?: ChessBoardPlayer
  board: Board
  moveFeed?: readonly MoveFeedEntry[]
  showMoveFeed?: boolean
  whitePlayer?: ChessBoardPlayer
}
