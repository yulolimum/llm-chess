import type { Color, Move, PieceSymbol, Square } from 'chess.js'

export type PlayerColor = Color

export type MoveRecord = Pick<Move, 'after' | 'before' | 'color' | 'from' | 'lan' | 'san' | 'to'> & {
  captured?: PieceSymbol
  piece: PieceSymbol
  promotion?: PieceSymbol
}

export type GameStartedEvent = {
  initialFen: string
  players?: GameStartedPlayers
  timestamp: string
  turn: PlayerColor
  type: 'game_started'
}

export type GameStartedPlayer = {
  effort?: string
  model: string
  provider: string
  strategy: string
}

export type GameStartedPlayers = {
  black: GameStartedPlayer
  white: GameStartedPlayer
}

export type MoveEvent = {
  analysis?: MoveAnalysis
  move: MoveRecord
  rationale?: string
  timestamp: string
  type: 'move'
}

export type EngineScore =
  | {
      type: 'cp'
      value: number
    }
  | {
      type: 'mate'
      value: number
    }

export type EngineWdl = {
  draw: number
  loss: number
  win: number
}

export type MoveQuality = 'best' | 'blunder' | 'excellent' | 'good' | 'inaccuracy' | 'mistake'

export type MoveAnalysis = {
  bestMove: string
  classification: MoveQuality
  depth: number
  engine: 'stockfish'
  evalBest: EngineScore
  evalLoss?: number
  evalPlayed: EngineScore
  expectedPointsBest?: number
  expectedPointsLost?: number
  expectedPointsPlayed?: number
  playedMove: string
  pv?: string[]
  wdlBest?: EngineWdl
  wdlPlayed?: EngineWdl
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
