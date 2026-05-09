/**
 * pixel.mjs — NES-style chiptune blip (C5 → G5, perfect fifth up)
 *
 * Tweak points (top of file):
 *   NOTE_1_HZ    — frequency of first note (default C5 = 523.25 Hz)
 *   NOTE_2_HZ    — frequency of second note (default G5 = 783.99 Hz)
 *   AMPLITUDE    — peak amplitude of square wave (0.0–1.0, default 0.4)
 *   NOTE_1_DUR   — duration of first note in seconds (default 0.08)
 *   TOTAL_DUR    — total duration in seconds (default 0.16)
 *   FADE_START   — fade-out start in seconds (default 0.14)
 *   FADE_DUR     — fade-out duration in seconds (default 0.02)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../sounds/chiptune/pixel.wav");
mkdirSync(dirname(out), { recursive: true });

// --- Tweak these constants ---
const NOTE_1_HZ = 523.25;   // C5
const NOTE_2_HZ = 783.99;   // G5
const AMPLITUDE = 0.4;
const NOTE_1_DUR = 0.08;    // seconds
const TOTAL_DUR = 0.16;     // seconds
const FADE_START = 0.14;    // seconds
const FADE_DUR = 0.02;      // seconds

const filterGraph = [
  `aevalsrc=`,
  `'if(lt(t,${NOTE_1_DUR}),${AMPLITUDE}*sgn(sin(2*PI*${NOTE_1_HZ}*t)),`,
  `if(lt(t,${TOTAL_DUR}),${AMPLITUDE}*sgn(sin(2*PI*${NOTE_2_HZ}*t)),0))':`,
  `d=${TOTAL_DUR}:s=44100`,
].join("");

const args = [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", filterGraph,
  "-af", `afade=t=out:st=${FADE_START}:d=${FADE_DUR},aformat=sample_fmts=u8:sample_rates=44100:channel_layouts=mono`,
  "-c:a", "pcm_u8",
  out,
];

execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
console.log(`rendered ${out}`);
