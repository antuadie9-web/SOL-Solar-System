# SOL v3.8 — a true-scale WebGPU atlas of the Solar System and the solar neighbourhood (→ Milky Way, in progress)

A physically based, **native-WebGPU-only** exploration of the Solar System at true scale: real body radii and
positions in kilometres, double-precision camera-relative rendering, measured ephemerides where SOL has them and
clearly labelled models where it does not. Built for **desktop Google Chrome** with hardware acceleration.
There is intentionally no WebGL/WebGL2 path — the renderer's automatic WebGL2 fallback is removed and the live backend
is asserted at start-up.

**Version 3.8.0** — *Stellar Bridge, Solar Rendering, Visual Identity, UI/UX & Performance*. Consolidates the v3.7.1
corrections (Venus terminator metering root cause, geometry-aware ring and plume enhancement, Uranian eccentric rings,
minor-moon identity) with v3.8: continuous far-Sun regimes (no more invisible Sun beyond 1 ly), Gaia DR3 refinement of the
20-pc neighbourhood and a real Earth → Proxima Centauri → Earth journey with in-flight catalogue streaming, Gaia G → Johnson V
photometry, a cited parametric Milky Way model with a Galactic context card (M) and deep-sky reference markers, size-dependent
small-body geology, JPL/MPC sizes for 414 minor moons, observed shapes for Itokawa and Phoebe, worker-based LUT/shape builds
(travel long tasks 18.1 s → ≈ 3.4 s on the scripted route), a truthful staged loader and accessibility fixes. Reports:
`docs/reports/v3.8/` (Markdown + PDF). Evidence is from software WebGPU; real-GPU look and performance remain **unverified**.

**Version 3.5.0** — lighting & visibility milestone. Three viewing modes on the same physical scene — **Scientific**
(one physical camera), **Exploration** (default: the night sky on its own calibrated dark-adapted exposure, highlight-
protected metering, labelled night-side inspection light) and **Cinematic** (art-directed grade). Physical planetshine
and Earth airglow; a star-removed, surface-brightness-calibrated diffuse Milky Way; a far-plane depth fix (stars were
drawn over night-side discs); EXP-002 clipping fixed; aperiodic solar granulation; all seven v3.4 audit defects (AUD-01…07)
addressed; 252/252 tests. See `docs/v3.5-changes-report.md`, `docs/requirements-matrix-v3.5.md`, `docs/qa/v3.5/README.md`.
Visual evidence is from a software WebGPU adapter; real-GPU look, motion and performance remain **pending hardware**.

**Version 3.4.0** — seven tested foundation contracts (hierarchical frames/units, object schema + crossmatch, catalogue shards + verified streaming, detail tiers, camera state machine, quality evidence); 28 of 31 non-commercial moon maps replaced by public-domain USGS/NASA mosaics (fixing a 150° Vesta and a 180° Charon misregistration); Neptune ephemeris deviation fixed (235/235 tests); hero-Sun active regions and prominences; Neutral tone mapping; a Saturn ring near-field particle slice. See `docs/CHANGELOG.md`, `docs/requirements-matrix-v3.4.md`, `docs/qa/v3.4/README.md`.

**Version 3.3.0** — the owner-reported defects of v3.2 are addressed in code: a rebuilt hero Sun, stable (relative-to-eye)
and decluttered orbit/axis guides with five modes, family-based visual identity for featured small bodies and dwarf
planets with evidence tiers, and a completely redesigned interface. See `docs/CHANGELOG.md`,
`docs/requirements-matrix-v3.3.md`, `docs/coverage.md` and `docs/issues.md`. Visual results are verified with a software
WebGPU adapter only; real-GPU look and performance are **not yet tested** (`docs/qa/v3.3/README.md`).
Galaxy model, Gaia bulk streaming, DSOs, exoplanets and the universe stages remain queued phases, not features.
Benchmark on your own GPU: `docs/qa/RTX3050-guide.md`.

## Run it

```bash
# Node.js 20+
npm ci
npm run dev            # http://localhost:5173
npm run check          # typecheck + asset-licence check + full test suite (310 tests in v3.8.0) + production build
npm run build && npm run preview    # serves dist/ on http://localhost:4173
```

If you see “WebGPU is not available” or “Software WebGPU adapter refused”: update Chrome, open `chrome://gpu`, confirm
*WebGPU: Hardware accelerated*, and enable *Use graphics acceleration when available*.

## Controls

| Input | Action |
|---|---|
| Left drag | Orbit the target (cancels a travel animation) |
| Right drag | Look around |
| Scroll | Zoom (logarithmic, down to the surface; cancels a travel animation) |
| Click / double-click | Select / travel |
| Ctrl/⌘ K | Search objects, tours and commands |
| Space · [ · ] · \ · Backspace | Pause · slower · faster · reverse · back to now |
| R | Free flight (WASD, Q/E, Shift boost) — v3.8: Tab now moves keyboard focus |
| M | Galactic context (model map) |
| 0–8 | Sun, Mercury … Neptune |
| N · G · J · , · ? | Atlas · guides & layers · journeys & bookmarks · settings · controls |
| V · Shift+V | Next / previous viewing mode (Scientific · Exploration · Cinematic) |
| O · L · C · H · P · B · U · Home | Guides on/off · labels · constellations · hide UI · capture · bookmark · back · Earth |

Settings → Graphics → *Diagnostics overlay* shows the WebGPU adapter, frame-time percentiles, estimated texture
residency and network activity. Settings → Camera → *Reduced motion* shortens travel animations (follows the OS
preference by default).

## What is modelled — and how accurately

Positions (details and measured residuals: `docs/science/ephemeris-tiers.md`, `docs/qa/ephemeris-residuals.json`):
- **2000–2050:** JPL Horizons state vectors for the planets, 24 major moons, the Pluto system and three comets,
  interpolated; tested against Horizons at off-grid epochs (planets ≤ 2.5 km; moons ≤ 10⁻³ of their orbital radius).
- **Outside that window:** VSOP87B planets, ELP/MPP02 Moon (rigorously precessed to J2000), Lieske E5 Galilean moons,
  two-body extrapolation for the other sampled bodies — labelled as such in the inspector.
- **Other moons:** two-body motion from Horizons osculating states at 2026-10-08 (accuracy degrades away from that date).
- **Asteroids, dwarf planets, comets:** JPL SBDB full-precision osculating elements, two-body (no perturbations, no
  non-gravitational forces). The 94,523 background points use rounded elements and are a visual layer (≈10⁵ km).

Time: TT simulation clock, TDB for ephemerides, UTC display via the IERS leap-second table (TAI−UTC = 37 s since 2017;
future leap seconds after mid-2027 unknown), ΔT model before 1972, UT1≈UTC for Earth rotation.

Rotation: IAU WGCCRE 2015 models where available; moons without a model are *assumed* synchronous and objects whose
spin axis SOL does not know are labelled as placeholders.

Rendering (unchanged from v3 except where noted): limb-darkened, granulated Sun that now stays visible at any distance
as a flux-conserving point source; single-scattering atmospheres; analytic eclipse shadows; Saturn rings from a
Cassini-derived radial profile; DEM-derived normal maps for Earth, Moon and Mars; NASA/ESA shape models for Phobos,
Deimos, Vesta, Eros, Bennu, Arrokoth, 67P, Toutatis, Kleopatra, Geographos, Golevka and Mithra; procedural shapes
elsewhere (not observations). Surface maps stream in when a world is first resolved; full-resolution maps load under
an estimated GPU-memory budget with least-recently-used eviction.

New in 3.2: physically scaled solar corona (Baumbach profile, ≈10⁻⁶ of the disc — visible in eclipses; streamer
structure simulated), eclipse-aware exposure, ephemeris trajectories and periapsis/apoapsis/node markers, Moon and Mars
relief from LOLA/MOLA altimetry below ~1.6 radii, labelled reconstructions for the never-imaged hemispheres of Ariel,
Titania and Oberon, and a 3D star layer (Gaia Catalogue of Nearby Stars < 100 pc + Hipparcos bright stars) whose
brightness and parallax change as you fly between stars; 157 named stars are travel targets.

Data rebuild (offline, deterministic, v3.5): `python3 tools/ingest/sky_diffuse.py`, `python3 tools/ingest/texstats_hi.py`, `node tools/ingest/named-rows.mjs`, `node tools/validate/assets.mjs`.
Visual QA (v3.5): `MODE=exploration VIEWS=io,earth-night node tools/qa/smoke.mjs --software --url 'http://localhost:4173/?qa-off=small,smallcompute' --script golden --out qa-out` then `python3 tools/qa/metrics.py qa-out`.

Data rebuild (optional, network): `npm run ingest:planets-ext`, `npm run ingest:shards`, `python3 tools/ingest/usgs_mosaics.py --raw <dir with the USGS .tif/.lbl/.md5 files>` (URLs in `docs/assets/provenance/*.json`).

What SOL does **not** yet have: metre-scale terrain or landing, volumetric rings, a 3D Milky Way model (the distant
sky is still a 2D panorama — now star-removed and calibrated — not the navigable Galaxy), Gaia beyond 100 pc, nebulae, exoplanets, resolved stellar surfaces. Planned phases, not features.

## Project layout

```
src/astro     ephemerides (sampled tier, VSOP87, ELP, E5, two-body), time scales, frames, precession, rotation
src/core      WebGPU gate, asset fetching, texture residency, settings, clock
src/contracts precision (hi/lo float) and unit contracts
src/render    WebGPU engine, TSL/WGSL materials, Sun, guides policy, visual-identity profiles, shape families, camera
src/ui        interface (ui.ts), design system (styles.css), formatting, persisted bookmarks, tours
src/data      body catalogue & events
public/assets textures, shape models, catalogues, data/ephem (Horizons samples + manifest with SHA-256)
tools/ingest  reproducible data ETL (Horizons, SBDB)      tools/validate  inventory      tools/qa  browser harness
tests/        astro, render, ui and asset tests + fixtures  docs/          ledger, issues, requirements, coverage, assets, QA
```

See `CREDITS.md` for imagery licences (some imagery is restricted to personal/non-commercial use).
