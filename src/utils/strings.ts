import { kebabCase } from 'change-case'

type GameIdPlayer = {
  effort: string | undefined
  model: string
}

export function createGameGuid(players: { black: GameIdPlayer; white: GameIdPlayer }) {
  return [Date.now().toString(), formatGameIdPlayer(players.white), formatGameIdPlayer(players.black)].join('--')
}

function formatGameIdPlayer(player: GameIdPlayer) {
  return `${slugifyGameIdPart(player.model)}_${slugifyGameIdPart(player.effort ?? 'none')}`
}

function slugifyGameIdPart(value: string) {
  return kebabCase(value) || 'unknown'
}
