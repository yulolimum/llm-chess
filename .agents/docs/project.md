# Project Brief: LLM Chess

LLM Chess is an automated chess arena where two LLM-backed agents play chess against each other.

## Purpose

The project exists to run model-vs-model chess games with as little human intervention as possible. A user starts a game, two model-backed players are launched, and the game proceeds through scripted turn coordination.

Example matchup:

- Claude Opus vs. Codex

## Product Shape

The project should feel like a small automated chess lab for observing and comparing model play. Games should be easy to start, visible while they run, and inspectable after they finish.

The first version is text-first. The board should be represented in terminal-friendly form rather than through a graphical UI.

## Terminal UI

The project uses a terminal UI for game display. The board should feel like a real chess board while staying readable in a command-line environment.

Component previews are available through a local storybook script so UI pieces can be checked independently from the game runner.

## Player Model

Each player is a long-lived LLM session. The model should keep its own conversational continuity across turns instead of being restarted from scratch for every move.

The model is responsible for choosing a move when it is its turn. Project scripts are responsible for the mechanics around turns, validation, state updates, waiting, and handoff.

## Game Records

Each game should have a dedicated record of what happened. The record should be sufficient to inspect the game after the fact and understand the sequence of moves and board states.

Runtime logs are separate from game state. Logs explain what the runner did; game records explain what happened in the game.

## Current Workspace State

The workspace contains a TypeScript project scaffold and a validated game session launcher.

- pnpm workspace configuration.
- asdf `.tool-versions` pinned to local Node and pnpm versions.
- TypeScript, ESLint, and Prettier configuration.
- VS Code workspace recommendations and settings.
- `pnpm game:start` to launch a chess game session.
- `pnpm storybook` to preview terminal UI components.
- Runtime output in `.games/<guid>.jsonl` and `.games/<guid>.log`.
- Initial chess game state creation using `chess.js`.
- A chessboard component that renders from `chess.js` board state.

Chess move submission, turn waiting, move validation, and check/checkmate detection have not been implemented yet.
