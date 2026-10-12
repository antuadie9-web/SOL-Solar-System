# Requirements traceability (master spec → code → test/evidence)

Legend: ✅ implemented + verified here · 🟡 partial / implemented but needs real-GPU verification · ⏳ planned (phase) · ⛔ blocked here.

| Spec § | Requirement | Status | Code | Test / evidence |
|---|---|---|---|---|
| 0 / 13.A | Multi-file Vite project, no single HTML, normal hosted assets | ✅ | `vite.config.ts`, `public/assets/**` | `npm run build` → `dist/` (index.html + hashed JS/CSS + asset folders) |
| 13.A | `npm ci`, typecheck, tests, build | ✅ | `package.json` scripts | `npm run check` (typecheck + 170 tests + build) |
| 10 / 13.A | Native WebGPU only, no WebGL fallback, backend asserted | ✅ | `src/core/gpu.ts`, `Engine.init` | smoke `diag.backend = "WebGPU (native)"`; R-010 |
| 13.A | Controlled error without hardware WebGPU / software adapter | ✅ | `probeNativeWebGPU` | refuses `isFallbackAdapter` unless `?qa-software-gpu=1` |
| 0 disc.1 | Machine-readable asset/source/data inventories | ✅ | `tools/validate/inventory.py` | `docs/inventory/*.json` |
| 13.C | Visual regression baseline + compare tool | 🟡 software baseline | `tools/qa/compare.py`, `docs/qa/golden-software/` | MAD/pixel-fraction thresholds |
| 0 disc.2 | Baseline screenshots/perf or "not run" | 🟡 | `tools/qa/smoke.mjs`, `scenarios/golden.mjs` | software-adapter captures `qa-out/` (functional only); real-GPU perf ⛔ |
| 9.2 / 9.3 | JPL Horizons fixtures with pre-declared tolerances | ✅ | `tests/fixtures/horizons/spec.json`, `vectors.json` | `tests/astro/ephemeris.test.ts` (152 checks) |
| 9.2 | UTC/TAI/TT/TDB/UT1 distinctions, leap seconds, validity | ✅ | `src/astro/time.ts` | `tests/astro/time.test.ts` |
| 9.3 | Uranus tilt, galactic round-trip, frame tests | ✅ | `src/astro/frames.ts` | `tests/astro/geometry.test.ts` |
| 9.3 | Earth–Moon barycentre, Moon dark side, lunar eclipse, negative parallax, no-RV stars | 🟡 | EMB handled in planets tier | eclipse/parallax tests ⏳ Phase 2b/8 |
| 9.2 | Explicit ephemeris validity windows + labels | ✅ | `src/astro/sampled.ts`, `Body.ephemTier` | inspector "Position source" |
| 3.1 | Sun visible at every distance, flux-conserving disc↔point | ✅ | `engine.render` star branch | 30 AU golden view |
| 3.1 | Sun exposure / limb darkening readable | 🟡 | exposure subject weight | golden 0.05 AU (software); hardware look ⛔ |
| 3.1 | Corona, chromosphere, eclipse corona | ✅ (structure simulated, labelled) | `src/render/corona.ts`, `src/astro/solar.ts` | `tests/astro/solar.test.ts`; eclipse golden view |
| 6 | Interruptible travel, no stuck camera, NaN/inside-body guards | ✅ | `src/render/camera.ts`, `ui.ts` input | code review + smoke (interactive gesture test ⏳ e2e) |
| 6 | Full mode state machine, bookmarks, undo, tours | ⏳ P6/P11 | — | — |
| 7 | Adaptive orbit tessellation, exact body phase, open hyperbolic arcs | ✅ | `conicPolyline`, `Engine.ensureOrbit` | geometry tests (on-curve, tolerance, hyperbola) |
| 7 | Orbit clutter control near worlds | ✅ | context fade, comets → level 2 | golden earth view |
| 7 | Sampled trajectory, apsides/nodes markers | ✅ | `Engine.updateTrajectory`, `orbitLandmarks`, `ui.updateOrbitMarks` | settings toggles; legend ⏳ |
| 12 | Texture residency budget, LRU, lazy loading | ✅ | `src/core/textures.ts` | diagnostics overlay `textures.*` |
| 12 | Bounded concurrent fetch, retry, abort | ✅ | `src/core/assets.ts` | — |
| 12 | KTX2/Basis compression | ⏳ P3 | — | — |
| 12 | p95/p99 frame time, GPU timings on RTX 3050 | ⛔ | diagnostics collects percentiles | needs hardware |
| 8.1 | Diagnostics overlay | ✅ | `ui.paintDiag` | Settings → Graphics |
| 8.2 | Reduced motion | ✅ | `Settings.reducedMotion`, `CameraRig.reducedMotion` | OS preference respected |
| 8 | Complete UI redesign, search scopes, inspector badges, compare, i18n | ⏳ P6 | — | — |
| 9.1 | Truth labels (observed/derived/simulated/artistic/unknown) | 🟡 | ephemeris tier + placeholder-pole labels | full badge system ⏳ P6 |
| 11 | Asset provenance manifest | 🟡 | `provenance/featured.sbdb.json`, `ephem/manifest.json` (+sha256) | texture/model licence manifest ⏳ P3 |
| 4 | DEM terrain (Moon, Mars) with LOD + ground clamp | 🟡 first tier | `src/terrain/*`, `tools/ingest/dem.mjs` | `tests/astro/terrain.test.ts`; terrain golden views |
| 3 | Unobserved-region masks + reconstruction labels | ✅ | `planetMaterial.ts` noData | Titania golden view |
| 3.2–3.6 | Atmosphere LUTs, volumetric rings, small-body families | ⏳ P3–P5 | — | — |
| 5, 8 | 3D stars with true parallax (GCNS 100 pc + Hipparcos) | 🟡 S1 | `src/galaxy/stars3d.ts`, `tools/ingest/gaia.mjs` | `tests/astro/stars.test.ts` |
| 5, 7, 9, 10 | Gaia bulk tiles, 3D Milky Way model, DSOs, exoplanets | ⏳ P7–P10 | `EQ2GAL` verified | — |
| 13.E | Unnecessary-complexity review | ✅ | no new runtime dependencies added (only `playwright-core` dev-dependency for QA) | — |
