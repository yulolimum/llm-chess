---
name: publish-games-to-github
description: Publish completed LLM Chess games to GitHub issues for review and discussion. Use when asked to post, publish, share, or create GitHub issues for completed games, including replay videos and PGN.
---

# Publish games to GitHub

## Goal

Create GitHub issues for completed LLM Chess games that have not been posted yet. Each issue should be easy to review, discuss, and analyze from GitHub.

Use this GitHub repository explicitly for all GitHub CLI commands:

```text
yulolimum/llm-chess
```

## Rules

- Never create issues without first showing the candidate table and waiting for the user's selection.
- Treat a game as already posted when an open or closed issue body contains the exact game id in the `**Game**:` field. Also treat exact-title matches as already posted for issues created by older versions of this workflow.
- Use the `.games/*.jsonl` filename without the `.jsonl` extension as the game id.
- Use only the timestamp prefix from the game id in the issue title. The timestamp prefix is everything before the first `--`.
- Generate the rest of the issue title from the two player strategies. The title should distill the strategic matchup descriptively; length does not matter.
- Format issue titles as `<timestamp-prefix> - <generated strategy title>`.
- Copy selected game ids from the candidate table or filename. Do not retype or manually transform game ids.
- Use `pnpm` scripts for project operations. Do not call `tsx src/scripts/...` directly.
- Add the `game` label to every created issue. Create the label if it does not exist.
- Add provider labels for both players, formatted as `provider:<provider>`.
- Add model labels for both players, formatted as `model:<model>_<effort or none>`.
- Deduplicate labels before creating the issue.
- Include PGN in the issue body inside a fenced `pgn` code block.
- Do not include exported PNG frame information in the issue.
- Do not upload replay videos automatically. GitHub release assets render as downloads, not inline issue videos.
- In the final report, present the local MP4 path and issue URL as a required manual step so the user can drag and drop the video into the GitHub issue web UI.

## Workflow

1. Read project docs if needed:

   ```sh
   sed -n '1,220p' .agents/docs/project.md
   sed -n '1,260p' .agents/docs/architecture.md
   ```

2. Check GitHub CLI state:

   ```sh
   gh auth status
   gh repo view yulolimum/llm-chess --json nameWithOwner,url
   ```

3. Scan completed games:

   - List `.games/*.jsonl`.
   - Parse each JSONL file event by event.
   - Keep records with a `game_ended` event.
   - Read the `game_started` event for player metadata.
   - Read `move` events for move count and PGN reconstruction.

4. Find already-posted games:

   ```sh
   gh issue list -R yulolimum/llm-chess --state all --limit 1000 --json number,title,url,labels,body
   ```

   Match by the body `**Game**:` field. Also match exact titles for issues created before the title format changed.

5. Present a numbered candidate table for unposted completed games and wait for the user's selection.

   Include these columns:

   - number
   - proposed title
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

   - Create the `game` label if needed.
   - Create provider and model labels if needed.
   - Create the GitHub issue with the exact format below.

   Label creation pattern:

   ```sh
   gh label create "<label-name>" -R yulolimum/llm-chess --color "<hex-color>" --description "<description>"
   ```

## Issue format

Use this structure exactly, while filling values from the game record. Do not add a top-level heading.

````md
## Metadata

**Game**: `<game-id>`
**Result**: <winner/result/reason>
**Moves**: <move-count>
**Started**: <started timestamp>
**Ended**: <ended timestamp>

## Players

### White

**Provider**: <provider>
**Model**: <model>
**Effort**: <effort or none>
**Strategy**: <white strategy or none>

### Black

**Provider**: <provider>
**Model**: <model>
**Effort**: <effort or none>
**Strategy**: <black strategy or none>

## Replay video

Manual upload required. Drag and drop the local replay video into this issue from:

```text
.games/export/<game-id>.mp4
```

## PGN

```pgn
<pgn>
```
````

Create the issue with:

```sh
gh issue create \
  -R yulolimum/llm-chess \
  --title "<timestamp-prefix> - <generated strategy title>" \
  --body-file "<body-file>" \
  --label game \
  --label "provider:<white-provider>" \
  --label "provider:<black-provider>" \
  --label "model:<white-model>_<white-effort-or-none>" \
  --label "model:<black-model>_<black-effort-or-none>"
```

## Validation

After publishing, verify each issue:

```sh
gh issue view "<issue-number-or-url>" -R yulolimum/llm-chess --json title,url,labels,body
```

In the final response, report:

- created issue URLs
- local MP4 paths for manual drag and drop
- a clear note that video upload is a manual step in the GitHub web UI
- any games skipped because they were already posted
- any failures or manual follow-up needed
