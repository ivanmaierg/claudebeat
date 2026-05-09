/**
 * pick.mjs — standalone CLI for claudebeat
 *
 * Modes:
 *   (default)          interactive arrow-key TUI picker
 *   settings           TUI settings editor
 *   --list [--json]    print sound catalog
 *   --save <id>        save default sound non-interactively
 *   --help / -h        print usage
 */

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, saveConfig, validateConfig, SCHEMA } from "./config-helpers.mjs";

const __filename = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = path.resolve(path.dirname(__filename), "..");
const PLUGIN_DATA = process.env.CLAUDE_PLUGIN_DATA ||
  path.join(process.env.HOME || process.env.USERPROFILE || "~", ".claude", "plugins", "data", "claudebeat-inline");

// ---------------------------------------------------------------------------
// Settings row order (12 settings in spec FR-19 order + permissionSound)
// ---------------------------------------------------------------------------

export const SETTINGS_ORDER = [
  "defaultSound",
  "enableNotification",
  "enablePermission",
  "enableStop",
  "notificationSound",
  "permissionSound",
  "stopSound",
  "cooldownSeconds",
  "maxPerMinute",
  "recurringUntilInput",
  "recurringIntervalSeconds",
  "recurringMaxDurationSeconds",
];

// ---------------------------------------------------------------------------
// Exported pure helpers (for tests)
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { mode: "help" };
  if (argv[0] === "--list") return { mode: "list", json: argv.includes("--json") };
  if (argv[0] === "--save") {
    const id = argv[1];
    if (!id) return { mode: "error", reason: "missing-arg" };
    return { mode: "save", id };
  }
  if (argv[0] === "settings") return { mode: "settings" };
  return { mode: "interactive" };
}

export function parseEscapeSequence(buf) {
  if (buf[0] === 0x1b) {
    if (buf.length === 1) return "escape";
    if (buf[1] === 0x5b) {
      if (buf[2] === 0x41) return "up";
      if (buf[2] === 0x42) return "down";
    }
    return "escape";
  }
  if (buf[0] === 0x0d || buf[0] === 0x0a) return "enter";
  if (buf[0] === 0x03) return "ctrl-c";
  return String.fromCharCode(buf[0]);
}

export function settingsNavigate(rowIndex) {
  const key = SETTINGS_ORDER[rowIndex];
  if (!key) return null;
  const meta = SCHEMA[key];
  return { key, type: meta.type, default: meta.default };
}

// ---------------------------------------------------------------------------
// Catalog loader
// ---------------------------------------------------------------------------

async function loadCatalog() {
  const indexPath = path.join(PLUGIN_ROOT, "sounds", "index.json");
  try {
    const raw = await readFile(indexPath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[claudebeat] failed to load catalog: ${e.message}\n`);
    return null;
  }
}

function allSounds(catalog) {
  if (!catalog || !catalog.packs) return [];
  const sounds = [];
  for (const [packName, pack] of Object.entries(catalog.packs)) {
    for (const s of pack.sounds) {
      sounds.push({ ...s, fullId: `${packName}/${s.id}` });
    }
  }
  return sounds;
}

// ---------------------------------------------------------------------------
// List mode
// ---------------------------------------------------------------------------

async function listMode(json) {
  const catalog = await loadCatalog();
  if (!catalog) {
    process.exit(1);
  }
  const sounds = allSounds(catalog);
  if (json) {
    process.stdout.write(JSON.stringify(sounds, null, 2) + "\n");
  } else {
    for (const s of sounds) {
      process.stdout.write(`${s.fullId}  ${s.label}  ${s.description}\n`);
    }
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Save mode (non-interactive)
// ---------------------------------------------------------------------------

async function saveMode(id) {
  const catalog = await loadCatalog();
  if (!catalog) {
    process.stderr.write(`[claudebeat] cannot validate id: catalog unavailable\n`);
    process.exit(1);
  }
  const sounds = allSounds(catalog);
  const match = sounds.find((s) => s.fullId === id);
  if (!match) {
    process.stderr.write(`[claudebeat] unknown sound id: ${id}\n`);
    process.exit(1);
  }
  await saveConfig(PLUGIN_DATA, { defaultSound: id });
  process.stdout.write(`Default sound saved: ${id}\n`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Help mode
// ---------------------------------------------------------------------------

function helpMode() {
  process.stdout.write(
    "Usage: node pick.mjs [options]\n" +
    "\n" +
    "Options:\n" +
    "  (none)           Interactive arrow-key TUI picker\n" +
    "  settings         TUI settings editor\n" +
    "  --list           Print sound catalog (human-readable)\n" +
    "  --list --json    Print sound catalog as JSON array\n" +
    "  --save <id>      Save default sound non-interactively\n" +
    "  --help, -h       Print this help and exit\n"
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// ANSI helpers for TUI
// ---------------------------------------------------------------------------

const ESC = "\x1b";
const CLEAR_SCREEN = `${ESC}[2J${ESC}[H`;
const SHOW_CURSOR = `${ESC}[?25h`;
const HIDE_CURSOR = `${ESC}[?25l`;
const INVERT = `${ESC}[7m`;
const RESET = `${ESC}[0m`;

function restoreTerm() {
  process.stdout.write(SHOW_CURSOR);
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(false); } catch { }
  }
  process.stdin.pause();
}

// ---------------------------------------------------------------------------
// Interactive TUI picker
// ---------------------------------------------------------------------------

async function interactiveMode() {
  if (!process.stdin.isTTY) {
    process.stderr.write("[claudebeat] stdin is not a TTY — cannot run interactive picker\n");
    process.exit(0);
  }

  const catalog = await loadCatalog();
  if (!catalog) process.exit(1);
  const sounds = allSounds(catalog);
  const config = await loadConfig(PLUGIN_DATA);
  const currentDefault = config.defaultSound || null;

  let selected = 0;
  let lastPreviewId = null;
  let message = "";

  function render() {
    let out = CLEAR_SCREEN + HIDE_CURSOR;
    out += currentDefault
      ? `Current default: ${currentDefault}\n\n`
      : "No default set\n\n";
    if (message) {
      out += `${message}\n\n`;
    }
    for (let i = 0; i < sounds.length; i++) {
      const s = sounds[i];
      const line = `  ${String(i + 1).padStart(2)}. ${s.fullId.padEnd(20)} ${s.label}`;
      if (i === selected) {
        out += `${INVERT}${line}${RESET}\n`;
      } else {
        out += `${line}\n`;
      }
    }
    out += "\n[arrows] navigate  [Enter] preview  [s] save  [q/Esc/^C] quit\n";
    if (lastPreviewId) {
      out += `Last preview: ${lastPreviewId}  — press s to save\n`;
    }
    process.stdout.write(out);
  }

  function preview(id) {
    const playMjs = path.join(PLUGIN_ROOT, "scripts", "play.mjs");
    spawnSync(process.execPath, [playMjs, "--preview", id], {
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, CLAUDE_PLUGIN_DATA: PLUGIN_DATA },
      stdio: "inherit",
    });
    lastPreviewId = id;
  }

  async function saveSound(id) {
    await saveConfig(PLUGIN_DATA, { defaultSound: id });
    message = `Saved: ${id}`;
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();

  process.on("exit", restoreTerm);
  process.on("SIGINT", () => { restoreTerm(); process.exit(0); });
  process.stdout.on("resize", render);

  render();

  for await (const chunk of process.stdin) {
    const key = parseEscapeSequence(chunk);
    if (key === "up") {
      selected = (selected - 1 + sounds.length) % sounds.length;
      message = "";
      render();
    } else if (key === "down") {
      selected = (selected + 1) % sounds.length;
      message = "";
      render();
    } else if (key === "enter") {
      preview(sounds[selected].fullId);
      render();
    } else if (key === "s") {
      const id = lastPreviewId || sounds[selected].fullId;
      await saveSound(id);
      render();
    } else if (key === "q" || key === "escape" || key === "ctrl-c") {
      restoreTerm();
      process.exit(0);
    }
  }
}

// ---------------------------------------------------------------------------
// Settings TUI
// ---------------------------------------------------------------------------

async function settingsMode() {
  if (!process.stdin.isTTY) {
    process.stderr.write("[claudebeat] stdin is not a TTY — cannot run settings editor\n");
    process.exit(0);
  }

  const config = await loadConfig(PLUGIN_DATA);
  let selectedRow = 0;
  let typingBuffer = "";
  let message = "";

  function render() {
    let out = CLEAR_SCREEN + HIDE_CURSOR;
    out += "claudebeat settings\n\n";
    if (message) {
      out += `${message}\n\n`;
    }
    for (let i = 0; i < SETTINGS_ORDER.length; i++) {
      const key = SETTINGS_ORDER[i];
      const meta = SCHEMA[key];
      const val = config[key] !== undefined ? config[key] : meta.default;
      const display = `  ${key.padEnd(32)} ${String(val)}`;
      if (i === selectedRow) {
        if (meta.type === "number" || meta.type === "string") {
          out += `${INVERT}${display}${RESET}`;
          if (typingBuffer) out += ` → ${typingBuffer}`;
          out += "\n";
        } else {
          out += `${INVERT}${display}${RESET}\n`;
        }
      } else {
        out += `${display}\n`;
      }
    }
    out += "\n[arrows] navigate  [Enter] toggle/confirm  [q/Esc/^C] quit\n";
    process.stdout.write(out);
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.on("exit", restoreTerm);
  process.on("SIGINT", () => { restoreTerm(); process.exit(0); });
  process.stdout.on("resize", render);

  render();

  for await (const chunk of process.stdin) {
    const key = parseEscapeSequence(chunk);
    const currentKey = SETTINGS_ORDER[selectedRow];
    const meta = SCHEMA[currentKey];

    if (key === "up") {
      typingBuffer = "";
      message = "";
      selectedRow = (selectedRow - 1 + SETTINGS_ORDER.length) % SETTINGS_ORDER.length;
      render();
    } else if (key === "down") {
      typingBuffer = "";
      message = "";
      selectedRow = (selectedRow + 1) % SETTINGS_ORDER.length;
      render();
    } else if (key === "q" || key === "escape" || key === "ctrl-c") {
      restoreTerm();
      process.exit(0);
    } else if (key === "enter") {
      if (meta.type === "boolean") {
        const newVal = !config[currentKey];
        const validation = validateConfig({ [currentKey]: newVal });
        if (validation.ok) {
          config[currentKey] = newVal;
          await saveConfig(PLUGIN_DATA, { [currentKey]: newVal });
          message = `Saved ${currentKey}: ${newVal}`;
        }
      } else if (typingBuffer) {
        let newVal;
        if (meta.type === "number") {
          newVal = Number(typingBuffer);
          if (isNaN(newVal)) {
            message = `Invalid number: ${typingBuffer}`;
            typingBuffer = "";
            render();
            continue;
          }
        } else {
          newVal = typingBuffer;
        }
        const validation = validateConfig({ [currentKey]: newVal });
        if (!validation.ok) {
          message = `Invalid: ${validation.errors[0].reason}`;
          typingBuffer = "";
          render();
          continue;
        }
        config[currentKey] = newVal;
        await saveConfig(PLUGIN_DATA, { [currentKey]: newVal });
        message = `Saved ${currentKey}: ${newVal}`;
        typingBuffer = "";
      }
      render();
    } else if (key === "\x7f" || key === "\b") {
      typingBuffer = typingBuffer.slice(0, -1);
      render();
    } else if (key.length === 1 && key >= " ") {
      if (meta.type !== "boolean") {
        typingBuffer += key;
        render();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);

  switch (parsed.mode) {
    case "help":
      helpMode();
      break;
    case "list":
      await listMode(parsed.json);
      break;
    case "save":
      await saveMode(parsed.id);
      break;
    case "error":
      process.stderr.write(`[claudebeat] ${parsed.reason === "missing-arg" ? "--save requires a sound id argument" : parsed.reason}\n`);
      process.exit(1);
      break;
    case "settings":
      await settingsMode();
      break;
    case "interactive":
    default:
      await interactiveMode();
      break;
  }
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isEntryPoint) {
  main().catch((err) => {
    process.stderr.write(`[claudebeat] ${err.message}\n`);
    process.exit(0);
  });
}
