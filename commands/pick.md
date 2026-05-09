---
description: Browse, preview, and pick your default claudebeat notification sound.
allowed-tools: Bash(node:*), Read
---

You are helping the user pick their default notification sound for the claudebeat plugin.

Keep the conversation warm and direct. Don't over-explain. Let the sounds speak.

---

## Step 0 — Show current default

Before listing anything, read the current config:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/play.mjs --save defaultSound=__check__
```

Actually, just read the config file directly:

```
${CLAUDE_PLUGIN_DATA}/config.json
```

Use the Read tool on `${CLAUDE_PLUGIN_DATA}/config.json`. If it exists and has a `defaultSound` key, show:

```
Current default: <defaultSound value>
```

If the file doesn't exist or has no `defaultSound`, show:

```
No default set
```

---

## Step 1 — Load the sound catalog

Read the file at `${CLAUDE_PLUGIN_ROOT}/sounds/index.json` using the Read tool.
Parse it — you'll get a `packs` object keyed by pack name.

---

## Step 2 — Present the catalog

Once loaded, show the sounds in this style:

```
Here are your claudebeat sounds — all 8-bit chiptune:

  1. pixel    — Two-note square-wave blip C5→G5. Classic NES motif. The default.
  2. blip     — Single A5 square-wave snap. Arcade cursor select.
  3. click    — Sharp UI-style click. Bandpassed noise burst, tiny.
  4. ring     — Two-beep pulse trill at A5. Old landline ring.
  5. whisper  — Quiet NES white-noise hush. Barely-there.
  6. lattice  — Triangle-wave note at G4. Soft Game Boy lead.
  7. halo     — Two pulse waves a fifth apart. NES powerup-confirm chime.
  8. thock    — Low pulse + noise burst. NES drum punch.

Type a number or name to preview it.
```

Note: volume control is macOS-only (via afplay). On Linux and Windows the OS mixer controls volume.

---

## Step 3 — Preview on request

When the user picks a sound by number or name, resolve it to a `chiptune/<id>` pair:
- 1 or "pixel"   → `chiptune/pixel`
- 2 or "blip"    → `chiptune/blip`
- 3 or "click"   → `chiptune/click`
- 4 or "ring"    → `chiptune/ring`
- 5 or "whisper" → `chiptune/whisper`
- 6 or "lattice" → `chiptune/lattice`
- 7 or "halo"    → `chiptune/halo`
- 8 or "thock"   → `chiptune/thock`

Then run via Bash tool:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/play.mjs --preview chiptune/<id>
```

After the command returns:
- If stderr is empty: say "Played <name>." then show the short re-prompt (Step 5)
- If stderr contains `[claudebeat]`: report it naturally — "Looks like playback failed: <message>"
- Exit code is always 0 — don't treat 0 as success/failure, look at stderr instead.

Remember which sound was just previewed as `current_preview = "chiptune/<id>"`.

---

## Step 4 — Save on confirm

When the user types "s" (single letter), "save", "yes", "lock it in", or similar:

Run via Bash tool:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/play.mjs --save <current_preview>
```

This writes `${CLAUDE_PLUGIN_DATA}/config.json` with the chosen sound as `defaultSound`.

After saving, confirm in one line: "Done — <name> is now your default notification sound."

**Also tell them**: To make this permanent across all Claude Code sessions, open `/plugin`
settings and set `claudebeat → defaultSound` to `<current_preview>` (e.g. `chiptune/pixel`).
The saved file is a per-machine fallback; the plugin settings value takes priority.

---

## Step 5 — Short re-prompt after preview

After previewing, do NOT re-print the full numbered list. Instead show only:

```
Which next? (s=save, q=quit, list=show all)
```

If the user types "list" or "?": re-display the full numbered catalog from Step 2.
If the user types a number or name: preview it (Step 3).
If the user types "s": save the last-previewed sound (Step 4).
If the user types "q", "quit", or "done": stop.
If the input is invalid: one-line error, then re-show the short re-prompt.
