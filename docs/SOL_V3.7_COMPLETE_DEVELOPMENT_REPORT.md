# SOL_V3.7_COMPLETE_DEVELOPMENT_REPORT

Report date 2026-10-10. Base: v3.6.0 (tag `v3.6.0`, branch `v3.6`). Work branch `v3.7`. Renderer evidence: **software WebGPU
only** (Chromium 154 + SwiftShader). Read with: ring report, atmosphere report, master handoff, requirements matrix,
image index. Version string: **3.7.0**.

## 0. Summary of what actually changed in the running application
1. **Rings for every ring-bearing body** (Saturn, Jupiter, Uranus, Neptune, Chariklo, Haumea, Quaoar) from one optical-depth
   renderer with per-system particle physics; Saturn's main rings from the **measured Voyager PPS 1-km profile**.
2. **Per-channel atmospheric transmittance** (ATM-005 fixed): surfaces behind atmospheres keep their colour.
3. **Dedicated atmosphere profiles for all eight planets and the relevant moons/dwarfs**: Venus cloud-deck shell, giant and
   ice-giant stratosphere shells (density-shifted over observed maps), Uranus ≠ Neptune (methane/haze), Pluto & Triton hazes,
   Mercury and exosphere moons correctly shell-less; new plume module (Io, Enceladus).
4. **Saturn near field** at the measured τ (B-ring cap 24k → 65k), smoother icy particles.
5. **UI**: ring & atmosphere sections in the inspector (component tables with sources/status; click a ring to fly above it),
   ring-region label overlay, faint-ring enhancement switch, plume switch, mode-badge labels for every enhancement.
6. **QA**: golden37 harness (body-frame cameras, Sun-relative placement, eclipse geometry, per-view mode, date offsets),
   UI capture scenario, per-image JSON metadata, ordered frame sequences (ring LOD, ring-plane traversal, Neptune arcs,
   rotation, terminator sweep, Hadley/Jezero descents).

## 1. System-by-system (spec §40 items 1–15)
### 1.1 Planetary rings
1. *Previous*: Saturn art-texture alpha as opacity; Jupiter/Uranus/Neptune 1-D texel profiles (Uranus' 2-km rings smeared
   invisible; Neptune arcs absent); no small-body rings; B-ring near-field at ≈ 55 % of its τ.
2. *Intended*: SpaceEngine-class, scientifically differentiated rings for all ringed bodies; tiers R0–R5.
3–4. *Research & sources*: NSSDCA ring fact sheets (Saturn 2022, others 2015); PDS Ring-Moon Systems Node VG_2801 (Voyager PPS);
   Braga-Ribas 2014, Morgado 2021 (Chariklo); Ortiz 2017 (Haumea); Morgado 2023, Pereira 2023, Proudfoot 2025 (Quaoar);
   Dumas 1999, de Pater 2005/2018 (Neptune arcs); de Pater 2006, Showalter & Lissauer 2006 (Uranus ν, μ); Cuzzi et al.
   (ring photometry). Full list and the coverage audit: ring report §1–3.
5. *Architecture*: `src/data/rings.ts` (catalogue), `src/render/ringSystem.ts` (WGSL `ringCore`/`ringShade`/`rowLerp`,
   `ringPlanetShadow`), engine tiers R0–R4 (`ringState`, `ringDiag`), `flyToRing`, `ringLabelAnchors`, planet shadow texture.
6. *Code/shader changes*: new modules above; `planetMaterial.ts` ring shadow e^{−τ/|l_z|}; `ringParticles.ts` cap/shading;
   old `src/render/rings.ts` removed.
7. *Assets*: `public/assets/rings/saturn_tau_pps_1km.u16` (+ `rings.json`), NASA/PDS public domain, via
   `tools/ingest/rings_profiles.py`. Saturn colour from the existing CC BY 4.0 art map, CPU-smoothed over 300 km, chroma only.
8. *Assumptions*: single-scattering slab + two-stream multiple-scattering factor (APPROXIMATE); HG phase lobes per population;
   circular equatorial rings; arcs at representative longitudes; small-body particle albedos inferred.
9. *Visual effects*: lit/unlit faces, backlit dust, eclipse glow, edge-on opacity, planet shadow on rings, ring shadow on the
   planet, narrow rings sharp at any zoom, region labels.
10. *Tests*: `tests/render/rings.test.ts` (10).
11. *QA evidence*: `SOL_V37_RING_SYSTEM_IMAGES.zip` (spec §33 matrix; see image index for every file).
12. *Bugs fixed during v3.7*: TSL `atan2` → `atan` (shader build failure); profile LOD texture 8198 px > 8192 limit
    (validation error) → 9-km level; Saturn rings dark (unlit face shown) → Sun-side camera placement in the harness;
    blue outer-edge chroma from low-alpha texels; purple/green fringes in close views → smoothed colour; 9-km blocks at
    grazing angles → manual linear filtering; cratered-rock look of near-field particles → smooth icy impostors.
13. *Missing*: R5 volumetric rings, wakes, spokes, eccentric/inclined rings, halo thickness, Saturnshine on rings.
14. *Performance limits*: not measured on GPUs; fragment cost bounded by construction.
15. *Next dependencies*: hardware run; volumetric prototype; dated arc longitudes.

### 1.2 Planetary atmospheres, clouds, plumes
1. *Previous*: v3.6 LUT atmospheres for Earth/Mars/Titan only; giants with legacy colour presets; grey-alpha compositing.
2. *Intended*: appropriate representation for every planet and relevant moon, no false shells.
3–4. *Sources*: atmosphere report §2 (NASA fact sheets, Irwin et al. 2024, Gladstone 2016, Cheng 2017, Pollack 1990, Porco
   2006/2014, Voyager/Galileo/New Horizons plume heights, Wolff 2009/2010, Lemmon 2015, Tomasko 2008).
5. *Architecture*: `viewTransmittance` (WGSL) + inscatter-only compositing over discs; `densityShiftH`; `cloudTopKm`;
   `src/data/atmospheres.ts`; `src/render/plumes.ts`.
6. *Code*: `atmosphere.ts`, `planetMaterial.ts`, `atmoModel.ts`, `catalog.ts`, `engine.ts`, `ui.ts`.
7. *Assets*: none new (parameters only).
8. *Assumptions*: channel-averaged coefficients; giant shells start 2 H above 1 bar; single smooth haze layers.
9. *Effects*: red Mars through dust and a visible polar cap; Titan opaque; Venus limb haze; ice-giant limbs; Pluto/Triton
   backlit haze rings; backlit Enceladus jets; Io umbrella plumes.
10. *Tests*: `tests/render/atmospheres37.test.ts` (9) + v3.6 `atmosphere.test.ts` (7).
11. *Evidence*: `SOL_V37_ATMOSPHERE_IMAGES.zip`.
12. *Bugs fixed*: ATM-005.
13. *Missing*: volumetric clouds anywhere, weather, Mars clouds/storms/seasons, giant-planet cloud layers, storms beyond maps,
    Pluto's multiple haze layers, aurorae, lightning.
14–15. LUT builds still on the main thread; next: worker offload, Earth volumetric cloud prototype with shadows.

### 1.3 Terrain and seamless exploration (spec §24–25)
v3.7 did **not** add new terrain data or a walking/collision mode. It adds evidence: ordered descent sequences at Hadley
Rille and Jezero (400 km → 0.4 km; reversed order = return to orbit), ground-adjacent and low-Sun views, all with terrain
LOD/residency metadata. Status: Partial (see matrix §E). Next: HiRISE/LROC NAC DEM + imagery for the two showcase sites.

### 1.4 Sun, celestial-body graphics, sky (spec §26–28)
No new Sun or Milky Way work in v3.7 beyond preservation (v3.6 granulation, v3.5 sky). Chariklo added as a catalogue body
(JPL SBDB full-precision elements, tri-axial shape, pole); Quaoar pole corrected to its ring pole. The Milky Way remains a
2-D panorama and is **not** the 3-D Galaxy.

### 1.5 UI/UX (spec §29)
Inspector Physical tab gains "Atmosphere · class" rows and a "Ring system" component table (radius, width, τ, data status,
source tooltip); a row click flies the camera above that ring (`Rig.flyToPoint`). Settings → Graphics → "Rings &
atmospheres (v3.7)": faint-ring enhancement, ring-region labels, plumes, multiple scattering. Mode badge lists every active
enhancement (ring gain, plume gain, inspection light, sky exposure). Labels are off by default (no clutter).

### 1.6 Interstellar demonstration (spec §0 item 10)
**Not attempted.** Prerequisites (parsec-scale frame hierarchy, Gaia streaming, P7/P8) are not in place; doing a fake
"fly to a star" would violate the true-scale/precision rules. Recorded in the roadmap.

## 2. Verification
Executed on the final v3.7 tree (2026-10-10):
```
npx tsc --noEmit -p .          → 0 errors
node tools/run-tests.mjs       → 286 tests, 286 pass, 0 fail   (v3.6: 267; +10 rings, +9 atmospheres37)
node tools/validate/assets.mjs → assets 1510 · unmatched 0 · exact duplicates 0 · non-commercial 3
npx vite build                 → OK
```


Matched v3.6.0 → v3.7.0 comparison (14 identical views, `v3.6-vs-v3.7-matched.jpg`), honest reading:
* **Large change:** Saturn close views (v3.6 art-texture alpha with rainbow/purple fringing → measured-τ rings, neutral icy
  chroma; Cassini Division and fine ringlets from data); Saturn overview (A/B/C contrast now follows τ, Cassini Division
  dark on the lit face); Jupiter backlit (v3.6: nothing visible → forward-scattering dust ring, enhanced ×200 and labelled);
  Uranus (rings now visible; ice-giant shell gives a more saturated cyan limb); Saturn near field (brighter, smooth icy
  particles at the measured density).
* **Small change:** Mars day/pole (ATM-005 per-channel transmittance — visible only as slightly redder limbs; the polar cap
  is similar); Venus day; Neptune; Titan (unchanged by design).
* **Regressions / problems found:** Venus terminator exposure (ATM-011, open); Jupiter backlit rings saturate to white near
  the ansae at ×200 in Exploration (Scientific mode is physical and dark); Io plumes nearly invisible at the limb (ATM-012).

### 2.1 Clean-extract verification
`git archive` of tag `v3.7.0` (no node_modules, dist, .git, raw ingest inputs), extracted into an empty directory:
```
npm ci OK · typecheck OK (0 errors) · tests 286 / pass 286 / fail 0
assets 1510 · unmatched 0 · exact duplicates 0 · non-commercial 3 · build OK (dist 332 MB)
```
ZIP ≈ 424 MB. Git: branch `v3.7`, tag `v3.7.0` on top of `v3.6.0`.

## 3. Image evidence (no video, per spec §30)
Seven archives in `files/review/` (see `SOL_V37_IMAGE_INDEX.md` for every file, its view request and metadata):
`SOL_V36_VISUAL_QA_IMAGES.zip`, `SOL_V37_RING_SYSTEM_IMAGES.zip`, `SOL_V37_ATMOSPHERE_IMAGES.zip`,
`SOL_V37_TERRAIN_AND_EXPLORATION_IMAGES.zip`, `SOL_V37_UI_AND_GENERAL_IMAGES.zip`, `SOL_V36_V37_BEFORE_AFTER_COMPARISONS.zip`,
`SOL_V37_DIAGNOSTIC_AND_SEQUENCE_FRAMES.zip`. Native capture resolution 1600×900 (SwiftShader); no upscaling. Still frames do
not prove real-time smoothness or hardware FPS.

## 4. Honest limitations
* Software rendering only; real-GPU look, frame time, VRAM, temporal stability unverified.
* Several acceptance gates of spec §48 are only partially met: terrain (no new data), seamless navigation (no walking mode),
  advanced volumetrics (none), interstellar travel (none). Rings and atmosphere tiers for all planets are met in software.
* No claim of SpaceEngine parity.
