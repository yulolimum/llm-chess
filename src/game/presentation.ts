import type { CapturedPiece, ChessBoardPlayer, MoveFeedEntry, PlayerStatus } from '../components/ChessBoard.js'
import type { GameState } from './state.js'
import type { GameStartedPlayer, PlayerColor } from './types.js'
import type { PieceSymbol } from 'chess.js'

import prettyMilliseconds from 'pretty-ms'

import { getModelLabel, getProviderLabel } from './providers.js'

type CapturedPiecesByPlayer = {
  black: CapturedPiece[]
  white: CapturedPiece[]
}

const capturedPieceOrder: Record<PieceSymbol, number> = {
  b: 2,
  k: 5,
  n: 3,
  p: 4,
  q: 0,
  r: 1,
}

export function createBoardPlayers(state: GameState): {
  blackPlayer: ChessBoardPlayer
  whitePlayer: ChessBoardPlayer
} {
  const capturedPieces = collectCapturedPieces(state)

  return {
    blackPlayer: createChessBoardPlayer(state.started.players?.black, 'b', state, capturedPieces.black),
    whitePlayer: createChessBoardPlayer(state.started.players?.white, 'w', state, capturedPieces.white),
  }
}

export function createMoveFeed(state: GameState): MoveFeedEntry[] {
  const entries: MoveFeedEntry[] = [
    {
      text: 'Game started',
      type: 'game-started',
    },
  ]

  let ply = 0
  let previousTimestamp = state.started.timestamp

  for (const event of state.events) {
    if (event.type === 'move') {
      ply += 1
      const duration = formatDurationBetween(previousTimestamp, event.timestamp)
      const entry: MoveFeedEntry = {
        color: event.move.color,
        move: event.move.san,
        moveNumber: Math.ceil(ply / 2),
        type: 'move',
      }

      if (duration !== undefined) {
        entry.duration = duration
      }

      if (event.rationale !== undefined) {
        entry.rationale = event.rationale
      }

      entries.push(entry)
      previousTimestamp = event.timestamp
    }

    if (event.type === 'game_ended') {
      entries.push({
        text: `Game ended: ${event.result} by ${event.reason}`,
        type: 'game-ended',
      })
    }
  }

  return entries
}

export function collectCapturedPieces(state: GameState): CapturedPiecesByPlayer {
  const capturedPieces: CapturedPiecesByPlayer = {
    black: [],
    white: [],
  }

  for (const event of state.events) {
    if (event.type !== 'move' || event.move.captured === undefined) {
      continue
    }

    const capturedPiece = {
      color: event.move.color === 'w' ? 'b' : 'w',
      type: event.move.captured,
    } as const satisfies CapturedPiece

    if (event.move.color === 'w') {
      capturedPieces.white.push(capturedPiece)
    } else {
      capturedPieces.black.push(capturedPiece)
    }
  }

  capturedPieces.black.sort(compareCapturedPieces)
  capturedPieces.white.sort(compareCapturedPieces)

  return capturedPieces
}

export function createPlayerStatus(color: PlayerColor, state: GameState): PlayerStatus | undefined {
  if (state.chess.isGameOver()) {
    if (state.ended?.winner === color) {
      return 'won'
    }

    if (state.ended?.winner !== undefined) {
      return 'lost'
    }

    return 'draw'
  }

  return state.chess.turn() === color ? 'on-move' : undefined
}

function createChessBoardPlayer(
  player: GameStartedPlayer | undefined,
  color: PlayerColor,
  state: GameState,
  capturedPieces: readonly CapturedPiece[],
): ChessBoardPlayer {
  const provider = player === undefined ? colorToFallbackPlayerName(color) : getProviderLabel(player.provider)
  const model = player === undefined ? 'Unknown player' : getModelLabel(player.provider, player.model)
  const status = createPlayerStatus(color, state)
  const displayPlayer = {
    capturedPieces,
    model,
    provider,
  }

  if (status === undefined) {
    return displayPlayer
  }

  return {
    ...displayPlayer,
    status,
  }
}

function compareCapturedPieces(a: CapturedPiece, b: CapturedPiece): number {
  return capturedPieceOrder[a.type] - capturedPieceOrder[b.type]
}

function formatDurationBetween(startTimestamp: string, endTimestamp: string): string | undefined {
  const duration = Date.parse(endTimestamp) - Date.parse(startTimestamp)

  if (!Number.isFinite(duration) || duration < 0) {
    return undefined
  }

  return prettyMilliseconds(duration, { compact: true })
}

function colorToFallbackPlayerName(color: PlayerColor): string {
  return color === 'w' ? 'White' : 'Black'
}
