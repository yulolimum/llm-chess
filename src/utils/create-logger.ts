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
  fileLevel?: LogLevel
  prefix?: string
  terminalLevel: LogLevel | 'silent'
}

export function createLogger(options: CreateLoggerOptions) {
  const { color, fileLevel, prefix, terminalLevel } = options
  const terminalPriority = terminalLevel === 'silent' ? -1 : logLevelPriority[terminalLevel]
  const filePriority = fileLevel === undefined ? terminalPriority : logLevelPriority[fileLevel]
  const formattedPrefix = prefix && color ? chalk.hex(color)(prefix) : prefix
  const logger = new NodeCliLogger(formattedPrefix ? { prefix: formattedPrefix } : {})

  function shouldLogToTerminal(methodLevel: LogLevel): boolean {
    return terminalLevel !== 'silent' && logLevelPriority[methodLevel] <= terminalPriority
  }

  function shouldLogToFile(methodLevel: LogLevel): boolean {
    return logLevelPriority[methodLevel] <= filePriority
  }

  function writeLog(methodLevel: LogLevel, fileLevelLabel: string, args: unknown[]): void {
    if (shouldLogToFile(methodLevel)) {
      writeToSessionLog(fileLevelLabel, prefix, args)
    }
  }

  return {
    debug(...args: Parameters<typeof console.log>) {
      if (shouldLogToTerminal('debug')) {
        logger.debug(...args)
      }
      writeLog('debug', 'debug', args)
    },
    error(...args: Parameters<typeof console.log>) {
      if (shouldLogToTerminal('error')) {
        logger.error(...args)
      }
      writeLog('error', 'error', args)
    },
    important(...args: Parameters<typeof console.log>) {
      if (shouldLogToTerminal('important')) {
        const greenArgs = args.map(arg => (typeof arg === 'string' ? chalk.green(arg) : arg))
        logger.log(...greenArgs)
      }
      writeLog('important', 'IMPRT', args)
    },
    info(...args: Parameters<typeof console.log>) {
      if (shouldLogToTerminal('info')) {
        logger.info(...args)
      }
      writeLog('info', 'info', args)
    },
    log(...args: Parameters<typeof console.log>) {
      if (shouldLogToTerminal('info')) {
        logger.log(...args)
      }
      writeLog('info', 'info', args)
    },
    warn(...args: Parameters<typeof console.log>) {
      if (shouldLogToTerminal('warn')) {
        logger.warn(...args)
      }
      writeLog('warn', 'warn', args)
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
