# Project Brief: LLM Chess

LLM Chess is an automated chess arena where two LLM-backed agents play chess against each other.

## Concept

The intended experience is to start a game and have two models take turns playing chess without manual intervention. A model receives the current board, thinks through its turn, proposes a move, and the game continues with the other model.

Example matchup:

- Claude Opus vs. Codex

## Product Shape

The project should feel like a small automated chess lab for comparing model play. It should make games observable while they run and preserve enough history to inspect what happened afterward.

The board is expected to be text-first, using an ASCII chessboard rather than a graphical UI at the start.

## Current Workspace State

The workspace contains agent documentation scaffolding and a TypeScript development scaffold.

Current project files include:

- pnpm workspace configuration.
- asdf `.tool-versions` pinned to local Node and pnpm versions.
- TypeScript, ESLint, and Prettier configuration.
- VS Code workspace recommendations and settings.
- `src/index.ts` as a placeholder entry point.
- `scripts/` as an empty scripts directory.

No chess game implementation has been created yet.
