import type { Chess, Color, PieceSymbol } from 'chess.js'

import { Box, Text } from 'ink'
import React from 'react'

import { pieceSpriteHeight, pieceSprites, pieceSpriteWidth } from '../utils/pieces.js'

type Board = ReturnType<Chess['board']>
type Square = Board[number][number]
export type PlayerStatus = 'draw' | 'lost' | 'on-move' | 'won'

export type ChessBoardPlayer = {
  capturedPieces?: readonly CapturedPiece[]
  model: string
  provider: string
  status?: PlayerStatus
}

export type MoveFeedEntry = {
  color?: Color
  duration?: string
  move?: string
  moveNumber?: number
  rationale?: string
  text?: string
  type: 'game-ended' | 'game-started' | 'move'
}

export type CapturedPiece = {
  color: Color
  type: PieceSymbol
}

const lightSquare = '#9ca3af'
const darkSquare = '#4b5563'
const lightPiece = '#ffffff'
const darkPiece = '#000000'
const filledPixel = '██'
const emptyPixel = '  '
const filesPerRank = 8
const renderedSquareWidth = pieceSpriteWidth * filledPixel.length
const boardWidth = renderedSquareWidth * filesPerRank
const capturedPieceGlyphs = {
  b: '♝',
  k: '♚',
  n: '♞',
  p: '♟',
  q: '♛',
  r: '♜',
} as const satisfies Record<PieceSymbol, string>
const statusDisplay = {
  draw: {
    backgroundColor: '#71717a',
    label: ' DRAW ',
  },
  lost: {
    backgroundColor: '#dc2626',
    label: ' LOST ',
  },
  'on-move': {
    backgroundColor: '#2563eb',
    label: ' ON MOVE ',
  },
  won: {
    backgroundColor: '#16a34a',
    label: ' WON ',
  },
} as const satisfies Record<PlayerStatus, { backgroundColor: string; label: string }>

export function ChessBoard({
  blackPlayer,
  board,
  moveFeed = [],
  showMoveFeed = true,
  whitePlayer,
}: {
  blackPlayer?: ChessBoardPlayer
  board: Board
  moveFeed?: readonly MoveFeedEntry[]
  showMoveFeed?: boolean
  whitePlayer?: ChessBoardPlayer
}) {
  return (
    <Box flexDirection="column" padding={1}>
      {showMoveFeed ? <MoveFeed entries={moveFeed} /> : null}
      {blackPlayer === undefined ? null : <PlayerInfo player={blackPlayer} />}
      <Box flexDirection="column">
        {board.map((rank, rankIndex) => (
          <Box key={rankIndex}>
            {rank.map((piece, fileIndex) => (
              <SquareView key={`${rankIndex}-${fileIndex}`} fileIndex={fileIndex} piece={piece} rankIndex={rankIndex} />
            ))}
          </Box>
        ))}
      </Box>
      {whitePlayer === undefined ? null : <PlayerInfo player={whitePlayer} />}
    </Box>
  )
}

function MoveFeed({ entries }: { entries: readonly MoveFeedEntry[] }) {
  if (entries.length === 0) {
    return null
  }

  const moveNumberWidth = getMoveNumberWidth(entries)

  return (
    <Box borderStyle="single" flexDirection="column" paddingX={1} width={boardWidth}>
      {entries.map((entry, index) => (
        <MoveFeedEntryView entry={entry} key={index} moveNumberWidth={moveNumberWidth} />
      ))}
    </Box>
  )
}

function MoveFeedEntryView({ entry, moveNumberWidth }: { entry: MoveFeedEntry; moveNumberWidth: number }) {
  if (entry.type === 'move') {
    return (
      <Box flexDirection="column">
        <Box>
          <Text>{formatMovePrefix(entry, moveNumberWidth)}</Text>
          <Text bold>{entry.color === 'w' ? 'White' : 'Black'}</Text>
          <Text> - </Text>
          <Text color="#facc15">[{entry.move}]</Text>
          {entry.duration === undefined ? null : <Text> - {entry.duration}</Text>}
        </Box>
        {entry.rationale === undefined ? null : (
          <Box paddingLeft={getMovePrefixWidth(moveNumberWidth)}>
            <Text wrap="wrap">{entry.rationale}</Text>
          </Box>
        )}
      </Box>
    )
  }

  return <Text>{entry.text}</Text>
}

function getMoveNumberWidth(entries: readonly MoveFeedEntry[]): number {
  return entries.reduce((width, entry) => {
    if (entry.type !== 'move' || entry.moveNumber === undefined) {
      return width
    }

    return Math.max(width, String(entry.moveNumber).length)
  }, 1)
}

function formatMovePrefix(entry: MoveFeedEntry, moveNumberWidth: number): string {
  const moveNumber = String(entry.moveNumber).padStart(moveNumberWidth, ' ')

  return entry.color === 'w' ? `${moveNumber}.   ` : `${moveNumber}... `
}

function getMovePrefixWidth(moveNumberWidth: number): number {
  return moveNumberWidth + 4
}

function PlayerInfo({ player }: { player: ChessBoardPlayer }) {
  return (
    <Box justifyContent="space-between" paddingY={1} width={boardWidth}>
      <Box>
        <Text bold>{player.provider}</Text>
        <Text> - {player.model}</Text>
        {player.status === undefined ? null : (
          <>
            <Text> - </Text>
            <Text backgroundColor={statusDisplay[player.status].backgroundColor} color="#ffffff">
              {statusDisplay[player.status].label}
            </Text>
          </>
        )}
      </Box>
      <CapturedPieces pieces={player.capturedPieces ?? []} />
    </Box>
  )
}

function CapturedPieces({ pieces }: { pieces: readonly CapturedPiece[] }) {
  if (pieces.length === 0) {
    return null
  }

  const pieceColor = pieces[0]?.color
  const foregroundColor = pieceColor === 'w' ? lightPiece : darkPiece
  const backgroundColor = pieceColor === 'w' ? darkPiece : lightPiece
  const label = ` ${pieces.map(piece => capturedPieceGlyphs[piece.type]).join(' ')} `

  return (
    <Text backgroundColor={backgroundColor} color={foregroundColor}>
      {label}
    </Text>
  )
}

function SquareView({ fileIndex, piece, rankIndex }: { fileIndex: number; piece: Square; rankIndex: number }) {
  const isLight = (rankIndex + fileIndex) % 2 === 0
  const backgroundColor = isLight ? lightSquare : darkSquare

  return (
    <Box backgroundColor={backgroundColor} flexDirection="column">
      {renderSquareRows(piece).map((row, rowIndex) => (
        <Text key={rowIndex} color={piece?.color === 'w' ? lightPiece : darkPiece}>
          {row}
        </Text>
      ))}
    </Box>
  )
}

function renderSquareRows(piece: Square): string[] {
  if (piece === null) {
    return Array.from({ length: pieceSpriteHeight }, () => emptyPixel.repeat(pieceSpriteWidth))
  }

  return pieceSprites[piece.type].pixels.map(row => row.map(pixel => (pixel ? filledPixel : emptyPixel)).join(''))
}
