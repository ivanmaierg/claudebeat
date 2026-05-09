/**
 * lattice.mjs — NES triangle-wave melodic note (chiptune)
 *
 * Triangle wave at G4 (392 Hz) with classic NES exponential decay envelope.
 * Triangle gives a softer, fuller tone than square waves — used on NES for
 * bass lines and secondary leads. Sounds musical but unmistakably 8-bit.
 *
 * Tweak points (top of file):
 *   FUNDAMENTAL_HZ — pitch of the triangle note (default 392 = G4)
 *   AMPLITUDE      — peak amplitude (0.0–1.0; default 0.7)
 *   DECAY_RATE     — exponential decay rate (higher = shorter decay; default 3.0)
 *   DURATION       — total duration in seconds (default 0.8)
 *   FADE_OUT_ST    — fade-out start in seconds (default 0.75)
 *   FADE_OUT_DUR   — fade-out duration in seconds (default 0.05)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../sounds/chiptune/lattice.wav");
mkdirSync(dirname(out), { recursive: true });

// --- Tweak these constants ---
const FUNDAMENTAL_HZ = 392;   // G4
const AMPLITUDE = 0.7;
const DECAY_RATE = 3.0;       // exp(-DECAY_RATE * t)
const DURATION = 0.8;
const FADE_OUT_ST = 0.75;
const FADE_OUT_DUR = 0.05;

// Triangle wave: (2/PI)*asin(sin(2*PI*f*t)) — true NES triangle voice
const filterGraph = [
  `aevalsrc=`,
  `'${AMPLITUDE}*exp(-${DECAY_RATE}*t)*(2/PI)*asin(sin(2*PI*${FUNDAMENTAL_HZ}*t))':`,
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
