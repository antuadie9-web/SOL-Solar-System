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

## 2026-10-14 — resume after usage refill (HEAD 7add52a; cp2 tag f4974e8 unchanged; 330/330, tsc clean, 1549 assets)
- AST-381-03/04 shared crater function (shaderlib `craters`): height was discontinuous at the rim crest (inner branch
  bowl·0.6+rim, outer rim·0.6 → step 0.14·rad at d = 1). Screen-derivative bump turned the step into the dotted crater
  outlines on every procedural surface. Outer branch now `rim` (continuous; rim height unchanged). Commit 9d…/"shared crater".
- New views PARTIALNEAR (views381.mjs): six bodies at 1.7 R, camera at the boundary latitude, az 20°/70°.
- Probe (pnear-probe-4aafe1e): Pluto/Charon boundary = colour step + jagged hairline. Measured by distance from the gap
  (/tmp/edge.py logic, lat < 60°): observed data darken over the last ~4° (Pluto 0.34→0.20, Charon 0.51→0.39 sRGB-Y;
  Triton/Titania/Ariel < 3 %), while the guide started at the core colour → brighter band.
- Iteration 7 (partial_recon.py): guide starts at the observed EDGE colour (0.35° normalised convolution of shown pixels,
  nearest-propagated) and relaxes to the regional guide over 4°. Charon edge step 0.392 vs 0.400.
- Iteration 8 (planetMaterial.ts): procedural albedo structure and relief scale with reconW (0 on the edge → 1 at 5°): the
  detail-frequency step (blurred observed rim vs sharp synthetic craters) itself drew the boundary.
- Iteration 8b: mask normalisation c/m removed — since it6 the texels beyond the mask edge are real rim data, not zeros, so
  the division amplified them into a 1-px light/dark hairline (tier 5). Residual: isolated ±4-level dark dots on the
  Charon boundary (source pixels), visible only in 3× crops.
- Acceptance queue tools/qa/sandbox/ast3_queue.sh (cp2 :4177 vs current, 1280×720, keyed by last src/public commit).

## 2026-10-14 (b) — GitHub remote, AST-381-03 iterations 8c–8e, Gate A audit
- GitHub: origin = antuadie9-web/SOL-Solar-System (private), main = master, all tags pushed, cp2 untouched (f4974e8). tools/git/push.sh, docs/REPOSITORY.md.
- AST-381-03 matched acceptance (cp2 vs ff4dbb5, PARTIALNEAR): dotted crater rims/colour steps of cp2 gone on all bodies; residual dotted lines traced
  in three steps: 8c (hand-over ramp ≥0.85 mask) no visible effect; 8d (luminance no-data test only while the mask is a placeholder) no visible effect;
  8e ROOT CAUSE — the 0.4° rim erosion of the data mask grew every sub-threshold speck inside the observed area (reseau/dropouts) into a ~0.8° hole of
  reconstruction colour. Specks < 0.3° enclosed by data are now part of the observed area (counts in partial-recon-v381.json; Pluto hi 3,850 specks).
- Gate A audit: docs/v3.8.1/GATE_A_AUDIT.md (inventory, dependency map, risk findings GA-SCI-01, GA-EPH-01..04, GA-ARCH-01/02, GA-RES-01, GA-PHOT-01).

## 2026-10-14 (afternoon) — AST-381-03 acceptance, QA-381-01
- Owner review: cp2 baseline linked working-tree assets → QA-381-01. ast3_queue.sh now serves cp2 and the candidate from immutable git-archive snapshots with blob manifests, re-verified before every batch; completion requires every image of the exact commit. Contaminated cp2 captures (Ariel/Oberon/Titania near, far) kept as *.contaminated-assets; Triton/Pluto cp2 kept (no loaded file differs).
- Six-body A/B (cp2 vs 4e3d06f), near az20/70 + far, SW WebGPU: boundary artefacts gone; high-pass isolated-pixel count 2–9× lower. AST-381-03 CLOSED (SW). Report docs/v3.8.1/AST-381-03_ACCEPTANCE.md; sheet work/qa/sheets/ast3-acceptance-4e3d06f.png.
- New AST-381-04: Triton recon neutral grey vs observed hue; crater-dominated recon morphology wrong for Triton; faint procedural rim circles.
- Next: CONT-14 titan-handover measurement, sun-far-auto, GA-EPH-04, then WP-E atmospheres (Titan haze) / WP-F rings.
- CONT-14 measurement (SW, 4e3d06f immutable snapshot, work/qa/travel-cont14-4e3d06f, exploration mode; -sci run timed out, rerun needed): integrated Titan signal (crop sum above median) at near-constant EV 7.4 falls ∝ r² from 7.8 px to 2.04 px (13,223→3,020) then JUMPS to 4,358 at 1.76 px (expected ≈2,250): ≈1.9× (+0.7 mag) step at disc→point handover. Below 1 px, after EV correction (+3.4 stops), the point signal is still ≈1.7× the r²-scaled disc value — consistent with the ×1.6 point colour factor + sky-vs-scene exposure domain. Fix to be made in the shared point/disc photometric contract (one exposure domain, unit point factor, energy-matched crossfade), not per body; then rerun titan-handover[-sci].

## 2026-10-14 (evening) — QA-381-02 + CONT-14
- Adopted risk-based L1/L2/L3 QA (docs/v3.8.1/QA_WORKFLOW.md) with measured phase costs; fixed harness hang (vite inherited stdin, +1,200 s/job).
- CONT-14 root cause 1 (owner hypothesis, confirmed by SW A/B with only Titan's sphere depth writes toggled, same geometry/flux/exposure: 4.6× point signal at 1 px): the body's own black, depth-writing sphere (drawn down to 0.55 px) occluded its PSF core. CPU point flux matches the Lambert formula exactly (8.17e-10 vs 8.16e-10 committed); GPU-integrated point / CPU flux = 0.93 at 1 px (PSF energy conserved).
- Fix: shared representation/depth contract `pointDepthScale` (sprite on the line of sight just in front of the view bound, atmosphere shell included); depth testing retained. Scientific titan-handover (immutable snapshots 0ccddd1 → de069107d635, HDR metric with inverse Neutral TM): normalised point signal 0.012 → 0.10–0.11, flat 1.4 → 0.5 px, no step at 0.55 px.
- Remaining CONT-14c: point (Lambert phase law) ≈ 4× fainter than the rendered disc (0.43) at this geometry — a radiometric/phase-law mismatch, separate from occlusion. Next: log phase angle (added to travel), compare an airless body, then make the point flux follow the disc's photometric model. Exposure contract (`pointExposure`) still needs Exploration travel verification.

## 2026-10-15 — CONT-14c photometry
- New QA path: engine.qaReadHDR (scene-linear readback of the HDR pass, before bloom/grade/tone map) + tools/qa/probe_photometry.mjs (body × phase × rpx at frozen clock). Cost finding: the readback is NOT faster than a 33×33 screenshot (4–15 s) — the cost is the SwiftShader frame render it forces, not PNG encode; benefit is unclipped linear data with no tone-map inversion. Next cost lever: smaller viewport for point-regime travel.
- Root causes (code + CPU integral + SW readback): point ⅔·p with geometric albedo; tint×1.6 (not luminance-normalised); Lambert phase law vs lunar-Lambert/Minnaert disc; airless disc a = 1.25p, gas a = 1.05p (undocumented, inherited from v3.8.0). Fix: one geometric-albedo-anchored model (presentation.ts discPhaseIntegral/discReflectance/pointBodyFlux/lumNormalised); planetshine and UI magnitude use the same convention. Venus/Titan/Earth calibrations unchanged pending WP-E.
- Evidence: photometry-a (before) / photometry-b (after); travel-c14c titan-handover-sci (α 122°): residual is CONT-14d (atmosphere-shell light), registered for WP-E. Exposure-contract verification: travel-c14c titan-handover (Exploration).
- Gate B continued: GA-EPH-04 mitigated (stream order planets → comets → pluto → moons; labels unchanged). sun-far-auto exposed SUN-FAR-01 (findability floors stacked on the Sun) → fixed at 724d783, verified travel-sunfar2 (stride 2, 24 steps, 732 s). Travel runner gained --from/--stride.
- Next: Gate C / WP-E Titan detached haze, together with CONT-14d (shell disc-integral contract so the point carries the atmosphere's phase behaviour).

## 2026-10-15 — Gate C / WP-E start: Titan reference atmosphere + CONT-14d contract (L1 → first L2)
- Verified start: HEAD = origin/main = c57fce9.
- atmoModel: up to 3 aerosol populations (exp with variable H + Gaussian gap / band / Gaussian layer), each with its own
  spectrum, ω0, g; CPU twins (aeroDensity) and WGSL (aeroD). Focus-shell march (CPU + WGSL): rays split at the thin-layer
  shell so the 20-km detached haze is resolved on limb paths (limb radiance within 5 % of a 10× finer march).
- Titan (src/data/titanAtmo.ts): DISR τ(λ) fits per altitude region (Tomasko 2008 / Tomasko & West 2010), 65-km scale
  height, detached haze 510 km (2017 state, West 2018; INFERRED for 2026), gap 445 km, N₂ Rayleigh τ(550)=1.0 (DERIVED).
  SSA/g FITTED within DISR uncertainty to p_V=0.22, B−V=1.28 and the García Muñoz 2017 phase curve. Rejected with
  evidence: decreasing-H law above 250 km and a two-lobe diffraction peak (both weaken the 160–166° surge).
- CONT-14d: discFlux/discTable (CPU disc integral of shell + surface with the shader's BRDF and Venus DM exponent), built in
  the LUT worker after the LUTs; the point uses it (rgb) for atmospheric bodies except Earth (clouds not in the twin).
- Tests: tests/render/titanAtmo381.test.ts (5) — total 349 pass.
- L2a (SW, work/qa/titan-l2a, sheet work/qa/sheets/titan-l2a-c57fce9-vs-00e5780.jpg): sharp haze disc with a separated
  blue-violet detached-haze ring (was a soft fuzzy edge); terminator smooth; backlit ring clipped in both builds.
  OPEN FINDINGS: (1) titan-low-altitude (40 km) far darker than baseline — check multiple-scattering accuracy at τ≈9 and
  exposure before accepting; (2) photometry probe: point/disc ≈ 1.0 at 60°, ≈ 1.4 at 120°, ≈ 2.1 at 150° — GPU disc below
  the CPU twin at high phase (step budget / forward-peak sampling suspected); the α=20° rpx-12 probe sample was misplaced
  (84°). CONT-14d stays OPEN. First commit 00e5780 had a TSL wgslFn parse error (fixed same session).
- QA cost: captures 221–349 s per 6-view set, photometry 189–203 s.

## 2026-10-15 (b) — WP-E Titan corrections (remote 7bfad4d; L2b evidence work/qa/titan-l2b, sheet work/qa/sheets/titan-l2b-c57fce9-vs-7bfad4d.jpg)
- **CONT-14d re-analysis (correction of L2a interpretation).** L2a compared the `X` column (display exposure) as if it were flux. Normalised to the Lambert reference, the GPU disc (rpx 12) and the CPU disc-table point (rpx 0.45) agree: L2b 20° 0.917/0.919, 60° 0.967/0.945, 120° 2.270/2.284, 150° 27.2/26.0, 165° 466/472 → ≤ 4 % everywhere (SW). The point flux is the CPU disc integral; the rendered disc is the GPU march → CPU/GPU integrated photometry agree within 4 % at 20–165°. CONT-14d CLOSED for Titan (SW evidence). The L2a 20° sample (measured 84°, flux ×10⁸) was the first sample of a run, taken before streaming settled; probe_photometry.mjs now runs a discarded warm-up and records reqAlpha.
- **WPE-TI-01 root cause: multiple-scattering approximation.** Hillaire's MS LUT assumes isotropic scattering; for Titan's τ≈9, g≈0.73 haze it discarded forward-scattered light: surface irradiance at 550 nm = 0.04× a plane-parallel Monte Carlo solution of the same profile/phase functions (tools/qa/rt/mc.py). Fix (shared, all atmospheres): orders ≥ 2 computed in the similarity-scaled medium (σs' = σs(1−g), σe' = σe − σs g) — MS LUT built from a scaled transmittance, LUT multiplier σs', and a second view transmittance Tv2 in the scaled medium for the MS term (CPU + WGSL). Single scattering and view transmittance unchanged. Result vs MC (fitted SSA, μ0=1): surface irradiance 0.60/0.63/0.93 (R/G/B), nadir I/F 0.73/0.72/0.69 — a documented residual RT bias of the LUT approximation (test titanAtmo381 enforces 0.55–1.25 / 0.6–1.2). Convergence: 64→128 dirs, 20→60 steps, 24→96 view steps change < 5 %.
- **SSA refit (FITTED).** The old ω0 had compensated the over-bright isotropic MS (isotropic backscatter raised plane albedo). New upper [0.97, 0.955, 0.91], lower [0.98, 0.96, 0.88] → p_V 0.22, B/V 0.56, 163° G ≈ 0.8 of full phase. These exceed the DISR high-altitude curve partly to absorb the 0.72× reflectance bias: effective renderer parameters, not a retrieval; p_V/B−V agreement is a fit, not validation.
- **Backlit clipping root cause: exposure meter.** limbLuminance returned 0 when the Sun is exactly behind the body (degenerate bright-limb direction), and the v3.7 "+2 EV of disc highlight" cap made limb protection zero when backlit anyway. Fixes: any perpendicular for the degenerate case; the CPU limb estimate now uses the GPU's own step budget/segmentation (twin), so the cap (introduced for a 32-vs-16-step mismatch) is removed. titan-backlit: EV 14.61→12.96, clipped pixels 3.98 %→0.47 %; orange main-haze limb and blue upper/detached haze now separately readable.
- L2b results (SW, matched immutable base c57fce9 vs cand snapshot 2d03df4 = 7bfad4d + runner flag): 0 TSL/WGSL errors. Low-altitude mean 46.6 vs base 48.7 (was much darker in L2a). Day/Sci/terminator: thin dark-blue detached halo, no hard outline. Limb view 17 % darker than base.
- Open: TI-02 (U) low-altitude hue olive-orange (R:G ≈ 1.6 linear, B≈0) — follows from the fitted aerosol spectrum, consistent with MC; no colour-calibrated DISR surface reference checked yet. TI-03 (D?) backlit disc interior grey (~70/255): glare/bloom spill from the ring, also in base — investigate PSF energy. TI-04 (P) daylit disc still fairly uniform (no latitudinal haze asymmetry/polar hood modelled). Venus terminator exposure must be re-verified (meter cap removed).
- Cost: capture 359 s, photometry 247 s (10 samples + warm-up), CPU/MC experiments ≈ 15 min.

## 2026-10-15 (c) — Titan TI-02/03/04, QA-381-03 preflight (remote 11e21fb)
- **TI-03 (FIXED, root cause).** Diagnostic captures (work/qa/ti03: none / no-bloom / no-glare / neither): disc interior 74/255 with
  bloom, 0 without; glare irrelevant. Cause: limbLuminance sampled tangent heights ≤ 0.35 of the shell; Titan's backlit ring peaks
  at 300–550 km → meter low by 6.5× → ring ≫ bloom threshold (6× white) → bloom filled the disc. Now 20 heights (quadratic
  spacing 0.002–0.95). CPU: Titan backlit limbL 4.4e-3 → 2.87e-2; Venus/Mars/Earth backlit +8/+31/+6 %, terminators unchanged.
  Cost: 6 ms (Titan, focus shell) per refresh, refreshed every 8 frames or on > 2° motion.
- **TI-02 (assessed, no model change).** Evidence: DISR-derived ω0 (Tomasko et al. 2008 as revised by West et al., NAI 2013 report)
  above 144 km 0.84/0.91/0.95 and 30–80 km 0.93/0.97/0.99 at 450/550/650 nm; our fitted upper ω0 0.91/0.955/0.97 is 0.03–0.07
  higher (absorbs the 0.72× RT reflectance bias — documented). The model's surface sky R:G:B ≈ 1 : 0.63 : 0.09 linear agrees with
  the Monte Carlo solution (1 : 0.60 : 0.06). The olive cast on screen is mostly an RGB-rendering limitation: three monochromatic
  samples of a steeply red spectrum under-represent the 600–700 nm band that dominates a broadband red channel (DISR flux rises
  steeply toward 700+ nm). A spectrally integrated (CIE-weighted) channel model would be the correct fix; it is a shared-pipeline
  change, deferred to a Gate C spectral-rendering item (WPE-SPEC-01), not patched with a colour multiplier. Note: DISR first results
  (2005) quote surface τ(531) ≈ 4.5; the 2008/2013 revised laws used here sum to ≈ 9 — recorded as an uncertainty.
- **TI-04 (deferred with rationale).** The atmosphere is spherically symmetric (LUTs, disc twin). Default epoch Oct 2026 is ≈ 1.4 yr
  after Titan's northern autumnal equinox (2025): the hemispheric asymmetry is in reversal and no post-Cassini observation fixes its
  amplitude for this date; a north polar hood would be inference. Implementing latitude-dependent haze needs non-symmetric
  transmittance and an updated disc twin (CONT-14d parity). Recorded as WPE-TI-04 (P/U), non-critical to acceptance.
- **QA-381-03** preflight implemented (docs/v3.8.1/QA_WORKFLOW.md).

## 2026-10-15 (d) — shared-change regression (WP-E MS scaling + limb meter), work/qa/wpe-reg
Matrix (SW): 13 views, base 5df3b3c (pre-MS-fix) vs candidate 11e21fb, + photometry venus/mars/jupiter α30/120/150 × rpx 12/0.45
(18/18 samples pass the QA-381-03 preflight). Sheet: work/qa/sheets/titan-ti03-backlit.jpg.
- **Venus**: day/terminator/backlit EV identical (−1.23/−1.32/14.61), display means within 5 %. Limb-cap removal: NO terminator
  regression. GPU disc vs CPU point 0.57–0.60 / 0.59–0.61 (α30/120), 2.19/2.22 (α150): parity ≤ 3 %.
- **Earth**: terminator/limb/sunset-limb identical (≤ 0.5 %).
- **Jupiter**: solo re-capture identical to baseline (31.9 vs 32.0). The black disc in the batch run was a TEXTURE STREAMING fault
  (`texLevels: placeholder` after the Mars terrain views), not the shader → new TEX-381-01; the probe's Jupiter disc samples
  (meas/ref 0.026–0.13) are void for the same reason. Preflight now also rejects samples whose surface textures are placeholders.
- **Titan backlit**: clip 3.98 % (c57fce9) → 0.47 % (d813266) → 0.00 % (11e21fb); disc centre 171 → 75 → 0/255; EV 14.61 → 12.96 → 10.26.
- **Mars — real change, open (WPE-MA-01)**: day disc display mean R/G/B 33.9/23.2/17.3 → 28.6/16.2/9.2; Jezero ground sky
  B 33.6 → 11.3 (ochre). GPU disc vs CPU point at α30 0.158 vs 0.316 (α120 0.82/0.89, α150 8.8/10.6). A baseline probe could not
  arbitrate: the legacy build cannot report LUT readiness and its α30 disc (0.76) is consistent with a sample taken before the LUTs
  landed (T = 1, no MS) — exactly what the preflight now prevents. Analysis (CPU, work/exp/marsdisc.ts): vertical dust τ ≈ 0.5,
  surface seen through TRUE-medium two-way transmittance (≈ 0.3 at α30) while the light forward-scattered out of the view beam is
  never returned (the shell's single scattering adds sunlight only). For an extended, horizontally uniform surface the correct
  first-order treatment is the diffuse (similarity-scaled) view transmittance exp(−τ(1−ϖg)/μ) for the mean, with the true
  transmittance for the unblurred detail (adjacency effect). The MS fix exposed this: the old isotropic MS over-returned light and
  masked it. Also: the CPU disc twin omits the skylight term the GPU adds on rocky surfaces (WPE-MA-02), and the GPU/CPU α30 gap
  needs its own split (surface vs shell) — CONT-14e. Planned as the first Mars WP-E item; affects Titan's surface visibility too.

## 2026-10-15 (e) — CONT-14e diagnosed, WPE-MA-01/02 implemented (remote c257166), Titan acceptance doc
- **CONT-14e mechanism (measurement, not compositing).** One body per page session, Mars α30: rpx 12 → 0.472, rpx 20 → 0.479,
  rpx 40 → 0.467 (meas/Lambert-p ref). The 0.158 of the regression run came from a contaminated long multi-body session (not
  reproducible). Contract check at rpx 12: shell alpha forced 0 → 0.473; shell radiance forced 0 → 0.314 = shell-hidden 0.315
  → over the disc the shell adds radiance only (alpha 0 holds). QA switches ?qa-off=atmoalpha / atmoL. Rule: photometry runs use
  one body per session (tools: ma_l2-style `step` scripts).
- **WPE-MA-02.** The CPU disc twin now carries the shader's skylight (refl·E(μ0)·T_view, rocky/icy 'full', Venus/Titan deck
  'twilight', gas giants none). Mars α30 CPU 0.324 → 0.393.
- **WPE-MA-01 — independent reference first.** Plane-parallel MC (work/exp/mars: same dust profile/phase, Lambert ground 0.25,
  Sun at zenith): nadir I/F MC 0.258/0.209/0.155; model 0.174/0.155/0.138 (0.68/0.74/0.89×). With the diffuse (similarity-scaled)
  view transmittance 0.227/0.203/0.177 (0.88/0.97/1.14×). Implemented (GPU planetMaterial + CPU twin, Tsim LUT from the worker):
  direct part T·col (full detail) + (Tsim − T)·col·(adjacency ratio: albedo mip at ≈ 3 aerosol scale heights / local albedo).
  Venus keeps its δ-M deck (DM 0.51) — the same approximation, not applied twice.
- **L2 (SW, one body per session, preflight all valid; work/qa/ma-l2, sheet mars-ma01-f102d0a-vs-c257166.jpg):**
  Mars GPU disc/ref α30/120/150 = 0.623/1.125/10.64 vs CPU twin 0.511/1.071/11.12 (+22 %/+5 %/−4 %). mars-day mean
  28.6/16.2/9.2 → 34.0/18.4/10.4, surface detail kept; Jezero ground unchanged (camera inside the layer: T ≈ Tsim).
  Titan disc/ref α30/120 0.940/2.297 (α120 2.270 at acceptance, +1 %); titan-day and low-altitude identical → Titan surface
  visibility unchanged (τ ≈ 9: Tsim(μ=1) ≈ 0.06 but the haze-deck surface term stays < 1 %).
- **Residual CONT-14e (open, narrowed):** GPU surface term ≈ 1.2–1.4× the twin at α30 only. Leading hypothesis: the twin uses
  the map-mean albedo, the GPU the visible hemisphere (hemisphere means of the Mars map range 0.146–0.228, i.e. ±22 % by
  sub-observer longitude). Test: log sub-observer lon/lat in the probe and weight the twin. Not yet verified.
- **Mars disc absolute:** model 0.62 vs observed ≈ 0.7–0.8 of the Lambert-p reference at α30 (Mars phase coefficient
  ≈ 0.016 mag/deg) — the disc calibration (discReflectance of catalogue p) assumes an airless body; the shell's share must be
  taken out of the surface calibration (as Titan's fit did). Mars WP-E item MA-03.
- **Earth regression:** earth-day 23.0/24.8/29.8 → 23.0/24.9/29.9, earth-terminator identical, EV unchanged.
- **Mars ground sky (MA-04, open):** Jezero sky 76/51/11 display — too saturated vs rover-imaged butterscotch; dust ω(B) = 0.77
  in the preset and the RGB-sampling issue (WPE-SPEC-01) both contribute. To be addressed with literature dust optics
  (Wolff et al. 2009 CRISM/MARCI SSA, g) in Mars WP-E.
- Process lesson: a TSL build error (TSL global undefined at runtime; tsc accepted it) made the material fall back silently;
  the probe's preflight now invalidates samples when shader/page errors occur in the session.
