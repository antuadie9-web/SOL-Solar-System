# SOL_V36_V37_MASTER_PROJECT_HANDOFF

Date 2026-10-10. Purpose: let a reviewer (human or AI) understand the whole SOL project, what v3.6 and v3.7 changed, and
what remains — **without the source ZIP**. Companion documents: `SOL_V3.6_COMPLETE_PHASE_REPORT.md`,
`SOL_V3.7_COMPLETE_DEVELOPMENT_REPORT.md`, `SOL_V3.7_RING_SYSTEM_RESEARCH_AND_IMPLEMENTATION.md`,
`SOL_V3.7_PLANETARY_ATMOSPHERES_AND_CLOUDS.md`, `requirements-matrix-v3.7.md`, `SOL_V37_IMAGE_INDEX.md`.

## 1. Vision, scope, benchmarks
SOL is a true-scale, scientifically grounded 3-D astronomical exploration application for desktop Chrome: from the Sun and
Solar System through nearby stars and the Milky Way to external galaxies and the observable universe. Primary benchmark:
SpaceEngine; UI benchmark: Star Citizen ARK Starmap; additional reference: universesimulator.org (both web references need
WebGL and could not be inspected in this WebGPU-only environment — recorded, not guessed). Constraints: modular TypeScript,
Three.js r186 `WebGPURenderer` + TSL + custom WGSL, Vite, **native WebGPU only (no WebGL/WebGL2 fallback)**, no single-file
build, no device-specific quality ceilings, true physical scale, science honesty (observed / derived / reconstructed /
representative / enhanced content labelled).

## 2. Architecture (current, v3.7 branch)
```
src/
  main.ts                 boot (staged required/optional assets), window.__sol QA hook, __SOL_VERSION__
  core/                   settings (schema 8, additive keys), textures (lazy, budget, LRU), assets
  astro/                  time scales, ephemerides (JPL-derived sampled tiers, VSOP-class planets, Galilean theory,
                          two-body/osculating), rotation (IAU), system graph (Body, sbdb small bodies)
  contracts/              frames (float64 anchors), LOD tiers + chord error, precision, residency, evidence, catalog
  data/                   catalog.ts (bodies, maps, atmosphere presets), rings.ts (v3.7), atmospheres.ts (v3.7), mapTruth
  render/
    engine.ts             scene, per-body views (getView/updateView), exposure/presentation, ring tiers, terrain, plumes
    presentation.ts       Scientific / Exploration / Cinematic modes (v3.5)
    planetMaterial.ts     surface shading (lunar-Lambert, Minnaert, ocean, clouds, night, shadows, skylight, v3.7 view T)
    atmoModel.ts          CPU atmosphere physics + LUT builders (v3.6)
    atmosphere.ts         GPU LUT march; viewTransmittance (v3.7)
    ringSystem.ts         v3.7 τ-based ring renderer (all systems)          ringParticles.ts  Saturn near field (v3.4→3.7)
    plumes.ts             v3.7 Io/Enceladus plumes                           sun.ts, corona.ts  Sun (v3.6 granulation)
    sky.ts, points.ts, lines.ts, guides.ts, comets.ts, smallbodies.ts, identity.ts, shaderlib.ts, geometry.ts, camera.ts
  terrain/                tiles.ts (TilePyramid), terrain.ts (SSE cube-sphere patches, horizon shadows) (v3.6)
  galaxy/stars3d.ts       3-D nearby-star layer
  navigation/cameraState.ts  camera mode state machine
  ui/                     ui.ts (topbar, search palette, inspector, settings, journeys, mode badge), styles.css, tours
tools/ingest/             terrain_fetch.py, terrain_tiles.py (v3.6), rings_profiles.py (v3.7), sbdb.mjs, others
tools/qa/                 smoke.mjs (Playwright + SwiftShader), scenarios golden35/36/37, views37, ui37, metrics.py, detail.py
tests/                    node:test suites (astro, contracts, render, ui, assets)
public/assets/            tex (154 MB), terrain (105 MB tile pyramids), data (40 MB), models (15 MB), catalogs (13 MB), rings (143 kB)
```
Frame per body: heliocentric ecliptic J2000 float64 on the CPU → camera-relative float32 on the GPU; terrain patches and
ring near field use local float64 anchors (0.19 mm placement error measured at 2 m altitude).

## 3. Scientific systems
Ephemerides (JPL-derived sampled tiers + residual tests), IAU rotation models, true radii/oblateness, photometric Sun with
limb darkening, physically based exposure with three presentation modes, atmosphere LUTs from published profiles, ring
optical depth from Voyager PPS occultation data and NSSDCA/peer-reviewed tables, DEM tile pyramids from LOLA (118 m) and
HRSC–MOLA (200 m), small bodies from JPL SBDB at full precision. Every derived/inferred/representative value is labelled in
code and in the reports.

## 4. Feature status
**Completed (verified at least in software):** WebGPU-only renderer; true-scale Solar System; ephemeris tiers; viewing modes
and exposure; night-side inspection light; star/Milky Way continuity (2-D panorama); LUT atmospheres for Earth, Mars,
Venus, Titan, giants, Pluto, Triton; per-channel atmospheric transmittance; Mercury/exosphere bodies correctly shell-less;
plumes on Io/Enceladus; τ-based rings for Saturn, Jupiter, Uranus, Neptune, Chariklo, Haumea, Quaoar with tiers R0–R4,
labelled enhancement, region labels, inspector ring tables and ring-selector flights; Saturn near field at measured τ;
terrain tile pyramids with streaming, SSE LOD, horizon shadows; per-image QA metadata.
**Partial:** gas/ice-giant atmospheres (shell over observed maps, no 3-D clouds), Moon/Mars terrain (six regions at
118–231 m; no imagery at that scale), seamless navigation (continuous LOD and placement, no walking/collision mode),
Sun (simulated granulation), UI (no journey planner upgrade), celestial-body maps (3 non-commercial).
**Pending / not started:** volumetric clouds; weather; R5 volumetric rings; self-gravity wakes/spokes; eccentric rings;
Mars dust storms/seasons; observed solar active regions; GPU histogram metering; worker offload; real-GPU validation; 3-D
Milky Way (P9) and everything after it (P10–P12, U1–U6); interstellar travel demonstration (prerequisite: P7/P8 frames and
catalogues — not attempted in v3.7).

## 5. Known bugs / risks
See `docs/issues.md` (open items: GPU-002 device-loss recovery, RES-01, GAS-001 partly, SKY-002 zodiacal light, PERF-003…006
hardware, ATM-004 Mars dust states, TER-005 albedo resolution, RING-003 Uranus eccentricities, RING-004 R5 volumetrics).
QA-environment risks: compute passes crash SwiftShader (QA runs with `qa-off=small,smallcompute`); captures take 30–110 s
per view in software.

## 6. Performance constraints and measurements
Only software WebGPU (Chromium 154 + SwiftShader, 2 CPU cores) was available. Measured: CPU LUT build 300–450 ms per
atmosphere body; terrain patch build ≈ 6 ms; Hadley terrain convergence ≈ 230 frames at a 5 ms/frame budget; ring shader
cost = 4 texture fetches + ≤ 16 analytic components per fragment (by construction). **No real-GPU frame time, VRAM or
long-session data exist.** Do not read software timings as production performance.

## 7. Asset / provenance inventory
Validator `tools/validate/assets.mjs` (every file under `public/` matched to a provenance rule with source, licence and
commercial status): v3.6.0 1508 files, 0 unmatched, 0 duplicates, 3 non-commercial (Ariel/Titania/Oberon maps, flagged).
v3.7 adds `public/assets/rings/` (Voyager PPS profile — NASA/PDS public domain) and Chariklo orbital elements (JPL SBDB).
Credits: `CREDITS.md`; rules: `docs/assets/provenance-rules.json`.

## 8. Test evidence
v3.5 252 → v3.6 267 → v3.7 see the development report §Verification (adds rings 10, atmospheres37 9).
All tests are CPU/node tests (science, contracts, LOD, precision, photometry); rendering is evidenced by images only.

## 9. Weighted completion estimate (stable methodology)
Method unchanged since the strict v3.4 audit (≈ 20.2 % overall): per-phase weights (Solar System phases P0–P6 ≈ 50 % of
the vision, Galactic P7–P12 ≈ 30 %, observable universe U1–U6 ≈ 20 %); an item counts only with code **and** evidence;
documentation and tests alone earn nothing; software-only visuals count at most as "partial" for look-dependent items.
| Scope | v3.4 audit | v3.5 | v3.6 | v3.7 |
|---|---|---|---|---|
| Solar System (P0–P6) | 39.9 % | ≈ 42 % | ≈ 45 % | ≈ 49 % (rings for every ringed body, atmosphere tiers for all planets, ATM-005, plumes) |
| Galactic (P7–P12) | ≈ 5 % | ≈ 5 % | ≈ 5 % | ≈ 5 % (unchanged) |
| Observable universe (U1–U6) | 0 % | 0 % | 0 % | 0 % |
| **Entire vision** | **≈ 20.2 %** | ≈ 21 % | ≈ 22.5 % | **≈ 26 %** (0.5·49 + 0.3·5 + 0.2·0 ≈ 26) |
These are engineering judgements, not objective measurements.

## 10. Roadmap and recommended next milestones
1. **Hardware validation sprint** (blocking): run `docs/qa/benchmark-protocol.md` on a real GPU; re-shoot the golden37 set;
   fix whatever SwiftShader hid.
2. v3.8 candidates: worker offload (LUTs, terrain); volumetric cloud prototype for Earth with cloud shadows; Mars dust
   seasons/clouds; R5 ring-slab ray-march prototype vs particle field; Uranus/Neptune storms from dated observations;
   HiRISE/LROC NAC regional DEM+imagery at Jezero/Hadley; surface walking/collision mode.
3. Interstellar groundwork (P7/P8): parsec-scale frame hierarchy, Gaia DR3 tiled streaming, a true-scale nearby-star
   journey demo.
4. Then P9 (3-D Milky Way structure, dust, clusters, nebulae), P10 exoplanet systems, P11–P12, U1–U6 as registered.
Nothing in v3.7 implements P9–P12 or U1–U6; the 2-D Milky Way panorama is not the 3-D Galaxy.
