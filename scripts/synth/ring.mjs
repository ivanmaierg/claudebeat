/**
 * ring.mjs — chiptune phone-ring (two-beep pulse-wave trill, A5)
 *
 * Pattern: bzzt — pause — bzzt. Like an old landline ring, condensed.
 *   0    → BEEP_DUR        : pulse beep at NOTE_HZ
 *   BEEP_DUR → BEEP_DUR + GAP_DUR : silence
 *   ... → 2*BEEP_DUR + GAP_DUR : pulse beep at NOTE_HZ
 *   ... → TOTAL_DUR        : tail silence
 *
 * Tweak points (top of file):
 *   NOTE_HZ      — pulse-wave frequency (default A5 = 880 Hz)
 *   AMPLITUDE    — peak amplitude of square wave (0.0–1.0, default 0.4)
 *   BEEP_DUR     — duration of each beep in seconds (default 0.05)
 *   GAP_DUR      — silence between the two beeps in seconds (default 0.04)
 *   TOTAL_DUR    — total duration in seconds (default 0.16)
 *   FADE_START   — fade-out start in seconds (default 0.14)
 *   FADE_DUR     — fade-out duration in seconds (default 0.02)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../sounds/chiptune/ring.wav");
mkdirSync(dirname(out), { recursive: true });

const NOTE_HZ = 880;        // A5
const AMPLITUDE = 0.4;
const BEEP_DUR = 0.05;
const GAP_DUR = 0.04;
const TOTAL_DUR = 0.16;
const FADE_START = 0.14;
const FADE_DUR = 0.02;

const beep1End = BEEP_DUR;
const beep2Start = BEEP_DUR + GAP_DUR;
const beep2End = beep2Start + BEEP_DUR;

const filterGraph = [
  `aevalsrc=`,
  `'if(lt(t,${beep1End}),${AMPLITUDE}*sgn(sin(2*PI*${NOTE_HZ}*t)),`,
  `if(lt(t,${beep2Start}),0,`,
  `if(lt(t,${beep2End}),${AMPLITUDE}*sgn(sin(2*PI*${NOTE_HZ}*t)),0)))':`,
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
