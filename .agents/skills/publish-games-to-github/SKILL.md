---
name: publish-games-to-github
description: Publish completed LLM Chess games to GitHub issues for review and discussion. Use when asked to post, publish, share, or create GitHub issues for completed games, including replay videos and PGN.
---

# Publish games to GitHub

## Goal

Create GitHub issues for completed LLM Chess games that have not been posted yet. Each issue should be easy to review, discuss, and analyze from GitHub.

Use the existing public release as the video asset bucket:

```text
game-replays
```

## Rules

- Never create issues without first showing the candidate table and waiting for the user's selection.
- Treat a game as already posted when an open or closed issue has the exact game id as its title.
- Use the exact game id as the issue title. The game id is the `.games/*.jsonl` filename without the `.jsonl` extension.
- Add the `game` label to every created issue. Create the label if it does not exist.
- Include PGN in the issue body inside a fenced `pgn` code block.
- Do not include exported PNG frame information in the issue.
- Upload replay videos to the `game-replays` release. Game MP4 filenames are unique, so `--clobber` is acceptable when re-running the publisher for the same game.

## Workflow

1. Read project docs if needed:

   ```sh
   sed -n '1,220p' .agents/docs/project.md
   sed -n '1,260p' .agents/docs/architecture.md
   ```

2. Check GitHub CLI state:

   ```sh
   gh auth status
   gh repo view --json nameWithOwner,url
   gh release view game-replays --json tagName,name,isDraft,isPrerelease,url,assets
   ```

3. Scan completed games:

   - List `.games/*.jsonl`.
   - Parse each JSONL file event by event.
   - Keep records with a `game_ended` event.
   - Read the `game_started` event for player metadata.
   - Read `move` events for move count and PGN reconstruction.

4. Find already-posted games:

   ```sh
   gh issue list --state all --limit 1000 --json number,title,url,labels
   ```

   Match by exact title.

5. Present a numbered candidate table for unposted completed games and wait for the user's selection.

   Include these columns:

   - number
   - game id
   - result
   - moves
   - white provider/model/effort
   - white strategy
   - black provider/model/effort
   - black strategy

6. For each selected game:

   - Generate PGN with the existing export flow:

     ```sh
     pnpm game:export --game "<game-id>" --format pgn
     ```

   - Ensure the MP4 exists in `.games/export/<game-id>.mp4`; run the existing video export flow if it is missing:

     ```sh
     pnpm game:export --game "<game-id>" --format video
     ```

   - Upload the MP4:

     ```sh
     gh release upload game-replays ".games/export/<game-id>.mp4" --clobber
     ```

   - Create the `game` label if needed.
   - Create the GitHub issue with the exact format below.

## Issue format

Use this structure exactly, while filling values from the game record.

````md
# Game

| Field   | Value                  |
| ------- | ---------------------- |
| Game    | `<game-id>`            |
| Result  | <winner/result/reason> |
| Moves   | <move-count>           |
| Started | <started timestamp>    |
| Ended   | <ended timestamp>      |

## Players

| Color | Provider   | Model   | Effort           |
| ----- | ---------- | ------- | ---------------- |
| White | <provider> | <model> | <effort or none> |
| Black | <provider> | <model> | <effort or none> |

## Strategies

### White

<white strategy or none>

### Black

<black strategy or none>

## Replay video

[Watch the replay](https://github.com/yulolimum/llm-chess/releases/download/game-replays/<game-id>.mp4)

## PGN

```pgn
<pgn>
```
````

Create the issue with:

```sh
gh issue create --title "<game-id>" --body-file "<body-file>" --label game
```

## Validation

After publishing, verify each issue:

```sh
gh issue view "<issue-number-or-url>" --json title,url,labels,body
gh release view game-replays --json assets
```

In the final response, report:

- created issue URLs
- uploaded or reused video URLs
- any games skipped because they were already posted
- any failures or manual follow-up needed
