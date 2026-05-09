import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

export const SCHEMA = {
  defaultSound:               { type: "string",  default: "chiptune/pixel" },
  enableNotification:         { type: "boolean", default: true },
  enablePermission:           { type: "boolean", default: true },
  enableStop:                 { type: "boolean", default: false },
  notificationSound:          { type: "string",  default: "" },
  permissionSound:            { type: "string",  default: "" },
  stopSound:                  { type: "string",  default: "" },
  volume:                     { type: "number",  default: 1.0, min: 0, max: 1 },
  cooldownSeconds:            { type: "number",  default: 0,   min: 0 },
  maxPerMinute:               { type: "number",  default: 0,   min: 0 },
  recurringUntilInput:        { type: "boolean", default: false },
  recurringIntervalSeconds:   { type: "number",  default: 60,  min: 1 },
  recurringMaxDurationSeconds:{ type: "number",  default: 300, min: 1 },
};

export function defaultConfig() {
  const cfg = {};
  for (const [key, meta] of Object.entries(SCHEMA)) {
    cfg[key] = meta.default;
  }
  return cfg;
}

export async function loadConfig(dataDir) {
  const def = defaultConfig();
  if (!dataDir) return def;
  const configPath = path.join(dataDir, "config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return mergeConfig(def, parsed);
  } catch {
    return def;
  }
}

export async function saveConfig(dataDir, patch) {
  await mkdir(dataDir, { recursive: true });
  const existing = await loadConfig(dataDir);
  const merged = mergeConfig(existing, patch);
  const configPath = path.join(dataDir, "config.json");
  const tmpPath = configPath + ".tmp";
  await writeFile(tmpPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  await rename(tmpPath, configPath);
}

export function validateConfig(obj) {
  const errors = [];
  for (const [key, value] of Object.entries(obj)) {
    if (!(key in SCHEMA)) {
      errors.push({ key, reason: "unknown key" });
      continue;
    }
    const meta = SCHEMA[key];
    if (typeof value !== meta.type) {
      errors.push({ key, reason: `expected ${meta.type}, got ${typeof value}` });
      continue;
    }
    if (meta.type === "number") {
      if (meta.min !== undefined && value < meta.min) {
        errors.push({ key, reason: `value ${value} is below min ${meta.min}` });
      }
      if (meta.max !== undefined && value > meta.max) {
        errors.push({ key, reason: `value ${value} is above max ${meta.max}` });
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function mergeConfig(existing, patch) {
  return { ...existing, ...patch };
}
