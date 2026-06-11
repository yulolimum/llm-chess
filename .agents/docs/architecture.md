# Architecture

LLM Chess uses a terminal-native runner, tmux-managed player sessions, and script-mediated turn handoff.

## Runner

The user starts a game with `pnpm game:start`.

The runner owns the game session. It creates the game record, starts the player sessions, streams game activity in the foreground, and cleans up the player sessions when stopped.

The runner is intended to run from a normal terminal. It is not designed around Conductor's non-interactive shell as the game runtime.

## Player Sessions

Each player runs in its own tmux session. The sessions are named from the game id:

- `llm-chess-<guid>-white`
- `llm-chess-<guid>-black`

The runner starts these sessions but does not attach to them. The foreground process remains the game manager.

Before starting a new game, existing LLM Chess tmux sessions are cleared so each game starts from a fresh pair of player sessions.

## Turn Coordination

The validated coordination pattern is script-mediated.

An LLM does not independently watch the game state. Instead, when it has acted, it calls a project script that waits until the opposing player has acted. That script resolves only when it is useful for the model to continue.

This pattern keeps each model in a continuous session while keeping turn progression deterministic and observable.

## Responsibilities

The player is responsible for chess reasoning and move selection.

Project scripts are responsible for:

- accepting or rejecting moves,
- updating the game record,
- detecting whose turn is next,
- blocking while the model should wait,
- returning clear output when the model should continue.

Players submit moves as plain move text. They do not write game records directly.

## Game Records

Each game writes two runtime files:

- `.games/<guid>.jsonl` for game state and events,
- `.games/<guid>.log` for runner logs.

The JSONL record is the source of truth for reconstructing a game. The log file is operational output.

Game records include a terminal event when the match ends. The end event records the final position, result, and resolution reason, such as checkmate or draw.

Player scripts keep their terminal output focused on turn coordination. Detailed diagnostics are written to the game log.

## Terminal UI

Terminal UI components are rendered with Ink.

The chessboard reads board state from `chess.js`. UI components should not maintain a separate chess position model when the engine already provides the board state.

The local storybook script is used to preview terminal UI components outside the game runner.

## Current State

The coordination approach has been validated. The non-chess validation code has been removed.

The repository has a terminal-rendered chessboard backed by `chess.js` board state.

The repository has chess-specific move submission, move validation, turn waiting, game replay, match completion detection, and explicit game-end records.
