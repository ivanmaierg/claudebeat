/**
 * claudebeat dispatcher — scripts/play.mjs
 *
 * Invocation modes:
 *   (A) Hook mode:          node play.mjs <event-kind>
 *   (B) Preview mode:       node play.mjs --preview <pack>/<id>
 *   (C) Save mode:          node play.mjs --save <pack>/<id>  (shorthand)
 *                           node play.mjs --save <key>=<value>  (generic)
 *   (D) Stop-recurring:     node play.mjs --stop-recurring
 *   (E) Recurring loop:     node play.mjs --recurring-loop <id> <intervalSec> <maxDurationSec>
 *
 * ALWAYS exits 0. All errors → stderr only. Never writes to stdout.
 */

import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir, access, utimes, unlink, rename, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT;
const PLUGIN_DATA = process.env.CLAUDE_PLUGIN_DATA;

const FALLBACK_SOUNDS = {
  notify: "chiptune/pixel",
  permission: "chiptune/pixel",
  stop: "chiptune/pixel",
};

// ---------------------------------------------------------------------------
// Logging helpers — stderr only, never stdout
// ---------------------------------------------------------------------------

function logErr(msg) {
  process.stderr.write(`[claudebeat] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Global error guards — belt-and-suspenders exit-0 enforcement
// ---------------------------------------------------------------------------

process.on("uncaughtException", (err) => {
  logErr(`uncaughtException: ${err && err.message ? err.message : String(err)}`);
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  logErr(`unhandledRejection: ${reason && reason.message ? reason.message : String(reason)}`);
  process.exit(0);
});

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadIndexJson() {
  if (!PLUGIN_ROOT) {
    return null;
  }
  const indexPath = path.join(PLUGIN_ROOT, "sounds", "index.json");
  try {
    const raw = await readFile(indexPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadConfigJson() {
  if (!PLUGIN_DATA) {
    return null;
  }
  const configPath = path.join(PLUGIN_DATA, "config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sound resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a sound id (e.g. "lofi/whisper") to an absolute file path.
 * Returns null if the id is not found in index.json or the file doesn't exist.
 */
async function resolveIdToPath(soundId, index) {
  if (!index || !PLUGIN_ROOT) {
    return null;
  }
  const parts = soundId.split("/");
  if (parts.length !== 2) {
    return null;
  }
  const [packName, id] = parts;
  const pack = index.packs[packName];
  if (!pack) {
    return null;
  }
  const sound = pack.sounds.find((s) => s.id === id);
  if (!sound) {
    return null;
  }
  const filePath = path.join(PLUGIN_ROOT, "sounds", sound.file);
  const exists = await fileExists(filePath);
  if (!exists) {
    return null;
  }
  return filePath;
}

/**
 * Validates a candidate value from the override resolution chain.
 * A value is either:
 *   - An absolute path ending in .wav that exists on disk
 *   - A sound id of the form <pack>/<id> present in index.json
 *
 * Returns { kind: "path", value } | { kind: "id", value } | null
 */
async function validateCandidate(candidate, index) {
  if (!candidate || typeof candidate !== "string" || candidate.trim() === "") {
    return null;
  }
  const trimmed = candidate.trim();

  // Absolute path candidate
  if (path.isAbsolute(trimmed)) {
    if (!trimmed.endsWith(".wav")) {
      logErr(`invalid override path (not a .wav): ${trimmed}`);
      return null;
    }
    const exists = await fileExists(trimmed);
    if (!exists) {
      logErr(`override path not found: ${trimmed}`);
      return null;
    }
    return { kind: "path", value: trimmed };
  }

  // Sound id candidate
  if (index) {
    const parts = trimmed.split("/");
    if (parts.length === 2) {
      const resolved = await resolveIdToPath(trimmed, index);
      if (resolved) {
        return { kind: "id", value: trimmed, path: resolved };
      }
    }
  }

  return null;
}

/**
 * Resolves the final absolute .wav path for a given event kind.
 * Implements the 7-layer precedence chain from the design.
 *
 * Exported for unit testing.
 */
export async function resolveSound(eventKind, index, config) {
  const KIND = eventKind ? eventKind.toUpperCase() : "";

  // Layer 1: Per-event env var CLAUDEBEAT_SOUND_<KIND>
  const layer1 = KIND ? process.env[`CLAUDEBEAT_SOUND_${KIND}`] : undefined;
  const v1 = await validateCandidate(layer1, index);
  if (v1) {
    return v1.kind === "path" ? v1.value : v1.path;
  }

  // Layer 2: Global env var CLAUDEBEAT_SOUND
  const v2 = await validateCandidate(process.env.CLAUDEBEAT_SOUND, index);
  if (v2) {
    return v2.kind === "path" ? v2.value : v2.path;
  }

  // Layer 3: userConfig per-event CLAUDE_PLUGIN_OPTION_SOUND_<KIND>
  const layer3 = KIND ? process.env[`CLAUDE_PLUGIN_OPTION_SOUND_${KIND}`] : undefined;
  const v3 = await validateCandidate(layer3, index);
  if (v3) {
    return v3.kind === "path" ? v3.value : v3.path;
  }

  // Layer 4: userConfig default CLAUDE_PLUGIN_OPTION_DEFAULT_SOUND
  const v4 = await validateCandidate(process.env.CLAUDE_PLUGIN_OPTION_DEFAULT_SOUND, index);
  if (v4) {
    return v4.kind === "path" ? v4.value : v4.path;
  }

  // Layer 5: config.json per-event
  const configPerEvent = config && config.perEvent && eventKind ? config.perEvent[eventKind] : undefined;
  const v5 = await validateCandidate(configPerEvent, index);
  if (v5) {
    return v5.kind === "path" ? v5.value : v5.path;
  }

  // Layer 6: config.json defaultSound
  const v6 = await validateCandidate(config && config.defaultSound, index);
  if (v6) {
    return v6.kind === "path" ? v6.value : v6.path;
  }

  // Layer 7: Bundled fallback constant
  const fallbackId = FALLBACK_SOUNDS[eventKind] || FALLBACK_SOUNDS.notify;
  if (index) {
    const fallbackPath = await resolveIdToPath(fallbackId, index);
    if (fallbackPath) {
      return fallbackPath;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// OS player dispatch
// ---------------------------------------------------------------------------

function getVolume() {
  const raw = process.env.CLAUDE_PLUGIN_OPTION_VOLUME;
  if (!raw) {
    return 1.0;
  }
  const v = parseFloat(raw);
  if (isNaN(v)) {
    return 1.0;
  }
  return Math.max(0.0, Math.min(1.0, v));
}

async function playSound(filePath) {
  const platform = process.platform;

  if (platform === "darwin") {
    const volume = getVolume();
    const args = [filePath, "-v", String(volume)];
    try {
      const child = spawn("afplay", args, {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } catch (err) {
      logErr(`afplay spawn failed: ${err.message}`);
    }
    return;
  }

  if (platform === "linux") {
    // Probe paplay first
    const paplayCheck = spawnSync("paplay", ["--version"], { stdio: "ignore" });
    if (paplayCheck.status === 0) {
      try {
        const child = spawn("paplay", [filePath], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
      } catch (err) {
        logErr(`paplay spawn failed: ${err.message}`);
        // Fall through to aplay
        await playAplay(filePath);
      }
      return;
    }
    await playAplay(filePath);
    return;
  }

  if (platform === "win32") {
    const resolvedPath = path.resolve(filePath);
    const escapedPath = resolvedPath.replace(/'/g, "''");
    const psCommand = `(New-Object Media.SoundPlayer '${escapedPath}').PlaySync()`;
    try {
      // Check if powershell exists
      const psCheck = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", "exit 0"], {
        stdio: "ignore",
      });
      if (psCheck.status !== 0 && psCheck.error) {
        logErr("powershell not found — cannot play audio on Windows");
        return;
      }
      const child = spawn(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Command", psCommand],
        { stdio: "ignore" }
      );
      child.unref();
    } catch (err) {
      logErr(`powershell spawn failed: ${err.message}`);
    }
    return;
  }

  logErr(`unsupported platform: ${platform}`);
}

async function playAplay(filePath) {
  const aplayCheck = spawnSync("aplay", ["--version"], { stdio: "ignore" });
  if (aplayCheck.status === 0 || (aplayCheck.status === null && !aplayCheck.error)) {
    try {
      const child = spawn("aplay", ["-q", filePath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    } catch (err) {
      logErr(`aplay spawn failed: ${err.message}`);
    }
    return;
  }
  logErr("no audio player found (tried paplay, aplay)");
}

// ---------------------------------------------------------------------------
// Stdin reading with timeout
// ---------------------------------------------------------------------------

async function readStdinWithTimeout(timeoutMs) {
  return new Promise((resolve) => {
    let data = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(data);
      }
    }, timeoutMs);

    // If stdin is not a pipe (TTY), resolve immediately
    if (process.stdin.isTTY) {
      clearTimeout(timer);
      resolve("");
      return;
    }

    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (chunk) => {
      data += chunk;
    });

    process.stdin.on("end", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(data);
      }
    });

    process.stdin.on("error", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(data);
      }
    });

    process.stdin.resume();
  });
}

// ---------------------------------------------------------------------------
// Save mode — supports both shorthand (<pack>/<id>) and key=value forms
// ---------------------------------------------------------------------------

async function saveMode(arg) {
  if (!PLUGIN_DATA) {
    logErr("CLAUDE_PLUGIN_DATA is not set — cannot persist config");
    return;
  }

  if (arg.includes("=")) {
    const eqIdx = arg.indexOf("=");
    const key = arg.slice(0, eqIdx);
    const rawVal = arg.slice(eqIdx + 1);

    const { SCHEMA, saveConfig, validateConfig } = await import("./config-helpers.mjs");
    if (!(key in SCHEMA)) {
      logErr(`unknown config key: ${key}`);
      return;
    }
    const meta = SCHEMA[key];
    let value;
    if (meta.type === "number") {
      value = Number(rawVal);
      if (isNaN(value)) {
        logErr(`invalid number value for ${key}: ${rawVal}`);
        return;
      }
    } else if (meta.type === "boolean") {
      value = rawVal === "true" || rawVal === "1";
    } else {
      value = rawVal;
    }

    const validation = validateConfig({ [key]: value });
    if (!validation.ok) {
      for (const e of validation.errors) {
        logErr(`save rejected: ${e.key} — ${e.reason}`);
      }
      return;
    }

    const { saveConfig: sc } = await import("./config-helpers.mjs");
    await sc(PLUGIN_DATA, { [key]: value });
    return;
  }

  // Shorthand: treat arg as defaultSound sound id
  const index = await loadIndexJson();
  if (!index) {
    logErr("cannot load sounds/index.json — is CLAUDE_PLUGIN_ROOT set?");
    return;
  }
  const resolved = await resolveIdToPath(arg, index);
  if (!resolved) {
    logErr(`unknown sound id: ${arg} — cannot save`);
    return;
  }

  const { saveConfig } = await import("./config-helpers.mjs");
  await saveConfig(PLUGIN_DATA, { defaultSound: arg });
}

// ---------------------------------------------------------------------------
// Preview mode
// ---------------------------------------------------------------------------

async function previewMode(soundId) {
  const index = await loadIndexJson();
  if (!index) {
    logErr("cannot load sounds/index.json — is CLAUDE_PLUGIN_ROOT set?");
    return;
  }

  const filePath = await resolveIdToPath(soundId, index);
  if (!filePath) {
    logErr(`unknown sound: ${soundId}`);
    return;
  }

  await playSound(filePath);
}

// ---------------------------------------------------------------------------
// Stop-recurring mode
// ---------------------------------------------------------------------------

async function stopRecurringMode() {
  if (!PLUGIN_DATA) {
    logErr("CLAUDE_PLUGIN_DATA is not set — cannot touch recurring.stop");
    return;
  }

  await mkdir(PLUGIN_DATA, { recursive: true });
  const stopPath = path.join(PLUGIN_DATA, "recurring.stop");
  const now = new Date();
  try {
    await utimes(stopPath, now, now);
  } catch (e) {
    if (e.code === "ENOENT") {
      await writeFile(stopPath, "", "utf8");
    }
  }

  const enableStop = process.env.CLAUDE_PLUGIN_OPTION_ENABLE_STOP;
  if (enableStop === "true" || enableStop === "1") {
    const index = await loadIndexJson();
    const config = await loadConfigJson();
    const filePath = await resolveSound("stop", index, config);
    if (filePath) {
      await playSound(filePath);
    }
  }
}

// ---------------------------------------------------------------------------
// Recurring-loop mode
// ---------------------------------------------------------------------------

async function recurringLoopMode(soundId, intervalSec, maxDurationSec) {
  if (!PLUGIN_DATA) {
    logErr("CLAUDE_PLUGIN_DATA is not set — cannot run recurring loop");
    return;
  }

  await mkdir(PLUGIN_DATA, { recursive: true });
  const lockPath = path.join(PLUGIN_DATA, "recurring.lock");
  const stopPath = path.join(PLUGIN_DATA, "recurring.stop");
  const pid = process.pid;
  const startedAt = Date.now();

  const lockData = JSON.stringify({ pid, startedAt, soundId });
  await writeFile(lockPath, lockData, "utf8");

  try {
    await unlink(stopPath);
  } catch {
    // stale or nonexistent — ignore
  }

  let tickCount = 0;

  const cleanupExit = async () => {
    try { await unlink(lockPath); } catch { }
    try { await unlink(stopPath); } catch { }
    process.exit(0);
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const now = Date.now();
    const elapsed = now - startedAt;

    if (elapsed >= maxDurationSec * 1000) {
      await cleanupExit();
      return;
    }

    try {
      const s = await stat(stopPath);
      if (s.mtimeMs >= startedAt) {
        await cleanupExit();
        return;
      }
    } catch {
      // file doesn't exist — continue
    }

    try {
      const raw = await readFile(lockPath, "utf8");
      const lock = JSON.parse(raw);
      if (lock.pid !== pid) {
        await cleanupExit();
        return;
      }
    } catch {
      await cleanupExit();
      return;
    }

    const expectedElapsed = intervalSec * 1000 * (tickCount + 1);
    if (tickCount > 0 && elapsed > expectedElapsed * 3) {
      await cleanupExit();
      return;
    }

    if (tickCount > 0 && tickCount % intervalSec === 0) {
      const index = await loadIndexJson();
      const config = await loadConfigJson();
      const filePath = await resolveSound("notify", index, config);
      if (filePath) {
        await playSound(filePath);
      }
    }

    tickCount++;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// ---------------------------------------------------------------------------
// Hook mode
// ---------------------------------------------------------------------------

async function hookMode(eventKind) {
  // Read stdin with 50ms cap
  const raw = await readStdinWithTimeout(50);
  let payload = {};
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw);
    } catch {
      logErr("failed to parse stdin JSON — proceeding with empty payload");
    }
  }

  // Sanity cross-check: hook_event_name vs eventKind
  if (payload.hook_event_name) {
    const expected = eventKind === "notify" ? "Notification" : eventKind === "permission" ? "PermissionRequest" : eventKind;
    if (payload.hook_event_name !== expected) {
      logErr(`event kind mismatch: arg="${eventKind}" hook_event_name="${payload.hook_event_name}" — playing anyway`);
    }
  }

  // Throttle check
  const cooldownSec = Number(process.env.CLAUDE_PLUGIN_OPTION_COOLDOWN_SECONDS) || 0;
  const maxPerMinute = Number(process.env.CLAUDE_PLUGIN_OPTION_MAX_PER_MINUTE) || 0;

  if (PLUGIN_DATA && (cooldownSec > 0 || maxPerMinute > 0)) {
    const { shouldPlay, loadThrottleState, saveThrottleState, recordPlay } = await import("./throttle.mjs");
    const throttleState = await loadThrottleState(PLUGIN_DATA);
    const now = Date.now();
    const check = shouldPlay({
      now,
      lastPlayedAt: throttleState.lastPlayedAt,
      recentTimestamps: throttleState.recentPlays,
      cooldownSeconds: cooldownSec,
      maxPerMinute,
    });

    if (!check.play) {
      logErr(`skipping playback: ${check.reason}`);
      return;
    }

    // Record the play after successful playback below — captured in closure
    const index = await loadIndexJson();
    const config = await loadConfigJson();
    const filePath = await resolveSound(eventKind, index, config);

    if (!filePath) {
      logErr(`could not resolve any sound for event: ${eventKind}`);
      return;
    }
    const exists = await fileExists(filePath);
    if (!exists) {
      logErr(`sound file not found: ${filePath}`);
      return;
    }

    await playSound(filePath);
    const newState = recordPlay(throttleState, now);
    await saveThrottleState(PLUGIN_DATA, newState);

    await maybeSpawnRecurring(eventKind, filePath);
    return;
  }

  const index = await loadIndexJson();
  const config = await loadConfigJson();
  const filePath = await resolveSound(eventKind, index, config);

  if (!filePath) {
    logErr(`could not resolve any sound for event: ${eventKind}`);
    return;
  }

  const exists = await fileExists(filePath);
  if (!exists) {
    logErr(`sound file not found: ${filePath}`);
    return;
  }

  await playSound(filePath);

  if (PLUGIN_DATA) {
    const { loadThrottleState, saveThrottleState, recordPlay } = await import("./throttle.mjs");
    const throttleState = await loadThrottleState(PLUGIN_DATA);
    const newState = recordPlay(throttleState, Date.now());
    await saveThrottleState(PLUGIN_DATA, newState);
  }

  await maybeSpawnRecurring(eventKind, filePath);
}


async function maybeSpawnRecurring(eventKind, filePath) {
  const recurringEnabled = process.env.CLAUDE_PLUGIN_OPTION_RECURRING_UNTIL_INPUT;
  if (recurringEnabled !== "true" && recurringEnabled !== "1") return;
  if (!PLUGIN_DATA) return;

  const intervalSec = Number(process.env.CLAUDE_PLUGIN_OPTION_RECURRING_INTERVAL_SECONDS) || 60;
  const maxDurationSec = Number(process.env.CLAUDE_PLUGIN_OPTION_RECURRING_MAX_DURATION_SECONDS) || 300;

  const lockPath = path.join(PLUGIN_DATA, "recurring.lock");
  try {
    const raw = await readFile(lockPath, "utf8");
    const lock = JSON.parse(raw);
    try {
      process.kill(lock.pid, 0);
      return;
    } catch {
      // dead pid — proceed to spawn
    }
  } catch {
    // no lock file — proceed to spawn
  }

  const index = await loadIndexJson();
  const soundId = await resolveSoundId(eventKind, index, await loadConfigJson());

  const __filename_play = fileURLToPath(import.meta.url);
  const child = spawn(
    process.execPath,
    [__filename_play, "--recurring-loop", soundId, String(intervalSec), String(maxDurationSec)],
    { detached: true, stdio: "ignore", env: process.env }
  );
  child.unref();
}

async function resolveSoundId(eventKind, index, config) {
  const KIND = eventKind ? eventKind.toUpperCase() : "";

  const candidates = [
    KIND ? process.env[`CLAUDEBEAT_SOUND_${KIND}`] : undefined,
    process.env.CLAUDEBEAT_SOUND,
    KIND ? process.env[`CLAUDE_PLUGIN_OPTION_SOUND_${KIND}`] : undefined,
    process.env.CLAUDE_PLUGIN_OPTION_DEFAULT_SOUND,
    config && config.perEvent && eventKind ? config.perEvent[eventKind] : undefined,
    config && config.defaultSound,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "string" && candidate.trim() && !path.isAbsolute(candidate.trim())) {
      const parts = candidate.trim().split("/");
      if (parts.length === 2 && index) {
        const resolved = await resolveIdToPath(candidate.trim(), index);
        if (resolved) return candidate.trim();
      }
    }
  }

  return `notify/${eventKind}` || "chiptune/pixel";
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  // --save, --stop-recurring, --recurring-loop: bypass PLUGIN_ROOT and CI guards
  if (args[0] === "--save") {
    const arg = args[1];
    if (!arg) {
      logErr("--save requires a sound id argument (e.g. --save chiptune/whisper)");
      return;
    }
    await saveMode(arg);
    return;
  }

  if (args[0] === "--stop-recurring") {
    await stopRecurringMode();
    return;
  }

  if (args[0] === "--recurring-loop") {
    const soundId = args[1];
    const intervalSec = parseInt(args[2], 10) || 60;
    const maxDurationSec = parseInt(args[3], 10) || 300;
    if (!soundId) {
      logErr("--recurring-loop requires: <soundId> <intervalSec> <maxDurationSec>");
      return;
    }
    await recurringLoopMode(soundId, intervalSec, maxDurationSec);
    return;
  }

  // CLAUDE_PLUGIN_ROOT guard (belt-and-suspenders against bug #9354)
  if (!PLUGIN_ROOT) {
    logErr("CLAUDE_PLUGIN_ROOT unset — upgrade Claude Code to >=2.0.0 (see minClaudeCodeVersion in plugin.json)");
    return;
  }

  // Headless / CI detection
  if (process.env.CI === "true" || process.env.CI === "1") {
    logErr("CI environment detected — skipping playback");
    return;
  }

  // --preview <pack>/<id>
  if (args[0] === "--preview") {
    const soundId = args[1];
    if (!soundId) {
      logErr("--preview requires a sound id argument (e.g. --preview chiptune/whisper)");
      return;
    }
    await previewMode(soundId);
    return;
  }

  // Hook mode: node play.mjs <event-kind>
  const eventKind = args[0];
  if (!eventKind) {
    logErr("no event kind provided — usage: node play.mjs <notify|permission|stop>");
    return;
  }

  await hookMode(eventKind);
}

// ---------------------------------------------------------------------------
// Execute — only when this file is the direct entry point (not when imported)
// ---------------------------------------------------------------------------

const __filename_play = fileURLToPath(import.meta.url);
const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename_play);

if (isEntryPoint) {
  try {
    await main();
  } catch (err) {
    logErr(`unexpected error: ${err && err.message ? err.message : String(err)}`);
  } finally {
    process.exit(0);
  }
}
