/**
 * pick.integration.test.mjs
 *
 * Integration tests for pick.mjs non-interactive modes.
 * Spawns the CLI as a child process.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PICK_MJS = path.join(__dirname, "pick.mjs");
const PROJECT_ROOT = path.resolve(__dirname, "..");

function runPick(args, overrideEnv = {}) {
  const env = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: PROJECT_ROOT,
    ...overrideEnv,
  };
  return spawnSync("node", [PICK_MJS, ...args], { env, encoding: "utf8", timeout: 8000 });
}

// ---------------------------------------------------------------------------
// --list --json
// ---------------------------------------------------------------------------

test("--list --json outputs valid JSON array with id/label/description keys", () => {
  const result = runPick(["--list", "--json"]);
  assert.equal(result.status, 0, `exit should be 0, stderr: ${result.stderr}`);

  const arr = JSON.parse(result.stdout);
  assert.ok(Array.isArray(arr), "output must be a JSON array");
  assert.equal(arr.length, 8, "catalog has 8 sounds");

  for (const item of arr) {
    assert.ok("id" in item, `item missing id: ${JSON.stringify(item)}`);
    assert.ok("label" in item, `item missing label: ${JSON.stringify(item)}`);
    assert.ok("description" in item, `item missing description: ${JSON.stringify(item)}`);
  }
});

test("--list outputs human-readable lines (not JSON)", () => {
  const result = runPick(["--list"]);
  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines.length, 8, "should have 8 lines");
  for (const line of lines) {
    assert.ok(line.includes("chiptune/"), `line should contain sound id: ${line}`);
  }
});

// ---------------------------------------------------------------------------
// --save
// ---------------------------------------------------------------------------

test("--save chiptune/halo writes defaultSound to config.json", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-pick-integ-"));
  try {
    const result = runPick(["--save", "chiptune/halo"], { CLAUDE_PLUGIN_DATA: dir });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const raw = await readFile(path.join(dir, "config.json"), "utf8");
    const cfg = JSON.parse(raw);
    assert.equal(cfg.defaultSound, "chiptune/halo");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--save with unknown id exits 1", () => {
  const result = runPick(["--save", "bad/id"]);
  assert.equal(result.status, 1, "should exit 1 for unknown id");
  assert.ok(result.stderr.includes("[claudebeat]"), `expected error in stderr: ${result.stderr}`);
});

test("--save with no argument exits 1", () => {
  const result = runPick(["--save"]);
  assert.equal(result.status, 1, "should exit 1 when arg missing");
  assert.ok(result.stderr.includes("[claudebeat]"), `expected error in stderr: ${result.stderr}`);
});

// ---------------------------------------------------------------------------
// --help
// ---------------------------------------------------------------------------

test("--help exits 0 and includes usage text", () => {
  const result = runPick(["--help"]);
  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes("Usage:"), "should include Usage:");
  assert.ok(result.stdout.includes("--list"), "should mention --list");
  assert.ok(result.stdout.includes("--save"), "should mention --save");
});
