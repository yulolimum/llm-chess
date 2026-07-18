import type { Color } from 'chess.js'

import { colorToPlayerName } from '../game/players.js'
import { renderTemplateFile } from './templates.js'

export async function renderPlayerPrompt(options: {
  appendInitialInstruction?: string
  color: Color
  gameGuid: string
  initialFen: string
  initialTurn: Color
  strategy: string | undefined
}): Promise<string> {
  const player = colorToPlayerName(options.color)
  const initialTurn = colorToPlayerName(options.initialTurn)
  const strategy = options.strategy === undefined ? '' : `\nStrategy guidance:\n\n${options.strategy}\n`

  const promptText = await renderTemplateFile(new URL('../prompts/game-start.md', import.meta.url), {
    color: player,
    gameGuid: options.gameGuid,
    initialFen: options.initialFen,
    initialTurn,
    moveCommand: `pnpm agent:move --game ${options.gameGuid} --player ${player} --move "<move>" --rationale "<public rationale>"`,
    strategy,
  })

  if (options.appendInitialInstruction === undefined) {
    return promptText
  }

  return `${promptText}\n\n${options.appendInitialInstruction}`
}
