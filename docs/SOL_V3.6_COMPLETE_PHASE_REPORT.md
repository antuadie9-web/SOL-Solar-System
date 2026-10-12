# SOL_V3.6_COMPLETE_PHASE_REPORT — SOL v3.6 from first commit to release

Report date 2026-10-10 (IST). Author: the SOL implementation agent (Hark). This document is self-contained: it is written so
another reviewer can evaluate v3.6 **without the source ZIP**. Everything stated as "verified" was executed in this
workspace; everything visual is **software-WebGPU only** (Chromium 154 + SwiftShader). No real GPU was available.

## 0. Release status (actual)
| Item | Status |
|---|---|
| Version | **3.6.0** (`package.json`, build-time `__SOL_VERSION__`) |
| Git | branch `v3.6`, commits `1b41394` (checkpoint of all prior uncommitted v3.6 work) and `241fe36` (release changes) + final docs commit (see §11) on top of v3.5.0 `a73e99d` (`master`) |
| Typecheck | 0 errors (`npx tsc --noEmit -p .`) |
| Tests | **267 / 267 pass** (v3.5: 252) — `node tools/run-tests.mjs` |
| Assets | validator: **1508 files**, 0 unmatched provenance, 0 exact duplicates, 3 non-commercial (unchanged set) |
| Build | `vite build` OK |
| ZIP | `sol-solar-system-v3.6.zip` — clean extraction verified (§10) |
| Visual QA | 27-view matched set v3.5 vs v3.6 (Exploration) + Scientific & Cinematic subsets, with per-image JSON metadata — `docs/qa/v3.6/` |
| Hardware | **NOT TESTED** — no real-GPU look, frame time, VRAM, motion |

## 1. Baseline
v3.5.0 (delivered 2026-10-09, `sol-solar-system-v3.5.zip`): modular TypeScript + Three.js r186 WebGPURenderer/TSL, native
WebGPU only; v3.5 lighting/exposure overhaul (Scientific / Exploration / Cinematic modes, night-side inspection light,
sky decoupling, star/Milky Way continuity). Re-verified at the start of v3.6 from a `git worktree` of `master`
(`/workspace/sol/base35`): typecheck 0, 252/252 tests, 198 assets / 0 unmatched, build OK.

## 2. Original v3.6 objectives (user request 2026-10-09)
Advanced planetary visuals and planet-specific physically based atmospheres; a substantially better close-range Sun;
improved materials; reusable high-resolution tiled terrain for the Moon and Mars; real integration of the frame hierarchy,
LOD and resource management into render paths; preserve v3.5 lighting/exposure/night-side/Milky Way systems, true scale,
WebGPU-only; source-verified R&D, matched comparisons, tests, documentation and an honest unfinished-work report. The
v3.6/v3.7 master specification (§4–7) added: recover/secure the uncommitted work, investigate Mars daylight/sunset colour
from observations, capture matched Mars day/night/twilight/polar/orbital/low-altitude views, finish requirements matrix,
change report, research record and issue log, and release a clean-extract-verified ZIP before any v3.7 work.

## 3. Recovery and securing (spec §4)
* Inspected git: 35 changed/untracked paths on branch `v3.6`, all present (sources, tile pyramids under
  `public/assets/terrain/`, ingest scripts, docs). Raw terrain inputs present in gitignored `tools/ingest/raw/`
  (8 regional `.npy` crops + MEGDR `megr16/megt16`). Nothing was missing.
* Checkpoint commit `1b41394` + a source tarball of the working tree were made before any further change.
* Re-ran the suite on the checkpoint: 267/267.

## 4. What changed — engineering detail

Date 2026-10-09. Base: v3.5.0 (git `a73e99d`, branch `master`); v3.6 work on branch `v3.6`. Native WebGPU only (no WebGL
fallback), modular TypeScript, true scale and distances unchanged. Visual evidence is **software WebGPU (SwiftShader,
Chromium 154) only** — real-GPU look, motion, frame time and VRAM are **NOT TESTED**.

## 1. Baseline re-verification and defect investigation
* v3.5 re-verified from its tree: typecheck 0, **252/252 tests**, assets 198 / 0 unmatched, production build OK.
* Matched comparison harness `tools/qa/scenarios/golden36.mjs` (26 views), run **unchanged** on the v3.5 tree
  (`git worktree` of `master`) and on v3.6: same epoch, same camera placement, and for surface sites the same automatic
  date search for a requested solar elevation. Sets in `docs/qa/v3.6/screens/{v3.5,v3.6}`.
* Findings on v3.5 (all fixed or addressed below unless noted):
  | ID | Finding | Evidence |
  |---|---|---|
  | VQA36-01 | Titan rendered as a blue-grey globe with its surface map visible (haze τ ≈ 0.5); from space Titan's surface is invisible at visible wavelengths | `titan` v3.5 |
  | VQA36-02 | Mars dust extinction 0.9·10⁻³ km⁻¹ (τ ≈ 0.01, ≈ 50× too clear) and an artistic red "Rayleigh": no limb haze, no horizon haze, black terrain shadows | `mars-limb`, `mars-terrain` v3.5 |
  | VQA36-03 | Ozone absorption applied with the Rayleigh (ground-level) profile; one grey Mie g; single scattering only | code review `atmosphere.ts` |
  | VQA36-04 | Ground sunlight used plane-parallel exp(−τ/μ0): wrong at grazing Sun | code review `planetMaterial.ts` |
  | VQA36-05 | Moon/Mars terrain limited to 1.9 / 3.7 km DEM; no cast shadows; body-centred float32 vertices (≈ 0.1–0.3 m error) | `moon-hadley`, `moon-tycho`, `mars-*` v3.5; `tests/contracts/terrainPrecision.test.ts` |
  | VQA36-06 | Close Sun: single granule scale, crisp hairline lanes ("crackle glaze") | `sun-close`, `sun-grazing` v3.5 |
  | VQA36-07 | Terrain patch bounding radius from one corner only (latent in v3.5; became a real hole bug with v3.6 cone culling near cube-face edges — Gale) | found & fixed during v3.6 QA |
  | VQA36-08 | v3.5 QA set `qa-final/exp-b` showed the ring-particle leak in `earth-polar`/`mars-crescent` — those PNGs were captured **before** the RING-002 fix; a fresh v3.5 capture (`earth-polar` after `ring-flythrough`) is clean. Stale evidence, not a live defect | `docs/qa/v3.6/screens/v3.5/earth-polar.png` |
  | VQA36-09 | Plain spheres used one mesh size at every tier (a 3-px disc cost the same 55k triangles as a full-screen limb) | AUD-04 remainder |

## 2. Atmospheres (physically based, planet-specific) — `src/render/atmoModel.ts`, `atmosphere.ts`
* Hillaire 2020 / Bruneton 2017 technique: **transmittance LUT** (256×64, exact spherical paths, every absorber with its own
  profile) replaces the 6-sample secondary march; **multiple-scattering LUT** (32×32, Ψms = L2/(1 − f_ms), ground bounce);
  per-channel Mie **single-scattering albedo and asymmetry** (Cornette–Shanks); Earth **ozone tent layer** (25 ± 15 km);
  analytic per-step integration (stable for optically thick haze).
* Surfaces: sunlight reaching the ground from the same LUT; **diffuse skylight** table (∫L cos θ dω) with sky-view factor —
  Mars shadows are filled by the reddish sky, Earth by blue sky light; the Moon (no atmosphere) keeps black shadows.
* **Mars dust colour decision (release)**: the interim inferred blue/green ω₀ 0.80/0.93 produced a grey-olive haze. It was
  replaced by the **measured** blue value ω₀(437 nm) = 0.765–0.769 (Wolff et al. 2010, Icarus 208, MARCI band 1 cross-checked
  with CRISM 440 nm) and an interpolated green 0.90 — chosen from the source, not from the look. CPU sky check (Sun 40° up):
  R:G:B 1.00 : 0.80 : 0.53 → 1.00 : 0.75 : 0.48. No presentation tint is applied.
* Exposure: the sunward atmospheric limb is metered (CPU twin of the shader, 4 tangent rays every 8 frames) so a backlit
  dust/haze crescent is highlight-protected (`limbLuminance`).
* Parameters & sources, derivations, validation: `docs/research/atmospheres-v3.6.md`. Highlights (automated tests):
  Earth τ = 0.062/0.142/0.271; Mars dust τ = 0.500; Titan τ > 3 all channels; LUT vs direct integration ≤ 1.5 %;
  **Mars blue sunset aureole emerges from the parameters** (sky near a setting Sun ≥ 1.3× bluer than the red sky away from it).
* LUTs are CPU-built (300–450 ms once per body, main thread) — not compute shaders: WebGPU compute crashes the QA adapter
  (R-013), and the CPU twin is what the tests validate. Worker offload: PERF-005 (open).

## 3. High-resolution tiled terrain (Moon, Mars) — reusable for any body
* **Format** (`tools/ingest/terrain_tiles.py`, manifest `public/assets/terrain/<body>/tiles.json`): nested equirectangular
  levels, ppd = 4·2^L, 240² tiles + 1-sample apron, gzip int16 m. L0–L2 (4–16 ppd) global; L3–L6 (32–256 ppd) regional.
* **Sources** (all public domain, `tools/ingest/terrain_fetch.py`, windowed HTTP range reads, no full download):
  Moon — LRO LOLA global LDEM 118 m (USGS 2014): **Hadley Rille / Apollo 15** and **Tycho** at 256 ppd (118 m).
  Mars — HRSC–MOLA Blended DEM 200 m v2 (Fergason et al. 2018): **Gale, Jezero, Candor/Melas** at 256 ppd (231 m), **Olympus
  Mons** at 128 ppd; areoid heights converted to MOLA radius with MEGDR (megr − megt).
  Consistency with the 16 ppd observed base (block means): mean offsets −0.4 … +5.9 m, rms 45–126 m (`tiles.json`).
* **Runtime** (`src/terrain/tiles.ts`, `terrain.ts`): byte-budgeted LRU tile residency (Settings `terrainBudgetMiB`,
  default 512), bounded-concurrency streaming, gzip via `DecompressionStream`; patches built from the finest resident level
  and **rebuilt when finer data lands** (no holes, no invented relief); refinement by **screen-space error**
  (contracts/lod.ts) and capped where the data stops; **view-cone culling**; per-frame CPU build budget.
* **Horizon-map shadows** (Max 1988): 8-azimuth horizon per vertex from the DEM; the Sun can move without re-meshing;
  penumbra over the solar disc. Mountains and crater rims now cast shadows (Hadley, Tycho, Candor).
* **Precision through the frame hierarchy**: patch-local vertex origins; per-patch camera-relative transform built in float64
  through `contracts/frames.ts` anchors (camera → body-fixed → ground-patch). Measured (test): **0.19 mm** worst placement
  error 2 m above the Moon vs **265 mm** for the v3.5 body-centred float32 path.
* Measured CPU (node, this machine, Hadley at 1.2 km altitude): converges in ≈ 230 frames at the 5 ms default budget,
  ≈ 445 patches, steady state 0.7 ms/frame; ≈ 6 ms per patch build incl. horizons. Real-GPU cost NOT TESTED.

## 4. Close-range Sun — `src/render/sun.ts`
* Granulation with a **size distribution** (two Worley scales selected by a cellular mask), **exploding granules** (dark
  centres in the largest cells), **magnetic bright points** in network lanes, dome-shaped granule interiors, **wider, softer
  lanes** and faint internal texture. All SIMULATED statistics (no observed field), band-limited as before. Radiometry,
  limb darkening and metering unchanged. Look remains owner-unapproved; software captures only.

## 5. Materials & rendering integration
* Terrain material variant shares the body's uniforms, reads body-fixed `bodyPos`, adds horizon shadows; ground
  transmittance + skylight from the atmosphere LUTs for every atmosphere-bearing body (Earth, Mars, Venus, Titan).
* **Geometry LOD per tier** (AUD-04 remainder): plain ellipsoids re-meshed 24 / 96 (128 giants) / 192 segments for D2 / D3 /
  D5 (`sphereSegmentsForTier`, test: focused full-screen limb chord error < 0.1 px).
* Frame hierarchy now in a real render path (terrain placement); LOD contract drives terrain refinement; resource
  management: terrain tile byte budget + patch geometry byte budget (192 MiB) with LRU eviction, both in diagnostics.

## 6. Matched comparison results (Exploration mode, software) — `docs/qa/v3.6/README.md`
See the README for the full metric tables (clip %, disc median, sky mean, stars, ground detail energy).

## 7. Verification
typecheck 0 errors · tests **267/267** (252 → 267: terrain pyramid +6 net, atmosphere +7, precision +1, geometry LOD +1) ·
assets validator 0 unmatched / 0 duplicates / 3 non-commercial (unchanged) · production build OK · clean-extract
verification of the ZIP: see `docs/qa/v3.6/README.md`.

## 8. Honest status — what remains unfinished
* **Hardware**: no real-GPU look, frame-time, VRAM or long-session evidence for any v3.6 feature (PERF-003/004/006).
* Terrain: regional high-res only (6 regions); global 64–256 ppd pyramids are a build-only step (same tools) but not shipped
  (size); polar regions; Mercury/Earth/icy moons; patch builds on the main thread (worker: PERF-005); no metre-scale
  surface camera mode/collision beyond the DEM clamp; albedo maps are far coarser than the 118–231 m relief.
* Atmospheres: single "typical" Mars dust state (no seasons/storms, ATM-004); Mars green ω₀ INTERPOLATED and blue/green g INFERRED (red and blue ω₀ measured: Wolff 2009/2010);
  Titan haze APPROXIMATE; gas-giant presets unchanged (GAS-001 partially helped by per-channel g only); aerial perspective uses
  a grey alpha (no per-channel transmittance blend); LUT build on the main thread.
* Sun: dated observed active regions (SUN-005) still open; owner look sign-off pending; at 0.05 AU granulation remains below
  resolution by design.
* Clouds (volumetric), auroras, lightning, zodiacal light, B-ring τ, GPU histogram metering, full hierarchical-frame adoption
  for every layer — open as before.
* Long-term roadmap (Milky Way → observable universe, phases P0–P12, U1–U6) unchanged and NOT implemented by v3.6.


## 5. Changed files (git diff --stat master..v3.6, src/tests/tools)
```
     src/contracts/lod.ts                               |   5 +
     src/core/settings.ts                               |   2 +
     src/data/catalog.ts                                |  20 +-
     src/env.d.ts                                       |   1 +
     src/main.ts                                        |   1 +
     src/render/atmoModel.ts                            | 231 +++++++++++++++++++
     src/render/atmosphere.ts                           | 115 ++++++----
     src/render/engine.ts                               |  79 +++++--
     src/render/planetMaterial.ts                       |  45 +++-
     src/render/sun.ts                                  |  39 +++-
     src/terrain/dem.ts                                 |  18 --
     src/terrain/terrain.ts                             | 251 +++++++++++++++------
     src/terrain/tiles.ts                               | 108 +++++++++
     tests/astro/terrain.test.ts                        |  68 ++++--
     tests/contracts/contracts.test.ts                  |   7 +
     tests/contracts/terrainPrecision.test.ts           |  35 +++
     tests/render/atmosphere.test.ts                    |  55 +++++
     .../__pycache__/terrain_fetch.cpython-312.pyc      | Bin 0 -> 8533 bytes
     tools/ingest/terrain_fetch.py                      |  73 ++++++
     tools/ingest/terrain_tiles.py                      |  97 ++++++++
     tools/qa/detail.py                                 |  20 ++
     tools/qa/scenarios/golden36.mjs                    | 114 ++++++++++
     22 files changed, 1209 insertions(+), 175 deletions(-)

```
New modules: `src/render/atmoModel.ts` (CPU physical atmosphere: profiles, LUT builders, multiple scattering, skylight, ray
radiance), `src/terrain/tiles.ts` (TilePyramid), `tools/ingest/terrain_fetch.py`, `tools/ingest/terrain_tiles.py`,
`tools/qa/detail.py`, `tools/qa/scenarios/golden36.mjs`, `src/env.d.ts`. Removed: `src/terrain/dem.ts` and the monolithic
`dem16.bin` DEMs (superseded by the pyramid). New WGSL/TSL: LUT-sampling atmosphere march (`atmosphere.ts`),
`transmittanceUVw`, `horizonShadow`, skylight sampling (`planetMaterial.ts`), granules2 (`sun.ts`).

## 6. Scientific calculations (summary; full derivations in docs/research/atmospheres-v3.6.md)
* Rayleigh β(λ) = 8π³(n²−1)²/(3Nλ⁴)·F_K; Earth H_R = 8.0 km; ozone absorption from the Serdyuchenko 2014 cross-sections ×
  a 300 DU tent profile (25 ± 15 km). Test: τ_R(680/550/440) = 0.046/0.108/0.265; total Earth τ 0.062/0.142/0.271.
* Mars: τ_dust = 0.5 (H 11.1 km, Lemmon et al. 2015 typical non-storm), ω₀ = 0.975/0.90/0.77 (red Wolff 2009, blue Wolff
  2010 measured at 437 nm, green interpolated), g = 0.67/0.69/0.72; CO₂ Rayleigh from 6.1 mbar, 210 K.
* Titan: haze τ > 3 every channel (H 65 km), ω₀/colour APPROXIMATE (Tomasko et al. 2008 trends).
* Transmittance LUT 256×64 (Bruneton parametrisation), MS LUT 32×32 (Hillaire 2020: Ψ = L₂/(1 − f_ms)), skylight table.
* Terrain: ppd = 4·2^L; SSE refinement error ε_px = k·e_geom/d; horizon maps 8 azimuths (Max 1988); placement in float64
  via frame anchors, residual 0.19 mm vs 264.7 mm (v3.5 float32 body-centred).

## 7. Tests added in v3.6 (all pass)
- `tests/render/atmosphere.test.ts` (7): Earth τ; Mars τ / Titan τ; LUT vs direct ≤ 1.5 %; MS finite; Earth blue sky and
  reddened low Sun; Mars red sky + blue aureole; skylight.
- `tests/astro/terrain.test.ts` (12, rewritten for the pyramid): Olympus summit radius, Hellas depth, Mars polar radius,
  Moon highest point, SPA floor, longitude wrap, tile-seam apron agreement, level nesting, regional vs base block means,
  Hadley Rille resolved at 118 m not at 1.9 km, Olympus caldera depth at 128 ppd, TilePyramid streaming/budget.
- `tests/contracts/terrainPrecision.test.ts` (1): < 2 mm at 2 m altitude (measured 0.193 mm) vs decimetres for v3.5.
- `tests/contracts/contracts.test.ts` (+1): geometry LOD per tier (proxy discs cheap, focused limbs sub-pixel).

## 8. Results and images
`docs/qa/v3.6/README.md` (method, metrics, known visual issues), `metrics-v3.5-vs-v3.6.md`, `detail-v3.5-vs-v3.6.txt`,
`compare/v3.5-vs-v3.6-matched.jpg`, `screens/v3.6/{exploration (27), scientific (5), cinematic (5)}` with JSON metadata,
`screens/v3.5/exploration` (27 baseline). The image archive `SOL_V36_VISUAL_QA_IMAGES.zip` contains the same files.

Matched-set findings (Exploration, software):
* Titan: blue-grey globe with visible surface (v3.5) → opaque orange haze globe (v3.6), disc median 51 → 134.
* Mars limb/night: a dust haze band and a bright backlit dust crescent appear; mars-night clipping 0 %.
* Mars low-altitude sites (Gale, Candor): a dusty sky (sky mean 7.6 → 19.5 at Gale) and distant-terrain extinction appear.
* Moon Hadley/Tycho: cast shadows from 118 m LOLA tiles (HF energy 0.85 → 1.96 Hadley; 9.0 → 11.7 Tycho).
* Sun close: softer lanes, size-distributed granules.
* No view clips more than 0.06 % of pixels (unchanged).

## 9. Bugs found and limitations (honest)
Fixed during v3.6: VQA36-01…09 (§4 table). Found during release QA and **not** fixed in v3.6 (moved to v3.7):
* **ATM-005 (known since v3.6 development; impact confirmed in release QA): grey-alpha atmosphere compositing.** Surface behind an atmosphere is dimmed by one grey factor
  (1 − mean T) instead of per-channel transmittance. Visible as a desaturated, olive-brown Mars disc from orbit and a
  washed-out north polar cap in `mars-polar`; also slightly greys Earth's limb land. Root cause identified; fix designed
  (per-channel LUT transmittance in the surface shader + inscatter-only compositing).
* Mars dust state fixed at τ = 0.5 (no seasons, storms, clouds); green ω₀ interpolated; g for G/B inferred.
* Titan haze approximate; no layered detached haze.
* Gas giants, Venus, Uranus, Neptune atmospheres were **not** upgraded in v3.6 (old presets).
* Terrain: six regional high-res areas; global base 16 ppd; no polar coverage; patch/LUT builds on the main thread
  (≈ 6 ms/patch, 300–450 ms/LUT per body); albedo maps far coarser than relief; no surface walking/collision mode.
* Sun: simulated granulation statistics; no dated observed active regions; owner look sign-off pending.
* Software rendering only: all look claims are provisional until a real GPU run of `docs/qa/benchmark-protocol.md`.

## 10. Release verification (clean extraction)
RELEASE_VERIFICATION_PLACEHOLDER

## 11. Git commits (v3.6)
GIT_LOG_PLACEHOLDER

## 12. Remaining work → v3.7 and beyond
See `SOL_V3.7_COMPLETE_DEVELOPMENT_REPORT.md` and `SOL_V36_V37_MASTER_PROJECT_HANDOFF.md`. v3.6 leaves: ATM-005, worker
offload (PERF-005), dust seasons/clouds (ATM-004), more terrain regions + global pyramids, gas-giant/ice-giant/Venus
atmospheres, ring systems (B-ring τ RING-001), real-GPU validation.
