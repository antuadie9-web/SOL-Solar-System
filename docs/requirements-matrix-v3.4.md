# SOL v3.4 requirement → code → validation matrix

Statuses: **Verified** (automated test / measured reference) · **Verified (software)** (rendered and inspected on the
SwiftShader software WebGPU adapter only) · **Implemented, visually unapproved** · **Partial** · **Queued** ·
**Not tested — needs hardware** · **Physically unknown**. Section letters refer to the v3.4 master handoff.

## B / C — baseline re-verification
| Item | Result |
|---|---|
| Upload | `sol-solar-system-v3.3.zip` 246,988,963 B, package 3.3.0, **no `.git` inside** → commit/tag `ce294ed` could not be verified; immutable import commit tagged `v3.3.0-upload` |
| Rebuild | `npm ci` ok · `tsc --noEmit` 0 errors · `npm test` 219 = 218 pass + 1 todo (Neptune 2.441″ @ JD 2478938.5) · `vite build` ok · assets 107 / 0 unmatched / 31 non-commercial — matches the handoff |
| Shape models | 12 GLBs present (67P, Arrokoth, Bennu, Deimos, Eros, Geographos, Golevka, Kleopatra, Mithra, Phobos, Toutatis, Vesta) |
| Stars | 335,865 rows (GCNS 331,291 + Hipparcos fill 4,574), 157 named |
| Software capture | Debian Chromium 154 + SwiftShader; requires `?qa-off=small,smallcompute` (compute pass kills SwiftShader, R-013) |

## D1 — seven contracts
| # | Contract | Status | Code | Validation |
|---|---|---|---|---|
| 1 | Precision & hierarchical frames, units, rebasing | Verified | `src/contracts/frames.ts`, `precision.ts` | m→Mpc round trip; Moon 1 m locality; Sun→Earth→Moon→Proxima→Sgr A*→M31→back finite; ICRS→Gal matrix vs NGP/GC < 1″ |
| 2 | AstroObject schema, per-property evidence, crossmatch, absent distances | Verified | `src/contracts/astroObject.ts` | placement (negative / low-S/N parallax stays 2D), binaries never merged, ambiguous on parallax conflict, every SOL body → unique canonical id |
| 3 | Catalogue shards, sectors, stream, checksum, cancel, missing | Verified (+ live in app) | `src/contracts/catalog.ts`, `tools/ingest/shard-stars.mjs`, `main.ts` | stream tests; 85 real shards hash-verified in `tests/astro/stars.test.ts` |
| 4 | Detail tiers D0–D5, screen-size selection, hysteresis | Verified (selection) / Partial (engine still uses its own per-subsystem LOD; the contract reports the tier in Diagnostics) | `src/contracts/lod.ts`, `Engine.targetDetail` | LOD test |
| 5 | Camera modes, interruption, history, safe state | Verified (machine) / Partial (surface, galactic, cinematic modes have no dedicated controllers yet) | `src/navigation/cameraState.ts`, `camera.ts` | state-machine test; UI scenario flight-cancel |
| 6 | UI state, settings schema & migration | Partial (verified existing + 3 new keys; ui.ts still 93 KB monolith) | `core/settings.ts`, `ui/store.ts` | `tests/ui/ui.test.ts` |
| 7 | Quality evidence | Verified | `src/contracts/evidence.ts`, golden harness, this matrix | evidence test |

## D2 — Sun
| Requirement | Status | Evidence |
|---|---|---|
| Not a white/beige ball at close range | Implemented, visually unapproved | `docs/qa/v3.4/compare/sun-*.jpg` — warm limb-darkened disc, spots/plage visible at 0.05 AU (was flat beige) |
| Granulation without tiling/shimmer | Partial | per-granule brightness and rounder cells; limb close-up still reads somewhat regular; motion video not recorded (no hardware) |
| Prominences / limb features | Partial (SUN-006) | simulated, physically scaled in Scientific look; flares not implemented |
| Dated HMI-informed layer | Queued (SUN-005) | needs licensed multi-epoch reprojection |
| Far point-source continuity, eclipse | Verified (software) | sun-1/5/30 AU and eclipse captures |

## D3 — major visuals
| Requirement | Status | Evidence |
|---|---|---|
| Correct georeferencing of moon maps | Verified | Vesta (Marcia group at 340° E IAU-2014) and Charon (encounter hemisphere at 0°) misregistrations of v3.3 fixed; Mimas checked against Herschel (111.76° W); provenance JSON per body |
| Higher-resolution observed maps | Verified | 8192×4096 hi tiers from 100–1435 m/px USGS sources (was ≤ 8K third-party) |
| Unobserved regions labelled, not invented | Verified | Pluto 23 %, Charon 26 %, Triton 33 % now noData → labelled reconstruction |
| Gas giants, Titan, Earth ocean/cloud upgrades | Partial | colour fidelity improved by Neutral tone mapping only; no new atmosphere/cloud models in v3.4 |
| Mission shapes for Ryugu/Itokawa/Ida/Lutetia | Queued (AST-004) | rights still unverified |

## D4 — terrain
| Requirement | Status |
|---|---|
| Moon/Mars DEM quadtree (16 px/deg LOLA/MOLA) | Verified existing (v3.3) — no new terrain resolution in v3.4 |
| Regional high-res tiles, Earth/Mercury, contact shadows, collision-aware surface mode | Queued (Phase 4) |

## D5 — atmospheres, rings, comets
| Requirement | Status |
|---|---|
| Saturn ring near-field slice | Implemented, visually unapproved — `ringParticles.ts`, golden `ring-flythrough*` |
| Ring mid-range self-shadowing / wakes | Queued |
| Multi-scattering LUT atmospheres, planet-specific optics | Queued (v3.3 single scattering remains) |
| Comet activity upgrades | Queued |

## D6/D7 — UI and overlays
| Requirement | Status |
|---|---|
| v3.3 interface, guide modes, precision-safe guides | Verified existing (UI scenario run on v3.4 build) |
| New settings: tone mapping, prominences, ring particles; diagnostics: camera state, LOD tier, catalogue shards, ring field | Implemented |
| Dock/resize panels, compare mode, i18n tables, AT screen-reader audit | Queued (UX-002) |
| Motion/slow-pan video of guides on hardware | Not tested — needs hardware |

## D8 — engineering
| Item | Status |
|---|---|
| Tests | 235 / 235 pass (no todo) |
| Assets | 192 files with provenance; 3 non-commercial (Ariel, Titania, Oberon) |
| Real-GPU FPS / VRAM / look | Not tested — needs hardware (`docs/qa/benchmark-protocol.md`) |

## E — roadmap phase status after v3.4
| Phase | Status |
|---|---|
| 0 Verified foundation | Done for v3.4 (re-audit above) |
| 1 Camera, Sun, HDR, safety | Partial — Sun improved, unapproved; device-loss recovery (re-init) still open |
| 2 Time, scale, guides | Mostly done — SCI-003 fixed; SCI-004 (Mimas 166 km), SCI-005 (rounded background elements) open |
| 3 Planet/moon atlas | Partial — rights + georeference leap; Uranian moons NC; mission shapes pending |
| 4 Terrain | Partial (v3.3 level) |
| 5 Atmospheres/rings/comets | Partial — ring near-field slice only |
| 6 Final Solar System UX | Partial |
| 7 Multi-scale stellar navigation | Partial — contracts + 3D local stars; no resolved stellar surfaces |
| 8 Observed catalogue streaming | Partial — streaming contract live for 336 k stars; Gaia DR3 bulk not ingested |
| 9–12 Milky Way model, deep sky, exoplanets, expedition, production QA | Queued (schema/taxonomy present in `AstroClass`) |
| U1–U6 Extragalactic | Queued (distance-kind contract only) |
