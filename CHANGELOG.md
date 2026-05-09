# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - Unreleased

### Added

- Slash command renamed from `/claudebeat:claudebeat` to `/claudebeat:pick` — shorter and more descriptive
- Conversational picker polish: shows current default at top, `s` shortcut to save, short re-prompt after preview
- Standalone CLI `scripts/pick.mjs` with `--list` (human-readable and `--json`), `--save <id>`, `--help`, and `settings` sub-mode (arrow-key TUI)
- `/claudebeat:settings` slash command for conversational walkthrough of all 11 settings
- `scripts/config-helpers.mjs` — shared config read/write/validate/merge layer (pure, fully tested)
- `scripts/throttle.mjs` — pure throttle logic with `shouldPlay`, `recordPlay`, atomic `throttle.json` state
- Throttle: `cooldownSeconds` and `maxPerMinute` userConfig keys wired into hook mode
- Recurring-until-input: `recurringUntilInput`, `recurringIntervalSeconds`, `recurringMaxDurationSeconds` userConfig keys
- `play.mjs --recurring-loop` subcommand: detached child loop with lockfile, 1-second tick, stop-flag detection, machine-sleep guard
- `play.mjs --stop-recurring` subcommand: touches `recurring.stop` flag; consumed by Stop, UserPromptSubmit, UserPromptExpansion hooks
- `play.mjs --save <key>=<value>` extended form for setting any config key; shorthand `--save <id>` still writes `defaultSound`
- Three new stop hooks in `hooks/hooks.json`: `Stop`, `UserPromptSubmit`, `UserPromptExpansion`
- `npm run pick` and `npm run settings` convenience scripts

### Changed

- `commands/claudebeat.md` deleted; replaced by `commands/pick.md`
- `saveMode()` in `play.mjs` now delegates to `config-helpers.mjs` for atomic writes

### Notes

- All five new userConfig keys default to off/zero — existing installs see identical behavior to 0.1.x (NFR-1)
- `idle_prompt` Notification fires after a hardcoded 60-second Claude Code platform delay — first recurring sound plays ~60 s after Claude finishes responding

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

[Unreleased]: https://github.com/ivanmaierg/claudebeat/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ivanmaierg/claudebeat/releases/tag/v0.1.0
