/**
 * exit-zero.test.mjs
 *
 * Verifies the dispatcher ALWAYS exits 0, regardless of input conditions.
 * Tests run the dispatcher as a child process to verify the real exit code.
 *
 * Scenarios tested:
 * - No arguments
 * - Invalid / unknown sound id
 * - CI=1 environment (headless detection)
 * - CLAUDE_PLUGIN_ROOT unset
 * - Malformed stdin JSON payload
 * - Missing audio player (CI skips playback anyway, but tested separately)
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
 * Spawn play.mjs synchronously and return { exitCode, stdout, stderr }.
 */
function runDispatcher(args = [], env = {}, stdinData = null) {
  const mergedEnv = {
    ...process.env,
    // Ensure we always have a valid CLAUDE_PLUGIN_ROOT unless overriding
    CLAUDE_PLUGIN_ROOT: PROJECT_ROOT,
    CI: "1", // Skip real audio playback in tests by default
    ...env,
  };

  const result = spawnSync("node", [PLAY_MJS, ...args], {
    env: mergedEnv,
    input: stdinData !== null ? stdinData : undefined,
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

test("exits 0 with no arguments", () => {
  const { exitCode } = runDispatcher([]);
  assert.equal(exitCode, 0, "must exit 0 with no arguments");
});

test("exits 0 with unknown sound id in preview mode", () => {
  const { exitCode, stderr } = runDispatcher(["--preview", "lofi/nonexistent"]);
  assert.equal(exitCode, 0, "must exit 0 even with unknown sound id");
  assert.ok(stderr.includes("[claudebeat]"), "must write a diagnostic to stderr");
});

test("exits 0 in CI environment (headless detection)", () => {
  const { exitCode } = runDispatcher(["notify"], { CI: "1" });
  assert.equal(exitCode, 0, "must exit 0 when CI=1");
});

test("exits 0 in CI=true environment", () => {
  const { exitCode } = runDispatcher(["notify"], { CI: "true" });
  assert.equal(exitCode, 0, "must exit 0 when CI=true");
});

test("exits 0 when CLAUDE_PLUGIN_ROOT is unset", () => {
  const { exitCode, stderr } = runDispatcher(["notify"], {
    CLAUDE_PLUGIN_ROOT: "",
    CI: "0", // Disable CI guard to reach the PLUGIN_ROOT check
  });
  assert.equal(exitCode, 0, "must exit 0 when CLAUDE_PLUGIN_ROOT is unset");
  assert.ok(
    stderr.includes("[claudebeat]"),
    "must write diagnostic to stderr about missing CLAUDE_PLUGIN_ROOT"
  );
});

test("exits 0 with malformed stdin JSON payload", () => {
  const { exitCode } = runDispatcher(["notify"], {}, "this is not json {{{");
  assert.equal(exitCode, 0, "must exit 0 with malformed stdin JSON");
});

test("exits 0 with valid stdin JSON payload", () => {
  const payload = JSON.stringify({
    hook_event_name: "Notification",
    notification_type: "idle_prompt",
    cwd: "/tmp",
  });
  const { exitCode } = runDispatcher(["notify"], {}, payload);
  assert.equal(exitCode, 0, "must exit 0 with valid stdin payload");
});

test("exits 0 with empty stdin", () => {
  const { exitCode } = runDispatcher(["notify"], {}, "");
  assert.equal(exitCode, 0, "must exit 0 with empty stdin");
});

test("does not write to stdout", () => {
  const { exitCode, stdout } = runDispatcher(["notify"]);
  assert.equal(exitCode, 0);
  assert.equal(stdout, "", "must write nothing to stdout");
});

test("exits 0 with --preview and missing sound id argument", () => {
  const { exitCode } = runDispatcher(["--preview"]);
  assert.equal(exitCode, 0, "must exit 0 when --preview has no argument");
});

test("exits 0 with --save and missing sound id argument", () => {
  const { exitCode } = runDispatcher(["--save"]);
  assert.equal(exitCode, 0, "must exit 0 when --save has no argument");
});

test("exits 0 with unknown event kind", () => {
  const { exitCode } = runDispatcher(["unknown-event-kind"]);
  assert.equal(exitCode, 0, "must exit 0 with unknown event kind");
});
