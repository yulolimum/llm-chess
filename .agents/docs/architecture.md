# Architecture

LLM Chess uses a terminal-native runner, tmux-managed player sessions, and script-mediated turn handoff.

## Runner

The user starts a game with `pnpm game:start`.

The runner owns the game session. It checks required local tooling, creates the game record, starts the player sessions, streams game activity in the foreground, and cleans up the player sessions when stopped.

The runner is intended to run from a normal terminal. It is not designed around Conductor's non-interactive shell as the game runtime.

The runner is the only user-facing entry point for a normal game. It asks for white and black player configuration, filters providers to installed local CLIs, and stores selected settings so a completed game can be rerun with the same configuration.

Completed games can be inspected with `pnpm game:replay`. The replay command scans `.games` for completed JSONL records, asks the user to choose a game and playback speed, then renders the recorded positions in the terminal.

Completed games can be exported with `pnpm game:export`. The export command scans completed records with the same selection pattern and prints PGN to the terminal.

## Player Sessions

Each player runs in its own tmux session. The sessions are named from the game id:

- `llm-chess-<guid>-white`
- `llm-chess-<guid>-black`

The runner starts these sessions but does not attach to them. The foreground process remains the game manager.

Before starting a new game, existing LLM Chess tmux sessions are cleared so each game starts from a fresh pair of player sessions.

When the game ends, or when the runner is interrupted, the runner stops the player sessions while preserving the game record and log files.

## Turn Coordination

The validated coordination pattern is script-mediated.

An LLM does not independently watch the game state. Instead, when it has acted, it calls a project script that waits until the opposing player has acted. That script resolves only when it is useful for the model to continue.

This pattern keeps each model in a continuous session while keeping turn progression deterministic and observable.

Player prompts instruct the model to call the project scripts for every move and wait. The scripts print only the information the model needs to continue.

## Responsibilities

The player is responsible for chess reasoning and move selection.

Project scripts are responsible for:

- accepting or rejecting moves,
- updating the game record,
- detecting whose turn is next,
- blocking while the model should wait,
- returning clear output when the model should continue,
- detecting completed games and recording the final result.

Players submit moves as plain move text with a concise public rationale. They do not write game records directly.

Invalid or unparsable moves are rejected by the move script. The model receives the current state and can try again.

Resignation is intentionally not supported yet.

## Game Records

Each game writes two runtime files:

- `.games/<guid>.jsonl` for game state and events,
- `.games/<guid>.log` for runner logs.

The JSONL record is the source of truth for reconstructing a game. The log file is operational output.

Game records include the starting position, validated moves, public rationales, and a terminal event when the match ends. The end event records the final position, result, and resolution reason, such as checkmate or draw.

The start event includes player metadata: provider, model, and strategy text. This keeps completed records self-describing for replay and later inspection.

PGN export rebuilds the game through `chess.js` from the recorded moves, sets standard PGN headers, and prints the generated PGN.

Player scripts keep their terminal output focused on turn coordination. Detailed diagnostics are written to the game log.

Move duration in the UI is derived from game event timestamps.

## Terminal UI

Terminal UI components are rendered with Ink.

LLM Chess is a CLI product. UI architecture should stay focused on terminal rendering rather than preparing for a GUI.

The chessboard reads board state from `chess.js`. UI components should not maintain a separate chess position model when the engine already provides the board state.

The main game view shows the full move feed, white and black player metadata, captured pieces, player status, and the current board. The move feed is meant to make the match understandable while it is running, not only after inspecting files.

Replay uses the same board component as the live game view. During playback, it hides the move feed so the changing position is the focus. The final replay frame shows the full feed alongside the completed board.

The local storybook script is used to preview terminal UI components outside the game runner.

## Current State

The coordination approach has been validated. The non-chess validation code has been removed.

The repository has a terminal-rendered chessboard backed by `chess.js` board state.

The repository has chess-specific move submission, move validation, turn waiting, completed game replay, completed game PGN export, match completion detection, explicit game-end records, provider availability checks, player strategy prompts, public move rationales, player metadata in game records, and terminal UI previews.
