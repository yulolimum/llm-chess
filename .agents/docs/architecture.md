# Architecture

LLM Chess uses a terminal-native runner, tmux-managed player sessions, and script-mediated turn handoff.

## Runner

The user starts a game with `pnpm game:start`.

The runner owns the game session. It checks required local tooling, creates the game record, starts the player sessions, streams game activity in the foreground, and cleans up the player sessions when stopped.

The runner is intended to run from a normal terminal. It is not designed around Conductor's non-interactive shell as the game runtime.

The runner is the only user-facing entry point for a normal live game. It checks tmux, Stockfish, and provider CLIs; asks for white and black player configuration including model effort when supported; filters providers to installed local CLIs; and stores selected settings so a completed game can be rerun with the same configuration.

Completed games can be inspected with `pnpm game:replay`. The replay command scans `.games` for completed JSONL records, asks the user to choose a game and playback speed, then renders the recorded positions in the terminal. Interrupted records are preserved but skipped because they do not contain a game-end event.

Completed games can be exported with `pnpm game:export`. The export command scans completed records with the same selection pattern and supports PGN plus supplemental video-frame export. PGN export rebuilds validated moves and headers; Stockfish analysis remains JSONL-only. Video export renders PNG stills for each replay position into `.games/tmp`.

## Player Sessions

Each player runs in its own tmux session. The sessions are named from the game id:

- `llm-chess-<game-id>-white`
- `llm-chess-<game-id>-black`

The runner starts these sessions but does not attach to them. The foreground process remains the game manager.

Before starting a new game, existing LLM Chess tmux sessions are cleared so each game starts from a fresh pair of player sessions.

When the game ends, or when the runner is interrupted, the runner stops the player sessions while preserving the game record and log files.

## Turn Coordination

The validated coordination pattern is supervisor-mediated through `pnpm supervisor:instruct` and `pnpm agent:move`. These are protocol commands, not normal user entry points.

An LLM does not independently watch the game state. Instead, the runner watches the JSONL record and sends the active player a supervisor instruction when it is time to move.

This pattern keeps each model in a continuous session while keeping turn progression deterministic and observable.

Player setup prompts are passed as the provider CLI's initial prompt when the tmux session is created. This avoids racing an interactive TUI during startup. White's setup prompt also includes the first supervisor turn instruction, because White is always first in the current game setup.

After the first move, the runner watches the JSONL record and sends the next active player a supervisor instruction through the live tmux session. If no move is recorded for the instructed player after the retry interval, the runner sends a stalled-turn instruction to the same player.

Player prompts instruct the model to wait for supervisor messages, then call `pnpm agent:move` for every move. After an accepted move, the model stops and waits for the next supervisor instruction. There is no separate player-side wait or polling command.

## Responsibilities

The player is responsible for chess reasoning and move selection.

Agent protocol scripts are responsible for:

- accepting or rejecting moves,
- analyzing accepted moves with Stockfish,
- updating the game record,
- detecting completed games and recording the final result.

Supervisor instructions are responsible for:

- detecting whose turn is next,
- sending the current board context to the active player session,
- retrying the active player after a stalled turn,
- keeping turn handoff out of the player process.

Players submit moves as plain move text with a concise public rationale. They do not write game records directly.

Invalid or unparsable moves are rejected by the move script. The model receives the current state and can try again.

Resignation is intentionally not supported yet.

## Stockfish

Stockfish is invoked as a local UCI engine. The project shells out to the `stockfish` binary; it does not call an external chess-analysis API.

Accepted moves are analyzed from the pre-move FEN. The analysis compares the engine's preferred move with the played move, then stores a move-quality label and engine evaluation for later display.

Stockfish analysis is part of the accepted-move path. If the engine is missing, `pnpm game:start` fails before starting player sessions.

## Game Records

Each game writes two runtime files:

- `.games/<epoch-ms>--<white-model>_<white-effort>--<black-model>_<black-effort>.jsonl` for game state and events,
- `.games/<epoch-ms>--<white-model>_<white-effort>--<black-model>_<black-effort>.log` for runner logs.

The JSONL record is the source of truth for reconstructing a game. The log file is operational output.

Game records include the starting position, validated moves, public rationales, Stockfish move analysis, and a game-end event when the match ends. The end event records the final position, result, and resolution reason, such as checkmate or draw.

The start event includes player metadata: provider, model, selected effort when present, and strategy text. This keeps completed records self-describing for replay and later inspection.

PGN export rebuilds the game through `chess.js` from the recorded moves, sets standard PGN headers, and prints the generated PGN.

Video-frame export replays the same JSONL record into board props and renders each position through Remotion. It writes one PNG per frame to `.games/tmp/<game-id>-<frame>.png`. The final frame includes the game-end event so player statuses, winner, result, and ending reason are visible. This is supplemental export infrastructure; it does not yet encode a final video file.

Protocol scripts keep their terminal output focused on move submission and turn coordination. Detailed diagnostics are written to the game log.

Move duration in the UI is derived from game event timestamps.

Stockfish analysis is stored on move events. Analysis records the engine, depth, best move, played move, White-normalized engine evaluations, mover-perspective loss, expected-points loss when WDL is available, principal variation, and move-quality label.

## UI Rendering

Terminal UI components are rendered with Ink.

LLM Chess is a CLI product. The terminal view remains the live game UI. Web rendering is scoped to export frames and browser previews, not a separate app surface.

The chessboard reads board state from `chess.js`. UI components should not maintain a separate chess position model when the engine already provides the board state.

The main game view shows the full move feed, white and black player metadata, selected effort when present, player strategy guidance when present, captured pieces, player status, and the current board. The move feed includes public rationales plus Stockfish labels and evaluations such as `Best · +0.44`. Evaluations use standard chess-engine sign convention: positive favors White and negative favors Black.

Replay uses the same board component as the live game view. During playback, it hides the move feed so the changing position is the focus. The final replay frame shows the full feed alongside the completed board.

The web chessboard accepts the same shared board props as the terminal chessboard but uses browser layout for rendered frames. It shows the current move, a compact move feed, player rails, captured pieces, status badges, Stockfish labels, and a final result banner when the game-end event is present.

The local `pnpm dev:storybook` script is used to preview board components outside the game runner. It supports the terminal board preview and the web board preview used by Remotion.

## Current State

The coordination approach has been validated. The non-chess validation code has been removed.

The repository has a terminal-rendered chessboard backed by `chess.js` board state.

The repository has chess-specific move submission, supervisor turn instruction, move validation, Stockfish analysis for accepted moves, completed game replay, completed game PGN export, supplemental video-frame export, match completion detection, explicit game-end records, provider availability checks, player effort and strategy prompts, public move rationales, player metadata in game records, terminal board previews, and web board previews.
