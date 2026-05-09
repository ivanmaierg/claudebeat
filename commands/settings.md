---
description: Configure all claudebeat settings interactively.
allowed-tools: Bash(node:*), Read
---

You are helping the user configure claudebeat. Show the full state up front, then change only what they want — no 12-step march unless they ask for it.

Keep it brisk. Don't pad with explanations the table already covers.

**Important caveat for `recurringUntilInput`**: Claude Code fires the `idle_prompt` Notification after a hardcoded ~60-second delay. The first recurring sound therefore plays ~60 s after Claude finishes — not instantly. Subsequent sounds play every `recurringIntervalSeconds`. Make sure the user understands this before they enable it.

---

## Step 0 — Load current config

Read `${CLAUDE_PLUGIN_DATA}/config.json` with the Read tool. If the file is missing, fall back to these defaults:

| Key | Default |
|---|---|
| `defaultSound` | `chiptune/pixel` |
| `enableNotification` | `true` |
| `enablePermission` | `true` |
| `enableStop` | `false` |
| `notificationSound` | `""` |
| `permissionSound` | `""` |
| `stopSound` | `""` |
| `cooldownSeconds` | `0` |
| `maxPerMinute` | `0` |
| `recurringUntilInput` | `false` |
| `recurringIntervalSeconds` | `60` |
| `recurringMaxDurationSeconds` | `300` |

---

## Step 1 — Show the full state, grouped

Render three Markdown tables under H3 headers. The `Current` column shows the live value (or default if missing). Wrap values in backticks.

### Sounds & events

| Setting | Type | Current | What it does |
|---|---|---|---|
| `defaultSound` | string | `<value>` | Sound id used when an event has no override. |
| `enableNotification` | bool | `<value>` | Play sound on Notification events. |
| `enablePermission` | bool | `<value>` | Play sound on PermissionRequest events. |
| `enableStop` | bool | `<value>` | Play sound when Claude finishes (frequent — opt-in). |
| `notificationSound` | string | `<value>` | Override sound for Notification. Empty = use `defaultSound`. |
| `permissionSound` | string | `<value>` | Override for PermissionRequest. Empty = use `defaultSound`. |
| `stopSound` | string | `<value>` | Override for Stop. Empty = use `defaultSound`. |

### Throttling

| Setting | Type | Current | What it does |
|---|---|---|---|
| `cooldownSeconds` | number ≥ 0 | `<value>` | Minimum seconds between sounds. `0` = disabled. |
| `maxPerMinute` | number ≥ 0 | `<value>` | Max sounds per 60 s sliding window. `0` = disabled. |

### Recurring reminders

| Setting | Type | Current | What it does |
|---|---|---|---|
| `recurringUntilInput` | bool | `<value>` | Loop a reminder while Claude waits for input. **Read caveat above.** |
| `recurringIntervalSeconds` | number ≥ 1 | `<value>` | Seconds between recurring sounds. |
| `recurringMaxDurationSeconds` | number ≥ 1 | `<value>` | Max total time for the recurring loop before auto-stop. |

Then prompt:

```
What do you want to change? (e.g. "cooldownSeconds 5", "enableStop true", "walk" for guided, "done" to finish)
```

---

## Step 2 — Apply changes

Parse the user's reply:

- `<key> <value>` or `<key>=<value>` → validate (rules below), write, confirm in one line, re-prompt the same question (NOT the full tables again).
- `walk` or `walk me through` → switch to sequential mode: walk through every key in the order shown in Step 1, with the same group headers, asking one at a time. For each: `Current: <value> · New value (or "skip"):`. Skip = keep, advance.
- `done`, `quit`, `q`, blank → go to Step 3.
- Anything else → one-line error, ask the same question again.

### Validation rules

- **Sound ids** (`defaultSound`, `notificationSound`, `permissionSound`, `stopSound`) must be a `chiptune/<id>` from the catalog (`pixel`, `blip`, `click`, `ring`, `whisper`, `lattice`, `halo`, `thock`). Override fields (`notificationSound`, `permissionSound`, `stopSound`) also accept empty string.
- **Booleans** accept `true`/`false`, `yes`/`no`, `1`/`0`.
- **Numbers** must be non-negative integers; for `recurringIntervalSeconds` and `recurringMaxDurationSeconds` they must be ≥ 1.

### Writing values

For each change, run via Bash:

```
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT} CLAUDE_PLUGIN_DATA=${CLAUDE_PLUGIN_DATA} node ${CLAUDE_PLUGIN_ROOT}/scripts/play.mjs --save <key>=<value>
```

After each save:
- If stderr is empty → confirm in one line: `Saved \`<key>\` = \`<value>\`.`
- If stderr contains `[claudebeat]` → report the error verbatim and re-prompt the same key.
- Exit code is always 0 — look at stderr, not the exit code.

When the user sets `recurringUntilInput=true`, after confirming, also show:

> Note: the first recurring sound plays ~60 s after Claude finishes (Claude Code `idle_prompt` delay), then every `recurringIntervalSeconds` after that.

Track every successful change as `{key, old, new}` for the summary.

---

## Step 3 — Summary

Render once when the user is done:

```
Changes:
- <key>: <old> → <new>
- ...
```

If nothing changed: `No changes made.`
