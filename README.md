<h1 align="center">LLM Chess</h1>

<p align="center">
  An automated CLI chess arena where LLMs play each other.
</p>

## The Idea

LLM Chess is a CLI-first chess lab for answering one of the least urgent questions in modern computing: what happens when two expensive text prediction machines are asked to spend real money and electricity playing a board game from the 6th century?

It is built for burning tokens, warming data centers, and converting a perfectly solved set of rules into a premium cloud workload. It is the kind of project that looks at Stockfish, shrugs, and asks whether the same outcome could be achieved more slowly, more expensively, and with significantly more prose.

You start one command, choose the white and black players, optionally tune each side's effort level and strategy prompt, and the project launches two long-running LLM sessions. Each model chooses moves while the runner validates the game, updates the board, records public move rationales and Stockfish analysis, and streams the match in the terminal. The goal is to observe how different models play chess when they have their own persistent session, a real rules engine, and a clean turn handoff loop. It is equal parts toy, benchmark, and tiny monument to the current state of AI: strangely capable, deeply verbose, and absolutely the most elaborate way to watch `e4`.

<p align="center">
<img width="918" height="1323" alt="pnpm gamestart --verbose -- iTerm -- 2026-06-11-at-00-06-37" src="https://github.com/user-attachments/assets/1002a244-1494-44ed-8b84-081bd7ddafb1" />
</p>

## Prerequisites

LLM Chess expects to run from a normal terminal with local CLI tools available.

- Modern Node.js
- Modern pnpm
- `tmux`
- `stockfish` for move analysis
- `ffmpeg`, only when exporting MP4 replays
- At least one supported LLM provider CLI:
  - `claude`
  - `codex`

## Quick Setup

Install dependencies:

```sh
pnpm install
```

If `tmux` is missing on macOS:

```sh
brew install tmux
```

If `stockfish` is missing on macOS:

```sh
brew install stockfish
```

If `ffmpeg` is missing and you want MP4 exports:

```sh
brew install ffmpeg
```

## Running

### Commands

| Command            | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `pnpm game:start`  | Start and watch a live game.                        |
| `pnpm game:replay` | Replay a completed game record.                     |
| `pnpm game:export` | Export a completed game record as PGN or MP4 video. |

### Quick Start

Start a game:

```sh
pnpm game:start
```

The runner will ask for:

- White provider
- White model
- White effort, when the selected model supports effort selection
- White strategy
- Black provider
- Black model
- Black effort, when the selected model supports effort selection
- Black strategy

Provider choices are filtered to CLIs installed on your machine. The runner creates one tmux session per player, renders the live board in the foreground, and cleans up the player sessions when the game ends or the runner is stopped.

The live move feed shows each move's public rationale, Stockfish label, and engine evaluation:

```text
1.   WHITE  Best · +0.44        - [e4] - 10s
1... BLACK  Good · +0.52        - [Nc6] - 6s
```

Game records are written to:

```text
.games/<epoch-ms>--<white-model>_<white-effort>--<black-model>_<black-effort>.jsonl
.games/<epoch-ms>--<white-model>_<white-effort>--<black-model>_<black-effort>.log
```

The JSONL file is the game record. The log file is operational output for debugging. Interrupted games preserve their JSONL/log files but are not listed by replay/export unless they contain a game-end event.

Move events include Stockfish metadata: best move, played move, depth, evaluation, WDL-derived expected-points loss when available, principal variation, and move-quality label.

The runner starts each player as a long-lived tmux session. The game-start prompt is passed as the provider CLI's initial prompt so the model initializes with the right context. White's initial prompt also includes the first turn instruction. After that, the game manager sends turn instructions to the active player and the player submits moves with `pnpm agent:move`.

### Replays

Replay a completed game:

```sh
pnpm game:replay
```

The replay command scans completed records in `.games`, asks which game to replay, then asks for playback speed. During playback it shows the board position for each move. After the final move, it shows the final board with the full activity feed, including recorded move analysis.

### Full Command

The start command can also be run non-interactively with explicit player settings:

```sh
pnpm game:start \
  --whiteProvider claude \
  --whiteModel claude-opus-4-8 \
  --whiteEffort xhigh \
  --whiteStrategy "Play like you're prime Kasparov" \
  --blackProvider codex \
  --blackModel gpt-5.5 \
  --blackEffort high \
  --blackStrategy "Play like you are 5 years old"
```

Replay can also be run non-interactively:

```sh
pnpm game:replay \
  --game GAME_ID \
  --speed normal
```

### Exports

Export a completed game. PGN is the default format:

```sh
pnpm game:export
```

Export can also be run non-interactively:

```sh
pnpm --silent game:export \
  --game GAME_ID \
  --format pgn
```

The PGN export contains the validated move sequence and game headers. Stockfish metadata remains in the JSONL record and is not emitted as PGN comments.

Export a replay video with the web board:

```sh
pnpm game:export \
  --game GAME_ID \
  --format video
```

`--video` is an alias for `--format video`. Video export writes the MP4 and rendered PNG frames to `.games/export`. The command renders one PNG per replay position with Remotion, then stitches those frames with `ffmpeg` at one second per position. The final result frame is held for three seconds.

### UI Previews

Preview the chessboard component:

```sh
pnpm dev:storybook --component chessboard
```

Preview the web chessboard used for rendered replay frames:

```sh
pnpm dev:storybook --component chessboard-web
```

## Agent Skills

The repo ships Claude Code skills for repeatable operator workflows. Invoke them from a Claude Code session by name.

| Skill                     | Purpose                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `publish-games-to-github` | Post completed games as GitHub issues — matchup-titled, with PGN and provider/model labels. The MP4 is attached manually. |
| `update-provider-models`  | Refresh the supported Claude and Codex model catalog in `src/game/providers.ts` (model IDs, labels, default/supported efforts). |
