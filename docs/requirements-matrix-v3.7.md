# SOL v3.7 — requirements-to-evidence matrix (spec §44)

Status vocabulary: **Done-verified** (code + automated test + evidence) · **Done-software** (code + software-WebGPU images,
no hardware) · **Partial** · **Open** · **Blocked** · **Not started**. "Evidence" paths refer to the image archives
(`SOL_V37_*.zip`, file names as listed in `SOL_V37_IMAGE_INDEX.md`); every image has a sidecar `.json` metadata record.
Tests refer to `tests/**` (suite totals in `SOL_V3.7_COMPLETE_DEVELOPMENT_REPORT.md` §Verification).

## A. Long-term phases (status after v3.7)
| Phase | Requirement | Status | Code | Tests | Visual evidence | Remaining | Blocker | Next action |
|---|---|---|---|---|---|---|---|---|
| P0 | Verified foundation (modular TS, WebGPU-only, build, tests, provenance) | Done-verified | `src/**`, `tools/validate/assets.mjs` | full suite | all sets | — | — | keep gates green |
| P1 | Camera, Sun, lighting, rendering safety | Partial | `render/presentation.ts`, `sun.ts`, `camera.ts` | presentation, camera, sun | sun-*, golden | real-GPU look; owner Sun sign-off | no GPU | hardware run |
| P2 | Astronomy, true scale, time, guides | Done-verified (Solar System) | `astro/**`, `contracts/frames.ts` | ephemeris, time, geometry | golden | interstellar frames | — | — |
| P3 | Planetary asset/material atlas | Partial | `data/catalog.ts`, `core/textures.ts` | manifest tests | golden | higher-res albedo; NC maps (3) | licences | source replacements |
| P4 | Planetary terrain & surface travel | Partial | `terrain/**` | terrain, precision | seq-hadley-descent, seq-jezero-descent, sites | global high-res, collision/walking mode, worker builds | data size, CPU | worker + more regions |
| P5 | Atmospheres, rings, comets, small bodies | **Partial → substantially advanced** | `render/ringSystem.ts`, `data/rings.ts`, `atmoModel.ts`, `atmosphere.ts`, `plumes.ts`, `data/atmospheres.ts` | rings (10), atmospheres37 (9), atmosphere (7) | ring & atmosphere archives | volumetric clouds/rings, weather | — | §C/§D below |
| P6 | Solar System visual/UX integration | Partial | `ui/ui.ts` | ui tests | UI archive | journey editor, accessibility audit on hardware | — | — |
| P7 | Multi-scale stellar navigation | Partial (3-D nearby stars) | `galaxy/stars3d.ts` | stars | starfield | interstellar travel demo | precision frames beyond 1 pc | U-scale frames |
| P8 | Observed stellar catalogue streaming | Partial | residency streaming | residency | — | Gaia bulk | data volume | tiled Gaia ingest |
| P9 | Navigable Milky Way structure | Not started | — | — | — (2-D panorama only, not a 3-D Galaxy) | everything | P7/P8 | — |
| P10 | Deep-sky objects & exoplanet systems | Not started | — | — | — | — | — | — |
| P11 | Integrated Galactic exploration | Not started | — | — | — | — | — | — |
| P12 | Galactic production QA | Not started | — | — | — | — | — | — |
| U1–U6 | Local Group → observable universe | Not started | — | — | — | — | — | — |

## B. v3.6 deliverables (re-checked in v3.7)
All rows of `docs/requirements-matrix-v3.6.md` hold. ATM-005 (grey-alpha compositing) moved from Open to **Done-verified**
in v3.7 (`viewTransmittance`, test `ATM-005 LUT ratio…`, images mars-day / mars-pole vs v3.6).

## C. Ring systems (spec Part III)
| § | Requirement | Status | Code | Tests | Evidence | Remaining |
|---|---|---|---|---|---|---|
| 9 | Saturn D, C, B, Cassini Div., A, Encke, Keeler, F, G, E distinguished | Done-software | `data/rings.ts` (D, G, E components) + measured PPS profile (C…F) | Saturn PPS regional τ; LOD conservation | sat-overview, sat-regions-labelled, sat-cassini-division, sat-encke-keeler, sat-A/B/C-close, sat-F-ring | ringlets beyond PPS resolution, density-wave azimuthal structure |
| 9 | Jupiter halo, main, Amalthea, Thebe gossamer; faint, phase-dependent | Done-software | dust population + HG forward phase | brightness ordering | jup-overview(-sci), jup-backlit(-sci), jup-forward-scatter, jup-edgeon, jup-halo-close, jup-main-ring-close, jup-gossamer | vertical thickness (halo 10,000 km) not rendered |
| 9 | Uranus 13 rings, ε, dusty components, orientation | Done-software | 10 narrow analytic + 3 dusty | 13-ring test | ura-overview(-sci), ura-polar, ura-oblique, ura-backlit, ura-epsilon-close, ura-narrow-rings, ura-diffuse-mu-nu, ura-regions-labelled | eccentricities/inclinations |
| 9 | Neptune Galle, Le Verrier, Lassell, Arago, Adams + arcs, dust bands | Done-software (arcs REPRESENTATIVE longitude) | arcs via azimuthal table + pattern speed | arc τ ratio | nep-overview(-sci), nep-polar-arcs, nep-edgeon, nep-backlit, nep-oblique, nep-adams-close, seq-neptune-arcs_f00–07 | anchor arc longitudes to an observed epoch |
| 9 | Chariklo, Haumea, Quaoar; candidates distinguished | Done-software | Chariklo added to catalogue (SBDB full precision); Quaoar pole fixed | small-body radii | chariklo-*, haumea-*, quaoar-* | particle albedos unknown (inferred) |
| 10 | Audit + ring-coverage matrix | Done | — | — | `SOL_V3.7_RING_SYSTEM_RESEARCH_AND_IMPLEMENTATION.md` §1 | — |
| 11 | Tiers R0–R4 | Done-software | `ringState` tiers in `engine.ts` | — | seq-ring-lod_f00–15 (metadata records the tier) | — |
| 11 | R5 volumetric | **Open** | — | — | — | prototype ray-marched slab vs particles |
| 12 | τ not opacity; viewing-angle dependence; edge-on | Done-verified | `ringShade` | slab photometry tests | sat-edgeon, jup-edgeon, nep-edgeon | — |
| 13 | B-ring near-field τ fix; stable particles; icy materials; shear | Done-software (cap 65,536) | `ringParticles.ts` | — | sat-nearfield-A/B, sat-particle-crop, seq-ring-plane-traverse_f00–13 | PPS-saturated core still capped; no wakes/collisions |
| 14 | Distinct per-planet materials | Done-software | per-system macro/dust ϖ, g, colour | — | all ring sets | — |
| 15 | Lighting integration: sunlit/unlit/backlit, shadows both ways, eclipse, polar, time | Done-software | planet shadow; ring τ shadow on planet | — | sat-sunlit-oblique, sat-backlit, sat-eclipse, sat-ringshadow-on-planet, sat-planetshadow-on-rings, sat-polar, sat-epoch2026 vs showcase epoch | rings seen from moons (no dedicated view), Saturnshine on rings |
| 15 | Enhanced visibility distinguished from physical | Done-software | gain + mode-badge note; Scientific = 1 | — | *-sci pairs, ui-mode-badge-ring-enhancement | — |
| 16 | Performance & precision | Partial | analytic narrow rings, ≤ 4 texture fetches | — | — | real-GPU timing |
| 29 | Ring controls, region overlay, selector | Done-software | Settings (ringEnhance, ringLabels), inspector ring table → `flyToRing` | — | ui-inspector-saturn-rings, ui-inspector-uranus-rings, *-regions-labelled | — |

## D. Atmospheres and clouds (spec Part IV)
| Body / item | Status | Code | Tests | Evidence | Remaining |
|---|---|---|---|---|---|
| Mercury exosphere (no shell) | Done-verified | `data/atmospheres.ts` | no-false-shell test | mercury-* | Na tail |
| Venus thick CO₂ + cloud deck | Done-software (static clouds) | catalog Venus, `cloudTopKm` | Venus test | venus-*, venus-cloudtop-flight | cloud structure/motion |
| Earth | Done-software (v3.6 + ATM-005) | v3.6 LUTs | v3.6 tests | earth-*, earth-sunset-limb, seq-earth-* | volumetric clouds, cloud shadows |
| Mars dust, blue twilight, butterscotch sky | Done-verified (parameters) / Done-software (look) | catalog Mars | Mars tests | mars-*, sites, seq-jezero-descent | clouds, storms, seasons |
| Jupiter, Saturn gas-giant shells | Partial (shell over observed maps) | catalog + densityShiftH | density-shift test | jupiter-*, saturn-*, *-cloudtop-flight, seq-jupiter-rotation | 3-D cloud layers, storms beyond map |
| Uranus vs Neptune ice giants | Partial | CH₄ + haze | ice-giant test | uranus-*, neptune-* | storms, seasonal polar caps |
| Titan | Done-software | v3.6 | τ > 3 | titan-*, titan-low-altitude | methane clouds, detached haze |
| Triton, Pluto thin hazes | Done-software (single layer) | catalog | τ < 0.05 | triton-*, pluto-*, *-backlit | Pluto's ~20 layers |
| Io, Enceladus plumes | Done-software (REPRESENTATIVE) | `plumes.ts` | plume test | io-*, io-plumes-limb, enceladus-*, enceladus-plume-backlit | time-variable activity |
| Galilean exospheres | Done (metadata) | `data/atmospheres.ts` | test | inspector | — |
| Volumetric clouds (§22) | **Open** | — | — | — | not claimed |

## E. Terrain, navigation, Sun, graphics, sky, UI (spec Part V)
| § | Requirement | Status | Evidence | Remaining |
|---|---|---|---|---|
| 24 | Hadley Rille & Jezero ultra detail | Partial (118 m / 231 m DEM; no new imagery in v3.7) | seq-hadley-descent, seq-jezero-descent, moon-hadley-ground, mars-jezero-ground, moon-hadley-lowsun | HiRISE/LROC NAC-scale DEMs, imagery drape |
| 25 | Seamless approach/descent/return | Partial (continuous LOD & placement shown as ordered frames; flight UI unchanged) | descent sequences (reverse order = return) | surface walking/collision mode |
| 26 | Sun upgrade | Partial (v3.6 granulation; no new v3.7 Sun work) | sun-* | observed active regions |
| 27 | Celestial-body graphics | Partial (ring/atmosphere-driven) | golden | — |
| 28 | Sky / Milky Way (2-D panorama, NOT a 3-D Galaxy) | Unchanged from v3.5 | golden starfields | 3-D Galaxy (P9) |
| 29 | UI/UX: ring/atmosphere controls, provenance, labels | Done-software | UI archive | journey planner upgrade |
| 30–38 | Image-only QA with metadata, sequences, archives | Done | 7 archives + index | real-GPU images |
| 39–44 | Reports | Done | this file + 4 reports + handoff | — |
| 47 | Performance on hardware | **Blocked** (no GPU in this environment) | — | run `docs/qa/benchmark-protocol.md` |
