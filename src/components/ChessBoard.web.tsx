import type { EngineScore, MoveQuality } from '../game/types.js'
import type {
  BoardSquare,
  CapturedPiece,
  ChessBoardPlayer,
  ChessBoardProps,
  MoveFeedAnalysis,
  MoveFeedEntry,
  PlayerStatus,
} from './ChessBoard.types.js'
import type { Color, PieceSymbol } from 'chess.js'

import React from 'react'

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const ranks = [8, 7, 6, 5, 4, 3, 2, 1] as const
const pieceGlyphs = {
  b: { b: '♝', w: '♗' },
  k: { b: '♚', w: '♔' },
  n: { b: '♞', w: '♘' },
  p: { b: '♟', w: '♙' },
  q: { b: '♛', w: '♕' },
  r: { b: '♜', w: '♖' },
} as const satisfies Record<PieceSymbol, Record<Color, string>>
const pieceNames = {
  b: 'Bishop',
  k: 'King',
  n: 'Knight',
  p: 'Pawn',
  q: 'Queen',
  r: 'Rook',
} as const satisfies Record<PieceSymbol, string>
const statusDisplay = {
  draw: { className: 'badge-neutral', label: 'Draw' },
  lost: { className: 'badge-error', label: 'Lost' },
  'on-move': { className: 'badge-primary', label: 'On move' },
  won: { className: 'badge-success', label: 'Won' },
} as const satisfies Record<PlayerStatus, { className: string; label: string }>
const moveQualityDisplay = {
  best: { className: 'badge-success', label: 'Best' },
  blunder: { className: 'badge-error', label: 'Blunder' },
  excellent: { className: 'badge-accent', label: 'Excellent' },
  good: { className: 'badge-info', label: 'Good' },
  inaccuracy: { className: 'badge-warning', label: 'Inaccuracy' },
  mistake: { className: 'badge-secondary', label: 'Mistake' },
} as const satisfies Record<MoveQuality, { className: string; label: string }>

export function ChessBoard({ blackPlayer, board, moveFeed = [], showMoveFeed = true, whitePlayer }: ChessBoardProps) {
  const gameEnded = getGameEnded(moveFeed)

  return (
    <main
      className="bg-base-300 text-base-content flex h-full min-h-[1080px] w-full gap-12 overflow-hidden p-10 font-sans"
      data-theme="abyss">
      <section className="flex w-[800px] shrink-0 flex-col gap-4">
        <PlayerRail color="b" player={blackPlayer} />
        <div className="card bg-base-100 shadow-2xl">
          <div className="card-body items-center p-5">
            <div className="relative">
              <BoardRankLabels />
              <BoardFileLabels />
              <div
                aria-label="Chess board"
                className="rounded-box border-base-300 bg-base-300 grid aspect-square w-[690px] grid-cols-8 overflow-hidden border-[8px]">
                {board.map((rank, rankIndex) =>
                  rank.map((piece, fileIndex) => (
                    <SquareView
                      fileIndex={fileIndex}
                      key={`${rankIndex}-${fileIndex}`}
                      piece={piece}
                      rankIndex={rankIndex}
                    />
                  )),
                )}
              </div>
            </div>
          </div>
        </div>
        <PlayerRail color="w" player={whitePlayer} />
      </section>
      <aside className="flex min-w-0 flex-1 flex-col gap-4">
        {gameEnded === undefined ? null : (
          <GameResultBanner blackPlayer={blackPlayer} entry={gameEnded} whitePlayer={whitePlayer} />
        )}
        {showMoveFeed ? <MoveFeed entries={moveFeed} /> : null}
        <AttributionCard />
      </aside>
    </main>
  )
}

function GameResultBanner({
  blackPlayer,
  entry,
  whitePlayer,
}: {
  blackPlayer: ChessBoardPlayer | undefined
  entry: MoveFeedEntry
  whitePlayer: ChessBoardPlayer | undefined
}) {
  const winner = getWinnerLabel(entry, whitePlayer, blackPlayer)
  const reason = entry.reason === undefined ? undefined : formatGameEndReason(entry.reason)

  return (
    <section className="alert alert-success rounded-box shadow-xl">
      <div className="min-w-0">
        {reason === undefined ? null : <div className="text-lg font-bold uppercase opacity-70">{reason}</div>}
        <div className="mt-2 flex items-baseline gap-4">
          <span className="truncate text-[34px] leading-none font-bold">{winner}</span>
        </div>
      </div>
    </section>
  )
}

function PlayerRail({ color, player }: { color: Color; player: ChessBoardPlayer | undefined }) {
  if (player === undefined) {
    return <div className="min-h-24" />
  }

  const isWhite = color === 'w'

  return (
    <section
      className={cls(
        'card min-h-24 border-2 shadow-xl',
        getPlayerRailBorderClass(player.status),
        isWhite ? 'bg-base-200' : 'bg-base-100',
      )}>
      <div className="card-body px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase">
              <span className="opacity-65">{isWhite ? 'White' : 'Black'}</span>
              <span className="opacity-65">-</span>
              <span className="opacity-65">{player.provider}</span>
              {player.effort === undefined ? null : (
                <>
                  <span className="opacity-65">-</span>
                  <span className="opacity-65">{player.effort}</span>
                </>
              )}
              {player.status === undefined ? null : <StatusBadge status={player.status} />}
            </div>
            <div className="mt-1 truncate text-2xl leading-tight font-bold">{player.model}</div>
          </div>
          <div className="shrink-0 pt-1">
            <CapturedPieces pieces={player.capturedPieces ?? []} />
          </div>
        </div>
        {player.strategy === undefined || player.strategy.length === 0 ? null : (
          <div className="mt-1 truncate text-base font-semibold opacity-60">{player.strategy}</div>
        )}
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: PlayerStatus }) {
  const display = statusDisplay[status]

  return (
    <span className={cls('badge badge-sm rounded-full px-2 text-xs font-bold uppercase', display.className)}>
      {display.label}
    </span>
  )
}

function getPlayerRailBorderClass(status: PlayerStatus | undefined) {
  if (status === 'on-move') {
    return 'border-primary'
  }

  if (status === 'won') {
    return 'border-success'
  }

  if (status === 'lost') {
    return 'border-error'
  }

  return 'border-transparent'
}

function CapturedPieces({ pieces }: { pieces: readonly CapturedPiece[] }) {
  if (pieces.length === 0) {
    return <div className="min-w-[170px]" />
  }

  return (
    <div aria-label="Captured pieces" className="flex min-w-[170px] items-center justify-end gap-1">
      {pieces.map((piece, index) => (
        <span
          className={cls(
            'text-[32px] leading-none drop-shadow',
            piece.color === 'w' ? 'text-base-content' : 'text-neutral',
          )}
          key={`${piece.color}-${piece.type}-${index}`}
          title={pieceNames[piece.type]}>
          {pieceGlyphs[piece.type][piece.color]}
        </span>
      ))}
    </div>
  )
}

function BoardRankLabels() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-[8px] z-10">
      {ranks.map((rank, index) => (
        <span
          className="absolute left-[-23px] flex h-5 w-4 -translate-y-1/2 items-center justify-center text-[13px] font-bold tabular-nums opacity-55"
          key={rank}
          style={{ top: `${(index + 0.5) * 12.5}%` }}>
          {rank}
        </span>
      ))}
    </div>
  )
}

function BoardFileLabels() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-[8px] z-10">
      {files.map((file, index) => (
        <span
          className="absolute bottom-[-23px] flex h-4 w-5 -translate-x-1/2 items-center justify-center text-[13px] font-bold uppercase opacity-55"
          key={file}
          style={{ left: `${(index + 0.5) * 12.5}%` }}>
          {file}
        </span>
      ))}
    </div>
  )
}

function SquareView({ fileIndex, piece, rankIndex }: { fileIndex: number; piece: BoardSquare; rankIndex: number }) {
  const isLight = (rankIndex + fileIndex) % 2 === 0

  return (
    <div
      className={cls(
        'relative aspect-square',
        isLight ? 'bg-neutral text-neutral-content' : 'bg-base-300 text-base-content',
      )}>
      {piece === null ? null : (
        <span
          aria-label={`${piece.color === 'w' ? 'White' : 'Black'} ${pieceNames[piece.type]}`}
          className={cls(
            'absolute inset-0 flex translate-y-[-1px] items-center justify-center font-serif text-[76px] leading-none drop-shadow-lg',
            piece.color === 'w' ? 'text-base-content' : 'text-primary',
          )}>
          {pieceGlyphs[piece.type][piece.color]}
        </span>
      )}
    </div>
  )
}

function MoveFeed({ entries }: { entries: readonly MoveFeedEntry[] }) {
  const visibleEntries = entries.filter(entry => entry.type === 'move').reverse()

  if (visibleEntries.length === 0) {
    return null
  }

  return (
    <section className="card bg-base-100 min-h-0 flex-1 shadow-xl">
      <div className="card-body min-h-0 p-7">
        <div className="text-base font-bold uppercase opacity-60">Move feed</div>
        <div className="mt-5 flex min-h-0 flex-col gap-3 overflow-hidden">
          {visibleEntries.map((entry, index) => (
            <MoveFeedRow
              entry={entry}
              isCurrent={index === 0}
              key={`${entry.moveNumber ?? index}-${entry.color ?? 'event'}-${entry.move ?? index}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function AttributionCard() {
  return (
    <section className="card bg-base-200">
      <div className="card-body flex-row items-center justify-between px-7 py-4">
        <div className="text-base font-bold uppercase opacity-70">LLM Chess</div>
        <div className="text-primary text-base font-bold">@yulolimum</div>
      </div>
    </section>
  )
}

function MoveFeedRow({ entry, isCurrent }: { entry: MoveFeedEntry; isCurrent: boolean }) {
  return (
    <div className="rounded-box bg-base-200 px-4 py-3">
      <div className="flex items-center gap-3">
        <MoveColorBadge entry={entry} />
        <div className="shrink-0 truncate text-xl font-bold">{entry.move}</div>
        {entry.duration === undefined ? null : (
          <div className="shrink-0 text-base font-bold tabular-nums opacity-55">{entry.duration}</div>
        )}
        {isCurrent ? (
          <span className="badge badge-primary rounded-field h-auto shrink-0 px-2.5 py-1 text-xs font-bold uppercase">
            Latest move
          </span>
        ) : null}
        {entry.analysis === undefined ? null : <CompactAnalysis analysis={entry.analysis} />}
      </div>
      {entry.rationale === undefined ? null : (
        <div className="mt-2 text-base leading-tight font-medium opacity-70">{entry.rationale}</div>
      )}
    </div>
  )
}

function MoveColorBadge({ entry }: { entry: MoveFeedEntry }) {
  const isWhite = entry.color === 'w'
  const colorLabel = entry.color === 'w' ? 'White' : 'Black'

  return (
    <span
      className={cls(
        'badge rounded-field h-auto shrink-0 px-2.5 py-1 text-xs font-bold uppercase tabular-nums',
        isWhite ? 'border-white bg-white text-black' : 'border-black bg-black text-white',
      )}>
      {formatMovePrefix(entry)} {colorLabel}
    </span>
  )
}

function CompactAnalysis({ analysis }: { analysis: MoveFeedAnalysis }) {
  const display = moveQualityDisplay[analysis.classification]

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <span className="badge badge-neutral rounded-field h-auto px-2.5 py-1 text-sm font-bold tabular-nums">
        {formatEngineScore(analysis.eval)}
      </span>
      <span className={cls('badge rounded-field h-auto px-2.5 py-1 text-sm font-bold uppercase', display.className)}>
        {display.label}
      </span>
    </div>
  )
}

function getGameEnded(entries: readonly MoveFeedEntry[]) {
  return entries.findLast(entry => entry.type === 'game-ended')
}

function getWinnerLabel(
  entry: MoveFeedEntry,
  whitePlayer: ChessBoardPlayer | undefined,
  blackPlayer: ChessBoardPlayer | undefined,
) {
  if (entry.winner === 'w') {
    return `${whitePlayer?.model ?? 'White'} wins`
  }

  if (entry.winner === 'b') {
    return `${blackPlayer?.model ?? 'Black'} wins`
  }

  return 'Draw'
}

function formatGameEndReason(reason: NonNullable<MoveFeedEntry['reason']>) {
  return reason
    .split('_')
    .map(word => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function formatMovePrefix(entry: MoveFeedEntry) {
  if (entry.moveNumber === undefined || entry.color === undefined) {
    return ''
  }

  return entry.color === 'w' ? `${entry.moveNumber}.` : `${entry.moveNumber}...`
}

function formatEngineScore(score: EngineScore) {
  if (score.type === 'mate') {
    return score.value < 0 ? `-M${Math.abs(score.value)}` : `M${score.value}`
  }

  if (score.value === 0) {
    return '0.00'
  }

  const pawns = score.value / 100
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`
}

function cls(...classes: (false | null | string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
