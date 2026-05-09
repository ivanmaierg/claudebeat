/**
 * halo.mjs — NES chiptune chime (two pulse waves a perfect fifth apart)
 *
 * Two square waves summed: A5 (880 Hz) + E6 (1318.51 Hz), perfect fifth.
 * Synchronized exponential decay — evokes NES "chest open" / "power-up confirmed"
 * tones. Triumphant-but-soft, not alarming.
 *
 * Tweak points (top of file):
 *   NOTE_1_HZ   — lower pulse frequency (default 880 = A5)
 *   NOTE_2_HZ   — upper pulse frequency (default 1318.51 = E6, perfect fifth above A5)
 *   AMP_1       — amplitude of lower note (default 0.45)
 *   AMP_2       — amplitude of upper note (default 0.35)
 *   DECAY_RATE  — exponential decay rate (default 2.5; lower = longer ring)
 *   DURATION    — total duration in seconds (default 1.0)
 *   FADE_OUT_ST — fade-out start in seconds (default 0.9)
 *   FADE_OUT_DUR — fade-out duration in seconds (default 0.1)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../sounds/chiptune/halo.wav");
mkdirSync(dirname(out), { recursive: true });

// --- Tweak these constants ---
const NOTE_1_HZ = 880;        // A5
const NOTE_2_HZ = 1318.51;    // E6 — perfect fifth above A5
const AMP_1 = 0.45;
const AMP_2 = 0.35;
const DECAY_RATE = 2.5;       // exp(-DECAY_RATE * t)
const DURATION = 1.0;
const FADE_OUT_ST = 0.9;
const FADE_OUT_DUR = 0.1;

// Two square (pulse) waves with synchronized exp decay
const filterGraph = [
  `aevalsrc=`,
  `'exp(-${DECAY_RATE}*t)*(${AMP_1}*sgn(sin(2*PI*${NOTE_1_HZ}*t))+${AMP_2}*sgn(sin(2*PI*${NOTE_2_HZ}*t)))':`,
  `d=${DURATION}:s=44100`,
].join("");

const audioFilter = [
  `afade=t=out:st=${FADE_OUT_ST}:d=${FADE_OUT_DUR}`,
  `aformat=sample_fmts=u8:sample_rates=44100:channel_layouts=mono`,
].join(",");

const args = [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", filterGraph,
  "-af", audioFilter,
  "-c:a", "pcm_u8",
  out,
];

execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
console.log(`rendered ${out}`);
