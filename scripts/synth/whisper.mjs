/**
 * whisper.mjs — NES "wind/hush" chiptune ambient (DEFAULT sound)
 *
 * Soft white noise with low-pass roll-off and gentle fade in/out.
 * Uses the NES noise channel (long-period white noise) feel:
 * very low amplitude, barely-there texture — not a beep, not aggressive.
 *
 * Tweak points (top of file):
 *   DURATION     — total duration in seconds (default 0.7)
 *   AMPLITUDE    — white noise amplitude (0.0–1.0; default 0.08 = very gentle)
 *   LOWPASS_HZ   — low-pass cutoff frequency in Hz (default 1500; lower = warmer hush)
 *   FADE_IN_DUR  — fade-in duration in seconds (default 0.05)
 *   FADE_OUT_ST  — fade-out start time in seconds (default 0.5)
 *   FADE_OUT_DUR — fade-out duration in seconds (default 0.2)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../sounds/chiptune/whisper.wav");
mkdirSync(dirname(out), { recursive: true });

// --- Tweak these constants ---
const DURATION = 0.7;       // seconds
const AMPLITUDE = 0.08;     // white noise amplitude (very gentle)
const LOWPASS_HZ = 1500;    // cutoff Hz — lower = warmer/softer hush
const FADE_IN_DUR = 0.05;   // seconds
const FADE_OUT_ST = 0.5;    // seconds
const FADE_OUT_DUR = 0.2;   // seconds

const filterGraph = `anoisesrc=color=white:duration=${DURATION}:amplitude=${AMPLITUDE}`;

const audioFilter = [
  `lowpass=f=${LOWPASS_HZ}`,
  `afade=t=in:st=0:d=${FADE_IN_DUR}`,
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
