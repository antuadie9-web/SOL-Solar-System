# SOL v3.3 requirement → code → validation matrix

Statuses: **Verified existing** · **Implemented (verified by test)** · **Implemented, visually unapproved** · **Partial** · **Missing/Queued** · **Not tested (needs hardware)** · **Scientific unknown**.
"Software capture" = Debian Chromium 154 + SwiftShader WebGPU (functional evidence only; not final look or performance).

| Spec § | Requirement | Status | Code | Validation |
|---|---|---|---|---|
| 0.3 | Multi-file TS/Vite project, native WebGPU only, WebGL fallback removed and backend asserted | Verified existing | `src/core/gpu.ts`, `Engine.init` | smoke `diag.backend = WebGPU (native)`; software adapter refused without `?qa-software-gpu=1` |
| 0.6.1 | Audit, baseline build/tests | Implemented | — | `npm ci`, typecheck 0, 185 pass + 1 todo (v3.2 baseline), build 0; baseline captures `docs/qa/v3.3/before/` |
| 5 | Precision contract (f64 CPU, hi/lo GPU) | Implemented (verified by test) | `src/contracts/precision.ts`, `src/render/lines.ts` | `tests/render/precision.test.ts` |
| 5 | Unit table with exact IAU constants | Implemented (verified by test) | `LENGTH_UNITS_KM` | precision test |
| 5 | AstroObject/visual-profile schema with per-property truth labels | Partial | `src/render/identity.ts` (visual), `Body.ephemTier`, inspector Evidence tab | `tests/render/identity.test.ts`; full AstroObject schema for stars/galaxies queued (Phase 7/8) |
| 5 | Asset/licence contract, CI check | Implemented (verified by test) | `docs/assets/*`, `tools/validate/assets.mjs` | `tests/assets/manifest.test.ts`, `npm run assets` |
| 5 | Catalogue streaming contract (octree/HEALPix shards) | Missing/Queued | — | Phase 8 |
| 7/9 | Sun: limb darkening, granulation, spots, faculae, differential rotation, no shimmer | Implemented, visually unapproved | `src/render/sun.ts` | software captures 0.05/0.2/1 AU, limb; `tests/render/sun.test.ts` (metering, glare policy) |
| 7/9 | Sun: three art-direction variants, owner chooses | Implemented, visually unapproved | `SUN_LOOKS`, Settings → The Sun | captures natural/cinematic/scientific |
| 7/9 | Sun: corona/eclipse, point-source continuity | Verified existing | `corona.ts`, engine star branch | v3.2 tests + eclipse capture |
| 7/9 | Sun: dated HMI-informed layer, prominences/flares toggle | Missing/Queued | — | SUN-005/006 |
| 8 | Distinct shape/surface families, stable id seeds, tiers A–D | Implemented (verified by test) | `identity.ts`, `geometry.ts familyGeometry`, `planetMaterial.ts familySurface` | `tests/render/identity.test.ts`, `tests/render/shapes.test.ts`, per-body captures |
| 8 | GLB import keeps hierarchy/normals/UVs | Implemented | `Engine.loadModel` | Evidence tab shows mesh/UV/normal/texture content |
| 8 | Mission shapes for Ryugu/Itokawa etc. | Missing/Queued | — | AST-004 (rights unverified) |
| 8 | Replace non-commercial imagery | Partial | manifest flags 31 files | AST-003 |
| 10 | Guide jitter root-cause fix | Implemented (verified by test) | `lines.ts`, `Engine.updateOrbits` | precision test; hardware video Not tested |
| 10 | Clean default + 5 modes + legend | Implemented (verified by test) | `guides.ts`, Guides panel, dock | `tests/render/guides.test.ts`, captures |
| 10 | Nodes/apsides, spin axis + equator, trajectory vs conic | Implemented | `orbitLandmarks`, `updateAxis`, `updateTrajectory` | scientific-mode capture |
| 10 | Depth occlusion of guides behind bodies | Partial | guides fade near the body; no depth write test | queued |
| 10/13 | UI redesign: HUD, breadcrumb, search, inspector, timeline, overlays, settings, journeys, onboarding, accessibility | Implemented, visually unapproved | `src/ui/*` | `tools/qa/scenarios/ui.mjs` captures + checks; `tests/ui/ui.test.ts` |
| 10 | Drag-resize/dock panels, compare mode, i18n tables | Missing/Queued | — | UX-002 |
| 10 | Camera modes: orbit, free, travel, tour, co-rotate; interruptible | Verified existing + extended | `camera.ts`, `ui.ts` | ui scenario flight-cancel check |
| 10 | Surface explorer / Galactic navigator modes | Missing/Queued | — | CAM-005 |
| 12 | Ephemerides vs Horizons, time scales | Verified existing | `src/astro/*` | `tests/astro/*` (152+ checks) |
| 12 | Neptune VSOP87B 2075 beyond 2″ | Scientific limitation (documented) | — | todo test SCI-003 |
| 15 | Visual regression captures before/after | Implemented (software) | `tools/qa/scenarios/golden.mjs`, `ui.mjs` | `docs/qa/v3.3/` |
| 15/16 | Real-GPU p95/p99, memory, long-session | Not tested (needs hardware) | diagnostics overlay collects | `docs/qa/benchmark-protocol.md` |
| 11 | Milky Way morphology, Gaia streaming, DSOs, exoplanets, Sgr A* | Missing/Queued | — | Phases 8–10 (`docs/coverage.md`) |
| 14 | Local Group → cosmology (U1–U6) | Missing/Queued | breadcrumb placeholders only | — |
