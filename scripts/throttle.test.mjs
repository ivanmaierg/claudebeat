import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { shouldPlay, loadThrottleState, saveThrottleState, recordPlay } from "./throttle.mjs";

const NOW = 1715250000000;

// ---------------------------------------------------------------------------
// shouldPlay — pure logic
// ---------------------------------------------------------------------------

test("both disabled returns {play:true, reason:'ok'}", () => {
  const result = shouldPlay({ now: NOW, lastPlayedAt: 0, recentTimestamps: [], cooldownSeconds: 0, maxPerMinute: 0 });
  assert.deepEqual(result, { play: true, reason: "ok" });
});

test("cooldown blocks within window", () => {
  const result = shouldPlay({ now: NOW, lastPlayedAt: NOW - 2000, recentTimestamps: [], cooldownSeconds: 5, maxPerMinute: 0 });
  assert.deepEqual(result, { play: false, reason: "cooldown" });
});

test("cooldown allows after elapsed", () => {
  const result = shouldPlay({ now: NOW, lastPlayedAt: NOW - 6000, recentTimestamps: [], cooldownSeconds: 5, maxPerMinute: 0 });
  assert.deepEqual(result, { play: true, reason: "ok" });
});

test("cooldown blocks exactly at boundary (2s < 5s)", () => {
  const result = shouldPlay({ now: NOW, lastPlayedAt: NOW - 2000, recentTimestamps: [], cooldownSeconds: 5, maxPerMinute: 0 });
  assert.equal(result.play, false);
});

test("rate-limit blocks at boundary", () => {
  const ts = [NOW - 50000, NOW - 30000, NOW - 10000];
  const result = shouldPlay({ now: NOW, lastPlayedAt: 0, recentTimestamps: ts, cooldownSeconds: 0, maxPerMinute: 3 });
  assert.deepEqual(result, { play: false, reason: "rate-limit" });
});

test("rate-limit allows when under limit", () => {
  const ts = [NOW - 50000, NOW - 30000];
  const result = shouldPlay({ now: NOW, lastPlayedAt: 0, recentTimestamps: ts, cooldownSeconds: 0, maxPerMinute: 3 });
  assert.deepEqual(result, { play: true, reason: "ok" });
});

test("sliding window drops old entries (>60s)", () => {
  const ts = [NOW - 70000, NOW - 65000, NOW - 61000];
  const result = shouldPlay({ now: NOW, lastPlayedAt: 0, recentTimestamps: ts, cooldownSeconds: 0, maxPerMinute: 3 });
  assert.deepEqual(result, { play: true, reason: "ok" });
});

test("clock skew (now < lastPlayedAt) treated as elapsed (play allowed)", () => {
  const result = shouldPlay({ now: NOW, lastPlayedAt: NOW + 10000, recentTimestamps: [], cooldownSeconds: 5, maxPerMinute: 0 });
  assert.deepEqual(result, { play: true, reason: "ok" });
});

// ---------------------------------------------------------------------------
// recordPlay — pure
// ---------------------------------------------------------------------------

test("recordPlay appends timestamp", () => {
  const state = { lastPlayedAt: 0, recentPlays: [] };
  const next = recordPlay(state, NOW);
  assert.equal(next.lastPlayedAt, NOW);
  assert.deepEqual(next.recentPlays, [NOW]);
});

test("recordPlay does not mutate original state", () => {
  const state = { lastPlayedAt: 0, recentPlays: [NOW - 1000] };
  recordPlay(state, NOW);
  assert.equal(state.lastPlayedAt, 0, "original unchanged");
});

// ---------------------------------------------------------------------------
// loadThrottleState — I/O
// ---------------------------------------------------------------------------

test("loadThrottleState from missing path returns empty state without throw", async () => {
  const state = await loadThrottleState("/nonexistent/path/that/does/not/exist");
  assert.deepEqual(state, { lastPlayedAt: 0, recentPlays: [] });
});

test("loadThrottleState with corrupt file returns empty state without throw", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-throttle-"));
  try {
    await writeFile(path.join(dir, "throttle.json"), "{ not valid json }", "utf8");
    const state = await loadThrottleState(dir);
    assert.deepEqual(state, { lastPlayedAt: 0, recentPlays: [] });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// saveThrottleState — I/O + truncation
// ---------------------------------------------------------------------------

test("saveThrottleState truncates recentPlays at 120", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-throttle-"));
  try {
    const bigPlays = Array.from({ length: 130 }, (_, i) => NOW - i * 1000);
    await saveThrottleState(dir, { lastPlayedAt: NOW, recentPlays: bigPlays });
    const raw = await readFile(path.join(dir, "throttle.json"), "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.recentPlays.length, 120);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveThrottleState round-trip preserves values", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-throttle-"));
  try {
    const state = { lastPlayedAt: NOW, recentPlays: [NOW - 1000, NOW - 2000] };
    await saveThrottleState(dir, state);
    const loaded = await loadThrottleState(dir);
    assert.equal(loaded.lastPlayedAt, NOW);
    assert.deepEqual(loaded.recentPlays, [NOW - 1000, NOW - 2000]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
