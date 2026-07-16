if (process.env['NO_COLOR'] === undefined) {
  process.env['FORCE_COLOR'] ||= '1'
}

import type { MoveFeedAnalysis, MoveFeedEntry } from '../components/ChessBoard.js'

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
const scriptCommand = 'pnpm dev:storybook'
const sampleMoveAnalyses = [
  {
    classification: 'best',
    eval: { type: 'cp', value: 47 },
  },
  {
    classification: 'excellent',
    eval: { type: 'cp', value: 34 },
  },
  {
    classification: 'good',
    eval: { type: 'cp', value: 42 },
  },
  {
    classification: 'inaccuracy',
    eval: { type: 'cp', value: 88 },
  },
  {
    classification: 'mistake',
    eval: { type: 'cp', value: -115 },
  },
  {
    classification: 'blunder',
    eval: { type: 'cp', value: -320 },
  },
] as const satisfies readonly MoveFeedAnalysis[]
const chessboardMoveFeed = withSampleAnalysis([
  {
    text: 'Game started',
    type: 'game-started',
  },
  {
    color: 'w',
    duration: '9s',
    move: 'e4',
    moveNumber: 1,
    rationale: "Opening with the King's Pawn to control the center and free the bishop and queen.",
    type: 'move',
  },
  {
    color: 'b',
    duration: '5s',
    move: 'e5',
    moveNumber: 1,
    rationale:
      "I match White's central pawn and fight for d4 and f4. This keeps development flexible for the kingside knight and bishop.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '3s',
    move: 'Nf3',
    moveNumber: 2,
    rationale: 'Developing the knight to attack the e5 pawn and prepare kingside castling.',
    type: 'move',
  },
  {
    color: 'b',
    duration: '5s',
    move: 'Nc6',
    moveNumber: 2,
    rationale:
      'I develop the knight to a natural square and reinforce the e5 pawn. It also adds pressure on d4 for the central fight.',
    type: 'move',
  },
  {
    color: 'w',
    duration: '6s',
    move: 'Bc4',
    moveNumber: 3,
    rationale: 'The Italian setup: developing the bishop to its most active diagonal, eyeing the f7 weakness.',
    type: 'move',
  },
  {
    color: 'b',
    duration: '7s',
    move: 'Nf6',
    moveNumber: 3,
    rationale:
      "I develop the kingside knight and put immediate pressure on White's e4 pawn. This also prepares castling and contests the center.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '5s',
    move: 'O-O',
    moveNumber: 4,
    rationale: 'Castling to safeguard the king and connect the rooks before the middlegame begins.',
    type: 'move',
  },
  {
    color: 'b',
    duration: '6s',
    move: 'Bc5',
    moveNumber: 4,
    rationale:
      'I develop the bishop to an active diagonal and increase pressure toward f2. This keeps Black ready to castle while maintaining central control.',
    type: 'move',
  },
  {
    color: 'w',
    duration: '3s',
    move: 'c3',
    moveNumber: 5,
    rationale: "Preparing the d4 break to build a strong pawn center and challenge Black's bishop on c5.",
    type: 'move',
  },
  {
    color: 'b',
    duration: '9s',
    move: 'O-O',
    moveNumber: 5,
    rationale:
      "I castle before the center opens, improving king safety and connecting the rook. Black can now meet White's d4 break from a stable position.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '3s',
    move: 'd4',
    moveNumber: 6,
    rationale: 'Striking in the center to open lines and challenge the bishop on c5, claiming central space.',
    type: 'move',
  },
  {
    color: 'b',
    duration: '8s',
    move: 'exd4',
    moveNumber: 6,
    rationale:
      "I exchange in the center to reduce White's space advantage and open lines for my pieces. This also asks White to commit a recapture before I place the bishop.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '8s',
    move: 'cxd4',
    moveNumber: 7,
    rationale: 'Recapturing to build a broad pawn center on d4 and e4 while gaining a tempo on the c5 bishop.',
    type: 'move',
  },
  {
    color: 'b',
    duration: '18s',
    move: 'Bb6',
    moveNumber: 7,
    rationale:
      "I retreat the bishop while preserving its active diagonal toward White's king. This keeps development intact and avoids giving White a simple tempo on the center.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '15s',
    move: 'd5',
    moveNumber: 8,
    rationale: 'Gaining space and chasing the knight with tempo, building a strong central pawn duo.',
    type: 'move',
  },
  {
    color: 'b',
    duration: '14s',
    move: 'Ne7',
    moveNumber: 8,
    rationale:
      "I move the attacked knight to a solid square where it supports the center and kingside. Black can challenge White's pawn chain with d6 next.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '18s',
    move: 'e5',
    moveNumber: 9,
    rationale:
      "Pushing the pawn to gain a large space advantage and drive the f6 knight to the rim, cramping Black's position.",
    type: 'move',
  },
  {
    color: 'b',
    duration: '12s',
    move: 'Nfxd5',
    moveNumber: 9,
    rationale:
      "I capture the advanced d-pawn and start breaking down White's pawn chain. If White trades on d5, my other knight can recapture and keep the center under control.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '1m',
    move: 'Bxd5',
    moveNumber: 10,
    rationale:
      'Capturing the knight; if Black recaptures with Nxd5 the knight is undefended and Qxd5 wins material, so I regain the pawn with interest.',
    type: 'move',
  },
  {
    color: 'b',
    duration: '39s',
    move: 'Nxd5',
    moveNumber: 10,
    rationale:
      "I eliminate White's active bishop and reduce the attacking pressure on my kingside. If White recaptures with the queen, I can gain time by challenging it with c6.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '8s',
    move: 'Qxd5',
    moveNumber: 11,
    rationale:
      "The knight is undefended, so I capture it. Black's planned c6 only kicks the queen without regaining the piece, leaving me up a clean minor.",
    type: 'move',
  },
  {
    color: 'b',
    duration: '6s',
    move: 'c6',
    moveNumber: 11,
    rationale:
      'I attack the exposed queen and gain a tempo to stabilize the position. This also prepares a stronger pawn center once the queen moves.',
    type: 'move',
  },
  {
    color: 'w',
    duration: '26s',
    move: 'Qd3',
    moveNumber: 12,
    rationale:
      "Retreating to a safe central square that Black can't harass, keeping my extra piece and preparing to develop with Nc3, Bf4 and rooks to the center.",
    type: 'move',
  },
  {
    color: 'b',
    duration: '25s',
    move: 'd5',
    moveNumber: 12,
    rationale:
      "I strike back in the center and challenge White's advanced e-pawn. Opening lines gives my bishops and queen more activity to compensate for the material deficit.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '19s',
    move: 'exd6',
    moveNumber: 13,
    rationale:
      'Capturing en passant to win a second pawn and plant an advanced, cramping pawn on d6 that Black must spend time dealing with.',
    type: 'move',
  },
  {
    color: 'b',
    duration: '45s',
    move: 'Qd7',
    moveNumber: 13,
    rationale:
      'I blockade the advanced d-pawn and attack it without allowing an immediate queen trade. This stops the pawn from advancing and prepares to recover it next move.',
    type: 'move',
  },
  {
    color: 'w',
    duration: '19s',
    move: 'Bf4',
    moveNumber: 14,
    rationale:
      'Developing with tempo and adding a second defender to the strong d6 pawn, completing my development while staying up a piece and a pawn.',
    type: 'move',
  },
  {
    color: 'b',
    duration: '28s',
    move: 'Qf5',
    moveNumber: 14,
    rationale:
      "I move the queen to an active protected square and attack White's queen. If queens trade, my bishop recaptures and White's attacking coordination is reduced.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '12s',
    move: 'Qxf5',
    moveNumber: 15,
    rationale:
      "Trading queens to simplify into a clean endgame where I'm up a full piece and a pawn - the easiest path to convert my material advantage.",
    type: 'move',
  },
  {
    color: 'b',
    duration: '6s',
    move: 'Bxf5',
    moveNumber: 15,
    rationale:
      'I recapture the queen with the bishop, completing the forced queen trade. With queens off, I can focus on blockading the passed pawn and activating the rooks.',
    type: 'move',
  },
  {
    color: 'w',
    duration: '12s',
    move: 'Nc3',
    moveNumber: 16,
    rationale:
      "Developing the knight off the back rank, escaping the bishop's diagonal, and preparing to bring both rooks into the game to push my extra material.",
    type: 'move',
  },
  {
    color: 'b',
    duration: '9s',
    move: 'Rad8',
    moveNumber: 16,
    rationale:
      "I place a rook behind the passed d-pawn, stopping its advance and attacking it along the file. This is the clearest way to contain White's main asset.",
    type: 'move',
  },
  {
    color: 'w',
    duration: '55s',
    move: 'Rfd1',
    moveNumber: 17,
    rationale:
      'Bringing the rook behind the passed d-pawn to over-protect it and support its eventual advance, keeping a firm grip while up a piece and a pawn.',
    type: 'move',
  },
] as const satisfies readonly MoveFeedEntry[])

function withSampleAnalysis(entries: readonly MoveFeedEntry[]): MoveFeedEntry[] {
  let moveIndex = 0

  return entries.map(entry => {
    if (entry.type !== 'move') {
      return entry
    }

    const analysis = getSampleAnalysis(moveIndex)
    moveIndex += 1

    return {
      ...entry,
      analysis,
    }
  })
}

function getSampleAnalysis(index: number): MoveFeedAnalysis {
  const analysis = sampleMoveAnalyses[index % sampleMoveAnalyses.length]

  if (analysis === undefined) {
    throw new Error('Expected at least one sample move analysis')
  }

  return analysis
}

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
          strategy: 'Keep the position closed and look for long-term queenside pressure.',
        },
        board: new Chess().board(),
        moveFeed: chessboardMoveFeed,
        whitePlayer: {
          capturedPieces: [
            { color: 'b', type: 'q' },
            { color: 'b', type: 'p' },
          ],
          model: 'GPT-5.5',
          provider: 'Codex',
          status: 'on-move',
          strategy: 'Prioritize forcing tactics, direct king pressure, and simple conversions.',
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
