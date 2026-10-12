---
title: "SOL v3.7–v3.8 — Master Project Hand-off"
subtitle: "Everything a new reviewer needs without the source ZIP: vision, rules, history, architecture, status, defects, evidence, roadmap"
date: "2026-10-11"
---

# 1. Project vision and benchmark

**What SOL is.** A scientifically grounded, true-scale, explorable model of the Solar System, growing towards the solar
neighbourhood, the Milky Way and beyond. It is benchmarked against *SpaceEngine-class* exploration and built **only** for
desktop Chrome with **native WebGPU**. There is deliberately no WebGL path.

**What SOL must be.** Physically interpretable in Scientific mode, natural and beautiful in Exploration and Cinematic modes,
honest about every approximation, and never faking distances or sizes for convenience.

**Development rules** (from the master specifications):

* No silent skipping, no fabricated evidence, no claim without evidence.
* Observed data must be distinguishable from reconstructed data.
* Scientific accuracy and exploratory readability stay separate, and every enhancement is labelled.
* No arbitrary quality ceiling. Optimisation must not lower maximum fidelity.
* Still images and reports only; no video requirement.
* Every major report is delivered in Markdown and as an image-rich PDF.

# 2. Version history

| Version | Theme | Key results |
|---|---|---|
| ≤ 3.2 | Prototype → true-scale Solar System | analytic ephemerides, textured bodies |
| 3.3 | Owner defects, hero Sun, guides, visual identity, UI redesign | evidence tiers |
| 3.4 | Foundation contracts (frames, schema, catalogue shards, detail tiers, camera state machine) | 335,865 3-D stars, streaming |
| 3.5 | Lighting & visibility: 3 viewing modes, planetshine, airglow, diffuse Milky Way | 252 tests |
| 3.6 | Atmospheres (LUT model), terrain pyramids (Moon 118 m, Mars 231 m) | |
| 3.7.0 | Rings for 7 systems, atmosphere audit, plumes | released with defects (Venus 5.6 EV, Jupiter rings, Io/Enceladus) |
| 3.7.1 (branch) | Corrections: metering root cause, ring/plume gains, Uranian eccentric rings, moon identity | retained in Git |
| **3.8.0** | Stellar bridge, far Sun, Milky Way model, visual identity, UI/a11y, travel performance | this release |

# 3. Architecture (as shipped)

```
src/
  astro/      ephemerides (Horizons-sampled, mean/osculating elements, J2-aware inner moons), time scales, SolarSystem graph
  contracts/  frames (ecliptic/ICRS/Galactic/Galactocentric), catalogue streaming (CatalogStream), detail tiers, schema
  core/       settings, assets, textures (residency), clock, GPU probe (native WebGPU only)
  data/       catalog (bodies), rings, atmospheres, smallMoons (+ satSizes.json), deepSky, mapTruth
  galaxy/     stars3d (GPU point layer), milkyWayModel (parametric, cited), photometry (G→V)
  navigation/ camera rig + flight (radial interstellar legs)
  render/     engine (meter, LOD, views), atmosphere (+ worker), ringSystem, plumes, sun, points (PSF), planetMaterial,
              geometry (family shapes + worker), terrain, presentation (tone map / exposure)
  terrain/    tile pyramid streaming, SSE refinement
  ui/         ui.ts (inspector, search, journeys, settings, loader), galmap (Galactic context), tours, styles
tools/        ingest (Gaia, Horizons, SBDB, PDS shapes, satellite sizes, rings), validate (asset manifest), qa (harness + scenarios)
tests/        node:test suites (310 in v3.8.0)
docs/         reports, requirements matrices, issues, inventories, asset manifest, QA indices
public/assets catalogues, ephemerides, textures, terrain, models, rings (≈ 342 MB)
```

**Precision.** State is held in float64 on the CPU and rendered camera-relative in float32. Stars are drawn on a 1e9 km sphere
in the camera direction. Body points beyond the far plane are pinned to reversed-depth z = 0.

# 4. Status by system (evidence-based)

| System | Completed | Partial | Missing |
|---|---|---|---|
| Ephemerides & time | Horizons tiers, TT/TDB/UTC, J2 inner moons | small-body element precision (SCI-005) | — |
| Sun | resolved photosphere, continuous far-Sun regimes, glare | real-GPU look | dated active regions |
| Lighting/exposure | 3 modes, highlight-protected metering, frame coverage | — | volumetric GI |
| Atmospheres | LUT atmospheres per body physics | giant-planet 3-D clouds | volumetric clouds/weather |
| Rings | 7 systems, τ-based, eccentric Uranian rings, near-field slice | volumetric R5 | wakes, spokes, propellers |
| Moons/small bodies | measured props ≈ 36, sizes for 414, observed shapes (NASA 3D, Itokawa, Phoebe) | surfaces procedural | controlled small-moon mosaics |
| Terrain | Moon/Mars regional pyramids | imagery coarser than relief | walking/collision |
| Stars | 335,865 stars, 20-pc Gaia DR3 refinement, V-band photometry, streaming | — | Gaia bulk beyond 100 pc |
| Milky Way | cited parametric model, context card, 9 DSO markers | — | rendered 3-D Galaxy |
| UI/UX | truthful loader, inspector, search, journeys, a11y fixes | polish, not redesign | panel docking |
| Performance | worker LUTs/shapes, predictive prep, freeze removal | — | real-GPU measurement |

**Estimated completion** (owner's long-term programme, P0–P12 plus U1–U6; my estimate): P0–P2 complete, P3–P8 partial, P9
foundation only (model, no renderer), P10–P12 and U1–U6 not started. By weight that is roughly **30–35 %** of the full SOL
vision, and roughly **75 %** of the Solar-System-scale goals.

# 4a. Evidence gallery (final build, software WebGPU)

![Venus terminator, v3.7.0 vs v3.8 final.](img/pair-venus-terminator.jpg)

![Far-Sun series, v3.7.0 vs v3.8 final.](img/sheet-sunfar.jpg)

![Earth → Proxima Centauri → Earth journey.](img/journey-strip.jpg)

![Arrival at Proxima Centauri, full-size original.](img/journey-arrival-proxima.png)

![Main-thread long tasks on the scripted travel route, v3.7.0 vs v3.8.](img/perf-longtasks.png)

# 5. Critical bugs and open issues at hand-off

**No known release-blocking defect remains** in the software-verified scope. Open items are in `docs/issues.md`, in particular:

* GPU-001: real-GPU validation, blocked.
* GPU-003: SwiftShader device loss when the small-body compute pass runs. This is a software-adapter issue, but it means the
  small-body compute path is **untested in QA**.
* §14: small-moon mosaics.
* RING-004: volumetric rings.
* CLD-001: volumetric clouds.
* SCI-004/005: ephemeris precision limits.
* PERF-002: KTX2.
* UX-002: docking and resizing.
* AST-003: three non-commercial maps.

# 6. Release contents and verification

* **Archive.** `sol-solar-system-v3.8-final.zip`: the complete application from Git commit `<release commit>` (tag `v3.8.0`).
  It includes source, all runtime assets, datasets, ingestion tools and their query inputs, tests, configuration,
  `package.json` with `package-lock.json`, and docs with all reports.
* **Excluded.** Only `node_modules`, `dist` and `.cache` (all rebuildable).
* **Release verification** (`release/verify.sh`, results in `RELEASE_VERIFICATION.md`):
  1. clean extraction;
  2. a hash of every file compared with the Git tree;
  3. the asset-manifest SHA-256 values and the catalogue shard hashes;
  4. every substantive line added by `v3.7.0..v3.7.1` present in the release (or a documented supersession);
  5. `npm ci`, typecheck, asset check, the full test suite and a production build, all from the extraction;
  6. Chromium loading the extraction's own build, with zero failed requests or HTTP errors required, plus page and GPU-error
     counts, and frames rendered for the Sun, Saturn and Proxima views.

# 7. v3.9 preparation and proposed scope

**v3.9 objective:** a genuinely navigable, multi-resolution Milky Way foundation with stronger planetary exploration
continuity.

**Ready.**

* Frames: ICRS, Galactic and Galactocentric, tested.
* The `CatalogStream` residency contract.
* The radial interstellar flight.
* The photometric-band handling.
* The parametric Galaxy model.
* The deep-sky metadata schema with navigability guards.

**Needed.**

1. Gaia DR3 HEALPix-tiled bulk catalogue (magnitude-limited LOD, offline preprocessing). The streaming contract already
   exists.
2. A far-field Galaxy renderer driven by the model, kept distinct from the observed panorama, with a dust/extinction
   volume.
3. Hierarchical camera anchors beyond 100 pc.
4. Regional terrain imagery (LROC/CTX) and a surface walking/collision mode.
5. Controlled small-moon mosaics.
6. Real-GPU benchmark runs on the owner's RTX 3050 laptop: `docs/qa/RTX3050-guide.md`, then the travel38 scenario.

# 8. v4.0 flagship objectives and dependencies

**Goal.** A SpaceEngine-class experience: seamless surface ↔ orbit ↔ interstellar ↔ Galactic travel, with observed data
wherever it exists and labelled reconstruction elsewhere.

**Dependencies.** v3.9's Galaxy streaming and renderer; surface navigation; volumetric clouds and rings; exoplanet systems
(P10); real-GPU performance budgets; a final UX pass.

**Acceptance gates.** Unchanged from the master spec Part XIV: scientific, functional, visual, performance, UX and
documentation.

# 9. Full remaining roadmap (ordered)

1. Hardware validation, which unblocks the performance and look sign-off.
2. Small-moon mosaics and the remaining identity work (§14).
3. Gaia bulk tiles and the Galaxy renderer (v3.9 core).
4. Terrain imagery and surface mode.
5. Volumetric clouds, then volumetric rings.
6. Exoplanet systems.
7. Local Group and universe stages (U1–U6).
