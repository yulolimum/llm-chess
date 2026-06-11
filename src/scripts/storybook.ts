if (process.env['NO_COLOR'] === undefined) {
  process.env['FORCE_COLOR'] ||= '1'
}

import select from '@inquirer/select'
import { Chess } from 'chess.js'
import { render } from 'ink'
import path from 'node:path'
import process from 'node:process'
import React from 'react'
import { fs, minimist } from 'zx'

import { ChessBoard } from '../components/ChessBoard.js'

//
// Constants
//
const scriptName = 'storybook'
const scriptCommand = 'pnpm storybook'
const components = {
  chessboard: {
    name: 'ChessBoard',
    render: () =>
      React.createElement(ChessBoard, {
        blackPlayer: {
          capturedPieces: [
            { color: 'w', type: 'p' },
            { color: 'w', type: 'n' },
            { color: 'w', type: 'p' },
          ],
          model: 'Claude Opus 4.8',
          provider: 'Claude',
        },
        board: new Chess().board(),
        moveFeed: [
          {
            text: 'Game started',
            type: 'game-started',
          },
          {
            color: 'w',
            duration: '12s',
            move: 'e4',
            moveNumber: 1,
            rationale: 'Controls the center and opens lines for the bishop and queen.',
            type: 'move',
          },
          {
            color: 'b',
            duration: '1m',
            move: 'c5',
            moveNumber: 1,
            rationale: 'Challenges the center from the flank and keeps the position unbalanced.',
            type: 'move',
          },
        ],
        whitePlayer: {
          capturedPieces: [
            { color: 'b', type: 'q' },
            { color: 'b', type: 'p' },
          ],
          model: 'GPT-5.5',
          provider: 'Codex',
          status: 'on-move',
        },
      }),
  },
} as const

type ComponentName = keyof typeof components

//
// Arguments
//
const args = minimist(process.argv.slice(2), {
  alias: { h: 'help', v: 'verbose' },
  boolean: ['help', 'verbose'],
  string: ['component'],
})

const parsedArgs = {
  component: parseComponentName(args['component']),
  help: Boolean(args['help']),
  verbose: Boolean(args['verbose']),
}

type ArgNames = keyof typeof parsedArgs
type Args = { [K in ArgNames]: NonNullable<(typeof parsedArgs)[K]> }

const accumulatedArgs: Partial<Args> = {
  help: parsedArgs.help,
  verbose: parsedArgs.verbose,
}

if (parsedArgs.component !== undefined) {
  accumulatedArgs.component = parsedArgs.component
}

//
// Cache
//
type Cache = {
  args: Partial<Args>
}

const repoRoot = process.cwd()
const cacheDir = path.join(repoRoot, 'node_modules', '.cache', scriptName)
const cacheFile = path.join(cacheDir, 'cache.json')

async function readCache(): Promise<Cache> {
  try {
    const cache = (await fs.readJson(cacheFile)) as Cache
    cache.args = cache.args || {}
    return cache
  } catch {
    return { args: {} }
  }
}

async function writeCache(cache: Cache): Promise<void> {
  await fs.ensureDir(cacheDir)
  await fs.writeJson(cacheFile, cache, { spaces: 2 })
}

const cache = await readCache()

//
// Logging
//
function log(...args: Parameters<typeof console.log>): void {
  console.log(...args)
}

function debug(...args: Parameters<typeof console.log>): void {
  if (parsedArgs.verbose) {
    console.log(`[${scriptName}]`, ...args)
  }
}

//
// Help
//
if (parsedArgs.help) {
  log(`Usage: ${scriptCommand} [options]

Options:
  --component <name>   Component to preview: chessboard
  --verbose, -v        Enable debug logs
  --help, -h           Show help
`)
  process.exit(0)
}

//
// Script
//
const componentName = await (async function () {
  let response: ComponentName

  if (parsedArgs.component !== undefined) {
    response = parsedArgs.component
  } else {
    response = await select<ComponentName>({
      choices: [{ name: 'ChessBoard', value: 'chessboard' }],
      default: cache.args.component ?? 'chessboard',
      message: 'Choose a component to preview:',
    })
  }

  cache.args.component = response
  accumulatedArgs.component = response

  debug('component:', response)
  await writeCache(cache)

  return response
})()

//
// Repeatable CLI command
//
const stringArgs = Object.entries(accumulatedArgs).reduce((args, [key, value]) => {
  if (value === undefined) {
    return args
  }

  if (typeof value === 'boolean') {
    if (value) {
      args += ` --${key}`
    }
  } else {
    args += ` --${key} "${value}"`
  }

  return args
}, '')

log(`\nYou can re-run this script with same settings using the following command:\n`, `${scriptCommand}${stringArgs}`)

const preview = components[componentName]

render(preview.render())

function parseComponentName(value: unknown): ComponentName | undefined {
  if (Array.isArray(value)) {
    return parseComponentName(value.at(-1))
  }

  if (value === undefined) {
    return undefined
  }

  if (isComponentName(value)) {
    return value
  }

  throw new Error(`Unknown component "${String(value)}". Expected chessboard.`)
}

function isComponentName(value: unknown): value is ComponentName {
  return typeof value === 'string' && value in components
}
