# SOL v3.5 — requirements matrix (master handoff v3.5, 9 Oct 2026)

Status vocabulary (contract 7): **Verified** (automated test or measured comparison passes) · **Verified-software**
(rendered and inspected on the SwiftShader adapter only) · **Pending-hardware** · **Partial** · **Open** · **Blocked**.

## Part I — lighting & visibility (v3.5 priority)
| § | Requirement | Status | Where / evidence |
|---|---|---|---|
| 4 | Fix the complete lighting-and-visibility experience (not "more ambient") | Verified-software | `docs/v3.5-changes-report.md` §2–3; `docs/qa/v3.5/` matched captures + metrics |
| 5 | Separate physical light · exposure · tone · inspection · sky visibility · art direction | Verified | `src/render/presentation.ts` header; tests "modes change presentation only", "engine sets sunlight from geometry" |
| 6A | Scientific mode: real light, phases, physical exposure, faint stars disappear, unlit stays dark, eclipses, manual EV | Verified-software | MODE_PARAMS.scientific; `qa-final/sci` captures |
| 6B | Exploration (default): context exposure, highlight/shadow management, secondary light, labelled inspection, star/MW visibility, smooth transitions, edge lighting | Verified-software | MODE_PARAMS.exploration; labels in `#viewmode`; atmosphere unchanged + airglow |
| 6C | Cinematic: art-directed exposure, contrast, glare, grade, no excess bloom/saturation | Verified-software (owner look sign-off pending) | grade node in engine.ts |
| 6 | Mode switching never changes geometry; mode always visible | Verified | tests; `#viewmode` control, key V |
| 7 | HDR exposure system examined as a pipeline (metering, percentiles, solar disc, selected object, adaptation, tone, colour, bloom order, gamma, stability) | Verified-software / Partial | meterLuminance (map p99 statistics), sun meter per mode, asymmetric adaptation; GPU histogram metering NOT implemented (compute passes crash the QA adapter, R-013) — CPU photometric metering instead |
| 7 | Neutral vs AgX compared under identical conditions | Partial | both selectable; HIGHLIGHT_TARGET per tone mapper; matched AgX capture set not produced in v3.5 |
| 7 | **EXP-002 fixed** without global darkening | Verified-software | clip % per view: v3.4 vs v3.5 table in `docs/qa/v3.5/README.md` |
| 8 | Earth: nightglow, city lights (sourced), auroras, lightning, moonlight, twilight | Partial | airglow (new), VIIRS lights (existing), moonlight via planetshine (new), twilight (existing scattering); auroras/lightning OPEN |
| 8 | Moon & airless bodies: reflected light + labelled inspection | Verified-software | planetshine; inspection light |
| 8 | Mars: terminator, haze, albedo, low-light, optional terrain inspection | Partial | existing scattering + new inspection; dust-storm/haze variation OPEN |
| 8 | Gas giants not Lambertian rocks | Partial | Minnaert (existing) + Minnaert inspection law; upper-haze night-limb scattering OPEN (GAS-001) |
| 8 | Icy moons: opposition effect; data-visualisation for dark sides; unmapped labelled | Partial | Lunar–Lambert surge (existing); reconstruction labels (existing); separate data-visualisation mode OPEN |
| 9 | Milky Way/stars never disappear arbitrarily; coherent, oriented, stable; occlusion valid | Verified-software | sky domain; far-plane depth fix (LGT-002); veil re-coupling; earth-mw / jupiter-mw / moon-mw captures |
| 9 | Separate nearby 3D stars from the distant layer; no double counting; panorama not called the 3D Milky Way | Verified | star-removed diffuse layer; UI text; manifest |
| 9 | Star PSF, magnitude/colour, sub-pixel, highlights, exposure response, AA, temporal stability, parallax | Partial | PSF compression + calibrated flux + 3D parallax layer; temporal stability on hardware PENDING |
| 10 | Simplest correct composition; APIs verified in installed three r186 | Verified | changes report §3.6 |

## Part II — Solar System graphics
| § | Requirement | Status | Notes |
|---|---|---|---|
| 11 | Mature Sun: photosphere, granulation without tiling, spots, faculae, limb, corona, prominences, eclipse, glare, distance transitions | Partial | tiling fixed (PCG3D); disc exposure per mode; AUD-07 corrected; SDO-informed dated active regions OPEN (SUN-005) |
| 11 | Sun tests at 0.05/0.2/1/5/30 AU, limb, eclipse | Verified-software | golden views present in `qa-final` |
| 12 | Body visual identity (all families) | Unchanged from v3.4 (Partial) | no new assets in v3.5 |
| 13 | Differentiated atmospheres, multiple scattering, LUTs, clouds | Partial (unchanged + airglow) | |
| 14 | Terrain LOD, tiles, collision, orbit↔ground | Partial (unchanged; terrain switch now tier-driven) | |
| 15 | Rings: optical depth, shadows, particles, B-ring τ loss | Partial | particle-slice leak fixed (RING-002); B-ring τ OPEN |

## Part III — architecture & science
| § | Requirement | Status | Where |
|---|---|---|---|
| 16 | Frames, object records, catalogue streaming, LOD, camera state, evidence, UI state — adopted with demonstrable benefit | Partial | streaming (residency) ✔, LOD (3 consumers) ✔, camera state (invariant) ✔, evidence (`metrics.py`, map truth) ✔, UI state (schema 8) ✔; hierarchical frames still library-only |
| 16 | AUD-01…AUD-07 | Verified | see changes report §3.7 and tests |
| 17 | True scale, no silent rescale | Verified (unchanged) | presentation never touches geometry (test) |
| 18 | Ephemeris accuracy & regression tests | Verified (unchanged, all pass) | |
| 19 | Legal assets; NC maps verified | Verified | Ariel/Titania/Oberon still non-commercial (unchanged, flagged) |

## Part IV — benchmark research
| § | Status | Where |
|---|---|---|
| 20 SpaceEngine | Done (documentation) | `docs/research/benchmarks-v3.5.md` §1 |
| 21 ARK Starmap | Blocked (WebGL not available here) | §2 |
| 22 universesimulator.org | Blocked (WebGL 2 required, exact message recorded) | §3 |

## Part V — long-term scope (all phases remain registered)
P0 Verified · P1 Partial (lighting milestone delivered) · P2 Verified/Partial · P3–P6 Partial · P7 Partial (3D star layer, named stars) · P8 Partial (residency streaming; Gaia bulk OPEN) · P9–P12 Open · U1–U6 Open. v3.5 does not claim any observable-universe implementation.

## Completion estimate (re-checked; weighted engineering estimate, not an objective percentage)
Method: v3.4 audit weights per phase, items moved only where v3.5 has code + evidence. Solar System ≈ **42 %** (v3.4 audit 39.9 %:
lighting/exposure/sky/honesty items of P1/P6 closed, nothing in P3–P5 assets); Galactic phases ≈ **5 %** (residency
streaming); observable universe **0 %**; entire vision ≈ **21 %**.
