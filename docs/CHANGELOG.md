# SOL changelog

## 3.8.0 — 2026-10-12 · Stellar Bridge, Solar Rendering, Visual Identity, UI/UX & Performance (consolidated release)
Includes every v3.7.1 correction (branch `v3.7.1`, retained for history). Reports (Markdown + PDF): `docs/reports/v3.8/`.
- v3.7.1 corrections: Venus terminator metering root cause (off-frame Sun in the meter) + near-surface coverage; geometry-aware
  labelled ring gain (Jupiter backlit); physically normalised Io/Enceladus plumes with labelled enhancement and overlap-aware
  peak; Uranian eccentric rings (French et al. 1988); minor-moon identity (measured properties, class priors, size-dependent
  geology); Saturn first-view freeze removed (pre-smoothed ring colour).
- Far Sun: continuous disc→point regimes, sky-domain point with star compression, continuous glare; points beyond the 1e13-km
  far plane no longer clipped (Sun was invisible beyond ~1 ly).
- Stars: Gaia DR3 refinement of 2,534 stars within 20 pc; navigable nearby stars; radial interstellar travel; Earth → Proxima
  journey with in-flight catalogue streaming; catalogue G/Hp magnitudes converted to Johnson V (Riello et al. 2021); Teff colours.
- Milky Way: cited parametric model (Reid 2019, BHG16, Drimmel–Spergel), Galactic context card (M), 9 deep-sky reference markers.
- Assets/data: Itokawa and Phoebe PDS shape models; sizes for 414 minor moons (JPL Horizons / MPC H); J2-aware inner-moon
  orbits (Pan back in the Encke gap).
- UI/a11y: truthful staged loader; search ranking; Tab no longer hijacked (free flight on R); WCAG AA text contrast; 24-px
  minimum targets; hover-card and label-placement fixes.
- Performance: atmosphere LUTs and family shapes in Web Workers, predictive view preparation; scripted-route main-thread long
  tasks 12.5–18.1 s → 3.8–3.9 s (software WebGPU; real-GPU behaviour unverified).
- 310 tests.

## 3.7.0 — 2026-10-10 · ring systems, planetary atmospheres, image-only QA
Reports: `docs/SOL_V3.7_COMPLETE_DEVELOPMENT_REPORT.md`, `SOL_V3.7_RING_SYSTEM_RESEARCH_AND_IMPLEMENTATION.md`,
`SOL_V3.7_PLANETARY_ATMOSPHERES_AND_CLOUDS.md`, `SOL_V36_V37_MASTER_PROJECT_HANDOFF.md`, `requirements-matrix-v3.7.md`.
Evidence: software WebGPU only (hardware NOT TESTED).
- **Rings:** one optical-depth renderer for Saturn, Jupiter, Uranus (13 rings), Neptune (+ arcs), Chariklo, Haumea, Quaoar
  (`src/data/rings.ts`, `src/render/ringSystem.ts`); Saturn main rings from the measured Voyager 2 PPS 1-km profile; tiers
  R0–R4; lit/unlit/backlit photometry with macro + dust populations; ring τ shadows on every ringed planet; precise
  near-field patch; B-ring particle density fixed; labelled faint-ring enhancement; ring-region labels; inspector ring tables
  with fly-to-ring.
- **Atmospheres:** per-channel view transmittance (ATM-005); dedicated profiles for Venus (cloud deck at 70 km), Jupiter,
  Saturn, Uranus, Neptune (density-shifted shells), Pluto, Triton; Mercury and exosphere moons shell-less; plume module for
  Io and Enceladus; atmosphere taxonomy in the inspector.
- **Catalogue:** Chariklo added (SBDB full precision); Quaoar pole = ring pole.
- **Settings (additive):** `ringEnhance`, `ringLabels`, `plumes`.
- **QA:** golden37 + views37 (≈ 230 views incl. ordered sequences), ui37, per-image JSON metadata, `tools/qa/package37.py`.
- **Fixed during QA:** RING-001, RING-002b, RING-007, ATM-005, ATM-011 (see `docs/issues.md`).

## 3.6.0 — 2026-10-09 · atmospheres, high-detail terrain, close Sun, rendering integration
Full report: `docs/v3.6-changes-report.md`. Evidence: `docs/qa/v3.6/` (software WebGPU only; hardware NOT TESTED).
- **Atmospheres:** Hillaire 2020 / Bruneton 2017 LUTs (transmittance, multiple scattering), per-channel Mie albedo & g,
  Earth ozone layer, ground skylight; physical Mars dust (τ 0.5) and Titan haze presets (`docs/research/atmospheres-v3.6.md`).
  Titan is now an opaque orange haze globe; Mars has limb/horizon haze and sky-filled shadows; backlit limbs are metered.
- **Terrain:** reusable DEM tile pyramid (`tools/ingest/terrain_fetch.py`, `terrain_tiles.py`, `src/terrain/tiles.ts`):
  global 4–16 ppd + 118 m (Hadley, Tycho) and 200 m-class (Gale, Jezero, Candor, Olympus) regional tiles; streaming with
  byte budgets; screen-space-error refinement and cone culling; horizon-map cast shadows; patch-local float64 placement
  through the frame hierarchy (0.19 mm vs 265 mm). Monolithic `dem16.bin` grids and `src/terrain/dem.ts` removed.
- **Sun:** granule size distribution, exploding granules, network bright points, softer lanes.
- **Integration:** geometry LOD per detail tier for plain ellipsoids; terrain patch bounding-radius fix (holes near cube-face
  edges); terrain diagnostics (levels, placement, residency).
- **Settings:** `terrainBudgetMiB` (512), `multiScatter` (on) — additive keys, schema unchanged (8).
- **QA:** `tools/qa/scenarios/golden36.mjs` (surface sites with solar-elevation date search, per-view settings),
  `tools/qa/detail.py`, `?qa-tdbg=1` terrain lighting diagnostic.
- **Tests:** 252 → 267, all passing.


## 3.5.0 — 2026-10-09 · lighting, exposure, night sides, sky continuity, viewing modes
Full report: `docs/v3.5-changes-report.md`. Evidence: `docs/qa/v3.5/` (software WebGPU only).
- **Viewing modes** Scientific · Exploration (default) · Cinematic (`src/render/presentation.ts`, top-centre control, key V,
  palette commands, Settings → Graphics → Viewing mode). Presentation parameters only; interpolated; always labelled.
- **Exposure:** highlight-protected metering from measured map statistics (`texstats_hi.json`) × photometric peak — EXP-002
  fixed (Io 45 % → 0.001 % clipped pixels, Triton 47 % → 0 %); bounded night-side opening; eclipse metering kept.
- **Sky:** own dark-adapted exposure domain with physical veil re-coupling; star-removed, calibrated diffuse Milky Way
  (`milkyway_diffuse.jpg`, μ ≈ 21 mag arcsec⁻² band); star PSF highlight compression; unresolved worlds in the sky domain;
  **far-plane depth bug fixed** (stars were drawn over night-side discs).
- **Night sides:** physical planetshine (earthshine, Saturnshine, moonlight on Earth); labelled inspection light
  (Exploration/Cinematic only); calibrated Earth airglow.
- **Sun:** aperiodic PCG3D granulation hash (no more diagonal banding); per-mode disc exposure; AUD-07 claim withdrawn.
- **Fixes:** ring-particle slice leaking into other views; 67P coma boost at the nucleus (white frame).
- **Audit:** AUD-01 schema 8 + migration chain; AUD-02 camera accessors + invariant; AUD-03 residency streaming +
  named-star extract; AUD-04 LOD tiers drive atmosphere sampling / hi-res streaming / terrain switch; AUD-05 colour-truth
  labels; AUD-06 real assertions + nearest-rank percentiles; AUD-07 evidence metric.
- **Tools:** `tools/ingest/sky_diffuse.py`, `texstats_hi.py`, `named-rows.mjs`; `tools/qa/metrics.py`, `report.py`;
  golden views for night sides, terminators, backlit giants, Milky Way behind worlds, `MODE=` capture switch.
- **Tests:** 235 → 252, all passing.

## 3.4.0 — 2026-10-09

Built on the uploaded v3.3.0 ZIP (no Git metadata inside it; this release's history starts from an immutable import
commit tagged `v3.3.0-upload`). Baseline re-verified independently: `npm ci`, typecheck 0 errors, 219 tests = 218 pass +
1 documented todo (Neptune 2.44″ @ 2075), build OK, 107 assets / 31 non-commercial — all as the handoff reported.

**D1 — seven foundation contracts (thin layer, tested; no renderer rewrite)**
- `src/contracts/frames.ts` — hierarchical anchors (cosmic cell → Galactocentric → ICRS/SSB → ecliptic → system → body
  → body-fixed → ground patch), relative transforms via the lowest common ancestor, camera-relative hi/lo GPU payload,
  Hipparcos ICRS→Galactic matrix, documented Galactocentric convention (R☉ 8.122 kpc, z☉ 20.8 pc), distance-kind
  semantics (a cosmological distance must name its model).
- `src/contracts/astroObject.ts` — canonical object record (ids, aliases, source ids, class taxonomy from planets to
  galaxy clusters, per-property `Measured` values with evidence status), `placement()` (no reliable parallax → stays a
  2D sky source, never placed at random), `crossmatch()` (identifier first; binaries A/B never merged; parallax
  conflict → ambiguous).
- `src/contracts/catalog.ts` — `sol-catalog/2` shard manifest, sector bounds, `CatalogStream` (nearest-first, bounded
  concurrency, size + SHA-256 verification, abort, per-shard states, failures reported not hidden).
- `src/contracts/lod.ts` — D0–D5 detail tiers from apparent pixel radius with hysteresis; shown live in Diagnostics.
- `src/navigation/cameraState.ts` — camera mode state machine (orbit/follow/travel/free/surface/tour/galactic/
  cinematic), gesture interruption, history/back, rejected-transition log, device-loss safe state; the rig reports
  every transition into it.
- `src/contracts/evidence.ts` — evidence statuses (software-adapter results can only be `verified-software`), scene
  fixture / capture metadata types, frame statistics.
- UI state: new keys (`toneMap`, `prominences`, `ringParticles`) added to the existing schema 7 (they default when absent). *[Corrected in v3.5 (AUD-01): this line originally said the schema was "bumped"; it was not.]*
- 14 new contract tests (`tests/contracts/contracts.test.ts`): m→Mpc round trips, Moon 1 m locality vs the measured
  ≈0.6 m loss of an absolute Galactocentric float64 round-trip, Sun→Earth→Moon→Proxima→Sgr A*→M31→back route,
  crossmatch, placement, streaming order/checksum/missing/abort, LOD hysteresis, camera interruption/history.

**Data & science**
- **3D star catalogue now streams as 85 spatial sector shards** (50 pc cells + octant "outer" shards) through
  `CatalogStream`, nearest-first, each verified by SHA-256 (`tools/ingest/shard-stars.mjs`). Unloaded rows are
  invisible; named stars are registered only from verified shards.
- **ISSUE SCI-003 fixed** — secondary 1900–2200 JPL Horizons (DE441) barycentre tier for Jupiter–Neptune
  (`tools/ingest/planets-ext.mjs`, `planets-ext.bin`, 0.99 MB); sampled ephemerides now support several windows per
  body. Neptune 2075 residual 2.441″ → 0.080″; the known-deviation exemption was removed: **235/235 tests pass**.

**Assets & rights (AST-003)**
- 28 personal/non-commercial Steve Albers maps replaced by U.S.-public-domain USGS Astrogeology mosaics (Europa,
  Ganymede colour, Io colour, Enceladus, Tethys, Dione, Rhea, Iapetus, Triton colour, Pluto, Charon, Ceres, Vesta) and
  NASA/JPL PIA17214 (Mimas) via a reproducible ETL (`tools/ingest/usgs_mosaics.py`): MD5/SHA verified downloads,
  ISIS-label-driven longitude re-indexing, georeference cross-check, area-averaged resampling, inferred colour for
  greyscale sources clearly labelled, coverage reported, per-body provenance JSON. Non-commercial files: 31 → 3
  (Ariel, Titania, Oberon — no public-domain global mosaic found yet).
- **Georeference errors found in v3.3 and fixed by the replacement:** Vesta was 150° off (third-party map in the
  Dawn "Claudia" system while SOL's rotation model is IAU-2014 / Claudia-double-prime — verified with the Marcia
  crater group), Charon was 180° off (New Horizons' encounter hemisphere is centred on 0° longitude). Pluto, Charon and
  Triton now have explicit unobserved regions (23 %, 26 %, 33 %) rendered as labelled reconstructions instead of the
  invented fill the old maps contained.

**Sun (D2)**
- Active regions rebuilt: leader spot with filamentary penumbra, fragmented follower, pores, Joy's-law tilt, extended
  mottled plage/faculae that outlive the spots; per-granule brightness and rounder granules; display limb grade.
- Prominences (ISSUE SUN-006): simulated H-alpha population at the limb; physical brightness (≈4·10⁻⁶ of the disc)
  in the Scientific look, perceptually brighter in Natural/Cinematic, toggle in Settings → The Sun.
- **Tone mapping: Khronos PBR Neutral by default** (AgX selectable). Measured: AgX mapped the linear photosphere
  (0.68, 0.50, 0.31) to near-grey (187, 173, 156); it also flattened planet colour. Disc metering 0.21 → 0.25 and the
  Natural aureole 0.9 → 1.4. Visually unapproved by the owner; software adapter only.

**Rings (D5)**
- Saturn ring near-field slice (`src/render/ringParticles.ts`): within ~90 m of the ring plane, 0.2–5 m icy particles
  (n(a) ∝ a⁻³), number density from local optical depth, ±10 m thickness, Keplerian shear, Saturn shadow, seen as a
  co-orbiting observer; dithered fade, deterministic (no popping). No self-gravity wakes / collisions yet.

**UI**
- Settings: Tone mapping, Prominences, Ring particles. Diagnostics: camera state/history, LOD tier with reason,
  catalogue shard states, ring near-field state.

**QA**
- Golden scenes extended (all replaced-map bodies, Titan, close Pluto, two ring fly-through views). v3.3 and v3.4 builds
  captured with the same harness, epoch, camera and exposure settle; side-by-side comparisons in `docs/qa/v3.4/`.

## 3.3.0 — 2026-10-08

**Owner defects addressed**
- *Orbit/axis lines vibrate* — root cause measured (float32 vertices × float32 translation at heliocentric magnitudes, 256–512 km quantisation at 30 AU). Guides now use relative-to-eye hi/lo float pairs; sub-pixel strokes no longer strobe; per-orbit opacity eases instead of popping. (R-019, `tests/render/precision.test.ts`)
- *Guide clutter* — five guide modes (Clean default · Focused · Solar System · Scientific · Everything); clean shows only the selection, plus faint planetary context seen from outside; scientific adds nodes/apsides, spin axis + equator, ephemeris trajectory and ecliptic; legend in the Guides panel. (`src/render/guides.ts`)
- *Immature close/mid Sun* — new photosphere (evolving granulation, mesogranulation, supergranular network, bipolar active regions with penumbral filaments, limb faculae, differential rotation, footprint band-limiting), re-metered exposure so the disc reads at ≈1× white from ~40 px, camera glare fades as the disc fills the view, three display looks. (R-020)
- *Objects look alike* — BodyVisualProfile registry (tiers A–D, literature basis), 7 shape families and 8 surface families seeded by canonical id; 21 featured bodies moved off the shared 7-lobe/26-crater recipe. (R-021)
- *UI not premium* — interface rebuilt as a coherent system: new tokens/typography, top bar with Universe › Milky Way › Solar System breadcrumb, Atlas with filters and tier badges, Inspector with evidence badges and an Evidence tab, timeline with UTC/TT/TDB and ephemeris-validity indicator, guide dock, Journeys (6 guided tours, persisted bookmarks, recent, back/home), searchable Settings (Graphics, Sun, Scene, Guides, Camera, Time, Accessibility, Credits), first-run coach marks, UI scale / high contrast / reduced motion, keyboard paths for every action.

**Also**
- glTF import keeps every mesh primitive and reports UV/normal/texture content.
- Labels no longer draw across nearer resolved bodies.
- Per-asset provenance/licence manifest with CI check; removed a byte-duplicate font file.
- Settings schema v7 with migration from v6.
- 33 new tests (218 pass, 1 documented todo).

**Final visual QA pass (2026-10-09)** — defects found in software-WebGPU captures and fixed:
- Close Sun read as a flat beige disc: disc metering lowered from ≈1.35× to ≈0.96× display white so AgX no longer compresses the limb-darkening gradient; aureole strength natural 0.5→0.9, cinematic 1→2.2; cinematic contrast 1.18→1.3. Radiometry and the Baumbach corona are unchanged.
- Granulation tiled into a regular woven pattern at the limb: Worley field domain-warped (≈±0.35 cell). A first attempt that also rescaled the field about the Sun's centre produced swirl moiré and was removed.
- Small bodies too white / alike: exposure compensation for albedo reduced (exponent 0.4→0.25) and metering raised 0.20→0.26, so dark bodies keep more of their real darkness (Ryugu, pv≈0.045, median 169→144 of 255 in the same view).
- Resolved planets 15–30 px across clipped and bloomed into a large brown halo (Saturn system view at 3 million km): disc metering ramp now smooth(1.5, 28) px instead of smooth(2, 90).
- Saturn's outer ring edge showed a saturated blue band from un-premultiplying near-zero alpha: clamped and faded to neutral.

## 3.2.0 and earlier

- 4af4629 2026-10-08 Fixes and overlays: exposure NaN, bloom/exposure tuning, orbit landmarks and trajectories, unobserved-terrain masks, QA compare tool, docs and RTX 3050 guide
- ee17424 2026-10-08 Phase 7/8 S1: 3D star catalogue (GCNS + Hipparcos) with live parallax and navigable named stars
- ecf2eb9 2026-10-08 Phase 4a: LOLA/MOLA DEM terrain quadtree for Moon and Mars with ground clamp
- 5aaec3c 2026-10-08 Phase 1b: physical solar corona and chromosphere, eclipse metering
- 74e174d 2026-10-08 Docs: README rewrite, R&D ledger, issue tracker, requirements matrix, science notes, benchmark protocol, inventories
- e9ed7db 2026-10-08 QA: assertion tests, Horizons fixtures, software-WebGPU browser harness, compute bisect pages, inventory and ingest tools
- 3c12ae4 2026-10-08 Phase 1/2 render: Sun point-source crossfade and exposure, bloom clamp, adaptive orbit conics with exact phase, orbit clutter control, wire Geographos/Golevka/Mithra models, spin-axis placeholder labels
- 2c6e471 2026-10-08 Phase 1: native-WebGPU gate, staged boot, texture residency store, device-loss screen, interruptible camera, diagnostics, reduced motion, settings schema
- 09d1819 2026-10-08 Phase 0/2: assertion test suite, Horizons fixtures, sampled ephemeris tier, full-precision SBDB, precession & time-scale fixes
- f160cd7 2026-10-08 baseline: original sol-solar-system.zip
