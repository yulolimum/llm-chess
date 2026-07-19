---
name: publish-games-to-github
description: Publish completed LLM Chess games to GitHub issues for review and discussion, with social share badges and raw JSONL records and runner logs stored as release assets. Use when asked to post, publish, share, or create GitHub issues for completed games, including videos, PGN, game records, and logs.
---

# Publish games to GitHub

## Goal

Create GitHub issues for completed LLM Chess games that have not been posted yet. Each issue should be easy to review, discuss, and analyze from GitHub.

Use this GitHub repository explicitly for all GitHub CLI commands:

```text
yulolimum/llm-chess
```

Store raw game records and runner logs in the repository's permanent published release:

```text
game-artifacts
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
- Upload the selected completed game's `.jsonl` record and `.log` file to the `game-artifacts` release before creating its issue.
- Never upload artifacts for an active or interrupted game.
- Never use `--clobber` when uploading release assets. Treat an exact asset-name match as already uploaded and reuse its existing URL.
- Link both release assets in the issue's Metadata section using the canonical URLs returned by GitHub.
- Put the Share section last, immediately after PGN.
- Use the generated strategy title without the timestamp prefix as the social share title.
- Use the canonical GitHub issue URL as the social share URL.
- Use `Explore this LLM Chess game: <generated strategy title> (<white-model> vs <black-model>).` as the social share text.
- Do not include hashtags in social share links.
- Percent-encode every social provider query value exactly once.
- Do not include exported PNG frame information in the issue.
- Do not upload videos automatically. GitHub release assets render as downloads, not inline issue videos.
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
   gh repo view yulolimum/llm-chess --json nameWithOwner,url,visibility
   gh release view game-artifacts -R yulolimum/llm-chess --json isDraft,isPrerelease,url,assets
   ```

   Require the repository to be public and the `game-artifacts` release to exist with `isDraft: false` and `isPrerelease: false`.

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

   - Require both `.games/<game-id>.jsonl` and `.games/<game-id>.log` to exist.
   - Read the current `game-artifacts` asset list. For each local file, reuse the canonical asset URL when the exact filename already exists. Upload only files whose exact names are absent:

     ```sh
     gh release upload game-artifacts \
       -R yulolimum/llm-chess \
       ".games/<game-id>.jsonl" \
       ".games/<game-id>.log"
     ```

     Omit an individual path from the command when that asset already exists. Do not use `--clobber`.

   - Query the release again and capture the canonical `url` for both exact asset names:

     ```sh
     gh release view game-artifacts \
       -R yulolimum/llm-chess \
       --json assets
     ```

     Stop before issue creation if either asset or URL is missing.

   - Create the `game` label if needed.
   - Create provider and model labels if needed.
   - Create the GitHub issue with the exact format below, leaving the `<!-- SHARE_BADGES -->` marker in place. Capture the URL printed by `gh issue create` and require it to match `https://github.com/yulolimum/llm-chess/issues/<number>`.
   - Build the share title, text, and provider URLs only after GitHub returns the issue URL. Do not predict or reserve an issue number.
   - Replace only the `<!-- SHARE_BADGES -->` marker in the local body with the four badge lines from the Share badges section below. Keep `## Share` as the final section after `## PGN`.
   - Update the created issue with the completed body:

     ```sh
     gh issue edit "<issue-url>" \
       -R yulolimum/llm-chess \
       --body-file "<completed-body-file>"
     ```

     If this edit fails, preserve the created issue and report that its Share section needs manual follow-up.

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
**Game record**: [`<game-id>.jsonl`](jsonl-release-asset-url)
**Runner log**: [`<game-id>.log`](log-release-asset-url)

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

## Video

⚠️ MANUAL UPLOAD REQUIRED - DRAG & DROP VIDEO HERE.

## PGN

```pgn
<pgn>
```

## Share

<!-- SHARE_BADGES -->
````

Create the issue with:

```sh
issue_url="$(
  gh issue create \
    -R yulolimum/llm-chess \
    --title "<timestamp-prefix> - <generated strategy title>" \
    --body-file "<body-file>" \
    --label game \
    --label "provider:<white-provider>" \
    --label "provider:<black-provider>" \
    --label "model:<white-model>_<white-effort-or-none>" \
    --label "model:<black-model>_<black-effort-or-none>"
)"
```

## Share badges

After issue creation, define:

```text
share_url   = <canonical issue URL returned by GitHub>
share_title = <generated strategy title without timestamp prefix>
share_text  = Explore this LLM Chess game: <share_title> (<white-model> vs <black-model>).
```

Percent-encode each query value independently and substitute the encoded values into these exact badge lines. Do not add hashtags.

```md
[![Share on X](https://img.shields.io/badge/Share_on_X-000000?logo=x&logoColor=white)](https://x.com/intent/tweet?text=<encoded-share-text>&url=<encoded-share-url>)
[![Share on Bluesky](https://img.shields.io/badge/Share_on_Bluesky-0285FF?logo=bluesky&logoColor=white)](https://bsky.app/intent/compose?text=<encoded-share-text-plus-space-plus-share-url>)
[![Share on Reddit](https://img.shields.io/badge/Share_on_Reddit-FF4500?logo=reddit&logoColor=white)](https://www.reddit.com/submit?title=<encoded-share-title>&url=<encoded-share-url>)
[![More sharing options](https://img.shields.io/badge/More_sharing_options-6C757D)](https://www.addtoany.com/share?linkname=<encoded-share-title>&linkurl=<encoded-share-url>)
```

## Validation

After publishing, verify each issue:

```sh
gh issue view "<issue-number-or-url>" -R yulolimum/llm-chess --json title,url,labels,body
```

Require the final body to start with `## Metadata` and end with `## Share` containing all four provider links after the PGN block. Require every provider link to contain the canonical issue URL after decoding, and require the `<!-- SHARE_BADGES -->` marker and all template placeholders to be absent.

Verify that both raw artifacts exist in the published release and that the issue body contains their canonical download URLs:

```sh
gh release view game-artifacts -R yulolimum/llm-chess --json isDraft,isPrerelease,url,assets
```

In the final response, report:

- created issue URLs
- JSONL and log release-asset URLs
- confirmation that the four share badges were added
- full absolute local MP4 paths for manual drag and drop, labeled as `local video`
- a clear note that video upload is a manual step in the GitHub web UI
- any games skipped because they were already posted
- any failures or manual follow-up needed
