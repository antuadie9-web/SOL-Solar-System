# SOL v3.8.1 — cross-system rendering continuity & consistency audit (CONT-381)

Owner request 2026-10-13 (after REV2-01). These are **risks, not confirmed bugs**: each entry is investigated by evidence,
fixed at the shared contract when several systems share a cause, and never "fixed" by per-object correction factors.

## Shared contracts under audit (separately: physical quantity vs display transform)
| Contract | Physical quantity | Display transform | Owner module |
|---|---|---|---|
| C1 Exposure | scene radiance (W·sr⁻¹ units, AU/R☉ scale) | auto-EV meter → expLog → displayExposure; sky EV glide | engine.ts exposure block, presentation.ts meterLuminance |
| C2 Point/disc handover | flux F = L·Ω conserved across representations | point PSF (sky domain) ↔ resolved disc (local presentation sunDiscScale) ↔ glare | sun.ts, starDisc.ts, psf (stars) |
| C3 Glare/bloom | fraction of displayed flux | halo/veil amplitude laws, bloom threshold | sun.ts makeGlare, post bloom |
| C4 LOD / texture tier | albedo calibration (albedoScale from texstats) | base ↔ hi texture swap, procedural fade by footprint | textures.ts, engine albedo calibration, planetMaterial |
| C5 Precision | double-precision positions | hi/lo camera-relative split, depth range | camera rig, star shaders (STAR-J01) |
| C6 Atmosphere/shell | LUT transmittance/inscatter | shell vs surface pipeline, inspection fill | atmosphere LUTs, planetMaterial |
| C7 Rings | τ, ϖ, phase functions | lit/unlit branch at l·v sign, near-field particles ↔ texture | ringSystem.ts, ringParticles.ts |
| C8 Sky composition | catalogue stars + 2-D panorama (star-removed) | sky EV vs scene EV, presentation gain | sky_v381, sky shader |
| C9 Navigation | frame changes (helio ↔ body-fixed ↔ galactic) | camera smoothing, target hand-off | rig, ui |
| C10 Streaming | resident resources | reconstruction cost on threshold crossings (re-upload, recompile) | textures.ts, terrain, shape models |

## Transition inventory (risk → test → status)
| ID | Transition | Risk | Deterministic test (before / at / after threshold; fixed + auto EV; FOV/res/mode) | Status |
|---|---|---|---|---|
| CONT-01 | Sun point ↔ resolved disc (C1–C3) | brightness/glare jump | GLAREAUDIT: 7 distances × 20°/50° × auto/fixed; image glare energy G | **CONFIRMED** = REV2-01/SUN-381-07; fixed in shared laws (sunDiscScale ramp, display-referred glare, point cap); verification glare-post2 |
| CONT-02 | Star point ↔ resolved stellar disc (C2) | same class as CONT-01 | xstar-proxima ladder (cp2) + glare/flux integral across 3.5–8 px | to verify with CONT-01 laws (shared PSF) |
| CONT-03 | Sky EV ↔ scene EV glide (C1, C8) | star/sky popping when a bright body enters | existing EXP-381-01 views + order permutations | partly verified (EXP-381-02 order-independence) |
| CONT-04 | View-order dependence of meters/caches (C1) | stale caches | permuted view orders, same frame compared | EXP-381-02 fixed; extend to all cached meters |
| CONT-05 | Texture base ↔ hi swap (C4) | albedo calibration jump | capture at tier boundary pre/post swap; mean Y of disc | open |
| CONT-06 | Procedural detail fade by footprint (C4) | popping | distance sweep across fp thresholds (small moons, reconstruction) | open (new crater octaves use smooth footprint fades) |
| CONT-07 | Observed ↔ reconstructed map region (C4) | seams | partial-* views | REV2-02 in progress |
| CONT-08 | Atmosphere shell ↔ surface; day ↔ twilight ↔ fill (C6) | hard terminator, duplicated light | venus/titan terminator, limb views | **CONFIRMED** (Venus/Titan: missing twilight + fill trough; day-side double count found and removed in iteration 2) |
| CONT-09 | Ring lit ↔ unlit branch, edge-on, near-field particles ↔ texture (C7) | black slabs, popping | sat-edgeon, sat-nearfield-A, Atlas/Pan views, ring-plane crossing sweep | open (black slab observed near Atlas) |
| CONT-10 | Plume visibility vs phase/exposure (C3, C6) | pops | plume views across phase | open |
| CONT-11 | Precision across scale (C5) | jitter | star-stability trace (cp2), surface close-ups | verified for stars (cp2); extend to surfaces/terrain |
| CONT-12 | Camera frame/target hand-off (C9) | jumps | scripted travel with frame change | open |
| CONT-13 | Streaming reconstruction (C10) | stalls on threshold | bench travel-cold/warm phases (owner HW) | owner HW pending |

Evidence: work/qa/* captures; each confirmed item gets a register ID and before/after sheet in the next phase report.
