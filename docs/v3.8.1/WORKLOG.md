# SOL v3.8.1 — WORKLOG

Durable, append-only log of the v3.8.1 visual-foundation reconstruction. Times are IST (UTC+05:30).
Evidence classes: **SW** = SwiftShader software WebGPU capture (function/composition only), **CPU** = deterministic
numerical trace or unit test, **HW** = owner-supplied real-GPU evidence (none yet).

## 2026-10-12 — Gate 0: baseline recovery

- Supplied archive `sol-solar-system-v3.8-final.zip` (444,561,177 bytes) extracted; **it contains no `.git` directory**, so
  the reported tag `v3.8.0` / commit `a0cfcc6` cannot be verified from the archive. A fresh repository was initialised
  with the supplied tree as commit 1 and tagged `v3.8.0-supplied` (recoverable baseline).
- `npm ci` OK; `npm run typecheck` OK; `npm test` → **310/310 pass** (reproduced).
- QA browser: Debian Chromium 154.0.8037.92 + SwiftShader (`?qa-software-gpu=1&qa-off=small,smallcompute`), boots to
  Interactive; ~0.1 frame/s on this 2-vCPU arm64 sandbox. No physical GPU → all hardware performance items stay
  UNVERIFIED (owner benchmark kit to be prepared, WP-J).
- Baseline A/B server: the `v3.8.0-supplied` tree is served unchanged on :4174, candidate on :4173; captures use the
  same harness (tools/qa/scenarios/golden38.mjs + views381.mjs) against both.

## 2026-10-12 — Gate 1: root causes (confirmed vs hypothesis)

| ID | Owner symptom | Root cause | Evidence | Status |
|---|---|---|---|---|
| STAR-J01 | Stars jitter during zoom / unstable near a selected star | 3-D star layer subtracted a **single float32 camera** on the GPU: near another star one ulp of 1.3 pc = 0.0245 AU, so the drawn star snaps by up to 3.7 million km per frame while the float64 camera aims smoothly | CPU trace `tools/qa/star-stability.ts`: Proxima zoom 50→0.05 AU **38.9 px RMS jitter (max 105 px)**, Sirius 70 px; orbit-hold at 5 AU 1.0 px | CONFIRMED, FIXED (hi/lo split: 5.5e-5 px) |
| EXP-381-01 | Milky Way & stars go black when the Sun enters view; sky brightness depends on view direction | `veil = 0.45 × [Sun centre within ±1.1 NDC]` (binary, brightness-independent) re-coupled the sky to the scene camera (c 0.06 → 0.48) ⇒ whole-sky drop of 7–12 EV at the frame edge | code (engine.ts v3.8.0 l.628–636) + SW sweep `exp-sweep-*` | CONFIRMED, FIXED (continuous veil, bounded ≤ 2 EV) |
| SKY-381-02 | Sky artefact toward the anticentre | implicit-derivative mip selection across the atan() wrap at l = ±180° | code | CONFIRMED (code), FIXED (explicit LOD) |
| SKY-381-03 | "Muddy", crawling background | sky dither hash included `frameNo % 64` → whole panorama re-noised every frame | code | CONFIRMED (code), FIXED |
| STAR-P01 | Stars look like generic soft dots | PSF σ = 0.85 **CSS** px → 1.7 device px on 2× displays; point-sampled | code + `psf381.test.ts` | FIXED (σ 0.62 device px, exact per-pixel erf integral) |
| SUN-381-01 | Sun at Earth/Mars distance = featureless white blob | disc metering weight is 0 below 4 px radius and ramps to 40 px (`sunMeterWeight`), so at 1 AU (≈3.8 px radius at 720p/50°) the disc is exposed for the sky ⇒ clipped by ~10⁹; fixed-size (45 % of frame height) glare sprite with a constant `exp(−10r)` fog term and a fixed warm tint | code | CONFIRMED (code), reconstruction in progress |
| PERF-HW | Real-PC stutter | not reproducible without a GPU | — | HYPOTHESES ONLY; owner kit pending |

## 2026-10-12 — Gate 2/3 implementation (checkpoint 1)

- STAR-J01 / STAR-P01 / EXP-381-01 / SKY-381-02…06 / SUN-381-01…05 / PERF-381-01 implemented (see docs/issues.md v3.8.1).
- Sun blob isolated by layer switch-off captures (glare off / corona off / bloom off): corona billboard (aureole + physical
  corona at 10²–10³ × white) was the dominant term, then the fixed-size glare, then the clipped disc.
- Sky asset gotcha: a `.gz` file is served with `Content-Encoding: gzip` by vite/sirv → "Failed to fetch"; container renamed
  `.r8gz` and the loader sniffs the gzip magic (works whether or not a host transport-decodes).
- Capture hygiene: the vite dev server hot-reloads on source edits and destroys an in-flight capture; candidate captures now
  run against a snapshot copy (/tmp/cand, :4175), baseline against /tmp/base (:4174).
- Evidence: docs/v3.8.1/SOL_V381_CHECKPOINT_1.md/.pdf, img/A1, D0, D1, D2, C1; originals in the checkpoint evidence archive.
- Open tuning items (SW-only judgement): Mercury-distance glow restrained; Exploration MW gain ×1.4 first pass.

## 2026-10-12 — Checkpoint 2 (owner QA requirements 1–5)
- Req. 1 sky removal QA (radiance domain), Req. 2 rendered-frame centroid runs (640×360 @ DPR 1/2, 1280×720), Req. 3 Sun
  ladder incl. 20° FOV / Scientific / Cinematic / far transitions, Req. 4 Uranian maps replaced (JPL/USGS), Req. 5 benchmark
  kit (no install/admin/upload) verified end-to-end in the sandbox with the packaged serve.mjs.
- Also: Cassini shape models for 11 small moons, measured stellar radii + resolved stellar disc, free-look smoothing,
  Galactic card redesign, new intro.
- Lessons: /tmp and system packages can vanish between sessions → tools/qa/sandbox/setup.sh, outputs in work/qa; always run a
  browser boot smoke after data-model edits (BOOT-381-01 was only caught by a capture run).

## 2026-10-12/13 — Checkpoint 2 completed (tag v3.8.1-cp2)
- Recovered after sandbox resets (×3 during the session): repo intact; rebuilt QA env with tools/qa/sandbox/setup.sh.
- DPR-2 stability extracted; full Sun/mode/moon set (33 views) + v3.8.0 baseline; phase-70 and Voyager-epoch views added.
- Capture review found and fixed: SUN-381-06 (resolved-Sun glare collapse), STAR-381-D2/D3 (photosphere exposure),
  AST-381-01b/c (Uranian map seam; first 01c attempt broke all partial maps — caught by capture), EXP-381-02 (limb-meter
  cache made exposure depend on the previous view; verified order-independent), GAL-381-01b (card legibility).
- 22-view regression set vs v3.8.0 (also the WP-E/F/H "before" set): no unintended regressions.
- Benchmark kit rebuilt from cp2, checksums verified, packaged serve.mjs self-test passed (SW). Windows .bat/.ps1 unverified.
- 329/329 tests, tsc clean, build OK, assets 1527 / 0 unmatched / 0 non-commercial.

## 2026-10-13 — owner review of cp2 (REV2-01…07), post-cp2 development
- Registered REV2-01…07 in docs/issues.md (D/P/U classes). cp2 tag untouched.
- REV2-01 SUN-381-07: glare audit (tools/qa/glare_audit.py, views GLAREAUDIT: 7 distances × 20°/50° × auto/fixed EV −10.26).
  Root cause: between the resolution threshold and full metering the disc was displayed at 10–100× white (local
  presentation ramp 3→12 px) → bloom/glare blob; Mars-20° G = 27.7k vs Mercury 4.3k. Fix: ramp 3→5 px, resolved glare
  display-referred (≤4× white), point cap; spikes off by default (Cinematic on, labelled). Post: resolved range monotone
  (4.2k → 1.19k → 0.78k). Point regime ×0.32 to remove the hand-over jump (verification run glare-post2 queued).
- REV2-02 AST-381-03: reconstruction guide fields for all 6 partial mosaics (colour guide + weight; w≈0 on observed
  pixels asserted); detail amplitudes from measured observed contrast; regional rim rule for the Uranian maps.
  Iteration 1 (luminance-only) was insufficient (grey Pluto/Charon/Triton reconstructions, bands) → iteration 3.
- REV2-03 AST-381-04: Cassini reference comparison (PIA17208, PIA12593, PIA21449): global tonal statistics already
  match (p50/p99 similar); the deficit is small-scale relief. Generic crater recipe had d/D ≈ 0.004. On observed shape
  models: fBm relief dropped, saturation-slope crater octaves with d/D 0.12 / 0.04 (mantled). Source meshes have few
  creases (docs/qa/v3.8.1/shape-model-creases.json).
- REV2-04 ATM-381-01: Venus/Titan twilight skylight from the atmosphere's own diffuse LUT; fill starts past twilight.
- REV2-05 STAR-381-D4: per-channel limb darkening.
- REV2-06 UX-381-02: intro anchor = observed SDO/HMI continuum Sun 2026-09-21 (tools/ingest/intro_sun.py); Galactic card
  enlarged layout two-column and clear of header/mode bar/time dock.
- Sandbox reset mid-session: queue scripts now in tools/qa/sandbox/rev2_queue*.sh (resumable).

## 2026-10-13/14 — REV2/CONT-381 continuation (owner: efficient usage; focused acceptance checks)
- SUN-381-07c (100 AU irradiance cap) WITHDRAWN on owner review → SUN-381-08 shared solar display transfer: physical flux
  exact; disc presented at 2.4 through the whole cross-fade (sunDiscScale ramp 0.6→1.0 px); point peak capped at the same
  level in the PSF shader (PX.sunPeakCap, compress≥2 flag); point glare = hand-over glare × (r/3.5)^0.5 (∝F^0.25), clamped.
- Continuous travel (tools/qa/continuity_travel.mjs, analyse tools/qa/travel_analyse.py) found three hand-over defects
  invisible at fixed distances: glare off at 9–13 AU (stale sunRpx → live geometric radius), halo overshoot 1.44→1.64 at
  1.2 AU (clamp), 12 EV single-step exposure cliff at ~2 AU (EXP-381-03 log-space meter blend 3.5→8 px). Post-fix
  sun-f20-auto and sun-f20-fixed: halo monotone 0.25→300 AU; EV max 5.6 / step incl. adaptation lag.
- RING-381-01: ring systems metered as subjects (view-ray/ring-plane); close-ups 6.45–6.85 EV (were +14.6 EV white).
- ATM-381-02: Venus delta-M haze transmittance. AST-381-03 iter 4–5 + relief blended at the normal (h·w ridge drew the
  boundary line on all six partial-mosaic bodies).
- Sandbox resets every ~40–60 min: all queues resumable (tools/qa/sandbox/rev4_queue.sh).
