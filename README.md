# claudebeat

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-orange)](https://code.claude.com/docs/en/plugins.md)
[![CI](https://github.com/ivanmaierg/claudebeat/actions/workflows/ci.yml/badge.svg)](https://github.com/ivanmaierg/claudebeat/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.2.1-green.svg)](CHANGELOG.md)

**Chiptune notification sounds for Claude Code** — short 8-bit cues that fire when Claude needs your attention.

Eight NES/Game Boy voices — pulse waves, triangle, noise — pick the one that fits your session.

---

## Why claudebeat

Claude Code can run for minutes — long enough that you walk away, switch tabs, or get distracted. The terminal's visual notifications are easy to miss when the window isn't focused. Sound isn't.

Eight short cues, each well under a second, chosen so they don't get annoying after the hundredth play. Pick the one that fits your work and you'll know — without looking — when Claude needs you.

---

## Install

```
/plugin marketplace add ivanmaierg/claudebeat
/plugin install claudebeat
```

> **Minimum Claude Code version**: `2.0.0`
> See [Troubleshooting](#troubleshooting) if you get a `CLAUDE_PLUGIN_ROOT unset` error.

### Upgrading from `claudebeat-local`?

If you previously installed via a local marketplace named `claudebeat-local`, switch to the public one:

```
/plugin marketplace remove claudebeat-local
/plugin marketplace add ivanmaierg/claudebeat
/plugin install claudebeat
/reload-plugins
```

Your saved default sound (`config.json`) carries over automatically — no need to re-pick.

---

## Usage

Once installed, claudebeat works automatically — no configuration needed.
Every time Claude finishes thinking and waits for you, you'll hear a sound.

### Pick your sound with `/claudebeat:pick`

Type `/claudebeat:pick` in Claude Code to open the conversational sound picker.

The picker shows your current default, renders the catalog as a grouped Markdown table with `▸` marking the active default, lets you preview any sound by number or name, and saves your choice with `s`:

```
> Current default: chiptune/pixel

### Chiptune / 8-bit

_NES and Game Boy voices: pulse, triangle, and noise channels._

| #   | Sound   | ID                 | Description                                       |
|-----|---------|--------------------|---------------------------------------------------|
| ▸ 1 | Pixel   | chiptune/pixel     | Two-note square-wave blip, C5 to G5...            |
|   2 | Blip    | chiptune/blip      | Single A5 square-wave snap...                     |
|   ...

Type a number or name to preview. (s = save · q = quit · list = show all)
```

### Configure settings with `/claudebeat:settings`

Type `/claudebeat:settings` to manage all 13 settings — sound choices, event toggles, throttle, and recurring options. The picker renders the full state as three grouped tables (Sounds & events / Throttling / Recurring reminders), and you change values one at a time without a forced sequential walkthrough.

### Standalone CLI _(developers only)_

For people who have cloned the repo. Marketplace-installed users should use the slash commands above — the CLI assumes you're running from the project root.

```bash
# Interactive arrow-key TUI (requires real TTY)
node scripts/pick.mjs

# Or via pnpm scripts
pnpm run pick

# List all sounds
node scripts/pick.mjs --list
node scripts/pick.mjs --list --json

# Save a default sound non-interactively
node scripts/pick.mjs --save chiptune/halo

# Settings TUI
node scripts/pick.mjs settings
pnpm run settings

# Help
node scripts/pick.mjs --help
```

---

## Sounds

All eight are 8-bit chiptune, stored as 8-bit unsigned PCM WAV. NES and Game Boy voices throughout.

| ID | Name | Voice | Description |
|----|------|-------|-------------|
| `chiptune/pixel` | Pixel | Pulse wave | Two-note square-wave blip, C5 → G5. Classic NES motif. **The default.** |
| `chiptune/blip` | Blip | Pulse wave | Single A5 square-wave snap. Arcade cursor select. |
| `chiptune/click` | Click | Noise (bandpassed) | Sharp UI-style click. Bandpassed white-noise burst — tiny and crisp. |
| `chiptune/ring` | Ring | Pulse wave | Two-beep pulse trill at A5. Old landline ring, condensed. |
| `chiptune/whisper` | Whisper | Noise channel | Quiet white-noise hush, low-passed. Barely-there. |
| `chiptune/lattice` | Lattice | Triangle wave | Single G4 note with NES decay envelope. Soft Game Boy lead. |
| `chiptune/halo` | Halo | Dual pulse | Two pulse waves a perfect fifth apart with synced decay. Powerup-confirm chime. |
| `chiptune/thock` | Thock | Pulse + noise | Low pulse body + filtered noise click. NES drum punch. |

All sounds are original syntheses produced via ffmpeg — see [Audio Assets](#audio-assets) below.

---

## Customization

### Via the plugin settings UI

In Claude Code, open `/plugin` settings and find `claudebeat`. Available knobs:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `defaultSound` | string | `chiptune/pixel` | Sound id to play for all events. Format: `<pack>/<id>` |
| `enableNotification` | boolean | `true` | Play sound on Notification events |
| `enablePermission` | boolean | `true` | Play sound on PermissionRequest events |
| `enableStop` | boolean | `false` | Play a sound when Claude finishes responding (Stop event) |
| `notificationSound` | string | _(empty)_ | Sound for Notification events (falls back to `defaultSound`) |
| `permissionSound` | string | _(empty)_ | Sound for PermissionRequest events (falls back to `defaultSound`) |
| `stopSound` | string | _(empty)_ | Sound for Stop events (requires `enableStop: true`) |
| `volume` | number | `1.0` | Playback volume 0.0–1.0. **macOS only.** See Platform Notes. |
| `cooldownSeconds` | number | `0` | Minimum seconds between sounds. 0 = disabled. |
| `maxPerMinute` | number | `0` | Maximum sounds per 60-second sliding window. 0 = disabled. |
| `recurringUntilInput` | boolean | `false` | Replay reminder every N seconds until you type. See caveat below. |
| `recurringIntervalSeconds` | number | `60` | Seconds between recurring reminders (requires `recurringUntilInput: true`) |
| `recurringMaxDurationSeconds` | number | `300` | Max seconds the recurring loop runs before auto-stopping |

### Recurring reminder caveat

> **Important**: The `idle_prompt` Notification fires after a hardcoded **60-second delay** imposed by the Claude Code platform. This means the first recurring sound plays approximately 60 seconds after Claude finishes responding — not instantly. The recurring feature exists precisely to compensate for this: the first sound plays ~60 s after Claude finishes; subsequent sounds play every `recurringIntervalSeconds` seconds thereafter.

### Via environment variables

For power users or per-project overrides. Set these in your shell or in a project `.env`:

| Variable | Scope | Description |
|----------|-------|-------------|
| `CLAUDEBEAT_SOUND_NOTIFY` | Per-event | Override sound for Notification events |
| `CLAUDEBEAT_SOUND_PERMISSION` | Per-event | Override sound for PermissionRequest events |
| `CLAUDEBEAT_SOUND_STOP` | Per-event | Override sound for Stop events |
| `CLAUDEBEAT_SOUND` | Global | Override sound for ALL events |

Values can be:
- A sound id: `chiptune/whisper`, `chiptune/pixel`, `chiptune/thock`
- An absolute path to a custom `.wav` file: `/Users/you/my-sound.wav`

**Precedence** (highest to lowest):
1. `CLAUDEBEAT_SOUND_<KIND>` (per-event env var)
2. `CLAUDEBEAT_SOUND` (global env var)
3. `notificationSound` / `permissionSound` / `stopSound` (userConfig per-event)
4. `defaultSound` (userConfig default)
5. config.json per-event (saved by slash command)
6. config.json default (saved by slash command)
7. Bundled fallback (`chiptune/pixel`)

### Custom sounds

Point any override to an absolute path of a WAV file you own:

```bash
export CLAUDEBEAT_SOUND=/Users/you/my-custom-alert.wav
```

Requirements: WAV format, absolute path, file must exist.

---

## Platform Notes

### macOS

- Player: `afplay` (system, always present on macOS 12+)
- Volume: supported via `afplay -v <0.0–1.0>`
- Playback is non-blocking — the dispatcher exits immediately while the OS plays the sound

### Linux

- Preferred: `paplay` (PulseAudio / PipeWire — present on all modern desktop distros)
- Fallback: `aplay -q` (ALSA — minimal/embedded systems)
- If neither is found: dispatcher logs a diagnostic and exits 0 silently
- **Volume**: not controlled by claudebeat on Linux — use your OS mixer (pavucontrol, alsamixer)
- Headless servers: set `CI=1` in your environment to disable all playback

### Windows

- Player: PowerShell `SoundPlayer` (`-NoProfile -NonInteractive`)
- **Requires PowerShell** (present on all Windows 10+ systems)
- `cmd.exe`-only environments are NOT supported
- **Volume**: not controlled by claudebeat on Windows — use the Windows volume mixer
- Arrow-key TUI in `pick.mjs` requires Windows Terminal (not legacy cmd.exe)
- Path safety: single quotes in paths are automatically escaped (`'` → `''`)

---

## Troubleshooting

### No sound on macOS

1. Check system volume is not muted
2. Verify `afplay` works: `afplay /System/Library/Sounds/Ping.aiff`
3. Check for `[claudebeat]` in Claude Code's hook output

### No sound on Linux

1. Verify PulseAudio/PipeWire is running: `paplay --version`
2. Or verify ALSA: `aplay --version`
3. Test manually: `aplay /usr/share/sounds/alsa/Front_Center.wav`
4. On minimal distros, install: `sudo apt install pulseaudio-utils` (Debian/Ubuntu)

### No sound on Windows

1. Verify PowerShell is available: `powershell -NoProfile -Command "exit 0"`
2. Test SoundPlayer manually:
   ```powershell
   (New-Object Media.SoundPlayer 'C:\Windows\Media\chimes.wav').PlaySync()
   ```

### `CLAUDE_PLUGIN_ROOT unset` error

You're running an older version of Claude Code that has a known bug (#9354) where
`CLAUDE_PLUGIN_ROOT` is not set in hook contexts.

**Fix**: upgrade Claude Code to `>= 2.0.0`. After upgrading, the error disappears.

### Sounds not playing in CI / Docker / SSH

By design. If `CI=1` is set (all major CI providers set this), claudebeat skips
all playback silently. This is the correct behavior — audio in CI is useless.

For local headless dev machines, set `CI=1` yourself:
```bash
export CI=1
```

---

## Audio Assets

All eight bundled sounds are **original syntheses** produced from scratch via `ffmpeg` filter graphs and stored as 8-bit unsigned PCM WAV. No third-party audio is bundled — no Pixabay, no freesound.org, no licensing matrix.

The synthesis scripts live in [`scripts/synth/`](scripts/synth/) — one per sound, parameters exposed as named constants at the top of each file. Re-run any of them to regenerate the WAV:

```bash
node scripts/synth/pixel.mjs     # or blip / click / ring / whisper / lattice / halo / thock
node scripts/synth/build-all.mjs # rebuild all eight
```

| Sound ID | File | Synth script | License |
|----------|------|--------------|---------|
| `chiptune/pixel` | `sounds/chiptune/pixel.wav` | [`scripts/synth/pixel.mjs`](scripts/synth/pixel.mjs) | MIT |
| `chiptune/blip` | `sounds/chiptune/blip.wav` | [`scripts/synth/blip.mjs`](scripts/synth/blip.mjs) | MIT |
| `chiptune/click` | `sounds/chiptune/click.wav` | [`scripts/synth/click.mjs`](scripts/synth/click.mjs) | MIT |
| `chiptune/ring` | `sounds/chiptune/ring.wav` | [`scripts/synth/ring.mjs`](scripts/synth/ring.mjs) | MIT |
| `chiptune/whisper` | `sounds/chiptune/whisper.wav` | [`scripts/synth/whisper.mjs`](scripts/synth/whisper.mjs) | MIT |
| `chiptune/lattice` | `sounds/chiptune/lattice.wav` | [`scripts/synth/lattice.mjs`](scripts/synth/lattice.mjs) | MIT |
| `chiptune/halo` | `sounds/chiptune/halo.wav` | [`scripts/synth/halo.mjs`](scripts/synth/halo.mjs) | MIT |
| `chiptune/thock` | `sounds/chiptune/thock.wav` | [`scripts/synth/thock.mjs`](scripts/synth/thock.mjs) | MIT |

Reproducibility is verified by the license CI gate ([`scripts/check-licenses.mjs`](scripts/check-licenses.mjs)) — each WAV's SHA-256 must match what's recorded in [`sounds/index.json`](sounds/index.json).

Plugin code AND audio assets are MIT — see [`LICENSE`](LICENSE).

---

## Development

```bash
# Run unit tests
pnpm test

# Verify license compliance
pnpm run check-licenses

# Preview a sound manually
CLAUDE_PLUGIN_ROOT=$(pwd) node scripts/play.mjs --preview chiptune/pixel

# Test the standalone CLI
CLAUDE_PLUGIN_ROOT=$(pwd) node scripts/pick.mjs --list
CLAUDE_PLUGIN_ROOT=$(pwd) CLAUDE_PLUGIN_DATA=/tmp/cb-test node scripts/pick.mjs --save chiptune/halo
```

### Adding a new sound

1. Add a synth script: `scripts/synth/<id>.mjs` (use existing scripts as templates)
2. Run it to render: `node scripts/synth/<id>.mjs`
3. Add an entry to `sounds/index.json` with `license: "MIT"`, `source: "scripts/synth/<id>.mjs"`, and the file's SHA-256
4. Run `pnpm run check-licenses` — must pass

---

## License

Everything (code AND audio assets) is MIT — see [LICENSE](LICENSE).
