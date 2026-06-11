import type { Chess, PieceSymbol } from 'chess.js'

import { Box, Text } from 'ink'
import React from 'react'

type Board = ReturnType<Chess['board']>
type Square = Board[number][number]

const squareWidth = 7
const squareHeight = 3
const solidPieces: Record<PieceSymbol, string> = {
  b: '♝',
  k: '♚',
  n: '♞',
  p: '♟',
  q: '♛',
  r: '♜',
}

const boardFrame = '#18181b'
const lightSquare = '#9ca3af'
const darkSquare = '#4b5563'
const lightPiece = '#ffffff'
const darkPiece = '#000000'

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

  return (
    <Box
      alignItems="center"
      backgroundColor={isLight ? lightSquare : darkSquare}
      height={squareHeight}
      justifyContent="center"
      width={squareWidth}>
      <Text bold color={piece?.color === 'w' ? lightPiece : darkPiece}>
        {piece === null ? ' ' : solidPieces[piece.type]}
      </Text>
    </Box>
  )
}
