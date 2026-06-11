import type { Color } from 'chess.js'

export type PlayerName = 'black' | 'white'

export function colorToPlayerName(color: Color): PlayerName {
  return color === 'w' ? 'white' : 'black'
}

export function playerNameToColor(player: PlayerName): Color {
  return player === 'white' ? 'w' : 'b'
}

export function parsePlayerName(value: unknown): PlayerName | undefined {
  if (Array.isArray(value)) {
    return parsePlayerName(value.at(-1))
  }

  if (value === undefined) {
    return undefined
  }

  if (value === 'white' || value === 'black') {
    return value
  }

  throw new Error(`Expected --player white or --player black, received "${String(value)}"`)
}
