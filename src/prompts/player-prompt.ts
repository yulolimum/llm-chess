import type { PlayerColor } from '../game/types.js'

import { renderTemplateFile } from '../utils/templates.js'

export async function renderPlayerPrompt(options: {
  color: PlayerColor
  gameGuid: string
  initialFen: string
}): Promise<string> {
  return renderTemplateFile(new URL('player.md', import.meta.url), {
    color: options.color,
    gameGuid: options.gameGuid,
    initialFen: options.initialFen,
  })
}
