import type { Chess } from 'chess.js'

import { Box, Text } from 'ink'
import React from 'react'

import { pieceSpriteHeight, pieceSprites, pieceSpriteWidth } from '../utils/pieces.js'

type Board = ReturnType<Chess['board']>
type Square = Board[number][number]

const boardFrame = '#18181b'
const lightSquare = '#9ca3af'
const darkSquare = '#4b5563'
const lightPiece = '#ffffff'
const darkPiece = '#000000'
const filledPixel = '██'
const emptyPixel = '  '

export function ChessBoard({ board }: { board: Board }) {
  return (
    <Box flexDirection="column" paddingX={1} paddingY={1} backgroundColor={boardFrame}>
      {board.map((rank, rankIndex) => (
        <Box key={rankIndex}>
          {rank.map((piece, fileIndex) => (
            <SquareView key={`${rankIndex}-${fileIndex}`} fileIndex={fileIndex} piece={piece} rankIndex={rankIndex} />
          ))}
        </Box>
      ))}
    </Box>
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
