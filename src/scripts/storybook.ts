if (process.env['NO_COLOR'] === undefined) {
  process.env['FORCE_COLOR'] ||= '1'
}

import select from '@inquirer/select'
import { render } from 'ink'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import React from 'react'
import { fs, minimist } from 'zx'

import { ChessBoard } from '../components/ChessBoard.js'
import { chessBoardPreviewProps } from '../storybook/chessboard.js'

//
// Constants
//
const scriptName = 'storybook'
const scriptCommand = 'pnpm dev:storybook'
const webPreviewUrl = 'http://localhost:3000'
const components = {
  chessboard: {
    name: 'ChessBoard',
    render: () => React.createElement(ChessBoard, chessBoardPreviewProps),
  },
  'chessboard-web': {
    name: 'ChessBoard.web',
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
  --component <name>   Component to preview: chessboard, chessboard-web
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
      choices: [
        { name: components.chessboard.name, value: 'chessboard' },
        { name: components['chessboard-web'].name, value: 'chessboard-web' },
      ],
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

if (componentName === 'chessboard-web') {
  await runWebPreview()
} else {
  render(components.chessboard.render())
}

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

  throw new Error(`Unknown component "${String(value)}". Expected chessboard or chessboard-web.`)
}

function isComponentName(value: unknown): value is ComponentName {
  return typeof value === 'string' && value in components
}

async function runWebPreview(): Promise<void> {
  log(`\nStarting browser preview at ${webPreviewUrl}\n`)

  let hasOpenedBrowser = false
  const child = spawn(
    'pnpm',
    ['exec', 'remotion', 'studio', 'src/components/Remotion.tsx', '--props', JSON.stringify(chessBoardPreviewProps)],
    {
      cwd: repoRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
    },
  )

  child.stdout.on('data', (chunk: Buffer) => {
    const output = chunk.toString()
    process.stdout.write(output)

    if (!hasOpenedBrowser && output.includes('Server ready')) {
      hasOpenedBrowser = true
      openBrowser(webPreviewUrl)
    }
  })

  child.stderr.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk)
  })

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code !== null) {
        resolve(code)
        return
      }

      resolve(signal === 'SIGINT' ? 130 : 1)
    })
  })

  if (exitCode !== 0 && exitCode !== 130) {
    throw new Error(`Web preview exited with status ${exitCode}`)
  }
}

function openBrowser(url: string): void {
  if (process.platform !== 'darwin') {
    return
  }

  const child = spawn('open', [url], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}
