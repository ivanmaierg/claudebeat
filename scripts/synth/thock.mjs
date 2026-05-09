/**
 * thock.mjs — NES chiptune percussion ("punch" hit)
 *
 * Two-layer synthesis:
 *   Layer 1 — low pulse "body": square wave at A2 (110 Hz) with ~25ms exp decay
 *   Layer 2 — noise burst "click": white noise bandpassed around 1500–3500 Hz,
 *              very short fade-out (~15ms) for attack-only texture
 *
 * Classic NES drum feel: percussive, not melodic.
 *
 * Tweak points (top of file):
 *   BODY_HZ       — body pulse frequency in Hz (default 110 = A2)
 *   BODY_AMP      — body pulse amplitude (default 0.6)
 *   BODY_DECAY    — exp decay rate for body (default 50; very fast = punchy)
 *   CLICK_AMP     — white noise amplitude (default 0.5)
 *   CLICK_BP_HZ   — bandpass center for noise click (default 2500)
 *   CLICK_BP_W    — bandpass width in Hz (default 2000)
 *   CLICK_FADE_ST — noise fade-out start in seconds (default 0.012)
 *   CLICK_FADE_DUR — noise fade-out duration in seconds (default 0.005)
 *   MIX_CLICK_W   — click weight in final mix (body weight = 1.0)
 *   TOTAL_DUR     — total duration in seconds (default 0.09)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../../sounds/chiptune/thock.wav");
mkdirSync(dirname(out), { recursive: true });

// --- Tweak these constants ---
const BODY_HZ = 110;          // A2 — low pulse wave body
const BODY_AMP = 0.6;
const BODY_DECAY = 50;        // very fast exp decay — punchy attack

const CLICK_AMP = 0.5;
const CLICK_BP_HZ = 2500;     // bandpass center for noise click texture
const CLICK_BP_W = 2000;      // bandpass width in Hz
const CLICK_FADE_ST = 0.012;  // seconds
const CLICK_FADE_DUR = 0.005; // seconds

const MIX_CLICK_W = 0.6;
const TOTAL_DUR = 0.09;

const bodyExpr = `${BODY_AMP}*exp(-${BODY_DECAY}*t)*sgn(sin(2*PI*${BODY_HZ}*t))`;

const filterComplex = [
  `[1:a]bandpass=f=${CLICK_BP_HZ}:width_type=h:w=${CLICK_BP_W},`,
  `afade=t=out:st=${CLICK_FADE_ST}:d=${CLICK_FADE_DUR}[click];`,
  `[0:a][click]amix=inputs=2:duration=longest:weights=1 ${MIX_CLICK_W}[mix];`,
  `[mix]aformat=sample_fmts=u8:sample_rates=44100:channel_layouts=mono[out]`,
].join("");

const args = [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", `aevalsrc='${bodyExpr}':d=${TOTAL_DUR}:s=44100`,
  "-f", "lavfi", "-i", `anoisesrc=color=white:duration=${TOTAL_DUR}:amplitude=${CLICK_AMP}`,
  "-filter_complex", filterComplex,
  "-map", "[out]",
  "-c:a", "pcm_u8",
  out,
];

execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
console.log(`rendered ${out}`);
