# SOL — R&D / decision ledger

Format per entry: question → sources (accessed 2026-10-08 unless noted) → evidence → options → decision → implementation → tests → residual risk.
Only facts we actually retrieved or measured are recorded. "Software adapter" = Chromium 154 SwiftShader WebGPU (QA only).

---

## R-001 Can SOL be built and exercised in this environment?
- **Evidence:** `npm ci` succeeds (31 packages; three 0.186.1, vite 8.3.3, typescript 7.0.2). Baseline `tsc --noEmit` passes, `vite build` passes (single 3.6 MB JS chunk). No GPU in the sandbox. Chromium 141 (Playwright build) rejects three 0.186's `GPUTextureViewDescriptor.swizzle` (API shape changed) → unusable; Debian Chromium **154.0.8037.92** works with SwiftShader WebGPU (`isFallbackAdapter: true`).
- **Decision:** browser QA = Chromium 154 + SwiftShader behind an explicit `?qa-software-gpu=1` flag. Proves pipelines compile, no exceptions, frames render, screenshots of real output. **Not** a performance or final-look measurement (frames take 1–30 s).
- **Residual:** real-GPU performance/visual gates remain **not executed** (target RTX 3050 laptop needed). See `docs/qa/benchmark-protocol.md`.

## R-002 Baseline runtime defects found by executing the app
- **Missing required data crashes boot**: blocking `smallbodies.bin` (route abort) → app never became ready (baseline main.ts destructures results and dereferences). Fixed by the staged boot (required vs optional lists, explicit failure screen).
- **SwiftShader GPU-process crash** (exit code 4, `Device Lost: A valid external Instance reference no longer exists`) reproducibly ~5 s after boot when the 94,523-object asteroid compute pass runs; disappears with `?qa-off=small`. Reproduced only on the software adapter; on hardware unverified. Device loss was previously silent (black canvas). Now: `renderer.onDeviceLost` → explicit error screen.
- **Black frame when device lost** — handled as above.

## R-003 Moon / Galilean frame error (precession)
- **Source:** Meeus, *Astronomical Algorithms* 2nd ed. eq. 21.5 (IAU 1976 ecliptic precession); Horizons API v1.2 vectors.
- **Evidence:** baseline Moon errors vs Horizons: 0.07 km (J2000), 5.4 km (2026), 17 km (2050), 42 km (1950) — growing with |T|: the baseline rotated only by precession in longitude, ignoring the motion of the ecliptic.
- **Decision/implementation:** rigorous ecliptic precession (`src/astro/precession.ts`), applied to ELP/MPP02 and E5 outputs.
- **Result:** Moon 0.07–0.37 km over 1950–2050 (tolerance 2 km, declared beforehand).

## R-004 Truncated small-body elements
- **Evidence:** baseline `featured.json` stored SBDB elements to 3 significant figures (Ceres a=2.77, i=10.6 …); Ceres error 1.18 million km, Vesta 1.88 million km at 2026-10-08.
- **Source:** JPL SBDB API `full-prec=1` (https://ssd-api.jpl.nasa.gov/doc/sbdb.html).
- **Implementation:** `tools/ingest/sbdb.mjs` (all 69 objects; provenance incl. orbit_id, solution date, non-grav parameters → `public/assets/data/provenance/featured.sbdb.json`).
- **Result:** Ceres 7,580 km, Vesta 3,898 km, Pallas 4,826 km (2-body from 2026-06 epoch; tolerance 20,000 km).
- **Residual:** `smallbodies.bin` (94,523 points) is also rounded (~4 significant digits, angles to 0.01°) → O(10⁵ km) positional error for point sprites. Acceptable only for unresolved points; ISSUE-SCI-005 plans on-demand full-precision fetch for selected objects.

## R-005 Galilean E5 unit radius
- **Evidence:** all four moons had a uniform ~1.1×10⁻³ radial scale error. Lieske E5/Meeus ch. 44 coordinates are in units of 71,398 km; baseline used 71,492 km.
- **Fix:** `E5_RJ = 71398` + rigorous precession → errors 150–730 km (was 450–2,050 km). E5 is now only the out-of-window fallback.

## R-006 Mean-element moons wrong by up to a full orbit
- **Evidence (Horizons, 2026-10-08):** Phobos 11,562 km, Titan 2.41 million km, Rhea 1.03 million km, Triton 227,000 km. Even AT the element epoch (J2000) Titan/Rhea positions disagree by >10⁵ km under every frame/anomaly interpretation tried (Laplace/ecliptic/equatorial × M / L−ϖ / L−ω), so the Saturnian mean-element orientation in `satellites.json` cannot be reproduced. Phobos also loses phase over 26 years (P given to 4 digits).
- **Options:** (a) reverse-engineer element conventions; (b) Chebyshev SPK-like fits (large); (c) Horizons state samples on a grid + two-body "Kepler-blend" interpolation; (d) Horizons osculating states at one epoch + two-body.
- **Prototype:** Kepler-blend vs Horizons hourly truth: Phobos 6 h step → 7.8 km; Io 6 h → 26 km; Titan 1 d → 2.8 km; Triton 1 d → 1.2 km; Pluto barycentre 30 d → 192 km.
- **Decision:** (c) for the planets, major moons, Pluto system and three comets inside **2000-01-01 … 2050-01-01** (~33 MB binary, streamed per system after first frame); (d) for the other ~440 moons (Horizons states at 2026-10-08.0 TDB). Outside the window: two-body from the window-edge state, labelled "extrapolation". 1 of 459 moons (Daphnis) has no Horizons ephemeris after 2018 → keeps mean elements, labelled approximate.
- **Tests:** off-grid interpolation fixture (4 random epochs × 24 bodies) — worst 348 km for Nereid (a=5.5 million km), Mimas 166 km (a=185,539 km); all within the declared 10⁻³·a budget.
- **Residual:** Mimas/Enceladus close-proximity accuracy (ISSUE-SCI-004: halve the step or add J2-aware propagation).

## R-007 Planet centres vs barycentres
- **Evidence:** sampling Earth (399) at 2-day steps gave 126 km interpolation error (lunar wobble); Jupiter 103 km.
- **Decision:** sample system barycentres (3, 5, 6, 7, 8) and subtract Σ GMᵢ rᵢ / GM_sys using the moon tracks / ELP Moon.
- **Result:** Earth ≤0.7 km, Jupiter ≤0.7 km, Saturn ≤1.6 km.

## R-008 Inconsistent JPL solutions for Uranus/Neptune
- **Evidence:** Horizons Uranus (799, `ura184_merged`) minus Uranus barycentre (7, `DE441`) after removing moon offsets ≈ 360 km (Neptune `nep098_merged` similar). Moon tracks are relative to 799.
- **Decision:** derive a satellite-solution-consistent barycentre: r₇' = r₇₉₉ + Σ GMᵢ rᵢ / GM_sys at the grid nodes (`tools/ingest/planet-bary.mjs`).
- **Result:** Uranus 0.8–2.4 km, Neptune 0.9–2.2 km.

## R-009 Time scales
- **Sources:** IERS Bulletin C 72 (Paris, 2026-07-06: no leap second end of Dec 2026; UTC−TAI = −37 s since 2017-01-01), IERS Leap_Second.dat; Fairhead & Bretagnon TDB−TT leading terms.
- **Baseline defect:** TT−UTC hard-coded 69.184 s only for 2017–2035, ΔT polynomial (≈63.8 s) used for 1972–2016 instead of TAI−UTC+32.184 (64.184 s in 2000).
- **Implementation:** leap-second table, TT, TDB, UT1≈UTC (|DUT1|<0.9 s), validity status (`timeScaleStatus`). Clock in TT, ephemerides in TDB, Earth rotation in UT1.

## R-010 Native WebGPU only
- **Source:** three r186 `WebGPURenderer.js` installs `parameters.getFallback = () => new WebGLBackend(...)`; `Renderer.init()` calls `_getFallback` on WebGPU failure.
- **Decision:** set `renderer._getFallback = null` before `init()` (WebGL backend can no longer be constructed), assert `backend.isWebGPUBackend` and `device instanceof GPUDevice` after; pre-flight adapter probe refuses `isFallbackAdapter` unless `?qa-software-gpu=1`.
- **Test:** smoke harness reports `backend: WebGPU (native)` + adapter info; no WebGL context is created in any code path we ship (three's WebGLBackend module is still bundled because WebGPURenderer imports it statically — tree-shaking cannot remove it; it is never instantiated).

## R-011 Texture residency
- **Evidence:** inventory estimates 3.6 GiB if every map were resident as RGBA8+mips; baseline preloaded all base maps at boot and swapped hi maps in without eviction; on the software adapter the full eager load coincided with GPU-process loss.
- **Implementation:** `TextureStore` — stable texture objects, lazy base maps, budgeted hi maps (default 1.5 GiB estimated), LRU demotion, GPU texture disposed before a different-size image is uploaded.
- **Residual:** KTX2/Basis GPU compression not yet adopted (ISSUE-PERF-002) — needs a supported-format test on the target GPU and a transcoding pipeline.

## R-012 Model assets
- **Evidence (`docs/inventory/models.json`):** all 12 GLBs are single-mesh, single-primitive; baseline "first mesh only" loader therefore loses nothing today. 9 were wired; Geographos, Golevka and Mithra were present but never used although the README listed them.
- **Fix:** catalogue entries added with SBDB dimensions/albedo/periods; spin axes unknown to SOL are explicitly labelled as placeholders.

## R-013 Asteroid compute crash = environment defect (GPU-003)
- **Bisection (tests/render/compute.html, tests/render/rawcompute.html, tools/qa/compute-bisect.mjs):** with `?qa-off=smallcompute` the app runs; with only the compute pass enabled the GPU process dies. A 10-line raw WebGPU compute shader **without three.js** (1,000 invocations, one storage write) kills the GPU process identically on Chromium 154 + SwiftShader (Linux arm64).
- **Conclusion:** the crash is in the software adapter's compute path, not in SOL's small-body shader. It says nothing about hardware behaviour. On the RTX 3050 the compute pass must be verified with `tests/render/rawcompute.html` and the app (protocol step 2b).

## R-014 Exposure NaN → white frame (found by the eclipse golden view)
- **Evidence:** camera exactly on a body's night side → `lit = (1+cosα)/2` rounded to −1e−17 → `pow(lit, 0.6)` = NaN → exposure NaN → every later frame white.
- **Fix:** clamp + a finite guard on the exposure state. Any NaN now resets instead of poisoning the session.

## R-015 Solar corona brightness
- **Source:** Baumbach (1937) K+F profile as tabulated in Allen's Astrophysical Quantities (4th ed., §14.3): I(r)/Ī☉ = 10⁻⁶(0.0532 r⁻²·⁵ + 1.425 r⁻⁷ + 2.565 r⁻¹⁷).
- **Decision:** physical brightness (≈10⁻⁶ of the disc) so the corona appears only when the disc is occluded; exposure meters for the inner corona during eclipses. Streamer/plume/ray STRUCTURE is simulated and labelled as such. Chromosphere: 0.015 R☉ H-α rim at 2·10⁻⁴.
- **Evidence:** 2026-08-12 total-eclipse golden view (software) shows a black lunar disc with a streamer corona; partial (96.5 % visible) shows normal glare.

## R-016 Unobserved map regions (AST-002)
- **Evidence:** inventory near-black fractions: Ariel 43 %, Titania 50 %, Oberon 58 % (Voyager 2 imaged only the southern hemispheres in 1986). Baseline also calibrated albedo against the full-map mean, over-brightening the observed part ~2×.
- **Implementation:** per-body `noData` mask in the surface shader → procedural reconstruction at the observed mean albedo, optional 10° graticule ("Mark unobserved terrain"), inspector "Map coverage" row; calibration uses the observed-region mean.

## R-017 Terrain DEMs (Phase 4 first tier)
- **Sources:** LRO LOLA LDEM_16 (PDS, 0.5 m DN, 1737.4 km reference); MGS MOLA MEGDR MEGR90N000EB (PDS, radius − 3,396 km). Both 5760×2880, public domain.
- **Tests:** Olympus Mons summit radius 3396+19…22.5 km; Hellas floor >30 km below it; Mars polar radius −15…−24 km (oblateness); Moon high point near (5.4°N, 201.4°E) 10–11 km; SPA floor < −6 km; longitude wrap continuity.
- **Implementation:** CPU cube-sphere quadtree (33×33 patches + skirts, horizon culling, LRU, ≤6 builds/frame, coarse levels pre-built for hole-free streaming), shared surface material, DEM-aware camera ground clamp.
- **Limits:** 1.9 km (Moon) / 3.7 km (Mars) native detail; float32 body-centred vertices (~0.1–0.2 m quantisation). Next tier: LOLA 64–512 ppd / HRSC-MOLA blended tiles streamed per patch, patch-local origins, procedural microrelief labelled as synthetic.

## R-018 3D stars (Phase 7/8 first slice)
- **Sources:** Gaia Catalogue of Nearby Stars (Smart et al. 2021, 331,291 stars < 100 pc, Bayesian distances); Hipparcos 2007 (4,574 bright stars Gaia lacks); α Cen parallax override (Akeson et al. 2021). Gaia DR3 full-table bright-star query was submitted to the ESA archive but was still queued after >40 min; the tool accepts it later as an optional third input.
- **Tests:** Proxima 1.302 pc, Barnard's Star 1.83 pc, Sirius 2.64 pc, Vega 7.68 pc, 10-pc census 250–600, no NaN.
- **Rendering:** per-star apparent magnitude recomputed from the camera position on the GPU (true parallax and brightness change in flight); cross-fade with the Sun-centred directional catalogue between 1,000 and 10,000 AU; 157 named stars become travel targets (Hipparcos/Gaia-labelled, distances derived, stellar discs not yet rendered).

---
# v3.3 entries (2026-10-08)

## R-019 Root cause of orbit/axis "vibration"
- **Question:** is the shimmer precision, aliasing or camera instability (spec §10 three causes)?
- **Evidence (code + numeric test):** v3.2 `LineSet` uploaded orbit vertices as float32 values of up to ≈4.5·10⁹ km (heliocentric, in scene axes) and placed each orbit with a float32 `modelViewMatrix` translation of the same magnitude. float32 spacing at 30 AU is 256–512 km, so every vertex was quantised to that grid and the quantisation changed whenever the camera moved (translation recomputed per frame). `tests/render/precision.test.ts` reproduces this: with the camera 50 km from a vertex at 30 AU, 1 m camera steps move the v3.2 vertex by 0 or ≥ 256 km (visible jumps), and the camera-relative error reaches ≥ 10 km.
- **Options:** (a) rebase every orbit to a camera-local origin on the CPU each frame (re-upload cost); (b) high/low split ("relative-to-eye", as used by CesiumJS) with the anchor-to-camera offset as a hi/lo uniform; (c) emulated double in shader.
- **Decision:** (b). No per-frame uploads; exact cancellation of the large terms (Sterbenz) leaves the result with float32 rounding of the *camera offset* (angularly constant, ≤ 0.24 µrad), independent of distance from the Sun.
- **Implementation:** `src/contracts/precision.ts`, `src/render/lines.ts` (aAh/aAl/aBh/aBl attributes, `originH/originL` uniforms, `basis` matrix for body-local guides), `Engine.updateOrbits/updateTrajectory/updateAxis`.
- **Also addressed:** sub-pixel strokes keep their energy as reduced opacity (no 0↔1 px strobing); per-orbit opacity now approaches its target exponentially (frame-rate independent, no popping at LOD thresholds); default *clean* mode removes the unrelated orbits that previously crossed the view.
- **Residual:** real-GPU slow-pan video at Saturn/Neptune/Pluto not recordable here (no GPU, software frames take seconds) → NOT TESTED on hardware.

## R-020 Hero Sun close/mid look
- **Sources:** NASA SDO channel guide (HMI continuum 6173 Å = photosphere; AIA EUV is false colour) https://sdo.gsfc.nasa.gov/data/channels.php ; Neckel & Labs (1994) limb darkening; Snodgrass & Ulrich (1990) differential rotation; granulation scale ≈1–2 Mm and lifetime 5–10 min, supergranulation ≈30 Mm (standard solar-physics values, e.g. Rieutord & Rincon 2010, Living Rev. Sol. Phys. 7, 2).
- **Evidence:** v3.2 metered the disc at 5 % of mean radiance up to 120 px (`subject = L_mean·0.05`): with key 0.16 the disc centre sat at ≈4× display white → AgX/bloom produced a white ball with a grey haze (golden `sun-0.05AU`, before). Granulation was a single Worley octave with no band-limiting (crawls at mid distance); spots were fBm thresholds (blobby, no penumbra).
- **Decision:** keep physical radiometry (limb darkening, flux, corona unchanged); change (1) metering: from ~40 px the disc centre lands ≈1.0× display white (`sunMeterWeight`), (2) camera glare fades as the disc fills the frame (`glareWeight`), (3) photosphere rebuilt: evolving two-generation Worley granulation with dark lanes and domed cells, mesogranulation, supergranular network, bipolar active regions with Joy's-law tilt, umbra/penumbra with radial filaments, limb-brightened faculae, Snodgrass differential rotation, footprint band-limiting, a visual clock for granule evolution under time-lapse. (4) Three looks (natural / cinematic / scientific) affecting display grading only.
- **Not done:** a dated HMI-continuum disc layer (would require a licensed, reprojected, multi-epoch map — HMI shows one hemisphere per epoch); prominences/flares (spec: toggleable illustrative only) → queued SUN-005/006.

## R-021 Body identity (owner: "too alike")
- **Evidence:** v3.2 `irregularGeometry` gave every procedural body 7 lobes + 26 craters; `proceduralAlbedo` was one fBm+crater formula with a seed from catalogue order; Ryugu and Itokawa used it despite mission shapes.
- **Decision:** `BodyVisualProfile` registry (`src/render/identity.ts`) with tier A–D, shape family (cratered, fragment, rubble-top, contact-binary, sponge, comet-nucleus, model) and surface family (cratered-rock, icy-tectonic, dark-rubble, comet-mantle, volatile-dwarf, metal-rich, sponge-ice, red-silicate), FNV-1a seed from the canonical id, a literature basis + source for each curated body. Geometry families (`familyGeometry`) build silhouette → mesoscale (power-law crater SFD with degradation and central peaks, facets, boulder fields, ridges, terraces) and normalise per axis so measured radii are applied once.
- **Ryugu/Itokawa mission shape models:** JAXA/ISAS shape products exist (Hayabusa/Hayabusa2 via PDS SBN / DARTS) but their redistribution terms were not verified in this session → not shipped; family reconstructions are labelled tier C with that reason in the inspector. Queued AST-004.

## R-022 glTF import
- v3.2 kept only the first mesh. v3.3 merges every mesh primitive (world transforms applied), keeps authored normals/UVs when all parts have them, and records meshes/triangles/UV/normals/texture presence for the Evidence tab. The 12 shipped GLBs remain single-mesh (inventory) and untextured where noted; surfaces on them are labelled "reconstructed shading".

## R-023 QA browser on this sandbox
- Playwright Chromium 141: (a) rejects three r186's `GPUTextureViewDescriptor.swizzle: 'rgba'`; a QA shim (`tools/qa/chromium-compat.js`, opt-in `--compat`) fixes that, but (b) the device is lost ≈2 s after any `GPUCanvasContext.configure()` with SwiftShader, even for a bare clear (minimal page, all flag combinations tried). Debian Chromium 154.0.8037.92 with `--use-vulkan=swiftshader --use-angle=vulkan` presents correctly → harness defaults to it when installed. Asteroid compute pass still crashes SwiftShader (R-002) → captures use `qa-off=small,smallcompute`.

## R-024 Asset rights
- New `docs/assets/provenance-rules.json` → `tools/validate/assets.mjs` → `docs/assets/asset-manifest.json` (107 files, SHA-256, licence, commercial flag, truth label). `tests/assets/manifest.test.ts` fails CI on any unmatched file. Findings: 31 files carry personal/non-commercial terms (Steve Albers mosaics) — flagged, not replaced in this session (AST-003 stays OPEN); `JetBrainsMono-normal-500.woff2` was byte-identical to the 400 file (a fake weight) → removed.

---
## v3.5 entries (2026-10-09)

## R-024 Why do stars and the Milky Way vanish near planets?
- **Evidence (source):** sky gain `LS·4e-6`, star gain `exposure·1e-10`, LS = scene exposure (engine.ts v3.4). Exposed for a sunlit planet (E≈2) the Galactic band renders ≈1e-7 display. NASA EO "Where are the stars?" (2011) confirms this is what real short exposures record.
- **Options:** (a) brighten the sky (unphysical, double brightness in deep space); (b) SpaceEngine-style per-object multipliers ("HDR" photo mode, self-described as faked, blog 2017-04-15); (c) a calibrated, separately exposed sky domain, weakly coupled, re-coupled by physical veils, labelled.
- **Decision:** (c) in Exploration/Cinematic; Scientific keeps the single camera. **Tests:** presentation.test.ts (coupling, veil, calibration, monotonicity). **Residual:** the coupling constants are presentation choices, owner sign-off pending.

## R-025 Far-plane depth of sky sprites
- **Evidence:** first v3.5 capture with a visible sky showed stars over Earth's night side. Reversed-depth value of a body at 2e4 km with near = 1e-6 km ≈ 5e-11 < 1e-9 (the v3.4 far-plane z). **Fix:** z = 0 exactly with GreaterEqual compare (three r186 maps LessEqual → GreaterEqual for reversed depth, verified in WebGPUPipelineUtils.js). Verified-software (night-side captures show occlusion).

## R-026 Milky Way calibration and double counting
- **Evidence:** Gaia DR2 map luminance band median 0.229 (linear), poles 0.0015 (160×); contains resolved stars. Sun mean surface brightness −10.58 mag/arcsec² (computed, tested). v3.4 gain ≈100× above μ_V ≈ 21.
- **Decision:** median-filtered diffuse layer (9.6 % of flux removed), L = L(21.0)·(Y/Y_band)^0.45 clamped to [L(23.6), L(19.8)] — DERIVED, labelled.

## R-027 EXP-002 metering
- **Evidence:** tools/qa/metrics.py on the shipped v3.4 screens: clip % Io 45, Triton 47, Europa 32, Vesta 35, Pluto 40, 67P 80.
- **Options:** GPU luminance histogram (compute — crashes the only available test adapter, R-013, so untestable here) vs. CPU photometric highlight prediction from measured map statistics.
- **Decision:** per-map p99 of max(R,G,B) (area-weighted, noData excluded) × exact photometric peak at the current phase; brightest 1 % ≤ 0.9 linear. **Result (software):** all of the above ≤ 0.01 %. GPU histogram metering remains an option once hardware QA exists.

## R-028 Granulation tiling
- **Evidence:** limb capture shows diagonal banding with ≈10-cell period; `hash31` uses fract(p·0.1031) → periodic. **Fix:** PCG3D (Jarzynski & Olano 2020) + second warp octave. Verified-software (sun-limb capture).

## R-029 Secondary light
- **Model:** Lambert-sphere neighbour, E = (2/3)·A·(R/d)²·Φ(α)/r², same law as SOL's unresolved points; wrap for extended source. Earthshine on the Moon at full Earth ≈ 5.5·10⁻⁵ of sunlight (−14 EV) — invisible in Scientific at day exposure, as in reality.
- **Inspection light** is not secondary light: presentation, 3 % of local sunlight, only beyond the terminator, always labelled.
