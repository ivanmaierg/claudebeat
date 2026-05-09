/**
 * blip.mjs — single-shot chiptune snap (A5 square wave, ~70ms)
 *
 * Distinct from pixel: blip is one note, much shorter — classic arcade "select" /
 * cursor-move feel. Pixel is a two-note motif; blip is a single tap.
 *
 * Tweak points (top of file):
 *   NOTE_HZ      — frequency of the single note (default A5 = 880 Hz)
 *   AMPLITUDE    — peak amplitude of square wave (0.0–1.0, default 0.4)
 *   TOTAL_DUR    — total duration in seconds (default 0.07)
 *   FADE_START   — fade-out start in seconds (default 0.06)
 *   FADE_DUR     — fade-out duration in seconds (default 0.01)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../sounds/chiptune/blip.wav");
mkdirSync(dirname(out), { recursive: true });

const NOTE_HZ = 880;        // A5
const AMPLITUDE = 0.4;
const TOTAL_DUR = 0.07;     // seconds
const FADE_START = 0.06;    // seconds
const FADE_DUR = 0.01;      // seconds

const filterGraph = `aevalsrc='${AMPLITUDE}*sgn(sin(2*PI*${NOTE_HZ}*t))':d=${TOTAL_DUR}:s=44100`;

const args = [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", filterGraph,
  "-af", `afade=t=out:st=${FADE_START}:d=${FADE_DUR},aformat=sample_fmts=u8:sample_rates=44100:channel_layouts=mono`,
  "-c:a", "pcm_u8",
  out,
];

execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
console.log(`rendered ${out}`);
