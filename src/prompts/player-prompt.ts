import type { Color } from 'chess.js'

import { colorToPlayerName } from '../game/players.js'
import { renderTemplateFile } from '../utils/templates.js'

export async function renderPlayerPrompt(options: {
  color: Color
  gameGuid: string
  initialFen: string
  initialTurn: Color
}): Promise<string> {
  const player = colorToPlayerName(options.color)
  const initialTurn = colorToPlayerName(options.initialTurn)

  return renderTemplateFile(new URL('player.md', import.meta.url), {
    color: player,
    gameGuid: options.gameGuid,
    initialFen: options.initialFen,
    initialTurn,
    moveCommand: `pnpm game:move --game ${options.gameGuid} --player ${player} --move "<move>" --rationale "<public rationale>"`,
    waitCommand: `pnpm game:wait --game ${options.gameGuid} --player ${player}`,
  })
}
