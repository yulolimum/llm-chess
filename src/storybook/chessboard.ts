import type { ChessBoardProps, MoveFeedAnalysis, MoveFeedEntry } from '../components/ChessBoard.types.js'

import { Chess } from 'chess.js'

const sampleMoveAnalyses = [
  {
    classification: 'best',
    eval: { type: 'cp', value: 47 },
  },
  {
    classification: 'excellent',
    eval: { type: 'cp', value: 34 },
  },
  {
    classification: 'good',
    eval: { type: 'cp', value: 42 },
  },
  {
    classification: 'inaccuracy',
    eval: { type: 'cp', value: 88 },
  },
  {
    classification: 'mistake',
    eval: { type: 'cp', value: -115 },
  },
  {
    classification: 'blunder',
    eval: { type: 'cp', value: -320 },
  },
] as const satisfies readonly MoveFeedAnalysis[]

const moves = [
  {
    color: 'w',
    duration: '9s',
    move: 'e4',
    moveNumber: 1,
    rationale: "Opening with the King's Pawn to control the center and free the bishop and queen.",
  },
  {
    color: 'b',
    duration: '5s',
    move: 'e5',
    moveNumber: 1,
    rationale: "I match White's central pawn and fight for d4 and f4.",
  },
  {
    color: 'w',
    duration: '3s',
    move: 'Nf3',
    moveNumber: 2,
    rationale: 'Developing the knight to attack the e5 pawn and prepare kingside castling.',
  },
  {
    color: 'b',
    duration: '5s',
    move: 'Nc6',
    moveNumber: 2,
    rationale: 'I develop the knight to a natural square and reinforce the e5 pawn.',
  },
  {
    color: 'w',
    duration: '6s',
    move: 'Bc4',
    moveNumber: 3,
    rationale: 'The Italian setup: developing the bishop to its most active diagonal, eyeing the f7 weakness.',
  },
  {
    color: 'b',
    duration: '7s',
    move: 'Nf6',
    moveNumber: 3,
    rationale: "I develop the kingside knight and put immediate pressure on White's e4 pawn.",
  },
  {
    color: 'w',
    duration: '5s',
    move: 'O-O',
    moveNumber: 4,
    rationale: 'Castling to safeguard the king and connect the rooks before the middlegame begins.',
  },
  {
    color: 'b',
    duration: '6s',
    move: 'Bc5',
    moveNumber: 4,
    rationale: 'I develop the bishop to an active diagonal and increase pressure toward f2.',
  },
  {
    color: 'w',
    duration: '3s',
    move: 'c3',
    moveNumber: 5,
    rationale: "Preparing the d4 break to build a strong pawn center and challenge Black's bishop on c5.",
  },
  {
    color: 'b',
    duration: '9s',
    move: 'O-O',
    moveNumber: 5,
    rationale: 'I castle before the center opens, improving king safety and connecting the rook.',
  },
  {
    color: 'w',
    duration: '3s',
    move: 'd4',
    moveNumber: 6,
    rationale: 'Striking in the center to open lines and challenge the bishop on c5.',
  },
  {
    color: 'b',
    duration: '8s',
    move: 'exd4',
    moveNumber: 6,
    rationale: "I exchange in the center to reduce White's space advantage and open lines for my pieces.",
  },
  {
    color: 'w',
    duration: '8s',
    move: 'cxd4',
    moveNumber: 7,
    rationale: 'Recapturing to build a broad pawn center on d4 and e4 while gaining a tempo.',
  },
  {
    color: 'b',
    duration: '18s',
    move: 'Bb6',
    moveNumber: 7,
    rationale: "I retreat the bishop while preserving its active diagonal toward White's king.",
  },
  {
    color: 'w',
    duration: '15s',
    move: 'd5',
    moveNumber: 8,
    rationale: 'Gaining space and chasing the knight with tempo, building a strong central pawn duo.',
  },
  {
    color: 'b',
    duration: '14s',
    move: 'Ne7',
    moveNumber: 8,
    rationale: 'I move the attacked knight to a solid square where it supports the center and kingside.',
  },
  {
    color: 'w',
    duration: '18s',
    move: 'e5',
    moveNumber: 9,
    rationale: 'Pushing the pawn to gain a large space advantage and drive the f6 knight to the rim.',
  },
  {
    color: 'b',
    duration: '12s',
    move: 'Nfxd5',
    moveNumber: 9,
    rationale:
      "I capture the advanced d-pawn and start breaking down White's pawn chain. If White trades on d5, my other knight can recapture and keep the center under control.",
  },
] as const

const chess = new Chess()

for (const move of moves) {
  chess.move(move.move)
}

export const chessBoardPreviewProps = {
  blackPlayer: {
    capturedPieces: [
      { color: 'w', type: 'p' },
      { color: 'w', type: 'n' },
    ],
    effort: 'max',
    model: 'Claude Opus 4.8',
    provider: 'Claude',
    strategy: 'Keep the position closed and look for long-term queenside pressure.',
  },
  board: chess.board(),
  moveFeed: withSampleAnalysis(
    moves.map(move => ({
      ...move,
      type: 'move',
    })),
  ),
  whitePlayer: {
    capturedPieces: [
      { color: 'b', type: 'p' },
      { color: 'b', type: 'p' },
    ],
    effort: 'high',
    model: 'GPT-5.6-Sol',
    provider: 'Codex',
    status: 'on-move',
    strategy: 'Prioritize forcing tactics, direct king pressure, and simple conversions.',
  },
} as const satisfies ChessBoardProps

function withSampleAnalysis(entries: readonly MoveFeedEntry[]) {
  return entries.map((entry, index) => ({
    ...entry,
    analysis: getSampleAnalysis(index),
  }))
}

function getSampleAnalysis(index: number): MoveFeedAnalysis {
  const analysis = sampleMoveAnalyses[index % sampleMoveAnalyses.length]

  if (analysis === undefined) {
    throw new Error('Expected at least one sample move analysis')
  }

  return analysis
}
