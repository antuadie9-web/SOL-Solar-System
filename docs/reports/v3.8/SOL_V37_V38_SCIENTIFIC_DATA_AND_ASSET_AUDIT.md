---
title: "SOL v3.7–v3.8 — Scientific Data and Asset Audit"
subtitle: "Inventory, sources, licences, resolutions, coordinate conventions, epochs, processing, uncertainties, and what is observed vs reconstructed"
date: "2026-10-11"
---

# 1. Asset inventory (shipped runtime files)

`npm run assets` (tools/validate/assets.mjs) checks every file under `public/` against a provenance rule and records the
file's size, SHA-256, licence, commercial status, attribution, coverage and truth label. These go into
`docs/assets/asset-manifest.json`. Final release check: **1,513 assets, 0 unmatched, 0 exact duplicates, 3 non-commercial**.

| Group | Files | Size | Main sources |
|---|---|---|---|
| `assets/terrain` | 1,314 | 109.0 MB | LOLA/LRO + SELENE (Moon 118 m), MOLA/HRSC (Mars 231 m) tile pyramids |
| `assets/tex` | 66 | 160.7 MB | USGS Astrogeology controlled mosaics, NASA/JPL, Solar System Scope (CC BY 4.0), ESA Gaia sky |
| `assets/data` | 23 | 41.4 MB | JPL Horizons sampled ephemerides, satellite elements and osculating states, JPL SBDB small bodies |
| `assets/models` | 14 | 17.3 MB | NASA 3D Resources, radar shape models, PDS SBN Gaskell models (Itokawa, Phoebe) |
| `assets/catalogs` | 90 | 13.5 MB | GCNS (Gaia EDR3/DR3) + Hipparcos-2 — 85 SHA-256-verified sector shards + named-star rows |
| `assets/rings` | 2 | 0.1 MB | Voyager 2 PPS δ Sco occultation (PDS Ring-Moon Systems Node) |
| fonts | 4 | 0.1 MB | SIL OFL 1.1 |

**Licences** (file counts):

| Licence | Files |
|---|---|
| Public domain (USGS/NASA/JPL/PDS) | ≈ 1,380 |
| Gaia CC BY-SA 3.0 IGO plus Hipparcos (ESA, credit) | 90 |
| CC BY 4.0 | 17 |
| CC BY-SA 4.0 | 2 |
| SIL OFL | 4 |
| Personal / non-commercial | 3 (`ariel.jpg`, `oberon.jpg`, `titania.jpg`) |

The three non-commercial Uranian-moon maps are the only ones left from the original 31 (AST-003). Replacing them needs
USGS-controlled Voyager mosaics at an equivalent resolution, which are not in this repository.

**Truth labels** (file counts):

| Truth label | Files |
|---|---|
| observed altimetry | 1,314 |
| observed positions with derived distances | 90 |
| observed luminance with inferred colour | 20 |
| observed plus artistically completed (giants, representative) | 17 |
| observed radar or stereo shapes | 11 + 2 |
| derived ephemerides | 10 |

# 2. Data added or changed in v3.7.1 / v3.8

| Dataset | File(s) | Source & processing | Epoch / frame | Uncertainty | Status |
|---|---|---|---|---|---|
| Gaia DR3 nearby refinement | `catalogs/stars/shards/*`, `named-rows.*`, `docs/inventory/gaia-nearby-refinement-v38.csv`, query `tools/ingest/queries/gaia_dr3_parallax_gt50mas.csv` | ADQL on gaiadr3.gaia_source (ϖ > 50 mas, ϖ/σ > 10); 2,534 GCNS rows re-placed from DR3 parallax (GCNS distances quantised at 0.01 pc) | J2016.0, ICRS → ecliptic J2000 | σd/d per row | OBSERVED / DERIVED |
| Nearby navigable stars | `catalogs/stars/named.json` | 9 additional named stars incl. Proxima (1.30197 pc) | J2016.0 | per row | OBSERVED |
| Photometric band (DEF-38-013) | `src/galaxy/photometry.ts` | Rows are Gaia G (Hipparcos Hp for Hipparcos-only rows); converted to Johnson V by Riello et al. 2021 Table C.2 (σ 0.030 mag); BP−RP recovered from the ingest's Teff fit | — | ±0.03 (relation) + Teff-fit scatter; Proxima −0.04 vs SIMBAD | DERIVED |
| Uranian eccentric rings | `src/data/rings.ts` | French et al. 1988 (PDS kit `ura_rings` elements), B1950 node | epoch 1977-03-10 (French 1988) | per element | MEASURED |
| Saturn ring colour | `tex/saturn_ring_colour_1024.rgba` | box-smoothed (~300 km) from `saturn_ring.png` by `tools/ingest/ring_colour_smooth.py` | — | colour only (τ from PPS) | DERIVED |
| Itokawa / Phoebe shapes | `models/itokawa.glb`, `models/phoebe.glb` | Gaskell 2008 / 2012 ver64q plate models (PDS SBN), body-fixed km preserved; `tools/ingest/pds_shape_to_glb.py` | body-fixed | per model | OBSERVED shape |
| Minor-moon properties | `src/data/smallMoons.ts`, `docs/inventory/moons-v371.json` | measured triaxial dimensions, pV, colour indices, rotation for ≈ 36 moons (Thomas 1998; Thomas & Helfenstein 2020; Verbiscer 2018; Grav 2015; Karkoschka 2001/03; Weaver 2016), class priors otherwise | — | per source | MEASURED / REPRESENTATIVE |
| Minor-moon sizes (DEF-38-008) | `src/data/satSizes.json`, `tools/ingest/sat_sizes.py`, inputs in `tools/ingest/queries/satsize/` | JPL Horizons object data (459 of 460 NAIF codes fetched 2026-10-11: radius and V(1,0) where JPL publishes them); otherwise MPC absolute magnitude H (Wikipedia moon lists, whose H column cites MPC-NatSats); radius = 1329 km/√pV·10^(−H/5)/2 with the moon's own pV | — | H ±0.2–0.5; albedo prior factor ~2 → size ±40 % | ESTIMATED (labelled in the inspector) |
| Inner-moon orbits (DEF-38-009) | `src/astro/system.ts` | JPL mean elements (Laplace frame, apsidal/nodal precession) with the mean longitude anchored to the Horizons state at its epoch, for moons inside 10 planetary radii | Horizons epoch | phase as Horizons; radius = geometric a | DERIVED |
| Milky Way model | `src/galaxy/milkyWayModel.ts` | Reid et al. 2019 arms; Bland-Hawthorn & Gerhard 2016 discs and bar; Drimmel & Spergel 2001 dust; GRAVITY 2018/2019 R0 and Sgr A* | Galactocentric (Astropy v4.0 conventions: R0 8.122 kpc, z☉ 20.8 pc) | per parameter (σ in file) | INFERRED (model) |
| Deep-sky reference objects | `src/data/deepSky.ts` | 9 objects, ICRS centre, distance with citation, evidence class | ICRS | per object | OBSERVED position; NOT rendered |

**What the new data looks like in the renderer** (final build, software WebGPU):

![Minor moons with measured or JPL/MPC-estimated sizes and measured or class-prior albedo and colour (same view template, 3.4 R, 25° phase). Phoebe uses the observed Gaskell shape; Sycorax and Kiviuq are now drawn at their H-derived sizes, where v3.7.0 had 2.5 km placeholders.](img/moons-final-grid.jpg)

![Pan before and after the J2 inner-moon orbit correction (Pan was 500 km outside the Encke gap, so the A ring showed through it).](img/pair-pan.jpg)

![Gaia DR3 nearby-star positions in use: the α Centauri field from the Sun and from 0.3 pc sideways (true 3-D positions, parallax-derived distances).](img/gal-parallax.jpg)

![Uranus with the French et al. (1988) eccentric ring elements; ε ring close-up.](img/uranus-final.jpg)

# 3. Coordinate conventions and epochs

* **Solar-System frame.** Heliocentric ecliptic J2000, in km, held in float64 on the CPU. Rendering is camera-relative in
  float32.
* **Transforms.** ICRS ↔ ecliptic uses the IAU 2006 obliquity at J2000. ICRS → Galactic uses the Hipparcos (ESA 1997)
  rotation matrix. Galactocentric follows Astropy v4.0 conventions (no roll). All are in `src/contracts/frames.ts`, with tests:
  Sgr A* maps to l = 359.94°, b = −0.05°, and the NGP maps to b = 90°.
* **Stars.** Positions are given at J2016.0. Linear space motion uses proper motion, plus radial velocity where one exists
  (flag bit 0); otherwise motion is tangential only, and this is labelled.
* **Time.** The simulation clock is TT; the UI shows UTC, TT or TDB. Horizons fixtures are TDB, and TDB − TT is under 2 ms.

# 4. Observed versus reconstructed (evidence tiers)

* **O1, observed.** Planets and major moons use controlled global mosaics. Moon and Mars terrain uses altimetry. Itokawa,
  Phoebe and the NASA 3D Resources bodies use their shape models.
* **O2, partial.** Some maps have no data in places (noData masks are flagged, not filled as terrain). The Uranian moons'
  southern hemispheres were Voyager-only.
* **O3, sparse.** About 36 small moons have measured dimensions, albedo and colour. Their surface detail is a deterministic
  reconstruction, labelled REPRESENTATIVE.
* **O4, unresolved.** About 420 minor moons and the TNOs, rendered as class-prior families. Their sizes are ESTIMATED from H.
* **Galaxy.** A model only; the sky background is the observed 2-D Gaia panorama.

# 5. Validation performed

* **Ephemerides.** Horizons fixtures (`tests/astro/ephemeris.test.ts`), with tolerances fixed before comparison. The new
  inner-moon test keeps Pan inside the Encke gap and Daphnis inside the Keeler gap over 2020–2032.
* **Rings.** Uranian apsidal precession matches the J2 secular rate to < 3 %. Saturn's PPS regional τ is checked.
* **Photometry.**
  * Sun-like G − V = −0.15.
  * Proxima M_V = 15.6 against SIMBAD's 15.56.
* **Sizes.**
  * Sycorax 50–90 km radius (Herschel D = 165 ± 36 km, Lellouch et al. 2013; H = 8.2 at pV = 0.065 gives r ≈ 60 km).
  * Siarnaq 12–25 km; Thrymr 2–6 km; Elara 40 km (JPL/NEOWISE).
* **Milky Way.** The published Reid 2019 tangencies are reproduced; W3(OH) lies within one arm width of the Perseus arm.

# 6. Known data limitations (not hidden)

* **SCI-005.** `smallbodies.bin` elements are rounded to about 4 significant figures (positions off by up to 10⁵ km). The
  full-precision SBDB fetch on promotion exists only for selected bodies.
* **SCI-004.** Mimas' interpolation error is 166 km.
* **SCI-008.** Unknown spin axes are placeholders, labelled as such.
* **Sizes.** The ~380 H-based sizes depend on the class albedo prior. A factor-2 albedo error changes a size by 41 %.
* **Hipparcos rows.** Hp is kept as approximately V (|Hp − V| ≲ 0.2 mag for B − V < 1.5).
* **Ring material.** Particle albedos for Chariklo, Haumea and Quaoar are unknown and inferred.
* **Neptune's arcs.** Their absolute longitude is REPRESENTATIVE.

# 7. Missing datasets (needed for the next quality step)

* **Cassini ISS / Galileo SSI controlled mosaics** for the small moons: Prometheus, Pandora, Janus, Epimetheus, Hyperion
  (partial), Helene, Telesto, Calypso, Amalthea and Thebe.
* **Public-domain replacements** for the three non-commercial Uranian-moon maps.
* **Gaia DR3 bulk HEALPix tiles** beyond 100 pc, for the v3.9 Galaxy foundation.
* **Higher-resolution terrain.** LROC NAC/WAC and CTX/HiRISE regional mosaics for the Moon/Mars imagery, which is coarser
  than the relief.
