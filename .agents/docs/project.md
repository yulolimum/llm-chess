# Project Brief: LLM Chess

LLM Chess is an automated chess arena where two LLM-backed agents play chess against each other.

## Purpose

The project exists to run model-vs-model chess games with as little human intervention as possible. A user starts a game, chooses the two players, and the game proceeds through scripted turn coordination.

Example matchup:

- Claude Opus vs. Codex

## Product Shape

The project should feel like a small automated chess lab for observing and comparing model play. Games should be easy to start, visible while they run, and inspectable after they finish.

LLM Chess is terminal-only. The main experience is a CLI game manager, and a GUI is not part of the product direction.

The start flow asks for white and black player configuration. Provider options are based on installed local CLIs, and model options come from the project's supported model list. The user can also provide optional strategy guidance for each player before the game starts.

## Terminal UI

The project uses a terminal UI for game display. The board should feel like a real chess board while staying readable in a command-line environment.

The running game view shows a move feed, Stockfish labels and evaluations, player metadata, player strategy guidance when present, captured pieces, status badges, and the current board. Move rationales are public summaries intended for observation, not hidden chain-of-thought.

Completed games can be replayed from the terminal. Replay playback focuses on the changing board position, then ends on the final board with the full activity feed and recorded move analysis visible for review.

Completed games can also be exported as PGN for analysis in external chess tools.

Component previews are available through `pnpm dev:storybook` so UI pieces can be checked independently from the game runner.

## Player Model

Each player is a long-lived LLM session. The model should keep its own conversational continuity across turns instead of being restarted from scratch for every move.

The model is responsible for choosing a move when it is its turn. Agent protocol scripts are responsible for the mechanics around turns, validation, state updates, waiting, and handoff.

Players submit human-readable move text and a concise public rationale through `pnpm agent:move`. They do not write game records directly.

Resignation is not currently part of the game protocol.

## Game Records

Each game has a dedicated record of what happened. The record is sufficient to inspect the game after the fact and understand the sequence of moves, board states, public rationales, timing, and final result.

Game records also include player provider, model, strategy metadata, and Stockfish move analysis so games remain understandable after the live session ends. Interrupted games preserve their records and logs, but replay and PGN export only list completed games.

Runtime logs are separate from game state. Logs explain what the runner did; game records explain what happened in the game.

## Current Workspace State

The workspace contains a TypeScript CLI app and a validated game session launcher.

- pnpm workspace configuration.
- asdf `.tool-versions` pinned to local Node and pnpm versions.
- TypeScript, ESLint, and Prettier configuration.
- VS Code workspace recommendations and settings.
- User-facing `pnpm game:start`, `pnpm game:replay`, and `pnpm game:export` commands.
- Agent protocol `pnpm agent:move` and `pnpm agent:wait` commands for LLM turn coordination.
- Developer `pnpm dev:storybook` command for terminal UI component previews.
- Runtime output in `.games/<guid>.jsonl` and `.games/<guid>.log`.
- Initial chess game state creation using `chess.js`.
- A chessboard component that renders from `chess.js` board state and displays Stockfish move analysis in the move feed.
- Player provider, model, supported effort, and optional strategy selection when starting a game.
- Player provider, model, effort, and strategy metadata recorded with each game.
- Local dependency checks for tmux, Stockfish, and supported provider CLIs.
- Static model and effort option lists for supported CLIs.
- Chess move submission and turn waiting through agent protocol scripts.
- Move validation, replay, and basic match completion detection through `chess.js`.
- Public move rationales and Stockfish analysis recorded with validated moves.
- Explicit game-end records with result and resolution reason.
- Game-end cleanup for player sessions.
- A repeatable command printed after a completed game.
- Completed game replay with selectable playback speed.
- Completed game PGN export for external analysis tools. PGN export omits JSONL-only Stockfish metadata.
