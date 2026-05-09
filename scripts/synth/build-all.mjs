/**
 * build-all.mjs — render all eight claudebeat chiptune audio assets in sequence
 *
 * Usage:
 *   node scripts/synth/build-all.mjs
 *
 * Each script is run as a child process so failures are isolated.
 * Set env CLAUDEBEAT_SYNTH=<name> to render a single sound, e.g.:
 *   CLAUDEBEAT_SYNTH=pixel node scripts/synth/build-all.mjs
 */

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const scripts = [
  { name: "pixel",   path: resolve(here, "pixel.mjs") },
  { name: "blip",    path: resolve(here, "blip.mjs") },
  { name: "click",   path: resolve(here, "click.mjs") },
  { name: "ring",    path: resolve(here, "ring.mjs") },
  { name: "whisper", path: resolve(here, "whisper.mjs") },
  { name: "lattice", path: resolve(here, "lattice.mjs") },
  { name: "halo",    path: resolve(here, "halo.mjs") },
  { name: "thock",   path: resolve(here, "thock.mjs") },
];

const filter = process.env.CLAUDEBEAT_SYNTH;

for (const { name, path } of scripts) {
  if (filter && name !== filter) continue;

  console.log(`\n▶ Rendering ${name}…`);
  try {
    execFileSync(process.execPath, [path], { stdio: "inherit" });
  } catch (err) {
    console.error(`✗ ${name} failed: ${err.message}`);
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log("\n✓ All sounds rendered.");
}
