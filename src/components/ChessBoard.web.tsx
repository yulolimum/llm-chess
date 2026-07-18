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
import type { CSSProperties } from 'react'

import React from 'react'

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
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
  draw: { background: '#7c8091', label: 'Draw' },
  lost: { background: '#d94a64', label: 'Lost' },
  'on-move': { background: '#2fb4a9', label: 'On move' },
  won: { background: '#76c56f', label: 'Won' },
} as const satisfies Record<PlayerStatus, { background: string; label: string }>
const moveQualityDisplay = {
  best: { background: '#7ee787', color: '#101820', label: 'Best' },
  blunder: { background: '#ff4d6d', color: '#ffffff', label: 'Blunder' },
  excellent: { background: '#35d0ba', color: '#071b1b', label: 'Excellent' },
  good: { background: '#b7d66b', color: '#18210a', label: 'Good' },
  inaccuracy: { background: '#ffd166', color: '#2b2108', label: 'Inaccuracy' },
  mistake: { background: '#f28f3b', color: '#211306', label: 'Mistake' },
} as const satisfies Record<MoveQuality, { background: string; color: string; label: string }>

export function ChessBoard({ blackPlayer, board, moveFeed = [], showMoveFeed = true, whitePlayer }: ChessBoardProps) {
  const gameEnded = getGameEnded(moveFeed)
  const latestMove = getLatestMove(moveFeed)

  return (
    <main style={styles.shell}>
      <section style={styles.boardColumn}>
        <PlayerRail color="b" player={blackPlayer} />
        <div style={styles.boardWrap}>
          <div style={styles.boardGlow} />
          <div aria-label="Chess board" style={styles.board}>
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
        <PlayerRail color="w" player={whitePlayer} />
      </section>
      <aside style={styles.feedColumn}>
        <div style={styles.matchHeader}>
          <div style={styles.eyebrow}>LLM Chess</div>
          <div style={styles.title}>Model Arena</div>
        </div>
        {gameEnded === undefined ? null : (
          <GameResultBanner blackPlayer={blackPlayer} entry={gameEnded} whitePlayer={whitePlayer} />
        )}
        <CurrentMove entry={latestMove} />
        {showMoveFeed ? <MoveFeed entries={moveFeed} /> : null}
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
    <section style={styles.resultBanner}>
      <div style={styles.resultLabel}>Final result</div>
      <div style={styles.resultMain}>
        <span style={styles.resultWinner}>{winner}</span>
        {entry.result === undefined ? null : <span style={styles.resultScore}>{entry.result}</span>}
      </div>
      {reason === undefined ? null : <div style={styles.resultReason}>{reason}</div>}
    </section>
  )
}

function PlayerRail({ color, player }: { color: Color; player: ChessBoardPlayer | undefined }) {
  if (player === undefined) {
    return <div style={styles.playerRailEmpty} />
  }

  const isWhite = color === 'w'
  const secondaryTextStyle = isWhite ? styles.playerTextDark : styles.playerTextLight

  return (
    <div style={{ ...styles.playerRail, ...(isWhite ? styles.whiteRail : styles.blackRail) }}>
      <div style={styles.playerMain}>
        <div style={{ ...styles.playerColor, ...secondaryTextStyle }}>{isWhite ? 'White' : 'Black'}</div>
        <div style={styles.playerModel}>{player.model}</div>
        <div style={{ ...styles.playerMeta, ...secondaryTextStyle }}>
          <span>{player.provider}</span>
          {player.effort === undefined ? null : <span>{player.effort}</span>}
          {player.status === undefined ? null : <StatusBadge status={player.status} />}
        </div>
      </div>
      <CapturedPieces pieces={player.capturedPieces ?? []} />
    </div>
  )
}

function StatusBadge({ status }: { status: PlayerStatus }) {
  const display = statusDisplay[status]

  return <span style={{ ...styles.statusBadge, background: display.background }}>{display.label}</span>
}

function CapturedPieces({ pieces }: { pieces: readonly CapturedPiece[] }) {
  if (pieces.length === 0) {
    return <div style={styles.capturedEmpty}>No captures</div>
  }

  return (
    <div aria-label="Captured pieces" style={styles.capturedPieces}>
      {pieces.map((piece, index) => (
        <span key={`${piece.color}-${piece.type}-${index}`} style={styles.capturedPiece} title={pieceNames[piece.type]}>
          {pieceGlyphs[piece.type][piece.color]}
        </span>
      ))}
    </div>
  )
}

function SquareView({ fileIndex, piece, rankIndex }: { fileIndex: number; piece: BoardSquare; rankIndex: number }) {
  const isLight = (rankIndex + fileIndex) % 2 === 0
  const rank = 8 - rankIndex
  const file = files[fileIndex]

  return (
    <div style={{ ...styles.square, ...(isLight ? styles.lightSquare : styles.darkSquare) }}>
      {fileIndex === 0 ? <span style={styles.rankLabel}>{rank}</span> : null}
      {rankIndex === 7 ? <span style={styles.fileLabel}>{file}</span> : null}
      {piece === null ? null : (
        <span
          aria-label={`${piece.color === 'w' ? 'White' : 'Black'} ${pieceNames[piece.type]}`}
          style={{ ...styles.piece, ...(piece.color === 'w' ? styles.whitePiece : styles.blackPiece) }}>
          {pieceGlyphs[piece.type][piece.color]}
        </span>
      )}
    </div>
  )
}

function CurrentMove({ entry }: { entry: MoveFeedEntry | undefined }) {
  if (entry === undefined || entry.type !== 'move') {
    return (
      <section style={styles.currentMove}>
        <div style={styles.panelLabel}>Current move</div>
        <div style={styles.emptyMove}>Waiting for the first move</div>
      </section>
    )
  }

  return (
    <section style={styles.currentMove}>
      <div style={styles.panelLabel}>Current move</div>
      <div style={styles.currentMoveTopline}>
        <span style={styles.moveNumber}>{formatMovePrefix(entry)}</span>
        <span style={styles.moveSan}>{entry.move}</span>
        {entry.duration === undefined ? null : <span style={styles.duration}>{entry.duration}</span>}
      </div>
      {entry.analysis === undefined ? null : <MoveAnalysisBadge analysis={entry.analysis} />}
      {entry.rationale === undefined ? null : <p style={styles.rationale}>{entry.rationale}</p>}
    </section>
  )
}

function MoveFeed({ entries }: { entries: readonly MoveFeedEntry[] }) {
  const hasResultBanner = getGameEnded(entries) !== undefined
  const visibleEntries = entries.filter(entry => entry.type === 'move').slice(hasResultBanner ? -4 : -5)

  if (visibleEntries.length === 0) {
    return null
  }

  return (
    <section style={styles.moveFeed}>
      <div style={styles.panelLabel}>Move feed</div>
      <div style={styles.moveList}>
        {visibleEntries.map((entry, index) => (
          <MoveFeedRow
            entry={entry}
            key={`${entry.moveNumber ?? index}-${entry.color ?? 'event'}-${entry.move ?? index}`}
          />
        ))}
      </div>
    </section>
  )
}

function MoveFeedRow({ entry }: { entry: MoveFeedEntry }) {
  return (
    <div style={styles.moveRow}>
      <div style={styles.moveRowPrefix}>{formatMovePrefix(entry)}</div>
      <div style={styles.moveRowSan}>{entry.move}</div>
      {entry.analysis === undefined ? null : <CompactAnalysis analysis={entry.analysis} />}
    </div>
  )
}

function MoveAnalysisBadge({ analysis }: { analysis: MoveFeedAnalysis }) {
  const display = moveQualityDisplay[analysis.classification]

  return (
    <div style={styles.analysisLine}>
      <span style={{ ...styles.analysisBadge, background: display.background, color: display.color }}>
        {display.label}
      </span>
      <span style={styles.evalBadge}>{formatEngineScore(analysis.eval)}</span>
    </div>
  )
}

function CompactAnalysis({ analysis }: { analysis: MoveFeedAnalysis }) {
  const display = moveQualityDisplay[analysis.classification]

  return (
    <div style={styles.compactAnalysis}>
      <span style={{ ...styles.qualityDot, background: display.background }} />
      <span>{display.label}</span>
      <span style={styles.compactEval}>{formatEngineScore(analysis.eval)}</span>
    </div>
  )
}

function getLatestMove(entries: readonly MoveFeedEntry[]) {
  return entries.findLast(entry => entry.type === 'move')
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

const styles = {
  analysisBadge: {
    borderRadius: 7,
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: 0,
    padding: '10px 18px',
    textTransform: 'uppercase',
  },
  analysisLine: {
    alignItems: 'center',
    display: 'flex',
    gap: 14,
    marginTop: 22,
  },
  blackPiece: {
    color: '#151820',
    textShadow: '0 2px 0 rgba(255,255,255,0.25), 0 12px 24px rgba(0,0,0,0.32)',
  },
  blackRail: {
    background: 'linear-gradient(135deg, #171a22, #252b33)',
    color: '#f4f2ea',
  },
  board: {
    aspectRatio: '1 / 1',
    border: '10px solid #181a20',
    borderRadius: 8,
    boxShadow: '0 30px 70px rgba(0,0,0,0.36), inset 0 0 0 1px rgba(255,255,255,0.14)',
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    overflow: 'hidden',
    position: 'relative',
    width: 690,
    zIndex: 1,
  },
  boardColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: 800,
  },
  boardGlow: {
    background: 'radial-gradient(circle at 50% 50%, rgba(231,192,101,0.5), rgba(53,208,186,0.18) 44%, transparent 68%)',
    filter: 'blur(24px)',
    height: 750,
    left: 5,
    position: 'absolute',
    top: -20,
    width: 750,
  },
  boardWrap: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    position: 'relative',
  },
  capturedEmpty: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 18,
    whiteSpace: 'nowrap',
  },
  capturedPiece: {
    fontSize: 32,
    lineHeight: 1,
    marginLeft: -4,
  },
  capturedPieces: {
    alignItems: 'center',
    display: 'flex',
    gap: 6,
    justifyContent: 'flex-end',
    minWidth: 170,
  },
  compactAnalysis: {
    alignItems: 'center',
    color: '#e7edf2',
    display: 'flex',
    fontSize: 18,
    fontWeight: 800,
    gap: 9,
    marginLeft: 'auto',
  },
  compactEval: {
    color: '#aeb8c6',
    fontVariantNumeric: 'tabular-nums',
  },
  currentMove: {
    background: 'rgba(12, 16, 23, 0.78)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
    minHeight: 300,
    padding: 32,
  },
  currentMoveTopline: {
    alignItems: 'baseline',
    display: 'flex',
    gap: 18,
    marginTop: 20,
  },
  darkSquare: {
    background: 'linear-gradient(135deg, #3b474b, #253136)',
  },
  duration: {
    color: '#9ba8b8',
    fontSize: 30,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 800,
  },
  emptyMove: {
    color: '#9ba8b8',
    fontSize: 32,
    fontWeight: 700,
    marginTop: 28,
  },
  evalBadge: {
    background: '#edf2f6',
    borderRadius: 7,
    color: '#151820',
    fontSize: 32,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 900,
    padding: '10px 16px',
  },
  eyebrow: {
    color: '#35d0ba',
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  feedColumn: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 24,
    minWidth: 0,
  },
  fileLabel: {
    bottom: 8,
    color: 'rgba(255,255,255,0.58)',
    fontSize: 16,
    fontWeight: 900,
    position: 'absolute',
    right: 10,
    textTransform: 'uppercase',
  },
  lightSquare: {
    background: 'linear-gradient(135deg, #d8c690, #b8a46c)',
  },
  matchHeader: {
    borderBottom: '1px solid rgba(255,255,255,0.16)',
    paddingBottom: 20,
  },
  moveFeed: {
    background: 'rgba(233,238,242,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    flex: 1,
    minHeight: 0,
    padding: 28,
  },
  moveList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 20,
  },
  moveNumber: {
    color: '#35d0ba',
    fontSize: 38,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 900,
    minWidth: 92,
  },
  moveRow: {
    alignItems: 'center',
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    display: 'flex',
    gap: 14,
    minHeight: 56,
    padding: '12px 16px',
  },
  moveRowPrefix: {
    color: '#8fa0b4',
    fontSize: 18,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 800,
    width: 58,
  },
  moveRowSan: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 900,
    minWidth: 96,
  },
  moveSan: {
    color: '#ffffff',
    fontSize: 74,
    fontWeight: 950,
    lineHeight: 1,
  },
  panelLabel: {
    color: '#9ba8b8',
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  piece: {
    alignItems: 'center',
    display: 'flex',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 72,
    height: '100%',
    justifyContent: 'center',
    lineHeight: 1,
    position: 'relative',
    transform: 'translateY(-1px)',
    width: '100%',
    zIndex: 1,
  },
  playerColor: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  playerTextDark: {
    color: 'rgba(22,24,29,0.62)',
  },
  playerTextLight: {
    color: 'rgba(255,255,255,0.64)',
  },
  playerMain: {
    minWidth: 0,
  },
  playerMeta: {
    alignItems: 'center',
    display: 'flex',
    fontSize: 20,
    fontWeight: 700,
    gap: 12,
    marginTop: 8,
    textTransform: 'capitalize',
  },
  playerModel: {
    fontSize: 34,
    fontWeight: 950,
    lineHeight: 1.05,
    marginTop: 5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playerRail: {
    alignItems: 'center',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 8,
    boxShadow: '0 18px 44px rgba(0,0,0,0.22)',
    display: 'flex',
    justifyContent: 'space-between',
    minHeight: 96,
    padding: '17px 22px',
    width: '100%',
  },
  playerRailEmpty: {
    minHeight: 96,
  },
  qualityDot: {
    borderRadius: 999,
    display: 'block',
    height: 13,
    width: 13,
  },
  rankLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 16,
    fontWeight: 900,
    left: 9,
    position: 'absolute',
    top: 7,
  },
  rationale: {
    color: '#cad3de',
    fontSize: 26,
    fontWeight: 650,
    lineHeight: 1.28,
    margin: '24px 0 0',
  },
  resultBanner: {
    background: 'linear-gradient(135deg, rgba(126,231,135,0.95), rgba(53,208,186,0.9))',
    border: '1px solid rgba(255,255,255,0.26)',
    borderRadius: 8,
    boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
    color: '#101820',
    padding: '24px 30px',
  },
  resultLabel: {
    color: 'rgba(16,24,32,0.62)',
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  resultMain: {
    alignItems: 'baseline',
    display: 'flex',
    gap: 18,
    marginTop: 8,
  },
  resultReason: {
    color: 'rgba(16,24,32,0.72)',
    fontSize: 24,
    fontWeight: 850,
    marginTop: 6,
  },
  resultScore: {
    background: 'rgba(16,24,32,0.13)',
    borderRadius: 7,
    fontSize: 28,
    fontWeight: 950,
    padding: '6px 12px',
  },
  resultWinner: {
    fontSize: 42,
    fontWeight: 950,
    lineHeight: 1,
  },
  shell: {
    background: 'linear-gradient(135deg, #0b0f16 0%, #121923 38%, #1f2630 68%, #2a2a24 100%)',
    boxSizing: 'border-box',
    color: '#ffffff',
    display: 'flex',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    gap: 48,
    height: '100%',
    minHeight: 1080,
    overflow: 'hidden',
    padding: 40,
    width: '100%',
  },
  square: {
    aspectRatio: '1 / 1',
    position: 'relative',
  },
  statusBadge: {
    borderRadius: 999,
    color: '#101820',
    display: 'inline-block',
    fontSize: 16,
    fontWeight: 950,
    padding: '5px 10px',
    textTransform: 'uppercase',
  },
  title: {
    color: '#ffffff',
    fontSize: 60,
    fontWeight: 950,
    letterSpacing: 0,
    lineHeight: 1,
    marginTop: 8,
  },
  whitePiece: {
    color: '#fff9e8',
    textShadow: '0 3px 0 rgba(0,0,0,0.2), 0 12px 24px rgba(0,0,0,0.28)',
  },
  whiteRail: {
    background: 'linear-gradient(135deg, #ece4d2, #cdbf9a)',
    color: '#16181d',
  },
} satisfies Record<string, CSSProperties>
