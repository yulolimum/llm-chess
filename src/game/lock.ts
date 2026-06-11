import { open, rm } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'

import { ensureGamesDirectory, getGameLockPath } from './files.js'

export async function withGameLock<T>(gameGuid: string, callback: () => Promise<T>): Promise<T> {
  await ensureGamesDirectory()

  const lockPath = getGameLockPath(gameGuid)
  const lock = await acquireLock(lockPath)

  try {
    return await callback()
  } finally {
    await lock.close()
    await rm(lockPath, { force: true })
  }
}

async function acquireLock(lockPath: string) {
  while (true) {
    try {
      return await open(lockPath, 'wx')
    } catch (error) {
      if (isFileExistsError(error)) {
        await setTimeout(100)
        continue
      }

      throw error
    }
  }
}

function isFileExistsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST'
}
