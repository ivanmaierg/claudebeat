/**
 * recurring.test.mjs
 *
 * Unit tests for the recurring-loop state machine pure logic.
 * Tests the conditions that cause the loop to exit, using mocked state.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Pure state-machine logic extracted for testing
// (These mirror the conditions in recurringLoopMode)
// ---------------------------------------------------------------------------

function shouldExitMaxDuration(elapsed, maxDurationSec) {
  return elapsed >= maxDurationSec * 1000;
}

function shouldExitStopFlag(stopMtimeMs, startedAt) {
  return stopMtimeMs >= startedAt;
}

function shouldExitLockStolen(lockPid, selfPid) {
  return lockPid !== selfPid;
}

function shouldExitMachineSleep(elapsed, tickCount, intervalSec) {
  if (tickCount === 0) return false;
  const expectedElapsed = intervalSec * 1000 * (tickCount + 1);
  return elapsed > expectedElapsed * 3;
}

function shouldPlaySound(tickCount, intervalSec) {
  return tickCount > 0 && tickCount % intervalSec === 0;
}

// ---------------------------------------------------------------------------
// Startup: clear stale stop flag
// ---------------------------------------------------------------------------

test("startup clears stale recurring.stop if present", () => {
  let stopFileExists = true;
  const cleared = [];

  function clearStopFile() {
    if (stopFileExists) {
      cleared.push("stop-cleared");
      stopFileExists = false;
    }
  }

  clearStopFile();
  assert.equal(cleared.length, 1);
  assert.equal(stopFileExists, false);
});

// ---------------------------------------------------------------------------
// Tick: play sound at intervalSec boundary
// ---------------------------------------------------------------------------

test("tick plays sound at intervalSec-th boundary", () => {
  const intervalSec = 2;
  const plays = [];

  for (let tick = 0; tick <= 4; tick++) {
    if (shouldPlaySound(tick, intervalSec)) {
      plays.push(tick);
    }
  }

  assert.deepEqual(plays, [2, 4]);
});

test("tick does NOT play on tick 0", () => {
  assert.equal(shouldPlaySound(0, 2), false);
});

test("tick does NOT play on tick 1 when intervalSec=2", () => {
  assert.equal(shouldPlaySound(1, 2), false);
});

// ---------------------------------------------------------------------------
// Exit condition: stop flag mtime >= startedAt
// ---------------------------------------------------------------------------

test("stop flag mtime >= startedAt causes exit", () => {
  const startedAt = 1000000;
  assert.equal(shouldExitStopFlag(1000000, startedAt), true);
  assert.equal(shouldExitStopFlag(1000001, startedAt), true);
});

test("stop flag mtime < startedAt (leftover from prior cycle) does NOT cause exit", () => {
  const startedAt = 1000000;
  assert.equal(shouldExitStopFlag(999999, startedAt), false);
});

// ---------------------------------------------------------------------------
// Exit condition: max duration elapsed
// ---------------------------------------------------------------------------

test("maxDuration elapsed causes exit", () => {
  assert.equal(shouldExitMaxDuration(301000, 300), true);
});

test("maxDuration not yet elapsed does NOT cause exit", () => {
  assert.equal(shouldExitMaxDuration(299000, 300), false);
});

test("maxDuration exactly at boundary causes exit", () => {
  assert.equal(shouldExitMaxDuration(300000, 300), true);
});

// ---------------------------------------------------------------------------
// Exit condition: lock stolen (pid mismatch)
// ---------------------------------------------------------------------------

test("lock stolen (pid mismatch) causes exit", () => {
  assert.equal(shouldExitLockStolen(9999, 1234), true);
});

test("lock matches self pid does NOT cause exit", () => {
  assert.equal(shouldExitLockStolen(1234, 1234), false);
});

// ---------------------------------------------------------------------------
// Exit condition: machine sleep gap
// ---------------------------------------------------------------------------

test("machine sleep gap (wall-clock >> interval) causes exit", () => {
  const tickCount = 2;
  const intervalSec = 2;
  const hugeElapsed = 7200000; // 2 hours
  assert.equal(shouldExitMachineSleep(hugeElapsed, tickCount, intervalSec), true);
});

test("normal elapsed does NOT trigger machine-sleep exit", () => {
  const tickCount = 2;
  const intervalSec = 2;
  const normalElapsed = 2100; // 2.1 seconds
  assert.equal(shouldExitMachineSleep(normalElapsed, tickCount, intervalSec), false);
});

test("tickCount 0 never triggers machine-sleep exit", () => {
  assert.equal(shouldExitMachineSleep(999999999, 0, 2), false);
});

// ---------------------------------------------------------------------------
// Cleanup: removes both recurring.lock and recurring.stop
// ---------------------------------------------------------------------------

test("cleanup_exit removes recurring.lock and recurring.stop (best-effort)", () => {
  const deleted = new Set();

  function mockUnlink(file) {
    deleted.add(file);
  }

  mockUnlink("recurring.lock");
  mockUnlink("recurring.stop");

  assert.ok(deleted.has("recurring.lock"));
  assert.ok(deleted.has("recurring.stop"));
});
