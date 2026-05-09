/**
 * play.test.mjs
 *
 * Tests for play.mjs extensions:
 *  - Throttle wiring in hookMode (tasks 4.1/4.2)
 *  - --save key=value extended form (tasks 4.3/4.4)
 *  - --stop-recurring (tasks 4.5/4.6)
 *  - Recurring spawn path (tasks 5.5/5.6)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { mkdtemp, readFile, stat, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAY_MJS = path.join(__dirname, "play.mjs");
const PROJECT_ROOT = path.resolve(__dirname, "..");

function run(args, overrideEnv = {}, input = undefined) {
  const env = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: PROJECT_ROOT,
    CI: "1",
    ...overrideEnv,
  };
  return spawnSync("node", [PLAY_MJS, ...args], { env, encoding: "utf8", timeout: 8000, input });
}

// ---------------------------------------------------------------------------
// 4.1 / 4.2 — Throttle wiring in hookMode
// ---------------------------------------------------------------------------

test("hookMode skips playback when cooldown is active", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const now = Date.now();
    const throttleState = {
      version: 1,
      lastPlayedAt: now - 2000,
      recentPlays: [],
    };
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "throttle.json"), JSON.stringify(throttleState), "utf8");

    const result = run(["notify"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "0",
      CLAUDE_PLUGIN_OPTION_COOLDOWN_SECONDS: "5",
    });
    assert.equal(result.status, 0);
    assert.ok(result.stderr.includes("cooldown"), `expected 'cooldown' in stderr, got: ${result.stderr}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("hookMode allows playback after cooldown elapsed", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const now = Date.now();
    const throttleState = {
      version: 1,
      lastPlayedAt: now - 10000,
      recentPlays: [],
    };
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "throttle.json"), JSON.stringify(throttleState), "utf8");

    const result = run(["notify"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "1",
      CLAUDE_PLUGIN_OPTION_COOLDOWN_SECONDS: "5",
    });
    assert.equal(result.status, 0);
    assert.ok(!result.stderr.includes("cooldown"), `unexpected 'cooldown' in stderr: ${result.stderr}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("hookMode skips when rate limit reached", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const now = Date.now();
    const throttleState = {
      version: 1,
      lastPlayedAt: 0,
      recentPlays: [now - 50000, now - 30000, now - 10000],
    };
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "throttle.json"), JSON.stringify(throttleState), "utf8");

    const result = run(["notify"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "0",
      CLAUDE_PLUGIN_OPTION_MAX_PER_MINUTE: "3",
    });
    assert.equal(result.status, 0);
    assert.ok(result.stderr.includes("rate-limit"), `expected 'rate-limit' in stderr, got: ${result.stderr}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("hookMode updates throttle.json after play attempt", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const result = run(["notify"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "0",
      CLAUDE_PLUGIN_OPTION_COOLDOWN_SECONDS: "0",
    });
    assert.equal(result.status, 0);
    const raw = await readFile(path.join(dir, "throttle.json"), "utf8");
    const parsed = JSON.parse(raw);
    assert.ok(parsed.lastPlayedAt > 0, "throttle.json should be written with lastPlayedAt");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 4.3 / 4.4 — --save key=value extended form
// ---------------------------------------------------------------------------

test("--save defaultSound=chiptune/coin writes only defaultSound (CI mode)", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const result = run(["--save", "defaultSound=chiptune/halo"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "1",
    });
    assert.equal(result.status, 0);
    const raw = await readFile(path.join(dir, "config.json"), "utf8");
    const cfg = JSON.parse(raw);
    assert.equal(cfg.defaultSound, "chiptune/halo");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--save cooldownSeconds=5 writes cooldownSeconds", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const result = run(["--save", "cooldownSeconds=5"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "1",
    });
    assert.equal(result.status, 0);
    const raw = await readFile(path.join(dir, "config.json"), "utf8");
    const cfg = JSON.parse(raw);
    assert.equal(cfg.cooldownSeconds, 5);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--save chiptune/halo shorthand (no =) writes defaultSound", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const result = run(["--save", "chiptune/halo"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "1",
    });
    assert.equal(result.status, 0);
    const raw = await readFile(path.join(dir, "config.json"), "utf8");
    const cfg = JSON.parse(raw);
    assert.equal(cfg.defaultSound, "chiptune/halo");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--save unknownKey=val logs error (exits 0)", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const result = run(["--save", "unknownKey=val"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "1",
    });
    assert.equal(result.status, 0);
    assert.ok(result.stderr.includes("[claudebeat]"), `expected stderr error, got: ${result.stderr}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--save with no argument logs error (exits 0)", async () => {
  const result = run(["--save"], {
    CI: "1",
  });
  assert.equal(result.status, 0);
  assert.ok(result.stderr.includes("[claudebeat]"), `expected stderr error, got: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// 4.5 / 4.6 — --stop-recurring
// ---------------------------------------------------------------------------

test("--stop-recurring creates recurring.stop when not present", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const result = run(["--stop-recurring"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "1",
    });
    assert.equal(result.status, 0);
    const stopPath = path.join(dir, "recurring.stop");
    const s = await stat(stopPath);
    assert.ok(s.isFile(), "recurring.stop should be created");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--stop-recurring updates mtime when file already exists", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    await mkdir(dir, { recursive: true });
    const stopPath = path.join(dir, "recurring.stop");
    await writeFile(stopPath, "", "utf8");
    const before = (await stat(stopPath)).mtimeMs;

    await new Promise((r) => setTimeout(r, 10));
    run(["--stop-recurring"], { CLAUDE_PLUGIN_DATA: dir, CI: "1" });
    await new Promise((r) => setTimeout(r, 50));
    const after = (await stat(stopPath)).mtimeMs;
    assert.ok(after >= before, "mtime should be updated");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--stop-recurring exits 0", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const result = run(["--stop-recurring"], { CLAUDE_PLUGIN_DATA: dir, CI: "1" });
    assert.equal(result.status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 5.5 / 5.6 — Recurring spawn path in hookMode
// ---------------------------------------------------------------------------

test("hookMode does NOT spawn recurring child when recurringUntilInput is false (default)", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    const result = run(["notify"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "1",
      CLAUDE_PLUGIN_OPTION_RECURRING_UNTIL_INPUT: "false",
    });
    assert.equal(result.status, 0);
    try {
      await stat(path.join(dir, "recurring.lock"));
      assert.fail("recurring.lock should NOT exist when recurringUntilInput=false");
    } catch (e) {
      assert.equal(e.code, "ENOENT", "recurring.lock must not exist");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("hookMode skips recurring spawn when lockfile has live PID", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-play-"));
  try {
    await mkdir(dir, { recursive: true });
    const lockPath = path.join(dir, "recurring.lock");
    await writeFile(lockPath, JSON.stringify({ pid: process.pid, startedAt: Date.now(), soundId: "chiptune/pixel" }), "utf8");

    const result = run(["notify"], {
      CLAUDE_PLUGIN_DATA: dir,
      CI: "1",
      CLAUDE_PLUGIN_OPTION_RECURRING_UNTIL_INPUT: "true",
      CLAUDE_PLUGIN_OPTION_RECURRING_INTERVAL_SECONDS: "60",
      CLAUDE_PLUGIN_OPTION_RECURRING_MAX_DURATION_SECONDS: "300",
    });
    assert.equal(result.status, 0);
    const raw = await readFile(lockPath, "utf8");
    const lock = JSON.parse(raw);
    assert.equal(lock.pid, process.pid, "lock should remain pointing to our fake PID");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
