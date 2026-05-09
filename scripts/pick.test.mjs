/**
 * pick.test.mjs
 *
 * Tests for pick.mjs:
 *  - argv parsing (all modes)
 *  - escape-sequence byte parser
 *  - settings menu navigation pure model
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, parseEscapeSequence, settingsNavigate } from "./pick.mjs";

// ---------------------------------------------------------------------------
// 6.1 — argv parsing
// ---------------------------------------------------------------------------

test("parseArgs(['--help']) → {mode:'help'}", () => {
  assert.deepEqual(parseArgs(["--help"]), { mode: "help" });
});

test("parseArgs(['-h']) → {mode:'help'}", () => {
  assert.deepEqual(parseArgs(["-h"]), { mode: "help" });
});

test("parseArgs(['--list']) → {mode:'list', json:false}", () => {
  assert.deepEqual(parseArgs(["--list"]), { mode: "list", json: false });
});

test("parseArgs(['--list','--json']) → {mode:'list', json:true}", () => {
  assert.deepEqual(parseArgs(["--list", "--json"]), { mode: "list", json: true });
});

test("parseArgs(['--save','chiptune/halo']) → {mode:'save', id:'chiptune/halo'}", () => {
  assert.deepEqual(parseArgs(["--save", "chiptune/halo"]), { mode: "save", id: "chiptune/halo" });
});

test("parseArgs(['--save']) with no arg → {mode:'error', reason:'missing-arg'}", () => {
  assert.deepEqual(parseArgs(["--save"]), { mode: "error", reason: "missing-arg" });
});

test("parseArgs(['settings']) → {mode:'settings'}", () => {
  assert.deepEqual(parseArgs(["settings"]), { mode: "settings" });
});

test("parseArgs([]) → {mode:'interactive'}", () => {
  assert.deepEqual(parseArgs([]), { mode: "interactive" });
});

// ---------------------------------------------------------------------------
// 6.1 — escape-sequence byte parser
// ---------------------------------------------------------------------------

test("\\x1b[A → 'up'", () => {
  assert.equal(parseEscapeSequence(Buffer.from([0x1b, 0x5b, 0x41])), "up");
});

test("\\x1b[B → 'down'", () => {
  assert.equal(parseEscapeSequence(Buffer.from([0x1b, 0x5b, 0x42])), "down");
});

test("\\r → 'enter'", () => {
  assert.equal(parseEscapeSequence(Buffer.from([0x0d])), "enter");
});

test("\\n → 'enter'", () => {
  assert.equal(parseEscapeSequence(Buffer.from([0x0a])), "enter");
});

test("\\x03 → 'ctrl-c'", () => {
  assert.equal(parseEscapeSequence(Buffer.from([0x03])), "ctrl-c");
});

test("\\x1b alone → 'escape'", () => {
  assert.equal(parseEscapeSequence(Buffer.from([0x1b])), "escape");
});

test("printable char 's' → 's'", () => {
  assert.equal(parseEscapeSequence(Buffer.from([0x73])), "s");
});

test("printable char 'q' → 'q'", () => {
  assert.equal(parseEscapeSequence(Buffer.from([0x71])), "q");
});

// ---------------------------------------------------------------------------
// 6.1 — settings menu navigation pure model
// ---------------------------------------------------------------------------

test("select row 0 → returns key 'defaultSound'", () => {
  const nav = settingsNavigate(0);
  assert.equal(nav.key, "defaultSound");
});

test("navigate to row 9 → returns key 'recurringUntilInput'", () => {
  const nav = settingsNavigate(9);
  assert.equal(nav.key, "recurringUntilInput");
});

test("navigate to row 11 → returns last key 'recurringMaxDurationSeconds'", () => {
  const nav = settingsNavigate(11);
  assert.equal(nav.key, "recurringMaxDurationSeconds");
});

test("boolean row reports type 'boolean'", () => {
  const nav = settingsNavigate(1);
  assert.equal(nav.type, "boolean");
});

test("number row reports type 'number'", () => {
  const nav = settingsNavigate(7);
  assert.equal(nav.type, "number");
});

// W1 — permissionSound must be present in SETTINGS_ORDER
import { SETTINGS_ORDER } from "./pick.mjs";

test("SETTINGS_ORDER includes 'permissionSound'", () => {
  assert.ok(SETTINGS_ORDER.includes("permissionSound"), "permissionSound must be in SETTINGS_ORDER");
});
