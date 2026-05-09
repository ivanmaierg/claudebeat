# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-05-09

### Changed

- README: added a `## Why claudebeat` section so the motivation is up front, not implicit
- README: picker example now matches the actual rendered output (grouped Markdown table with `▸` current-default marker), not the legacy flat numbered list
- README: settings count corrected from 11 to 13 (`enableNotification` and `enablePermission` were added in 0.2.0)
- README: Standalone CLI section labeled as developer-only with a one-line clarification
- README: added an "Upgrading from `claudebeat-local`?" callout under Install for users migrating from the pre-public local marketplace
- Author/owner metadata updated to `Ivan Maier Gallardo <ivanmaiergallardo@gmail.com>` across `plugin.json`, `package.json`, and `marketplace.json`

## [0.2.0] - 2026-05-09

### Added

- Slash command renamed from `/claudebeat:claudebeat` to `/claudebeat:pick` — shorter and more descriptive
- Conversational picker polish: shows current default at top, `s` shortcut to save, short re-prompt after preview
- Standalone CLI `scripts/pick.mjs` with `--list` (human-readable and `--json`), `--save <id>`, `--help`, and `settings` sub-mode (arrow-key TUI)
- `/claudebeat:settings` slash command for conversational walkthrough of all 13 settings
- `scripts/config-helpers.mjs` — shared config read/write/validate/merge layer (pure, fully tested)
- `scripts/throttle.mjs` — pure throttle logic with `shouldPlay`, `recordPlay`, atomic `throttle.json` state
- Throttle: `cooldownSeconds` and `maxPerMinute` userConfig keys wired into hook mode
- Recurring-until-input: `recurringUntilInput`, `recurringIntervalSeconds`, `recurringMaxDurationSeconds` userConfig keys
- `play.mjs --recurring-loop` subcommand: detached child loop with lockfile, 1-second tick, stop-flag detection, machine-sleep guard
- `play.mjs --stop-recurring` subcommand: touches `recurring.stop` flag; consumed by Stop, UserPromptSubmit, UserPromptExpansion hooks
- `play.mjs --save <key>=<value>` extended form for setting any config key; shorthand `--save <id>` still writes `defaultSound`
- Three new stop hooks in `hooks/hooks.json`: `Stop`, `UserPromptSubmit`, `UserPromptExpansion`
- `pnpm run pick` and `pnpm run settings` convenience scripts
- `enableNotification` and `enablePermission` boolean userConfig toggles (both default `true`)
- Marketplace published as `claudebeat` (renamed from local-only `claudebeat-local`)
- Migrated package manager from npm to pnpm; `pnpm-lock.yaml` committed; `packageManager` field pinned at `pnpm@10.33.4`

### Changed

- `commands/claudebeat.md` deleted; replaced by `commands/pick.md`
- `saveMode()` in `play.mjs` now delegates to `config-helpers.mjs` for atomic writes

### Fixed

- `commands/pick.md` save invocation now correctly prefixes `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` env vars so `play.mjs` receives them in Claude Code's sandboxed Bash context
- `commands/settings.md` save invocation now correctly prefixes `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` env vars; without the prefix, settings changes were silently discarded (`config.json` was never written)
- Replaced `t.plan()` usage in test suite with manual assertion counting — fixes Node 18.x CI failure (`scripts/recurring.integration.test.mjs`)

### Notes

- All five new userConfig keys default to off/zero — existing installs see identical behavior to 0.1.x (NFR-1)
- `idle_prompt` Notification fires after a hardcoded 60-second Claude Code platform delay — first recurring sound plays ~60 s after Claude finishes responding

### Migration

If you previously installed claudebeat via the local marketplace (`claudebeat-local`), run these three commands once to switch to the public marketplace entry:

1. `/plugin marketplace remove claudebeat-local` — remove the stale local registration
2. `/plugin marketplace add ivanmaierg/claudebeat` — add the public marketplace source
3. `/plugin install claudebeat` — install from the renamed source

If you are installing for the first time, the standard two-command install applies:

```
/plugin marketplace add ivanmaierg/claudebeat
/plugin install claudebeat
```

## [0.1.0] - 2026-05-08

### Added

- Plugin manifest (`.claude-plugin/plugin.json`) with userConfig schema for sound customization
- 4 curated CC0 audio cues in two packs:
  - **Lo-fi pack**: `lofi/whisper` (soft tape hiss, default), `lofi/lattice` (muted marimba), `lofi/halo` (vinyl bell with crackle)
  - **Chiptune pack**: `chiptune/pixel` (NES-style two-note blip)
- Cross-platform dispatcher (`scripts/play.mjs`) supporting macOS (afplay), Linux (paplay/aplay fallback chain), and Windows (PowerShell SoundPlayer)
- `/claudebeat` slash command for conversational sound browsing, previewing, and saving default
- Hook registration for `Notification` and `PermissionRequest` events (`hooks/hooks.json`)
- macOS-only volume control via `afplay -v` flag
- 7-layer override resolution: per-event env var → global env var → userConfig per-event → userConfig default → config.json per-event → config.json default → bundled fallback
- License CI gate (`scripts/check-licenses.mjs`) with SHA-256 verification — release blocker
- GitHub Actions CI (`ci.yml`) and release workflow (`release.yml`)
- Sound sourcing guide (`sounds/SOURCING.md`) with CC0 candidate URLs for manual curation
- `sounds/index.json` schema with all 4 sound entries (placeholders pending Phase 3 curation)
- Unit tests: exit-0 invariant, override resolution, platform dispatch

[0.2.0]: https://github.com/ivanmaierg/claudebeat/releases/tag/v0.2.0
