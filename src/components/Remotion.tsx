import type { ChessBoardProps } from './ChessBoard.types.js'

import React from 'react'
import { AbsoluteFill, Composition, getInputProps, registerRoot } from 'remotion'

import { ChessBoard } from './ChessBoard.web.js'

function ChessReplayPreview() {
  const inputProps = getInputProps<ChessBoardProps>()

  return (
    <AbsoluteFill>
      <ChessBoard {...inputProps} />
    </AbsoluteFill>
  )
}

function RemotionRoot() {
  return (
    <Composition
      component={ChessReplayPreview}
      durationInFrames={180}
      fps={30}
      height={1080}
      id="ChessReplayPreview"
      width={1920}
    />
  )
}

registerRoot(RemotionRoot)
