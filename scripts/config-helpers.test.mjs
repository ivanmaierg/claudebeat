import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { defaultConfig, loadConfig, saveConfig, validateConfig, mergeConfig, SCHEMA } from "./config-helpers.mjs";

// ---------------------------------------------------------------------------
// SCHEMA & defaultConfig
// ---------------------------------------------------------------------------

test("SCHEMA has 13 keys", () => {
  assert.equal(Object.keys(SCHEMA).length, 13);
});

test("defaultConfig returns all 13 keys at spec defaults", () => {
  const cfg = defaultConfig();
  assert.equal(cfg.defaultSound, "chiptune/pixel");
  assert.equal(cfg.enableNotification, true);
  assert.equal(cfg.enablePermission, true);
  assert.equal(cfg.enableStop, false);
  assert.equal(cfg.notificationSound, "");
  assert.equal(cfg.permissionSound, "");
  assert.equal(cfg.stopSound, "");
  assert.equal(cfg.volume, 1.0);
  assert.equal(cfg.cooldownSeconds, 0);
  assert.equal(cfg.maxPerMinute, 0);
  assert.equal(cfg.recurringUntilInput, false);
  assert.equal(cfg.recurringIntervalSeconds, 60);
  assert.equal(cfg.recurringMaxDurationSeconds, 300);
});

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

test("loadConfig from missing path returns defaults", async () => {
  const cfg = await loadConfig("/nonexistent/data/dir/that/does/not/exist");
  const def = defaultConfig();
  assert.deepEqual(cfg, def);
});

test("loadConfig from valid file merges over defaults", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-test-"));
  try {
    await saveConfig(dir, { defaultSound: "chiptune/halo", cooldownSeconds: 5 });
    const cfg = await loadConfig(dir);
    assert.equal(cfg.defaultSound, "chiptune/halo");
    assert.equal(cfg.cooldownSeconds, 5);
    assert.equal(cfg.maxPerMinute, 0, "unset keys get defaults");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// validateConfig
// ---------------------------------------------------------------------------

test("validateConfig rejects unknown keys", () => {
  const result = validateConfig({ unknownKey: "value" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.key === "unknownKey"));
});

test("validateConfig rejects values below min", () => {
  const result = validateConfig({ cooldownSeconds: -1 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.key === "cooldownSeconds"));
});

test("validateConfig rejects values above max for volume", () => {
  const result = validateConfig({ volume: 1.5 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.key === "volume"));
});

test("validateConfig rejects wrong type (string for number)", () => {
  const result = validateConfig({ cooldownSeconds: "five" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.key === "cooldownSeconds"));
});

test("validateConfig rejects wrong type (number for boolean)", () => {
  const result = validateConfig({ enableNotification: 1 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.key === "enableNotification"));
});

test("validateConfig accepts valid partial config", () => {
  const result = validateConfig({ defaultSound: "chiptune/halo", cooldownSeconds: 10, volume: 0.5 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("validateConfig accepts empty object", () => {
  const result = validateConfig({});
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// mergeConfig
// ---------------------------------------------------------------------------

test("mergeConfig preserves unmentioned keys", () => {
  const existing = defaultConfig();
  existing.cooldownSeconds = 5;
  const patch = { defaultSound: "chiptune/ring" };
  const merged = mergeConfig(existing, patch);
  assert.equal(merged.defaultSound, "chiptune/ring");
  assert.equal(merged.cooldownSeconds, 5);
  assert.equal(merged.maxPerMinute, 0, "unrelated key preserved");
});

test("mergeConfig patch wins on declared keys", () => {
  const existing = { defaultSound: "chiptune/pixel", cooldownSeconds: 0 };
  const patch = { cooldownSeconds: 10 };
  const merged = mergeConfig(existing, patch);
  assert.equal(merged.cooldownSeconds, 10);
  assert.equal(merged.defaultSound, "chiptune/pixel");
});

// ---------------------------------------------------------------------------
// saveConfig — atomic write
// ---------------------------------------------------------------------------

test("saveConfig writes and loadConfig reads back", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-test-"));
  try {
    const input = { defaultSound: "chiptune/blip", recurringUntilInput: true, cooldownSeconds: 3 };
    await saveConfig(dir, input);
    const raw = await readFile(path.join(dir, "config.json"), "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.defaultSound, "chiptune/blip");
    assert.equal(parsed.recurringUntilInput, true);
    assert.equal(parsed.cooldownSeconds, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveConfig merges with existing config atomically", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cb-test-"));
  try {
    await saveConfig(dir, { defaultSound: "chiptune/halo" });
    await saveConfig(dir, { cooldownSeconds: 7 });
    const cfg = await loadConfig(dir);
    assert.equal(cfg.defaultSound, "chiptune/halo", "prior key preserved");
    assert.equal(cfg.cooldownSeconds, 7, "new key saved");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
