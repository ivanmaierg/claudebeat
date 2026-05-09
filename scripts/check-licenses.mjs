/**
 * claudebeat license gate — scripts/check-licenses.mjs
 *
 * Validates the integrity of bundled audio assets:
 *   1. Every WAV in sounds/ has a matching entry in sounds/index.json
 *   2. Every entry in sounds/index.json has its WAV file on disk
 *   3. Each entry's recorded sha256 matches the actual file hash
 *   4. Each entry's license is in the accepted set (currently MIT-only — all assets
 *      are original syntheses produced by scripts/synth/*.mjs)
 *
 * Exits 0 only if all checks pass. Exits 1 if any FAIL is found.
 *
 * Usage: node scripts/check-licenses.mjs
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const VALID_LICENSE_IDS = new Set(["MIT"]);

function ok(msg) {
  process.stdout.write(`  OK  ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`  FAIL  ${msg}\n`);
}

async function walkFiles(dir, predicate) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walkFiles(fullPath, predicate);
      results.push(...sub);
    } else if (entry.isFile() && predicate(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function main() {
  let failed = false;

  process.stdout.write("claudebeat license gate\n");
  process.stdout.write(`Project root: ${PROJECT_ROOT}\n\n`);

  const indexPath = path.join(PROJECT_ROOT, "sounds", "index.json");
  let index;
  try {
    const raw = await readFile(indexPath, "utf8");
    index = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`FAIL  cannot load sounds/index.json: ${err.message}\n`);
    process.exit(1);
  }

  const indexedFiles = new Map();
  for (const [packName, pack] of Object.entries(index.packs)) {
    for (const sound of pack.sounds) {
      indexedFiles.set(sound.file, { packName, sound });
    }
  }

  const soundsDir = path.join(PROJECT_ROOT, "sounds");
  const wavFiles = await walkFiles(soundsDir, (name) => name.endsWith(".wav"));

  process.stdout.write(`Checking ${wavFiles.length} WAV file(s)...\n\n`);

  for (const wavPath of wavFiles) {
    const relativeToSounds = path.relative(soundsDir, wavPath);
    process.stdout.write(`[${relativeToSounds}]\n`);

    const indexed = indexedFiles.get(relativeToSounds);
    if (!indexed) {
      fail(`unindexed asset — not found in sounds/index.json: ${relativeToSounds}`);
      failed = true;
      continue;
    }

    const { sound } = indexed;

    if (!VALID_LICENSE_IDS.has(sound.license)) {
      fail(`invalid license "${sound.license}" for ${relativeToSounds} — accepted: ${[...VALID_LICENSE_IDS].join(", ")}`);
      failed = true;
    }

    if (!sound.sha256 || sound.sha256 === "TBD") {
      fail(`missing sha256 for ${relativeToSounds} — re-run scripts/synth/${sound.id}.mjs and update sounds/index.json`);
      failed = true;
      continue;
    }

    try {
      const actualHash = await sha256File(wavPath);
      if (actualHash !== sound.sha256) {
        fail(`SHA-256 mismatch for ${relativeToSounds}: recorded=${sound.sha256} actual=${actualHash} — re-run scripts/synth/${sound.id}.mjs and update sounds/index.json`);
        failed = true;
      } else {
        ok(`${relativeToSounds} (${sound.license}, sha256 verified)`);
      }
    } catch (err) {
      fail(`cannot compute SHA-256 for ${relativeToSounds}: ${err.message}`);
      failed = true;
    }
  }

  process.stdout.write("\nChecking index.json entries have corresponding WAV files...\n");
  for (const [relFile, { packName, sound }] of indexedFiles.entries()) {
    const wavPath = path.join(soundsDir, relFile);
    let exists = false;
    try {
      await stat(wavPath);
      exists = true;
    } catch {
      exists = false;
    }
    if (!exists) {
      fail(`indexed but missing WAV: sounds/${relFile} (id: ${packName}/${sound.id}) — run scripts/synth/${sound.id}.mjs to render`);
      failed = true;
    }
  }

  process.stdout.write("\n");

  if (failed) {
    process.stderr.write("License gate FAILED. Fix the issues above before releasing.\n");
    process.exit(1);
  } else {
    process.stdout.write("License gate PASSED. All sounds are indexed, licensed, and verified.\n");
    process.exit(0);
  }
}

main().catch((err) => {
  process.stderr.write(`FAIL  unexpected error: ${err.message}\n`);
  process.exit(1);
});
