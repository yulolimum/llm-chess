import type { Color } from 'chess.js'

import { colorToPlayerName } from '../game/players.js'
import { renderTemplateFile } from './templates.js'

export async function renderPlayerPrompt(options: {
  color: Color
  gameGuid: string
  initialFen: string
  initialTurn: Color
  strategy: string | undefined
}): Promise<string> {
  const player = colorToPlayerName(options.color)
  const initialTurn = colorToPlayerName(options.initialTurn)
  const strategy = options.strategy === undefined ? '' : `\nStrategy guidance:\n\n${options.strategy}\n`

  return renderTemplateFile(new URL('../prompts/player.md', import.meta.url), {
    color: player,
    gameGuid: options.gameGuid,
    initialFen: options.initialFen,
    initialTurn,
    moveCommand: `pnpm agent:move --game ${options.gameGuid} --player ${player} --move "<move>" --rationale "<public rationale>"`,
    strategy,
    waitCommand: `pnpm agent:wait --game ${options.gameGuid} --player ${player}`,
  })
}
