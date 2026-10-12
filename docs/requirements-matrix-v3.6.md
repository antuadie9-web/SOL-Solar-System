# SOL v3.6 — requirements matrix

Sources: user request of 2026-10-09 ("SOL v3.6 — Advanced Planetary Visuals, Atmospheres, High-Detail Surfaces and
Rendering Integration") and Part II of `SOL_v3.6_v3.7_Master_Specification.md` (§4–7).
Status: **Verified** (automated test / measured comparison) · **Verified-software** (rendered and inspected on SwiftShader
WebGPU only) · **Pending-hardware** · **Partial** · **Open** · **Blocked**.

| # | Requirement | Status | Code | Tests | Visual evidence | Remaining / next |
|---|---|---|---|---|---|---|
| 1 | Verify the v3.5 baseline | Verified | worktree `base35` (master) | 252/252 on v3.5 | `docs/qa/v3.6/screens/v3.5/*` | — |
| 2 | Investigate exposure / atmospheric-edge / sky / material defects; fair comparisons | Verified-software | `tools/qa/scenarios/golden36.mjs` (identical harness on both trees, date search for site Sun elevation) | — | VQA36-01…09 in `docs/v3.6-changes-report.md` §1 | — |
| 3 | Planet-specific atmospheres (LUT transmittance, multiple scattering, skylight, ozone layer, aerosols) | Verified (model) / Verified-software (look) | `src/render/atmoModel.ts`, `atmosphere.ts`, `planetMaterial.ts` | `tests/render/atmosphere.test.ts` (7) | earth-limb, mars-*, titan | worker LUT builds; per-channel aerial-perspective blend |
| 3a | Mars dust from trustworthy observations; daylight/sunset colour | Verified (parameters + sky-colour check) | `src/data/catalog.ts` Mars `phys` | atmosphere tests (blue aureole, red sky) | mars, mars-limb, mars-night, mars-crescent, mars-polar, mars sites | dust seasons/storms, clouds (ATM-004) |
| 3b | Titan thick orange haze | Verified-software | catalog Titan | τ > 3 test | titan (v3.5 blue globe → v3.6 haze globe) | layered haze detail |
| 3c | Backlit-limb exposure | Verified-software | `engine.ts` limb metering (`limbLuminance`) | — | mars-night clip 2.56 % → 0 % | hardware check |
| 4 | Substantially better close-range Sun | Partial (Verified-software) | `src/render/sun.ts` granules2 | sun tests unchanged pass | sun-limb, sun-close, sun-grazing | owner look sign-off; dated active regions (SUN-005) |
| 5 | Improved body materials | Partial | terrain material variant, skylight, horizon shadows | — | Moon/Mars sites | albedo maps coarser than relief (TER-005) |
| 6 | Reusable high-resolution tiled terrain, Moon & Mars first | Verified (data, sampling, residency) / Verified-software (look) | `tools/ingest/terrain_fetch.py`, `terrain_tiles.py`, `src/terrain/tiles.ts`, `terrain.ts` | `tests/astro/terrain.test.ts` (12) | moon-hadley, moon-tycho, mars-gale, mars-candor, mars-olympus, moon-terrain, mars-terrain | global high-res pyramids; worker builds; surface camera mode |
| 6a | Regional tiles registered to science data | Verified | `tiles.json` regions | vs-16 ppd block-mean test (|mean| < 15 m) | — | — |
| 6b | Adaptive LOD, cube-face boundaries, residency/eviction, geometry update after tile load | Verified (node) | `terrain.ts` | TilePyramid streaming/budget test; bench (node) | site captures | real-GPU timing |
| 6c | Precision-safe placement | Verified | `TerrainBody.place` via `contracts/frames.ts` | `tests/contracts/terrainPrecision.test.ts` (0.19 mm vs 265 mm) | — | — |
| 6d | Terrain cast shadows | Verified-software | horizon maps (`horizons`, `horizonShadow`) | — | moon-hadley, moon-tycho | soft contact shadows below DEM scale |
| 7 | Integrate frame hierarchy, LOD and resource management into render paths | Partial → Verified for terrain & sphere LOD | terrain placement, `sphereSegmentsForTier`, tile/patch byte budgets | contracts tests | — | adoption for orbits/stars/rings remains partial |
| 8 | Preserve scale, distances, camera, v3.5 lighting | Verified | unchanged ephemeris/frames; v3.5 modes kept | full suite 267/267 | matched sets | — |
| 9 | No device-specific quality ceilings | Verified (design) | quality presets only change error targets/sample counts | — | — | — |
| 10 | Modular WebGPU-only, no WebGL fallback | Verified | `engine.ts` init assertion unchanged | — | captures report backend | — |
| 11 | Matched visual comparisons | Verified-software | golden36 | `tools/qa/metrics.py`, `detail.py` | `docs/qa/v3.6/` | — |
| 12 | Honest unfinished-work report | Done | `docs/v3.6-changes-report.md` §8, `docs/issues.md` v3.6 table, `SOL_V3.6_COMPLETE_PHASE_REPORT.md` | — | — | — |
| 13 | Clean-extract ZIP verification | Verified (see phase report §Release) | — | npm ci, tsc, tests, build on extract | — | — |
| — | Hardware look, frame time, VRAM, long sessions | Pending-hardware | — | — | — | run `docs/qa/benchmark-protocol.md` on a GPU |
