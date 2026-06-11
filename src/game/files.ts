import type { GameEvent } from './types.js'

import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

export function getGamesDirectory(): string {
  return path.join(process.cwd(), '.games')
}

export function getGameJsonlPath(gameGuid: string): string {
  return path.join(getGamesDirectory(), `${gameGuid}.jsonl`)
}

export function getGameLogPath(gameGuid: string): string {
  return path.join(getGamesDirectory(), `${gameGuid}.log`)
}

export async function ensureGamesDirectory(): Promise<void> {
  await mkdir(getGamesDirectory(), { recursive: true })
}

export async function appendGameEvent(gameGuid: string, event: GameEvent): Promise<void> {
  await ensureGamesDirectory()
  await appendFile(getGameJsonlPath(gameGuid), `${JSON.stringify(event)}\n`, 'utf8')
}
