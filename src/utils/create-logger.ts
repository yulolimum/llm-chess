import { Logger as NodeCliLogger } from '@node-cli/logger'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { chalk } from 'zx'

export type LogLevel = 'important' | 'error' | 'warn' | 'info' | 'debug'

const logLevelPriority: Record<LogLevel, number> = {
  important: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
}

let sessionLogFile: string | null = null

export function setSessionLogFile(filePath: string): void {
  sessionLogFile = filePath
  mkdirSync(dirname(filePath), { recursive: true })
}

export function getSessionLogFile(): string | null {
  return sessionLogFile
}

// eslint-disable-next-line no-control-regex
const ansiRegex = /\x1b\[[0-9;]*m/g

export type CreateLoggerOptions = {
  color?: string
  level: LogLevel
  prefix?: string
}

export function createLogger(options: CreateLoggerOptions) {
  const { color, level, prefix } = options
  const currentPriority = logLevelPriority[level]
  const formattedPrefix = prefix && color ? chalk.hex(color)(prefix) : prefix
  const logger = new NodeCliLogger(formattedPrefix ? { prefix: formattedPrefix } : {})

  function shouldLog(methodLevel: LogLevel): boolean {
    return logLevelPriority[methodLevel] <= currentPriority
  }

  return {
    debug(...args: Parameters<typeof console.log>) {
      if (shouldLog('debug')) {
        logger.debug(...args)
        writeToSessionLog('debug', prefix, args)
      }
    },
    error(...args: Parameters<typeof console.log>) {
      if (shouldLog('error')) {
        logger.error(...args)
        writeToSessionLog('error', prefix, args)
      }
    },
    important(...args: Parameters<typeof console.log>) {
      if (shouldLog('important')) {
        const greenArgs = args.map(arg => (typeof arg === 'string' ? chalk.green(arg) : arg))
        logger.log(...greenArgs)
        writeToSessionLog('IMPRT', prefix, args)
      }
    },
    info(...args: Parameters<typeof console.log>) {
      if (shouldLog('info')) {
        logger.info(...args)
        writeToSessionLog('info', prefix, args)
      }
    },
    log(...args: Parameters<typeof console.log>) {
      if (shouldLog('info')) {
        logger.log(...args)
        writeToSessionLog('info', prefix, args)
      }
    },
    warn(...args: Parameters<typeof console.log>) {
      if (shouldLog('warn')) {
        logger.warn(...args)
        writeToSessionLog('warn', prefix, args)
      }
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

function stripAnsi(value: string): string {
  return value.replace(ansiRegex, '')
}

function writeToSessionLog(level: string, prefix: string | undefined, args: unknown[]): void {
  if (sessionLogFile === null) {
    return
  }

  const timestamp = new Date().toISOString()
  const prefixPart = prefix === undefined ? '' : `${prefix} `
  const message = stripAnsi(formatArgs(args))
  const line = `${timestamp} [${level.toUpperCase().padEnd(5)}] ${prefixPart}${message}\n`

  try {
    appendFileSync(sessionLogFile, line)
  } catch {
    // Logging should never break the game runner.
  }
}
