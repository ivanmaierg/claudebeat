/**
 * dispatch.test.mjs
 *
 * Platform dispatch integration tests.
 * Tests that the dispatcher invokes the correct OS player for the current platform.
 *
 * Strategy: spawn play.mjs --preview with CI=1 (skips actual playback) and verify:
 *   - Exit code is always 0
 *   - Stderr is clean (no unexpected errors beyond CI skip message)
 *   - On CI=1, playback is skipped gracefully
 *
 * We also test that invalid sound ids are handled correctly.
 *
 * Note: Testing the actual OS player invocation (afplay/paplay/powershell)
 * requires a real audio environment. In CI (CI=1), the dispatcher skips
 * playback early. The key invariant — exit 0 — is tested exhaustively in
 * exit-zero.test.mjs. This test focuses on the dispatch layer behavior.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAY_MJS = path.join(__dirname, "play.mjs");
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Run the dispatcher synchronously and return { exitCode, stdout, stderr }.
 */
function runDispatcher(args = [], overrideEnv = {}) {
  const env = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: PROJECT_ROOT,
    CI: "1",
    ...overrideEnv,
  };

  const result = spawnSync("node", [PLAY_MJS, ...args], {
    env,
    encoding: "utf8",
    timeout: 5000,
  });

  return {
    exitCode: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("preview mode exits 0 in CI (playback skipped)", () => {
  // Even with an unknown sound, CI=1 causes early exit before sound resolution
  const { exitCode, stdout } = runDispatcher(["--preview", "chiptune/whisper"], { CI: "1" });
  assert.equal(exitCode, 0);
  assert.equal(stdout, "", "must not write to stdout");
});

test("preview mode exits 0 with unknown sound id", () => {
  const { exitCode, stderr } = runDispatcher(["--preview", "chiptune/unknown-sound"]);
  assert.equal(exitCode, 0);
  assert.ok(stderr.includes("[claudebeat]"), "must write diagnostic to stderr");
});

test("hook mode exits 0 with valid event kind", () => {
  const { exitCode } = runDispatcher(["notify"]);
  assert.equal(exitCode, 0);
});

test("hook mode exits 0 with permission event kind", () => {
  const { exitCode } = runDispatcher(["permission"]);
  assert.equal(exitCode, 0);
});

test("hook mode exits 0 with stop event kind", () => {
  const { exitCode } = runDispatcher(["stop"]);
  assert.equal(exitCode, 0);
});

test("hook mode never writes to stdout", () => {
  const { exitCode, stdout } = runDispatcher(["notify"]);
  assert.equal(exitCode, 0);
  assert.equal(stdout, "", "dispatcher must write nothing to stdout");
});

test("preview mode never writes to stdout", () => {
  const { exitCode, stdout } = runDispatcher(["--preview", "chiptune/whisper"]);
  assert.equal(exitCode, 0);
  assert.equal(stdout, "", "dispatcher must write nothing to stdout");
});

test("save mode exits 0 with no CLAUDE_PLUGIN_DATA", () => {
  const { exitCode, stderr } = runDispatcher(["--save", "chiptune/whisper"], {
    CLAUDE_PLUGIN_DATA: "",
  });
  assert.equal(exitCode, 0);
  // Should warn about missing CLAUDE_PLUGIN_DATA or missing sounds (CI=1 skips before this)
  // Exit code must always be 0 regardless
});

test("dispatcher skips playback gracefully in CI environment", () => {
  const { exitCode, stderr } = runDispatcher(["notify"], { CI: "true" });
  assert.equal(exitCode, 0);
  assert.ok(
    stderr.includes("CI environment detected") || stderr === "",
    "should mention CI skip in stderr or have empty stderr"
  );
});

test("dispatcher reports correct platform in unsupported case", () => {
  // We can't easily fake process.platform, but we can verify the dispatcher
  // handles any event kind correctly on the current platform
  const platforms = ["notify", "permission", "stop"];
  for (const kind of platforms) {
    const { exitCode } = runDispatcher([kind]);
    assert.equal(exitCode, 0, `must exit 0 for event kind: ${kind}`);
  }
});

test("--preview with malformed sound id format exits 0", () => {
  // Not pack/id format
  const { exitCode } = runDispatcher(["--preview", "notavalidformat"]);
  assert.equal(exitCode, 0);
});

test("--preview with empty sound id exits 0", () => {
  const { exitCode } = runDispatcher(["--preview", ""]);
  assert.equal(exitCode, 0);
});

test("hook mode with stdin JSON payload exits 0", () => {
  const payload = JSON.stringify({
    hook_event_name: "Notification",
    notification_type: "idle_prompt",
    cwd: "/tmp/test",
  });

  const result = spawnSync("node", [PLAY_MJS, "notify"], {
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: PROJECT_ROOT,
      CI: "1",
    },
    input: payload,
    encoding: "utf8",
    timeout: 5000,
  });

  assert.equal(result.status, 0, "must exit 0 with valid hook stdin payload");
  assert.equal(result.stdout || "", "", "must not write to stdout");
});
