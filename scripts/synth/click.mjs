/**
 * click.mjs — sharp UI-style click (very short bandpassed noise burst)
 *
 * The "click" character is dominated by high-frequency noise, not tonal content.
 * Almost all the energy lands between 2 kHz and 5 kHz. Very short duration so it
 * reads as a single discrete event, not a sustained sound.
 *
 * Tweak points (top of file):
 *   AMPLITUDE     — raw noise amplitude before bandpass (default 0.6)
 *   BP_HZ         — bandpass center frequency (default 3500 Hz — "click" range)
 *   BP_W          — bandpass width in Hz (default 3000)
 *   TOTAL_DUR     — total duration in seconds (default 0.012 — 12ms)
 *   FADE_START    — fade-out start in seconds (default 0.010)
 *   FADE_DUR      — fade-out duration in seconds (default 0.002)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../sounds/chiptune/click.wav");
mkdirSync(dirname(out), { recursive: true });

const AMPLITUDE = 0.6;
const BP_HZ = 3500;
const BP_W = 3000;
const TOTAL_DUR = 0.012;
const FADE_START = 0.010;
const FADE_DUR = 0.002;

const args = [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", `anoisesrc=color=white:duration=${TOTAL_DUR}:amplitude=${AMPLITUDE}`,
  "-af", `bandpass=f=${BP_HZ}:width_type=h:w=${BP_W},afade=t=out:st=${FADE_START}:d=${FADE_DUR},aformat=sample_fmts=u8:sample_rates=44100:channel_layouts=mono`,
  "-c:a", "pcm_u8",
  out,
];

execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
console.log(`rendered ${out}`);
