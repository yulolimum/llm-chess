---
name: update-provider-models
description: Refresh LLM Chess supported Claude and Codex model metadata, including model IDs, display labels, default effort levels, and supported effort/thinking levels. Use when asked to update, audit, verify, or regenerate provider model lists for the game start flow.
---

# Update Provider Models

## Goal

Update the static provider catalog used by LLM Chess. The primary file to edit is:

```text
src/game/providers.ts
```

That file owns:

- `effortLevels`
- `modelOptionsByProvider`
- `ModelOption`
- effort label helpers used by `game:start`, replay, export, and the live board

Do not add dynamic runtime discovery to `game:start` unless the user explicitly asks for it. This skill is for refreshing the static catalog from reliable sources.

## Workflow

1. Read `src/game/providers.ts` before making changes.
2. Gather current Codex model metadata.
3. Gather current Claude model metadata.
4. Update only the provider catalog and directly related labels/types in `src/game/providers.ts`.
5. Update docs only if user-facing model or effort behavior changed.
6. Run verification.

## Codex Source

Prefer the installed Codex CLI catalog because it returns structured model and effort metadata for the current CLI/account:

```sh
codex debug models
```

Reduce the JSON to the fields this project needs:

```sh
codex debug models | jq '[.models[]
  | select(.visibility == "list")
  | {
      id: .slug,
      label: .display_name,
      defaultEffort: .default_reasoning_level,
      efforts: [.supported_reasoning_levels[]?.effort],
      priority: .priority
    }
]'
```

Use `priority` for ordering. Map `id` to `value`, `label` to `label`, `defaultEffort` to `defaultEffort`, and `efforts` to `efforts`.

If the CLI command is unavailable or fails, use current official OpenAI/Codex documentation as a fallback and state that the update used docs instead of local CLI metadata.

## Claude Source

Claude Code does not expose a reliable normal-login equivalent of `codex debug models`. Do not scrape the `/model` TUI picker as the source of truth.

Use official Claude documentation for the base catalog:

- Claude Code model configuration docs for aliases, full model names, custom model overrides, and environment settings.
- Claude Platform model overview docs for current model IDs.
- Claude effort/thinking docs for supported effort levels.
- Claude gateway protocol docs only when `ANTHROPIC_BASE_URL` and `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` indicate a gateway setup.

Use local Claude configuration only as an overlay:

- `~/.claude/settings.json`
- managed settings if present
- `ANTHROPIC_DEFAULT_FABLE_MODEL`
- `ANTHROPIC_DEFAULT_OPUS_MODEL`
- `ANTHROPIC_DEFAULT_SONNET_MODEL`
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`
- `ANTHROPIC_CUSTOM_MODEL_OPTION`
- `ANTHROPIC_CUSTOM_MODEL_OPTION_NAME`
- `ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION`
- `ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES`

If gateway discovery is configured, inspect `~/.claude/cache/gateway-models.json` if it exists, or verify the documented gateway discovery method before using gateway-specific models.

When direct-login Claude availability cannot be proven, mark the catalog as documented/recognized by Claude Code rather than account-entitlement verified.

## Effort Rules

Keep effort IDs as CLI values, not display labels.

Known shared labels in this project:

- `low` -> `Low`
- `medium` -> `Medium`
- `high` -> `High`
- `xhigh` -> `Extra High`
- `max` -> `Max`
- `ultra` -> `Ultra`

For Codex, use `supported_reasoning_levels[].effort` and `default_reasoning_level` from `codex debug models`.

For Claude, use only effort values accepted by `claude --effort` and documented as supported by that model. As of Claude Code v2.1.212, `claude --effort` accepts `low`, `medium`, `high`, `xhigh`, and `max`; do not add `ultracode` to `efforts` unless the installed CLI help explicitly accepts it.

If the Claude effort docs list a model as supporting the effort parameter, include at least `low`, `medium`, and `high` with `defaultEffort: 'high'`. Add `xhigh` and `max` only when the docs explicitly list that model for those levels. This handles models such as Claude Opus 4.5, where the docs say effort is supported but do not list the model for `xhigh` or `max`.

Claude Code passes effort through:

```sh
claude --model "$MODEL" --effort "$EFFORT"
```

Codex passes effort through:

```sh
codex --model "$MODEL" -c "model_reasoning_effort=\"$EFFORT\""
```

## Edit Shape

Each supported model should look like this when effort selection is available:

```ts
{
  defaultEffort: 'medium',
  efforts: ['low', 'medium', 'high', 'xhigh'],
  label: 'Provider Model Name',
  value: 'provider-model-id',
}
```

If a model should be selectable but effort support is unknown or not supported, omit `defaultEffort` and `efforts`.

Do not change the public provider IDs `claude` and `codex`.

## Verification

Run:

```sh
pnpm exec prettier --write src/game/providers.ts
pnpm exec tsc --noEmit
pnpm exec eslint src/game/providers.ts src/scripts/start.ts
pnpm game:start --help
```

If docs were updated, include those docs in the Prettier command.

In the final response, report:

- Which sources were used.
- Which models or efforts changed.
- Whether verification passed.
