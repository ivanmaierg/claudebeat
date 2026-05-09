# claudebeat Synth Scripts

Pure ffmpeg synthesis — no sample libraries, no licenses, no network.
All scripts are independently runnable as Node ESM modules.
All output is **8-bit unsigned PCM (u8) WAV** — NES/Game Boy voices throughout.

## Render all sounds

```bash
node scripts/synth/build-all.mjs
```

Render a single sound:

```bash
node scripts/synth/pixel.mjs
node scripts/synth/blip.mjs
node scripts/synth/whisper.mjs
node scripts/synth/lattice.mjs
node scripts/synth/halo.mjs
node scripts/synth/thock.mjs
```

Or via the build-all helper:

```bash
CLAUDEBEAT_SYNTH=lattice node scripts/synth/build-all.mjs
```

## Output format

| Property      | Value          |
|---------------|----------------|
| Sample rate   | 44100 Hz       |
| Channels      | Mono           |
| Bit depth     | 8-bit unsigned PCM (u8) |
| Container     | WAV            |
| Codec         | pcm_u8         |

All output lives in `sounds/chiptune/`.

## Sound catalog

NES had 4 audio channels: 2 pulse (square), 1 triangle, 1 noise. Every sound here
uses one or more of these voices to stay authentic to the 8-bit aesthetic.

---

### pixel (`sounds/chiptune/pixel.wav`) — DEFAULT

NES-style two-note blip: C5 (523 Hz) → G5 (784 Hz), 160ms. Pulse (square) wave.

**Tweak knobs in `pixel.mjs`:**

| Constant     | Default  | Effect                              |
|--------------|----------|-------------------------------------|
| `NOTE_1_HZ`  | 523.25   | First note pitch                    |
| `NOTE_2_HZ`  | 783.99   | Second note pitch                   |
| `AMPLITUDE`  | 0.4      | Loudness (square wave — keep <0.8)  |
| `NOTE_1_DUR` | 0.08     | Duration of first note (seconds)    |
| `TOTAL_DUR`  | 0.16     | Total clip duration (seconds)       |
| `FADE_START` | 0.14     | Fade-out begin (seconds)            |
| `FADE_DUR`   | 0.02     | Fade-out length (seconds)           |

---

### blip (`sounds/chiptune/blip.wav`)

Single square wave A5 (880 Hz), ~70ms. Classic arcade cursor-move / select feel.

**Tweak knobs in `blip.mjs`:**

| Constant     | Default | Effect                             |
|--------------|---------|------------------------------------|
| `NOTE_HZ`    | 880     | Note pitch (A5)                    |
| `AMPLITUDE`  | 0.4     | Loudness (keep <0.8)               |
| `TOTAL_DUR`  | 0.07    | Total clip duration (seconds)      |
| `FADE_START` | 0.06    | Fade-out begin (seconds)           |
| `FADE_DUR`   | 0.01    | Fade-out length (seconds)          |

---

### whisper (`sounds/chiptune/whisper.wav`) — DEFAULT (gentle)

NES noise channel: soft white noise with low-pass roll-off. Barely-there ambient hush.

**Tweak knobs in `whisper.mjs`:**

| Constant       | Default | Effect                                     |
|----------------|---------|--------------------------------------------|
| `DURATION`     | 0.7     | Clip length in seconds                     |
| `AMPLITUDE`    | 0.08    | White noise level (keep <0.15 for "soft")  |
| `LOWPASS_HZ`   | 1500    | Cutoff — lower = warmer hush               |
| `FADE_IN_DUR`  | 0.05    | Fade-in length (seconds)                   |
| `FADE_OUT_ST`  | 0.5     | When fade-out starts (seconds)             |
| `FADE_OUT_DUR` | 0.2     | Fade-out length (seconds)                  |

---

### lattice (`sounds/chiptune/lattice.wav`)

NES triangle channel: G4 (392 Hz) with exponential decay. Softer than square waves —
musical but unmistakably 8-bit. Used for bass lines and secondary leads on NES.

**Tweak knobs in `lattice.mjs`:**

| Constant        | Default | Effect                                        |
|-----------------|---------|-----------------------------------------------|
| `FUNDAMENTAL_HZ`| 392     | Pitch (392 = G4, 440 = A4, 523 = C5)          |
| `AMPLITUDE`     | 0.7     | Peak amplitude                                |
| `DECAY_RATE`    | 3.0     | Exp decay (higher = shorter ring)             |
| `DURATION`      | 0.8     | Clip length in seconds                        |

---

### halo (`sounds/chiptune/halo.wav`)

Two NES pulse waves a perfect fifth apart: A5 (880 Hz) + E6 (1318 Hz), synchronized
exp decay. Evokes "chest open" / "power-up confirmed" feel. Triumphant-but-soft.

**Tweak knobs in `halo.mjs`:**

| Constant        | Default  | Effect                                        |
|-----------------|----------|-----------------------------------------------|
| `NOTE_1_HZ`     | 880      | Lower pulse (A5)                              |
| `NOTE_2_HZ`     | 1318.51  | Upper pulse (E6 — perfect fifth)              |
| `AMP_1`         | 0.45     | Lower note amplitude                          |
| `AMP_2`         | 0.35     | Upper note amplitude                          |
| `DECAY_RATE`    | 2.5      | Exp decay (lower = longer ring)               |
| `DURATION`      | 1.0      | Clip length in seconds                        |

---

### thock (`sounds/chiptune/thock.wav`)

NES percussion: low pulse wave (A2, 110 Hz) + white noise burst. Percussive, not melodic.

**Tweak knobs in `thock.mjs`:**

| Constant        | Default | Effect                                        |
|-----------------|---------|-----------------------------------------------|
| `BODY_HZ`       | 110     | Body pulse frequency (A2)                     |
| `BODY_AMP`      | 0.6     | Body amplitude                                |
| `BODY_DECAY`    | 50      | Exp decay (very fast = punchy)                |
| `CLICK_AMP`     | 0.5     | Noise click amplitude                         |
| `CLICK_BP_HZ`   | 2500    | Bandpass center for noise click               |
| `CLICK_BP_W`    | 2000    | Bandpass width (Hz)                           |
| `TOTAL_DUR`     | 0.09    | Clip length in seconds                        |

---

## Note on file sizes

At 44100 Hz / mono / **8-bit** PCM, each second of audio ≈ 43 KB raw WAV.
The 16-bit versions were ~86 KB/s — u8 is exactly half the data per second.
Short sounds (blip at 70ms, thock at 90ms) will be ~3–4 KB. This is correct.
