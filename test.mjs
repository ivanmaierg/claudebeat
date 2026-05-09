/**
 * Smoke test for claudebeat gh-pages landing page.
 * Uses only Node built-in modules. Run: node test.mjs
 * Exits 0 on all-pass, 1 on any failure.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let failures = 0;

function fail(label, message) {
  process.stderr.write(`FAIL [${label}]: ${message}\n`);
  failures++;
}

function pass(label) {
  process.stdout.write(`PASS [${label}]\n`);
}

// ── T-1 / T-2: Read index.html, assert 5 sound buttons with correct IDs ──────

let html;
try {
  html = readFileSync(join(__dirname, 'index.html'), 'utf8');
} catch (err) {
  fail('T-1', `Cannot read index.html: ${err.message}`);
  process.stderr.write(`\nTotal: 0 passed, 1 failed\n`);
  process.exit(1);
}

const EXPECTED_IDS = new Set(['pixel', 'halo', 'thock', 'ring', 'blip']);

const rawMatches = html.match(/data-sound="([^"]+)"/g) ?? [];
const foundIds = rawMatches.map(m => /data-sound="([^"]+)"/.exec(m)[1]);

if (rawMatches.length !== 5) {
  fail('T-1', `Expected exactly 5 data-sound attributes, found ${rawMatches.length}`);
} else {
  pass('T-1');
}

const foundSet = new Set(foundIds);
const missingIds = [...EXPECTED_IDS].filter(id => !foundSet.has(id));
const extraIds = [...foundSet].filter(id => !EXPECTED_IDS.has(id));

if (missingIds.length > 0 || extraIds.length > 0) {
  fail('T-2', `Sound ID mismatch. Missing: [${missingIds.join(', ')}], Extra: [${extraIds.join(', ')}]`);
} else {
  pass('T-2');
}

// ── T-3: Each expected WAV exists on disk ─────────────────────────────────────

let t3Failed = false;
for (const id of EXPECTED_IDS) {
  const wavPath = join(__dirname, 'sounds', `${id}.wav`);
  if (!existsSync(wavPath)) {
    fail('T-3', `Missing WAV file: sounds/${id}.wav`);
    t3Failed = true;
  }
}
if (!t3Failed) pass('T-3');

// ── T-4: Install command line 1 ───────────────────────────────────────────────

if (!html.includes('/plugin marketplace add ivanmaierg/claudebeat')) {
  fail('T-4', 'Missing: /plugin marketplace add ivanmaierg/claudebeat');
} else {
  pass('T-4');
}

// ── T-5: Install command line 2 ───────────────────────────────────────────────

if (!html.includes('/plugin install claudebeat')) {
  fail('T-5', 'Missing: /plugin install claudebeat');
} else {
  pass('T-5');
}

// ── T-6: Repo link ────────────────────────────────────────────────────────────

if (!html.includes('https://github.com/ivanmaierg/claudebeat')) {
  fail('T-6', 'Missing: https://github.com/ivanmaierg/claudebeat');
} else {
  pass('T-6');
}

// ── T-7: Author credit ────────────────────────────────────────────────────────

if (!html.includes('Ivan Maier Gallardo')) {
  fail('T-7', 'Missing: Ivan Maier Gallardo');
} else {
  pass('T-7');
}

// ── Summary ───────────────────────────────────────────────────────────────────

const passed = 7 - failures;
process.stdout.write(`\nTotal: ${passed} passed, ${failures} failed\n`);
if (failures > 0) {
  process.exit(1);
}
