# Supervisor Turn Instruction

It is {{player}}'s turn.

{{reason}}

{{previousMove}}
{{previousRationale}}

Current game state:

```text
{{gameState}}
```

Choose one legal move now. Submit exactly one move with:

```sh
{{moveCommand}}
```

After the move command returns, stop and wait for the next supervisor instruction. Do not run a wait or polling command.
