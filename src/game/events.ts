import type { GameEndedEvent, GameEndReason, GameResult, GameStartedEvent, MoveEvent, MoveRecord } from './types.js'
import type { Color, Move } from 'chess.js'

import { Chess } from 'chess.js'

export function createGameStartedEvent(): GameStartedEvent {
  const chess = new Chess()

  return {
    initialFen: chess.fen(),
    timestamp: new Date().toISOString(),
    turn: chess.turn(),
    type: 'game_started',
  }
}

export function createMoveEvent(move: Move, options: { rationale: string }): MoveEvent {
  return {
    move: createMoveRecord(move),
    rationale: options.rationale,
    timestamp: new Date().toISOString(),
    type: 'move',
  }
}

export function createGameEndedEvent(chess: Chess, options: { ply: number }): GameEndedEvent {
  const winner = getWinner(chess)

  const event: GameEndedEvent = {
    finalFen: chess.fen(),
    ply: options.ply,
    reason: getGameEndReason(chess),
    result: getGameResult(winner),
    timestamp: new Date().toISOString(),
    type: 'game_ended',
  }

  if (winner !== undefined) {
    event.winner = winner
  }

  return event
}

function createMoveRecord(move: Move): MoveRecord {
  const record: MoveRecord = {
    after: move.after,
    before: move.before,
    color: move.color,
    from: move.from,
    lan: move.lan,
    piece: move.piece,
    san: move.san,
    to: move.to,
  }

  if (move.captured !== undefined) {
    record.captured = move.captured
  }

  if (move.promotion !== undefined) {
    record.promotion = move.promotion
  }

  return record
}

function getWinner(chess: Chess): Color | undefined {
  if (!chess.isCheckmate()) {
    return undefined
  }

  return chess.turn() === 'w' ? 'b' : 'w'
}

function getGameResult(winner: Color | undefined): GameResult {
  if (winner === 'w') {
    return '1-0'
  }

  if (winner === 'b') {
    return '0-1'
  }

  return '1/2-1/2'
}

function getGameEndReason(chess: Chess): GameEndReason {
  if (chess.isCheckmate()) {
    return 'checkmate'
  }

  if (chess.isStalemate()) {
    return 'stalemate'
  }

  if (chess.isThreefoldRepetition()) {
    return 'threefold_repetition'
  }

  if (chess.isInsufficientMaterial()) {
    return 'insufficient_material'
  }

  if (chess.isDrawByFiftyMoves()) {
    return 'fifty_move_rule'
  }

  return 'draw'
}
