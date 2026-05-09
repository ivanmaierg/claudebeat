---
description: Browse, preview, and pick your default claudebeat notification sound.
allowed-tools: Bash(node:*), Read
---

You are helping the user pick their default notification sound for the claudebeat plugin.

Keep it warm, short, and direct. Let the sounds speak — don't over-explain.

---

## Step 0 — Show current default

Read `${CLAUDE_PLUGIN_DATA}/config.json` with the Read tool.

- If it exists and has a `defaultSound` key, render:
  > **Current default:** `<value>`
- If the file is missing or has no `defaultSound`, render:
  > **No default set** — pick one below.

---

## Step 1 — Load the catalog

Read `${CLAUDE_PLUGIN_ROOT}/sounds/index.json` with the Read tool. Shape:

```json
{ "packs": { "<pack>": { "label": "...", "description": "...", "sounds": [ { "id": "...", "label": "...", "description": "..." } ] } } }
```

For each sound, the **fullId** is `<packName>/<id>` (e.g. `chiptune/pixel`). Use fullId for previews and saves.

Do NOT hardcode the list of sounds in your reply — build it from the file you just read so the menu always matches the catalog.

---

## Step 2 — Present the catalog

For each pack in `packs`, render one section: an H3 header with `pack.label`, an italic line with `pack.description`, then a Markdown table.

Numbering is **continuous across packs** (1-indexed in display order). Mark the current-default row by prefixing the `#` cell with `▸` (otherwise leave a leading space so columns stay aligned).

Example shape (values come from the JSON, not from this template):

```
### Chiptune / 8-bit

_NES and Game Boy voices: pulse, triangle, and noise channels._

| # | Sound | ID | Description |
|---|-------|-----|-------------|
| ▸ 1 | Pixel | `chiptune/pixel` | Two-note square-wave blip… |
|   2 | Blip  | `chiptune/blip`  | Single A5 square-wave snap… |
```

Below the last table:

```
Type a number or name to preview. (s = save · q = quit · list = show all)
```

Note: volume control is macOS-only (via `afplay`). On Linux and Windows, the OS mixer controls volume.

---

## Step 3 — Preview on request

When the user picks a sound by number or name, resolve to its **fullId** from the catalog you loaded:
- A number → the Nth row in display order, across all packs (1-indexed).
- A name → match the `id` field (case-insensitive). If the same `id` exists in multiple packs, ask which pack.

Then run via Bash:

```
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT} CLAUDE_PLUGIN_DATA=${CLAUDE_PLUGIN_DATA} node ${CLAUDE_PLUGIN_ROOT}/scripts/play.mjs --preview <fullId>
```

The two leading env-var assignments are required: the Claude Code Bash tool does not propagate plugin runtime env to subprocesses, and `play.mjs` hard-fails if either is unset.

After the command returns:
- If stderr is empty → render `**Played** \`<fullId>\`.` then the short re-prompt (Step 5).
- If stderr contains `[claudebeat]` → report it naturally: "Looks like playback failed: <message>"
- Exit code is always 0 — look at stderr, not the exit code.

Remember the last preview as `current_preview = "<fullId>"`.

---

## Step 4 — Save on confirm

When the user types `s` (single letter), `save`, `yes`, `lock it in`, or similar, run:

```
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT} CLAUDE_PLUGIN_DATA=${CLAUDE_PLUGIN_DATA} node ${CLAUDE_PLUGIN_ROOT}/scripts/play.mjs --save <current_preview>
```

This writes `${CLAUDE_PLUGIN_DATA}/config.json` with the chosen sound as `defaultSound`.

Confirm in one or two short lines:

> **Saved.** `<fullId>` is now your default notification sound. Every event will use this from now on.
>
> _Want it to follow you across machines or a fresh install? Optionally set `claudebeat → defaultSound` in `/plugin`. That value outranks this file, but isn't needed for it to work here._

---

## Step 5 — Short re-prompt

After a preview, do NOT re-render the full catalog. Show only:

```
Which next? (s = save · q = quit · list = show all)
```

- `list` or `?` → re-render Step 2 (full tables).
- number or name → preview (Step 3).
- `s` → save the last-previewed sound (Step 4).
- `q`, `quit`, `done` → stop.
- invalid input → one-line error, then the short re-prompt again.
