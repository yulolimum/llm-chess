import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

let sessionLogFile: string | null = null

export function setSessionLogFile(filePath: string): void {
  sessionLogFile = filePath
  mkdirSync(dirname(filePath), { recursive: true })
}

export function createLogger(options: { prefix: string }) {
  return {
    debug(...args: Parameters<typeof console.log>) {
      writeToSessionLog('debug', options.prefix, args)
    },
    error(...args: Parameters<typeof console.log>) {
      writeToSessionLog('error', options.prefix, args)
    },
    info(...args: Parameters<typeof console.log>) {
      writeToSessionLog('info', options.prefix, args)
    },
    warn(...args: Parameters<typeof console.log>) {
      writeToSessionLog('warn', options.prefix, args)
    },
  }
}

export type Logger = ReturnType<typeof createLogger>

function formatArgs(args: unknown[]): string {
  return args
    .map(arg => {
      if (typeof arg === 'string') {
        return arg
      }

      if (arg instanceof Error) {
        return arg.stack ?? arg.message
      }

      return JSON.stringify(arg)
    })
    .join(' ')
}

function writeToSessionLog(level: string, prefix: string, args: unknown[]): void {
  if (sessionLogFile === null) {
    return
  }

  const timestamp = new Date().toISOString()
  const message = formatArgs(args)
  const line = `${timestamp} [${level.toUpperCase().padEnd(5)}] ${prefix} ${message}\n`

  try {
    appendFileSync(sessionLogFile, line)
  } catch {
    // Logging should never break the game runner.
  }
}
