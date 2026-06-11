export type PlayerColor = 'white' | 'black'

export type GameStartedEvent = {
  initialFen: string
  timestamp: string
  turn: PlayerColor
  type: 'game_started'
}

export type GameEvent = GameStartedEvent
