/**
 * recurring.integration.test.mjs
 *
 * Integration test for the --recurring-loop subcommand.
 * Uses real child spawn and real wall-clock sleep (~4 s total).
 * Isolated via a temp CLAUDE_PLUGIN_DATA directory.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, stat, rm, mkdir, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAY_MJS = path.join(__dirname, "play.mjs");
const PROJECT_ROOT = path.resolve(__dirname, "..");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test("recurring loop: lock created, then exits when stop flag is touched", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-recurring-integ-"));
  const lockPath = path.join(dir, "recurring.lock");
  const stopPath = path.join(dir, "recurring.stop");

  try {
    const child = spawn(
      process.execPath,
      [PLAY_MJS, "--recurring-loop", "chiptune/pixel", "2", "10"],
      {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          CLAUDE_PLUGIN_ROOT: PROJECT_ROOT,
          CLAUDE_PLUGIN_DATA: dir,
          CI: "1",
        },
      }
    );
    const childPid = child.pid;
    child.unref();

    await sleep(600);

    // Assert lock exists
    let lockRaw;
    try {
      lockRaw = await readFile(lockPath, "utf8");
    } catch {
      assert.fail("recurring.lock should exist after child starts");
    }
    const lock = JSON.parse(lockRaw);
    t.assert.ok(lock.pid > 0, "lock should contain a valid PID");
    t.assert.ok(isPidAlive(lock.pid), "child process should be alive");

    // Touch the stop flag
    const now = new Date();
    try {
      await utimes(stopPath, now, now);
    } catch {
      await writeFile(stopPath, "", "utf8");
    }

    // Wait for child to detect stop flag (up to 3 s)
    let lockGone = false;
    for (let i = 0; i < 15; i++) {
      await sleep(200);
      try {
        await stat(lockPath);
      } catch (e) {
        if (e.code === "ENOENT") {
          lockGone = true;
          break;
        }
      }
    }

    t.assert.ok(lockGone, "recurring.lock should be removed after stop flag is set");
    t.assert.ok(!isPidAlive(lock.pid), "child process should have exited");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, { timeout: 10000 });
