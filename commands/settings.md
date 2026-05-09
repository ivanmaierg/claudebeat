---
description: Configure all claudebeat settings interactively.
allowed-tools: Bash(node:*), Read
---

You are helping the user configure claudebeat. Walk through all 12 settings one at a time.

Keep it brisk. Show current value. Ask for new value or "skip". Validate. Write. Move on.

**Important for `recurringUntilInput`**: Claude Code fires the `idle_prompt` Notification after a hardcoded 60-second delay. This means the first recurring sound plays approximately 60 seconds after Claude finishes responding — not instantly. The recurring feature exists precisely to compensate: the first sound plays ~60 s after Claude finishes; subsequent sounds play every `recurringIntervalSeconds`. Make sure the user understands this before enabling it.

---

## Step 0 — Load current config

Read the current config using the Read tool on `${CLAUDE_PLUGIN_DATA}/config.json`.
If the file doesn't exist, use these defaults:

| Key | Default |
|-----|---------|
| defaultSound | chiptune/pixel |
| enableNotification | true |
| enablePermission | true |
| enableStop | false |
| notificationSound | (empty) |
| permissionSound | (empty) |
| stopSound | (empty) |
| cooldownSeconds | 0 |
| maxPerMinute | 0 |
| recurringUntilInput | false |
| recurringIntervalSeconds | 60 |
| recurringMaxDurationSeconds | 300 |

---

## Step 1 — Walk through settings in order

For each setting, show:

```
[N/12] <key>
  Current: <value>
  <one-line description>
  New value (or "skip"):
```

Process the user's reply:
- Blank or "skip" → keep current value, advance to next setting
- Valid value → write it (see "Writing values" below), confirm in one line, advance
- Invalid value → show one-line error, re-prompt the same setting

### Settings order and validation rules

1. **defaultSound** (string) — Sound id for all events. Must be a valid `chiptune/<id>` from the catalog. Valid ids: pixel, blip, click, ring, whisper, lattice, halo, thock.

2. **enableNotification** (boolean) — Play sound on Notification events. Accept: true/false, yes/no, 1/0.

3. **enablePermission** (boolean) — Play sound on PermissionRequest events. Same boolean input.

4. **enableStop** (boolean) — Play sound when Claude finishes responding (can be frequent). Same boolean input.

5. **notificationSound** (string) — Override sound for Notification events. Empty string = use defaultSound. Must be a valid `chiptune/<id>` or empty.

6. **permissionSound** (string) — Override sound for PermissionRequest events. Empty string = use defaultSound. Must be a valid `chiptune/<id>` or empty.

7. **stopSound** (string) — Override sound for Stop events. Empty string = use defaultSound.

8. **cooldownSeconds** (number, min: 0) — Minimum seconds between sounds. 0 = disabled. Must be a non-negative integer.

9. **maxPerMinute** (number, min: 0) — Maximum sounds per 60-second sliding window. 0 = disabled. Must be a non-negative integer.

10. **recurringUntilInput** (boolean) — **Read the caveat in the header before accepting true.** After enabling, remind the user: "Note: the first recurring sound plays ~60 seconds after Claude finishes (Claude Code idle_prompt delay), then every recurringIntervalSeconds after that."

11. **recurringIntervalSeconds** (number, min: 1) — How often (in seconds) the recurring reminder plays. Must be >= 1.

12. **recurringMaxDurationSeconds** (number, min: 1) — Max total time the recurring loop runs before auto-stopping. Must be >= 1.

---

## Writing values

For each change, run via Bash tool:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/play.mjs --save <key>=<value>
```

Examples:
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/play.mjs --save defaultSound=chiptune/halo`
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/play.mjs --save cooldownSeconds=5`
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/play.mjs --save recurringUntilInput=true`

Exit code is always 0. If stderr contains `[claudebeat]`, report the error and re-prompt.

---

## Step 2 — Summary

After all 12 settings are done, show a one-line summary of what changed (keys and new values). If nothing changed, say "No changes made."
