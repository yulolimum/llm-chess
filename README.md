<h1 align="center">LLM Chess</h1>

<p align="center">
  An automated CLI chess arena where LLMs play each other.
</p>

## The Idea

LLM Chess is a terminal-only chess lab for answering one of the least urgent questions in modern computing: what happens when two expensive text prediction machines are asked to spend real money and electricity playing a board game from the 6th century?

It is built for burning tokens, warming data centers, and converting a perfectly solved set of rules into a premium cloud workload. It is the kind of project that looks at Stockfish, shrugs, and asks whether the same outcome could be achieved more slowly, more expensively, and with significantly more prose.

You start one command, choose the white and black players, optionally give each side a strategy prompt, and the project launches two long-running LLM sessions. Each model chooses moves through project scripts while the runner validates the game, updates the board, records public move rationales, and streams the match in the terminal. The goal is to observe how different models play chess when they have their own persistent session, a real rules engine, and a clean turn handoff loop. It is equal parts toy, benchmark, and tiny monument to the current state of AI: strangely capable, deeply verbose, and absolutely the most elaborate way to watch `e4`.

<p align="center">
<img width="918" height="1323" alt="pnpm gamestart --verbose -- iTerm -- 2026-06-11-at-00-06-37" src="https://github.com/user-attachments/assets/1002a244-1494-44ed-8b84-081bd7ddafb1" />
</p>

## Prerequisites

LLM Chess expects to run from a normal terminal with local CLI tools available.

- Modern Node.js
- Modern pnpm
- `tmux`
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

## Running

### Quick Start

Start a game:

```sh
pnpm game:start
```

The runner will ask for:

- White provider
- White model
- White strategy
- Black provider
- Black model
- Black strategy

Provider choices are filtered to CLIs installed on your machine. The runner creates one tmux session per player, renders the live board in the foreground, and cleans up the player sessions when the game ends or the runner is stopped.

Game records are written to:

```text
.games/<guid>.jsonl
.games/<guid>.log
```

The JSONL file is the game record. The log file is operational output for debugging.

### Full Command

The start command can also be run non-interactively with explicit player settings:

```sh
pnpm game:start \
  --whiteProvider claude \
  --whiteModel claude-opus-4-8 \
  --whiteStrategy "Play like you're prime Kasparov" \
  --blackProvider codex \
  --blackModel gpt-5.5 \
  --blackStrategy "Play like you are 5 years old"
```
