# SOL v3.8.1 — MAJOR VISUAL FOUNDATION RECONSTRUCTION
## Research-Led Engineering Specification, New-Agent Handoff & Execution Plan

**Project:** SOL — Scientifically Grounded Universe Exploration Simulator  
**Target release:** v3.8.1  
**Starting release:** v3.8.0 — Git tag `v3.8.0`, commit `a0cfcc6791da1575fd49217e5d0dddffdd7843e3`  
**Document version:** 1.0 — 12 October 2026  
**Target platform:** Desktop Google Chrome, native WebGPU exclusively  
**Implementation model:** One AI coding agent; continuous work with recoverable checkpoints  
**Strategic trajectory:** v3.8.1 → v3.9 → flagship v4.0 → wider Galactic and extragalactic exploration  

---

# 0. MISSION AND NON-NEGOTIABLE OUTCOME

You are taking over SOL development in a completely new conversation. Do not assume access to previous chat context or personal recollections.

SOL is an interactive, true-scale astronomical simulator built with a modular TypeScript, Vite and Three.js/WebGPU architecture. It began as a Solar System simulator and has expanded into nearby-star navigation. Its eventual ambition is an exceptionally convincing, scientifically grounded universe-exploration website, drawing inspiration from the ambition of SpaceEngine and the premium interaction quality of modern astronomical interfaces, without copying their proprietary implementation.

**The owner is dissatisfied with the current graphical quality and interactive stability.** The software has functional and scientific achievements, but the sky, stars, Sun, distant background, moons, some atmospheric effects and user experience still look artificial. Real-PC exploration also reveals star jitter and travel stuttering missed by previous software-WebGPU verification.

This is not a request for another small collection of shader tweaks.

**v3.8.1 must selectively reconstruct the weak visual and interactive foundations where necessary, repair demonstrable defects, preserve working scientific systems, and produce substantially better real-world visuals.**

The goal is an experience in which a visitor genuinely feels immersed in astronomical space: profound depth, believable darkness and brightness, stable stars, convincing celestial bodies, strong lighting, smooth journeys, precise controls and a refined interface.

Scientific credibility and visual beauty must reinforce each other rather than compete.

An impressive still image obtained through false geometry, artificial global lighting, excessive bloom or hidden scientific inaccuracies does not satisfy the mission.

## Absolute rules

1. **Desktop Chrome only. Native WebGPU only. No WebGL/WebGL2 fallback, no mobile compatibility work.** Verify the actual initialized renderer backend; API availability alone is insufficient.
2. Preserve scientific scale, ephemerides, coordinate frames, orbital geometry, dataset provenance and existing correct behavior.
3. Never invent astronomical observations, measured geometry, exact surfaces, star properties or sources.
4. Distinguish OBSERVED, DERIVED, INFERRED, REPRESENTATIVE and UNKNOWN content, including the uncertainty of inferred values.
5. Maintain three clearly differentiated presentation modes: Scientific, Exploration and Cinematic.
6. No arbitrary ceiling on graphical quality. A constrained laptop is a performance test target, not the definition of SOL's maximum quality.
7. Rebuild weak modules when a sound technical assessment justifies it, but do not restart the whole project or rewrite unrelated working systems.
8. Prioritize correct foundations over superficial effects, and measurable results over adjectives.
9. No invented tests, screenshots, hardware benchmarks, research citations or successful executions.
10. Do not introduce unsupported libraries, APIs or asset URLs. Confirm their compatibility with the project's pinned dependencies before implementation.
11. Work as **one primary agent**; do not launch unnecessary sub-agents.
12. No arbitrary deadline. Progress checkpoints are mandatory, but they must not substitute for actual implementation.
13. Preserve the existing complete-project release format: one consolidated final source ZIP, not patches or separate prerequisite archives.
14. Preserve the best aspects of earlier releases, including their physics, data, rendering, UI and performance improvements.
15. If an advanced system cannot be implemented correctly, disclose the limitation and preserve a credible future implementation path rather than shipping an impressive-looking fake.

---

# 1. PROJECT HISTORY AND CURRENT BASELINE

The provided source should be the released `sol-solar-system-v3.8-final.zip`, approximately 445 MB compressed.

The previous agent reported:

- Release commit `a0cfcc6`, tagged `v3.8.0`.
- 2,258 packaged files matching the Git tree by SHA-256.
- 1,513 runtime assets verified against manifests.
- 85 catalogue shards validated by hash.
- 310/310 tests passing, TypeScript check passing, successful production build.
- Clean-extraction Chromium boot with zero failed resource requests or GPU errors.
- All 3.7.1 corrective work integrated into the consolidated 3.8.0 application.
- The full Earth → Proxima Centauri → Earth journey operational.
- Final 94-view visual regression set plus other journey, Galactic, UI and loader screenshots.
- Significant improvement in software-WebGPU CPU-side travel stalls.

**These are historical reports, not automatically independently reproduced facts.** Verify the baseline before modifying it.

Version history:

- v3.3: Solar rendering, early visual identity and data work.
- v3.4: coordinate contracts, catalogue architecture, camera-state foundations.
- v3.5: three presentation modes, lighting/exposure and planet visibility.
- v3.6: atmospheric LUTs, Moon/Mars terrain foundations and streaming.
- v3.7.0: extensive ring systems, atmospheric refinements and plumes; several rendering defects.
- v3.7.1 branch: corrective work for v3.7 shortcomings.
- v3.8.0: nearby-star navigation, far-Sun rendering, Galactic model/context card, star photometry, minor-moon fixes, UI/accessibility work and CPU travel optimizations.
- **v3.8.1: this major visual-foundation reconstruction.**

## Existing assets and architecture

The modular application includes approximately:

- `src/astro/`: ephemerides, time systems, system graph, orbital propagation.
- `src/contracts/`: coordinate reference frames, catalogue, schemas, LOD-related contracts.
- `src/core/`: renderer support, settings, resources and residency.
- `src/data/`: bodies, satellite dimensions, atmospheres, rings and astronomical datasets.
- `src/galaxy/`: existing 3D stellar catalogue, photometry and parametric Galactic model.
- `src/navigation/`: camera rig and astronomical flights.
- `src/render/`: principal scene, materials, lighting, atmospheric rendering, Sun, points, rings, geometry, terrain and postprocessing.
- `src/terrain/`: Moon/Mars terrain-tile handling.
- `src/ui/`: interface, search, inspector, tours, loader and Galactic context.
- `tools/`: data ingestion, asset verification and automated QA.
- `tests/`: astronomical, rendering and application regression tests.

Treat these locations as **documented starting points**, not an excuse to assume their exact APIs or implementation.

Use source inspection to establish the real dependency graph.

## Existing documentation

Read the existing project-level overview, the release notes, the issue register and the following reports if provided:

1. `SOL_V38_COMPLETE_DEVELOPMENT_REPORT.md`
2. `SOL_V38_REQUIREMENTS_MATRIX.md`
3. `SOL_V37_FINAL_COMPLETION_REPORT.md`
4. `SOL_V37_V38_SCIENTIFIC_DATA_AND_ASSET_AUDIT.md`
5. `SOL_V37_V38_VISUAL_QA_REPORT.md`
6. `SOL_V38_PERFORMANCE_AND_OPTIMIZATION.md`
7. `SOL_V37_V38_MASTER_PROJECT_HANDOFF.md`
8. `RELEASE_VERIFICATION.md`
9. QA image metadata, test inventories and relevant source manifests.

**Do not waste time exhaustively reading every file and every code line before doing anything.** First map the project, identify module boundaries and inspect the code relevant to the current issue. Deepen inspection when necessary.

Do not depend on a prior conversation history that is unavailable.

---

# 2. RESEARCH BASIS AND MAJOR ARCHITECTURAL DECISIONS

These conclusions were researched before this handoff. Use them as the starting design basis; perform additional targeted research only where an implementation detail remains uncertain.

## R1 — Astronomical star rendering

Individual stars should be rendered as calibrated sources of light with consistent photometry and angular positions, not as arbitrary white dots or objects attached to the screen.

Relevant reference:

- Three.js `PointsNodeMaterial` documentation:  
  https://threejs.org/docs/pages/PointsNodeMaterial.html

WebGPU point primitives are limited to one pixel. Variable-sized point-source images should use an appropriate instanced sprite or screen-space reconstruction method, not assume conventional variable-size WebGPU points are supported.

**Decision:** Rebuild the current star point/PSF system if inspection confirms that it cannot guarantee stable centroid positions, energy conservation and correct distance-dependent appearance.

Do not replace the existing astronomical catalogue or 64-bit source positions merely because the screen-space rendering is defective.

## R2 — Gaia photometry and colour

Gaia G, BP and RP are their own passbands; they are not Johnson V. The earlier v3.8 bug demonstrated that confusing these systems can make red stars many times too bright.

Sources:

- https://www.cosmos.esa.int/web/gaia/edr3-passbands
- https://www.cosmos.esa.int/web/gaia/dr3-what-colour-do-they-have
- https://www.cosmos.esa.int/web/gaia/dr3
- Riello et al., Gaia EDR3 photometry: https://arxiv.org/abs/2012.01916

**Decision:** Maintain source-band metadata, conversions with applicability limits, and physically reasonable stellar colours. Prefer observed photometric/spectral information when available. Blackbody or temperature-derived colour is an approximation, not a substitute for all stellar spectra.

## R3 — Milky Way sky imaging

ESA's Gaia all-sky colour map reflects the brightness and colour of a very large observed stellar sample. Its broad band and dark dust lanes are real astronomical features, but the source image is still a projected map, not 3D Galactic geometry.

Sources:

- https://www.esa.int/ESA_Multimedia/Images/2020/12/Interactive_map_of_the_sky_from_Gaia_s_Early_Data_Release_3
- https://www.esa.int/ESA_Multimedia/Images/2020/12/The_colour_of_the_sky_from_Gaia_s_Early_Data_Release_3

**Decision:** Preserve an observationally grounded Galactic sky where useful, but replace weak colour/exposure/projection/compositing logic. Avoid double-counting light already represented by individually drawn catalogue stars.

Do not claim that a revised panorama is a true spatial 3D Milky Way.

## R4 — Sun colour and physically meaningful exposure

NASA explains that the Sun is effectively white when viewed in space; its warmer appearance from Earth is influenced by the atmosphere and perception.

Sources:

- https://eclipse2017.nasa.gov/what-color-sun
- https://soho.nascom.nasa.gov/explore/faq.html
- https://science.nasa.gov/blogs/earth-matters/2011/09/28/where-are-the-stars/

**Decision:** Preserve a physically credible white-light solar emitter and solar irradiance. Build the visually desirable warm/golden impression through controlled glare, colour grading, contrast, observer adaptation and atmospheric paths where applicable. Never hard-code strongly golden planetary illumination solely for aesthetic appeal.

The core should have convincing high-dynamic-range detail rather than featureless clipped white pixels.

## R5 — Atmosphere and scattering

Relevant foundation:

- Bruneton, Precomputed Atmospheric Scattering:  
  https://ebruneton.github.io/precomputed_atmospheric_scattering/index.html
- Hillaire, A Scalable and Production Ready Sky and Atmosphere Rendering Technique:  
  https://doi.org/10.1111/cgf.14050

**Decision:** Review the existing LUT implementation and composition order before modifying it. Adopt physically motivated transmittance, scattering and aerial-perspective techniques where beneficial, adapted to per-planet compositions and scale heights.

Do not add Earth-like blue atmospheres to airless worlds or pretend that static planetary maps are volumetric cloud/weather simulations.

## R6 — Small-moon observational geometry

NASA's PDS has spacecraft-derived shape models for Pan, Daphnis, Atlas, Prometheus, Pandora, Epimetheus, Janus, Telesto, Calypso, Helene and Hyperion.

- https://sbn.psi.edu/pds/resource/saturnsatshapes.html
- https://arcnav.psi.edu/urn:nasa:pds:saturn_satellite_shape_models

**Decision:** Prioritize appropriately licensed, observed shapes for these known problem objects rather than spending most of the time inventing procedural geometry.

Surface imagery and geometric shape must remain separate observational evidence categories.

## R7 — Rings

Saturn ring optical depth and microstructure can be constrained by Cassini occultation measurements.

- https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=CO-SR-RSS-4%2F5-OCC-V2.0
- https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=CO-SR-UVIS-HSP-2%2F4-OCC-V2.0

**Decision:** Improve ring presentation using measured structure, correct geometry, scattering and shadows rather than relying on fixed brightness multipliers or broad white lines.

## R8 — WebGPU, postprocessing and colour management

Official references:

- https://threejs.org/docs/pages/WebGPURenderer.html
- https://threejs.org/manual/pages/webgpurenderer.html
- https://threejs.org/manual/pages/webgpu-postprocessing.html
- https://threejs.org/manual/pages/color-management.html

**Decision:** Use the project's actual pinned Three.js/WebGPU/TSL APIs. Verify renderer backend identity, linear-light working values, HDR buffer precision, the correct order of exposure, bloom, tone mapping and output colour conversion.

Use a native-WebGPU-only contract. `WebGPURenderer` may fall back to WebGL2 by default, which is not allowed in this project.

## R9 — Texture optimization and hardware profiling

References:

- https://www.khronos.org/ktx/
- https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html
- https://developer.chrome.com/docs/devtools/performance/overview
- https://www.w3.org/TR/webgpu/

**Decision:** Investigate KTX2/Basis Universal, streaming, memory pressure and GPU timing where supported. Compression must be selected by asset type and visible quality, not enabled indiscriminately.

Native hardware tests and software-renderer tests are different evidence categories.

---

# 3. CONSTRUCTION POLICY — WHAT TO REBUILD AND WHAT TO PRESERVE

The owner explicitly authorizes selective major rewrites when justified.

## Preferred reconstruction targets

These systems are candidates for architectural replacement, not merely constant tuning:

**A. Unified astronomical image formation**

A coherent pipeline for stellar flux, point-spread functions, emissive bodies, atmospheric effects, HDR exposure, bloom, tone mapping and sky presentation.

**B. Stellar renderer**

Stable 3D positions, precision-preserving transforms, magnitude and colour mapping, point/disc transitions and physically meaningful close-star presentation.

**C. Sky compositor**

Correct merging of foreground worlds, individual nearby stars, deep-sky objects, observed Gaia background, planetary atmosphere, Sun and dark space.

**D. Camera/navigation transform path**

Only if diagnostics demonstrate that existing interpolation, world-origin management, projection or camera-relative transforms are causing instability.

**E. Solar disc/glare presentation**

A continuous, believable photosphere-to-point-source representation for Mercury through interstellar distance.

**F. Selected presentation/UI modules**

Loader/intro, motion design and Galactic context may be substantially redesigned while preserving working controls, settings and accessibility.

## Systems to preserve unless proven defective

- JPL ephemerides and their verified time-range logic.
- Verified orbital and rotational models.
- ICRS/ecliptic/Galactic/Galactocentric transformations.
- Existing catalogue records and validated ingestion tools.
- Scientific data provenance and asset manifests.
- Camera-state and user-setting contracts that remain sound.
- Ring optical-depth datasets and validated physical geometry.
- Existing Moon/Mars terrain data.
- Fixed Venus, Jupiter, Io, Enceladus, Pan and satellite-radius behavior.
- Existing automated tests, accessibility corrections and CPU-stall improvements.
- Previous version tags and release archives.

**Do not equate a larger rewrite with higher quality.** Every replacement should have a documented root cause, explicit interface contract, migration strategy, before/after evidence and regression test.

---

# 4. WORK PACKAGE A — UNIFIED SKY, EXPOSURE AND ASTRONOMICAL IMAGE FORMATION

**Priority: P0 — Major reconstruction candidate**

This is the central visual foundation of v3.8.1.

## Problems

The owner reports:

- The Milky Way and stars become excessively dark when the Sun enters the visible scene.
- Sky brightness appears to depend too strongly on camera direction.
- The background looks muddy, flat and artificial.
- Bright objects and stars do not feel part of the same coherent optical environment.
- The scene can feel either too dark or unnaturally bright.

## New rendering contract

Establish a consistent HDR radiometric/presentation pipeline with separately identified:

1. Emissive stellar and solar radiance.
2. Reflected planetary/lunar radiance.
3. Atmosphere transmission and in-scattering.
4. Ring/particle scattering and extinction.
5. Deep-sky integrated light.
6. Observational Galactic panorama.
7. Camera exposure/adaptation.
8. Optical image effects/PSF/glare.
9. Tone mapping, colour grading and output transform.

The same astronomical source must not be counted twice. A sky image containing integrated stellar light must have a documented relationship to individually rendered catalogue sources.

Use the working scene colour space correctly. Audit pre-exposure and post-exposure effects, colour-space conversions, depth and compositing.

## Scientific mode

- Preserve measured/inferred source brightness relationships.
- Do not delete stars when the Sun enters the view.
- Faint stars may become invisible under an exposure chosen for a bright object.
- Preserve physically relevant atmospheric attenuation.
- Do not add an artificial secondary Sun, Galactic ambient lamp or planet-night fill without justification.
- Display enough diagnostic information to explain why a star is or is not visually resolved.

## Exploration mode

- Permit controlled sky adaptation for readability.
- Maintain coherent, temporally stable adaptation.
- Use bounded and labelled exposure adjustments rather than making every star bright under every condition.
- Do not arbitrarily black out the entire background because one bright object is in frame.
- Preserve coherent visual relationships between planets and the sky.

## Cinematic mode

- Permit restrained warm/cool grading, enhanced photographic bloom and carefully controlled contrast.
- Avoid excessive lens flares, extreme noise, oversaturation and perpetual nebula glow.
- Clearly distinguish artistic rendering from physical flux.

## Required tests

Use deterministic fixed-camera sequences in which the Sun moves just inside and outside the frame. Repeat with Venus, Earth, Jupiter, Saturn and dark sky.

Record scene EV, sky EV, star magnitudes, measured output brightness, camera orientation, selected mode and any enhancement gains.

Evaluate atmospheric and airless observations separately.

**Pass condition:** No arbitrary global sky disappearance, sudden exposure discontinuity or unstable transition. Measured behavior agrees with the declared presentation mode.

---

# 5. WORK PACKAGE B — STABLE, HIGH-FIDELITY STAR RENDERING

**Priority: P0 — Major reconstruction candidate**

This addresses the owner's most serious reported visual defect.

## Reproduce first

Stars reportedly:

- Vibrate or jitter during zoom.
- Appear to move incorrectly when the view is manipulated.
- Become unstable near a selected star.
- Look like generic dots even when approached closely.
- Sometimes feel attached to the camera rather than located in astronomical space.

Some on-screen movement during camera rotation is correct; uncontrolled jitter is not.

## Mathematical and numerical design

Maintain high-precision astronomical positions at the appropriate epoch on the CPU.

Perform origin rebasing/camera-relative subtraction in sufficient precision **before** casting the local coordinates used by the GPU.

Use correctly separated coordinate frames for:

- Solar System bodies.
- Nearby stars with physical 3D positions.
- Very distant integrated-light sky.
- The Galactic structural context model.

Inspect for floating-point cancellation, changing scene origins, unstable camera matrices, catalogue boundary changes, projection discontinuities and poorly synchronized interpolation.

Do not assume the current star-position code is wrong: prove the actual cause using recorded transforms and projected coordinates.

## Stellar PSF and photometric energy

Design a stable image-space reconstruction:

- Magnitude determines integrated source brightness, not an arbitrary sprite radius.
- The point-spread function must preserve integrated brightness under subpixel movement.
- Resizing a star's apparent spot must not magically create extra light.
- Ensure stable centroid motion and appropriate antialiasing.
- Avoid repetitive star shapes and identical glare profiles at all brightnesses.
- Bright stars may exhibit stronger glare, but this must be applied smoothly and in a controlled way.
- Avoid random twinkling in airless space unless explicitly representing instrumental effects.
- Correctly handle occlusion by planetary bodies, rings and atmospheric extinction.

Use instanced sprites or an equivalent supported WebGPU/TSL implementation where variable screen-space sizes are needed.

## Star colour and classification

Use source spectral/photometric information where available.

Support credible variation among hot blue/blue-white stars, solar-type stars, cool red dwarfs, giants and other observed classes.

Avoid converting every source into a cartoon-saturated coloured dot. Bright stars should retain plausible colour under the selected exposure and white balance.

Maintain proper Gaia G, BP, RP, Johnson V and Hipparcos Hp provenance and conversions.

## Approaching a star

The transition must follow angular size and distance.

- At long range: stable unresolved point source.
- At closer range: changing irradiance and angular size.
- When resolved: physically plausible stellar disc and limb darkening.
- At very close range: credible stellar radiance, texture/phenomena appropriate to the spectral class and supported by research.
- For stars without observed surface data: clearly labelled physically constrained representation.

Do not make stars appear as giant glowing balls at distances where their angular diameter is far below one pixel.

For Proxima, test its radius, photometric band, colour, apparent magnitude and resolved-disc threshold separately.

Do not recycle the exact solar photosphere shader for every stellar type without physical justification.

## Required stability matrix

Test paused and running simulation at:

- Earth orbit.
- Outer Solar System.
- 300 AU.
- 1 light-year.
- 1 parsec.
- 50 AU from Proxima.
- Close enough to resolve a selected stellar disc.
- Across catalogue loading/unloading boundaries.

Test stationary, pan, zoom, lateral translation, slow orbital camera, fast rotation, interrupted travel, cold/warm loads and different render resolutions.

**Pass condition:** Stable projected centroids at rest; deterministic movement under a specified camera transform; no unphysical snapping, vibrating, camera-locked objects or inconsistent catalogue transitions.

---

# 6. WORK PACKAGE C — MILKY WAY BACKGROUND RECONSTRUCTION

**Priority: P0/P1 — Major visual work**

The broad Galactic band is a real feature of the sky. The problem is the current representation's appearance and compositing.

## Present weaknesses

- Broad brownish glow.
- Limited perceived texture and contrast.
- Insufficient visible small-scale structure.
- Sky sometimes nearly disappears through exposure.
- Inconsistent relationship between individual stars and background light.
- Lack of perceived depth or celestial richness.

## Research-led replacement plan

Audit the original Gaia panorama and its actual resolution, colour processing, projection and use in the renderer.

Compare against verified ESA Gaia reference maps at matching coordinates. Assess whether the problems originate in source-image quality, tone mapping, exposure, incorrect texture sampling, filtering, artistic recolouring or overlaid effects.

Then build an improved observational sky compositor using:

- Correct celestial orientation/projection.
- Subtle integrated-light structure.
- Proper separation of unresolved light and individual nearby stars.
- Natural variation in the Galactic plane.
- Dark dust lanes with credible large- and small-scale structure.
- Physically meaningful overall darkness.
- Correct behaviour at high Galactic latitude and toward the Galactic anticentre.
- No conspicuous repeating procedural textures.
- No artificial glowing border around the Galactic plane.
- Exposure behaviour consistent across modes.
- Stable orientation during camera movement.

If replacing the source panorama is justified, inspect the replacement's licence, resolution, colour information, purpose and projection. Do not blindly substitute a colourful infrared or false-colour astronomical image as visible-light reality.

Do not use a 2D texture as evidence that the Galaxy has full 3D depth.

## The actual Galactic model

The v3.8 source includes a model of the Milky Way's spiral arms, stellar disc/bar and Galactic frame relationships. Preserve this mathematical foundation.

The existing left-side Galactic context card is a **schematic model and local-position reference**, not the finished 3D Galaxy.

For v3.8.1:

- Make the context card more legible and informative.
- Label inferred geometry and limited data coverage.
- Optionally offer an enlarged 2D schematic map.
- Keep the full spatial 3D Galactic renderer for v3.9.
- Ensure the user never confuses the Gaia background panorama with rendered 3D Galactic structure.

## Visual comparison scenes

Capture Galactic centre, anticentre, high Galactic latitude, Sun neighbourhood, 0.3 pc translated observer and Proxima neighbourhood.

Use matched exposure and viewing settings. Inspect panorama seams, duplicate stars, stellar density, sky colour and rotation.

**Pass condition:** Strongly improved, natural-looking Galactic sky with credible observational structure, correct orientation and no arbitrary brightness pumping.

---

# 7. WORK PACKAGE D — SOLAR PHOTOSPHERE, GLARE AND MULTI-SCALE TRANSITIONS

**Priority: P0/P1 — Major reconstruction candidate**

The owner considers the Sun acceptable at some close views, particularly from Mercury, but unattractive from Earth/Mars and at intermediate distances. Its glare often becomes a featureless white spot.

## Preserve

- Correct solar radius and distance.
- Inverse-square irradiance at planetary distances.
- Existing far-distance visibility and clipping corrections.
- Continuous disc-to-point transitions.
- Verified eclipse/occlusion behavior.
- Existing good photosphere details where they survive comparison.

## Rebuild where justified

Investigate the source of the ugly intermediate-distance glare:

- Scene-linear radiance representation.
- PSF/glare kernel.
- Bloom threshold and energy normalization.
- Screen-space footprint.
- Exposure and tone mapping.
- HDR clipping.
- Disc/subpixel interpolation.
- Incorrect colour-space transformations.
- Excessive white saturation.
- Gamma and framebuffer precision.
- Transition between resolved surface and point source.

Separate:

**Physical emission:** Correct solar spectral/white-light characteristics and irradiance.

**Disc shading:** Solar limb darkening, granulation and justified surface structure.

**Instrument/observer response:** Glare, bloom, apparent halo, exposure and optical PSF.

**Presentation grade:** Subtle warm/golden aesthetic where desirable, particularly in Exploration/Cinematic.

Do not make the Sun a physically incorrect yellow lamp simply because yellow looks more pleasant.

## Suggested visual character

The Sun should feel intensely luminous, hot and substantial.

It should have a high-brightness core, visually integrated warm highlights where justified by presentation, refined outer glare, convincing disc structure and a smooth falloff.

Avoid:
- Flat white blobs.
- Cartoon-orange solar discs.
- Oversized radial starbursts.
- Screen-wide golden fog in empty space.
- Constant-size halos at very different distances.
- Hard transitions between shader regimes.

## Required distances

Test approximately 0.3, 0.4, 1, 1.5, 5, 10, 30, 100, 1,000 and 3,000 AU, plus 1 ly, 1 pc and Proxima distance.

Include Mercury, Earth and Mars comparisons because those views are specifically reported as weak.

Use at least two camera FOVs, all three viewing modes and real-GPU screenshots where possible.

**Pass condition:** A convincing, continuous Sun across distance scales without unnatural clipping, glare jumps or physically unjustified colour changes.

---

# 8. WORK PACKAGE E — PLANETARY LIGHTING AND ATMOSPHERES

**Priority: P1 — Significant improvement, selective architecture rebuild**

The existing v3.6/v3.7 atmospheric LUT system is valuable, but many world views remain simple and lack atmospheric depth.

Build a per-body atmospheric-quality matrix rather than one generic atmosphere shader.

## Different atmosphere classes

**Earth:** Rayleigh/Mie scattering, ozone, cloud layers, physically credible day/night limb and aerial perspective.

**Venus:** Dense CO2 atmosphere, optically thick cloud/haze behavior, appropriate colour, gradual terminator and more convincing cloud-top presentation.

**Mars:** Thin CO2 atmosphere, suspended dust, realistic low-altitude haze and colour under appropriate geometry.

**Titan:** Dense nitrogen atmosphere, strong organic haze, muted surface visibility and deep aerial perspective.

**Jupiter/Saturn/Uranus/Neptune:** Gas-giant cloud/haze structures, upper atmospheric scattering, atmospheric limb treatment, distinct colour and opacity characteristics; no fake solid surface.

**Triton/Pluto:** Very thin nitrogen-related hazes where justified, with appropriately small optical effects.

**Airless or nearly airless bodies:** No invented Earth-like shells. Handle Mercury, the Moon, most asteroids and applicable moons accordingly.

## Engineering strategy

Review existing atmospheric LUT correctness first, including half-float precision and Worker transfers.

Consider targeted improvements using Bruneton/Hillaire-inspired approaches where they genuinely solve the observed defects.

Introduce higher-quality cloud shading and layering for the most important bodies before attempting a universal physically simulated cloud/weather engine.

For clouded planets, distinguish:
- Observed cloud-map texture.
- Geometrically layered cloud volume.
- Procedurally reconstructed structure.
- Fully time-evolving weather.

These are not interchangeable claims.

Work on:
- Proper cloud-deck geometry.
- Multi-scale spatial structure.
- Atmospheric scattering.
- Cloud self-shadowing where feasible.
- Planetary curvature and altitude effects.
- Smooth orbital-to-near-surface transitions.
- Texture/map source fidelity.
- Stable LOD and acceptable GPU cost.

Do not claim complete volumetric clouds for all planets unless that genuinely exists, has been validated and is scientifically appropriate.

## Required regression views

Venus terminator and cloud-top, Earth day/night limb, Mars dusty atmosphere, Titan haze, giant-planet limb views, Triton and Pluto.

Re-capture Moon/Mars ground-adjacent exposure because the shared metering system changed in v3.8.

**Pass condition:** Correct atmospheric behavior, visibly improved selected worlds, stable transitions and no regression to previously fixed exposure defects.

---

# 9. WORK PACKAGE F — RINGS, SHADOWS, PARTICLES AND PLUMES

**Priority: P1 — Quality improvements with selective new techniques**

## Rings

Preserve all existing measured ring geometry, optical-depth datasets and validated orbital corrections.

Improve:
- Saturn's C/B/A ring structure and prominent gaps.
- Near-ring textures, transparency and material variation.
- Ring optical depth, scattering phase and colour.
- Ring-on-planet shadows and moon/ring occlusions.
- Near-edge-on appearance.
- Resolution-dependent banding and aliasing.
- Avoidance of exaggerated bright white lines.
- Correct label handling for enhanced brightness.
- Uranus's narrow/eccentric rings.
- Jupiter's faint rings under appropriate forward-scattering conditions.
- Neptune's faint rings and explicitly uncertain arc longitudes.
- Relevant minor-body rings.

## Advanced ring research

Evaluate the feasibility of:
- Limited near-field volumetric particle representation.
- Self-gravity wake-inspired structure.
- Density waves and ringlets.
- Spokes and propeller features.

Implement only a bounded, measurable subsystem in v3.8.1 if it adds clear visual value and doesn't destabilize the main renderer. Preserve more extensive physical and dynamic work for v3.9+.

A physically inaccurate decorative particle cloud is worse than a restrained correct ring representation.

## Plumes

For Io:
- Preserve Pele/Tvashtar geometry and justified visible-limb conditions.
- Reduce the granular/regular canopy appearance.
- Keep particle-count-independent brightness.
- Verify scattering and any enhanced gain labels.
- Avoid claiming dated volcanic activity unless modeled.

For Enceladus:
- Preserve its multiple-jet structure.
- Preserve the zero-clipping correction.
- Test varied phase angles, shadowing and overlay geometry.
- Keep the real E-ring interpretation separate from plume artifacts.

**Pass condition:** Improved close and distant ring appearance, correct occlusion and shadowing, and more convincing plumes without saturating or falsifying the science.

---

# 10. WORK PACKAGE G — MOONS, ASTEROIDS AND COMETS

**Priority: P1 — High visual importance**

The current small-moon grid demonstrates a significant lack of individuality. Several moons appear as smooth white or grey objects without recognizable terrain.

## Targeted observed-asset upgrade

First prioritize:

- Pan.
- Daphnis.
- Atlas.
- Prometheus.
- Pandora.
- Janus.
- Epimetheus.
- Helene.
- Telesto.
- Calypso.
- Hyperion.
- Amalthea and Thebe where suitable data exists.
- Phoebe, Proteus, Larissa, Himalia and other visually weak priority bodies.

Use verified spacecraft-derived geometry and controlled mosaics where available.

Ensure correct:
- Unit scale.
- Coordinate convention.
- Rotation and shape orientation.
- Surface latitude/longitude registration.
- Normal and roughness response.
- Source-resolution limits.
- Observed-versus-reconstructed labels.

For bodies without sufficient imagery, create restrained, deterministic, geologically plausible reconstruction based on available observations and evidence class.

Do not repeat identical crater/boulder noise on unrelated objects. Do not oversculpt tiny crater rims on bodies whose observations don't support those features.

## Comets and asteroids

Audit known shape models and surface properties for important targets, particularly 67P, Vesta, Ceres and relevant near-Earth asteroids.

Improve silhouette, material distinctiveness and close-inspection texture quality where supported by sources.

Do not silently give every comet the same permanent active tail. Activity should depend on an appropriate model, distance and documented assumptions.

## Acceptance examples

The upgraded Pan and Atlas should be recognizably different even with similar lighting.

The visibly weak Saturnian moons should have better silhouettes and materials, not merely stronger noise.

All changes must survive orbital and lighting integration.

---

# 11. WORK PACKAGE H — TERRAIN AND NEAR-SURFACE REGRESSION

**Priority: P1/P2**

Do not rebuild the entire surface engine in this release without proven need.

Verify the existing Moon/Mars terrain systems and fix:
- Surface exposure changes.
- Texture/heightfield registration.
- LOD transitions.
- Tile cracks and seams.
- Incorrect shadows.
- Camera clipping and penetration.
- Overly smooth/blurred close terrain.
- Ground-adjacent atmospheric behavior.
- Loading stalls when entering or leaving terrain views.

Research higher-resolution LROC and CTX/HiRISE regional imagery as a future-quality path, with limited implementation where the gain is clear and manageable.

A general walking/collision engine and planetwide advanced surface simulation should remain a major later workstream, unless isolated defects require small corrective changes.

---

# 12. WORK PACKAGE I — CAMERA, NAVIGATION AND INTERACTION RECONSTRUCTION

**Priority: P0**

Inspect and repair the navigation path together with star-rendering tests.

Cover:
- Free-flight mode.
- Orbit/focus/follow/co-rotate.
- Mouse drag and scroll.
- Wheel zoom and FOV.
- Keyboard movement.
- Search-driven travel.
- Flight cancellation.
- Switching targets mid-flight.
- Starting another journey before the previous one ends.
- Interstellar travel.
- Near-surface camera safety.
- Browser resize, focus loss and recovery.
- Reduced-motion behavior.
- High- and low-framerate operation.

Use deterministic route traces with recorded camera position, quaternion, angular velocity, selected target and relevant LOD transitions.

Camera movement must not conflict with UI keyboard focus. Preserve the Tab accessibility fix and the R free-flight binding.

Where precision requires separate local and Galactic frame handling, use explicit transform contracts instead of hidden scale multipliers.

**Pass condition:** Predictable, cancelable and continuous camera navigation with no unexplained stalling, jumping, lockups or screen-space instability.

---

# 13. WORK PACKAGE J — ACTUAL HARDWARE PERFORMANCE

**Priority: P0**

The owner previously observed travel stuttering on a Windows laptop with approximately:

- AMD Ryzen 5 5600H.
- NVIDIA GeForce RTX 3050, 4 GB VRAM.
- 16 GB RAM.
- Desktop Google Chrome.

Treat this as the baseline constrained hardware configuration, not the maximum quality ceiling.

Previous SwiftShader profiling showed improvements in CPU long tasks, but the owner still experiences lag during actual interactive exploration.

## Required approach

1. Produce a reproducible local performance package/procedure that can run on Windows without advanced coding knowledge.
2. Confirm Chrome, WebGPU backend, active GPU, driver and render resolution.
3. Measure cold, warm and repeated travel independently.
4. Collect main-thread and render timings, frame times, GPU timing where supported, memory/residency evidence and notable stalls.
5. Profile the existing `travel38` scenario plus real manually reproduced problematic journeys.
6. Distinguish camera-motion stalls from renderer stalls.
7. Trace shader compilation, texture uploads, mesh generation, workers, resource allocation, garbage collection and catalogue loading.
8. Make one root-cause correction at a time and demonstrate its effect.
9. Repeat profiling after the major image-pipeline reconstruction.
10. Never hide lag by reducing maximum-quality settings without the owner's agreement.

## Optimization candidates

- WebGPU pipeline caching/warmup.
- Predictive and cancelable preparation.
- Better Worker scheduling.
- KTX2/Basis GPU texture formats, only where suitable.
- Texture and geometry residency accounting.
- Better streaming and eviction.
- Stable LOD transition design.
- Avoiding redundant render passes and excessive overdraw.
- Avoiding needless per-frame object reconstruction.
- Efficient star instancing and visibility filtering.
- Terrain patch worker if profiling justifies it.
- GPU memory-budget-aware quality tiers.
- Better shader uniform and resource update patterns.

Suggested measurements include frame-time p50, p95 and p99, the longest frame, meaningful long tasks, GPU memory pressure indicators, first-visit stalls and camera responsiveness.

Targets must be established from baseline measurements. Do not promise 4K/60 FPS on 4 GB VRAM without evidence.

If the agent's environment has only SwiftShader, mark native-GPU results UNVERIFIED and prepare the user's test rather than inventing measurements.

---

# 14. WORK PACKAGE K — NEW INTRO / LOADING EXPERIENCE

**Priority: P1 — Deliberate visual redesign authorized**

The current SOL intro is functional but visually modest. It doesn't yet establish the emotional identity of an extraordinary astronomical explorer.

The new intro should feel like entering a serious scientific observatory or premium space atlas, not a generic gaming loading screen.

## Recommended creative direction: “Into the Universe”

The opening should use restrained, cinematic composition:

- Deep astronomical black with subtle, precisely arranged light.
- Premium typography and carefully controlled spacing.
- A strong SOL wordmark and concise explanatory subtitle.
- An elegant astronomical visual anchor: a resolved Sun, realistic planet silhouette or observed star-field composition.
- Gentle movement based on meaningful camera or lighting transitions.
- No excessive golden particles, generic random star streaks or gratuitous glass blur.
- A clear and inviting primary action such as “Begin exploration”.
- Optional direct resume to the previous view.
- Minimal distraction from the world being introduced.

The visual language should be consistent with the upgraded sky and Sun renderer.

## Actual loading

Retain truthful staged progress:
- WebGPU capability/backend checks.
- Essential datasets.
- Rendering initialization.
- Required textures and scene.
- Interactive-ready state.
- Optional background streaming.

Never simulate progress percentages detached from actual work.

Provide:
- Clear error messages.
- Useful retry/recovery where feasible.
- A precise no-WebGPU explanation.
- Keyboard navigation.
- Reduced-motion behavior.
- Fast bypass for repeat users.
- No long mandatory animation delaying interaction.
- No accidental triggering of sound, autoplay media or heavy GPU effects.

**Pass condition:** More premium first impression, no deceptive loading states, no accessibility regression, and no additional significant startup stall.

---

# 15. WORK PACKAGE L — PREMIUM UI/UX REFINEMENT

**Priority: P1**

The current interface has a worthwhile foundation; do not destroy everything merely for stylistic novelty.

Redesign the weak parts and preserve successful navigation, data provenance and accessibility.

## Desired visual design

Aim for:
- Astronomical sophistication rather than generic sci-fi clutter.
- Strong typography and information hierarchy.
- Excellent legibility over variable planetary backgrounds.
- Restrained colour palette with purposeful warm accents.
- Elegant, coherent icons.
- Consistent panel layout and spacing.
- Minimal scene obstruction.
- Smooth, physically unobtrusive transitions.
- High contrast without heavy opaque panels everywhere.
- Clearly differentiated scientific information and presentation controls.

## Required upgrades

**Search:** Fast exact matches, relevant results, predictable keyboard controls and correct travel destination.

**Inspector:** Better grouping of astronomical facts, observed/inferred tags, measurement sources and units; stable updates during flight.

**Galactic context:** More informative local navigator with clear “Model” provenance. Improve readability and optional expansion. Do not imply a fully navigable 3D Galaxy already exists.

**Camera controls:** Clear states for free flight, orbit, follow, co-rotate and selected target.

**Labels and guides:** Intelligent scale-aware clutter control, stable anchoring, no stale labels or text blocking important astronomy features.

**Timeline:** Clear UTC/TT/TDB selection, sensible current-time handling and accessible controls.

**Settings:** Organized presentation modes, sky visibility, render detail, guides, performance diagnostics and accessibility preferences.

**Panels:** Optional docking/resizing if it improves usability and can be added safely.

**Transitions:** Cancelable, frame-rate-independent, reduced-motion compatible and consistent between UI and camera.

**Accessibility:** Maintain accessible names, focus states, keyboard operation, AA contrast and adequate targets. Add manual assistive-technology verification where possible.

Avoid redesigning the interface in isolation from the upgraded renderer. The sky, intro, panels, type system and transitions should form one visual identity.

**Pass condition:** Significant improvement in perceived professionalism without sacrificing usability or the existing working interface.

---

# 16. WORK PACKAGE M — SCIENTIFIC CORRECTIONS AND CONTINUITY

**Priority: P1/P2**

The following documented items remain tracked and must be investigated or carried forward explicitly:

| Identifier / area | Required action |
|---|---|
| SCI-004 | Mimas interpolation residual, previously reported around 166 km |
| SCI-005 | Rounded small-body orbital elements and resulting positional inaccuracies |
| SCI-008 | Unknown rotation axes represented by placeholders |
| Proxima | Radius estimate and observed stellar-parameter reconciliation |
| Proxima photometry | Residual Johnson V transformation discrepancy and uncertainty |
| Hipparcos | Hp-versus-V treatment for Hipparcos-only bright stars |
| Gaia | Data provenance, distance uncertainty, epoch and proper motion |
| Satellite sizes | Preserve observed radius versus albedo-derived estimates |
| Inner Saturnian orbits | Continue comparison to Horizons; retain Pan/Daphnis gap behavior |
| Uranus rings | Preserve eccentricity, precession and correct orientation |
| Neptune arcs | Keep uncertain absolute longitudes explicitly representative |
| Other small-body rings | Clearly distinguish measured and assumed particle properties |
| Time systems | UTC/TT/TDB conversions and displayed epoch consistency |
| Frames | ICRS, ecliptic, Galactic and Galactocentric transformations |
| Ephemerides | Existing DE441/Horizons fixtures and valid time ranges |
| Atmospheres | Scientific composition/optical-depth and source verification |

Prioritize corrections that visibly affect user navigation, plotted geometry or displayed astronomical measurements.

Never silently promote an estimated property to a measured fact.

---

# 17. WORK PACKAGE N — ASSET RIGHTS AND QUALITY

**Priority: P1**

Previous reports identify three non-commercial Uranian-moon textures:

- `assets/tex/ariel.jpg`
- `assets/tex/oberon.jpg`
- `assets/tex/titania.jpg`

Review their original licence terms and the owner's intended use. Obtain suitable permitted alternatives or permission before incompatible public/commercial distribution.

Do not replace high-quality assets with inferior generative noise solely to clear a licence warning.

Every newly introduced asset must have:
- Source URL and retrieval date.
- Author/agency and correct attribution.
- Licence and distribution restrictions.
- Observational or inferred evidence class.
- Resolution and coverage.
- Processing/reprojection method.
- Orientation/registration conventions.
- Cryptographic integrity metadata.
- Runtime integration test.

Preserve the full asset manifest and source ingestion procedures.

---

# 18. WORK PACKAGE O — REGRESSION PROTECTION

**Priority: P0 throughout**

v3.8.1 must not regress on the repairs already achieved.

Mandatory protected scenarios:

- Venus terminator exposure and cloud-top exposure.
- Venus backlit limb LUT precision.
- Jupiter high-phase rings and labelled gain.
- Enceladus 20 overlapping jets and no highlight clipping.
- Io plumes' measured-versus-enhanced brightness.
- Sun visibility beyond ~1 light-year, at 1 pc and at Proxima distance.
- Close/mid/far solar rendering transitions.
- Pan in Encke gap and Daphnis in Keeler gap.
- Satellite radii from JPL/MPC sources, not generic fallbacks.
- Correct Gaia G/V treatment.
- Exact search match for Proxima.
- Tab keyboard focus, R free-flight and accessibility.
- No stale hover cards or stale enhancement labels.
- Galactic coordinate transformations and star catalogue streaming.
- Complete Earth–Proxima–Earth travel.
- Previous Saturn travel-freeze optimization.
- Clean native-WebGPU-only initialization.
- All 310 existing tests plus justified new tests.

Rebuilding a subsystem must not erase the tests or evidence of the system it replaces.

---

# 19. IMPLEMENTATION PHASES AND HARD GATES

This project has no arbitrary duration. Work systematically through the following stages.

## GATE 0 — Baseline recovery and targeted architecture audit

- Verify v3.8.0 source, assets and Git state.
- Build and run it.
- Read the supplied reports and requirements matrix.
- Inspect relevant render/navigation/UI modules.
- Establish an issue registry, architecture map and benchmark baseline.
- Identify which modules deserve reconstruction and which should be preserved.
- Record unresolved technical uncertainties.

**Deliverable:** Baseline architecture audit, defect reproduction plan and explicit reconstruction decisions.

## GATE 1 — Hardware and visual diagnostics

- Develop deterministic star and sky tests.
- Reproduce exposure, star jitter, camera and travel complaints.
- Prepare real-PC benchmark/diagnostics for the owner.
- Identify confirmed root causes versus hypotheses.
- Capture baseline screenshots and metadata.

**Deliverable:** Root-cause report and measurable correction targets.

## GATE 2 — Core image and stellar reconstruction

- Repair or rebuild stellar projection/PSF.
- Repair sky exposure and scene composition.
- Stabilize star/camera transform behavior.
- Improve star colour/brightness/size presentation.
- Rebuild solar glare and critical distance transitions.
- Preserve astronomical contracts.

**Deliverable:** Measurably stable astronomical image formation, matched stills and new tests.

## GATE 3 — Galactic sky reconstruction

- Improve the observed background's projection, colour, detail and dynamic-range handling.
- Integrate it consistently with individually rendered stars.
- Improve Galactic context readability and truth labels.
- Test multiple Galactic directions and long-distance travel.

**Deliverable:** Clearly improved sky presentation without unsupported claims of 3D Galactic rendering.

## GATE 4 — Selected high-value visual upgrades

- Replace priority small-moon geometry/materials with observed assets.
- Improve atmospheres and cloud presentation for selected representative bodies.
- Refine rings, Sun, plumes and selected terrain views.
- Preserve all science and performance constraints.

**Deliverable:** Strong, source-grounded visual gains in multiple categories, documented by matched evidence.

## GATE 5 — Website and user-experience upgrade

- Redesign the intro/loader.
- Polish the interface and Galactic context.
- Improve transitions, controls, diagnostics and information presentation.
- Verify keyboard and accessibility behavior.

**Deliverable:** A cohesive premium experience that complements the astronomical scene.

## GATE 6 — Performance and integration

- Profile changed subsystems.
- Run real-GPU tests where evidence is available.
- Fix remaining frame-time spikes and resource problems.
- Re-run astronomy and interface regressions.
- Validate long journeys and repeated session behavior.

**Deliverable:** Measured performance improvements and integration QA.

## GATE 7 — Release audit and packaging

- Full requirements audit, including carried-forward issues.
- Final screenshots and comparisons.
- Test/typecheck/asset/build verification.
- Clean-extract verification.
- Documentation and publication/licensing review.
- One complete consolidated final ZIP.

**Deliverable:** SOL v3.8.1 release candidate, then final only after its acceptance gates are satisfied.

### Important checkpoint rule

**The agent should continue working between checkpoints.** A progress report is not an automatic request for permission to proceed.

Stop for owner input only when there is a genuine blocker, a materially different high-risk architectural choice, a rights/asset decision, or an operation that would discard important working capabilities.

No stage may be silently skipped.

---

# 20. PROGRESS UPDATES DURING IMPLEMENTATION

The owner explicitly requires ongoing, transparent progress updates.

At the beginning of each gate and after meaningful discoveries, provide a concise but informative status report with:

1. **Current work:** Which system, stage and objective are active.
2. **What was inspected:** Relevant code, data, screenshots and references.
3. **What was discovered:** Confirmed root causes versus unverified hypotheses.
4. **What was changed:** Actual code/modules/assets modified.
5. **Why that solution was chosen:** Technical and scientific justification.
6. **Evidence:** Screenshots, measurements, tests and before/after comparisons.
7. **Regressions/limitations:** Anything still broken, uncertain or unsupported.
8. **Commit/checkpoint:** Recoverable Git commit or tag.
9. **What happens next:** Immediate next actions and dependencies.

Keep a durable `WORKLOG.md` and an issue register with stable identifiers.

Each meaningful rendering checkpoint should produce reviewable high-resolution screenshots, preferably with a small comparison sheet and the original image files.

Each major phase should produce a self-contained interim report in Markdown. Supply a PDF evidence summary where practical; the final release requires both formats.

**Do not repeatedly announce that work has started without producing implementation or QA evidence.**

If execution is interrupted or usage limits are reached, commit the recoverable state and leave a precise resume instruction identifying files, commits, pending work and next steps.

---

# 21. QUALITY AND ACCEPTANCE EVIDENCE

Use several distinct classes of verification.

## A. Scientific validation

Test reference calculations for:
- Star photometry and colour.
- Distances and angular sizes.
- Epoch and proper motion.
- Orbital and satellite geometry.
- Atmospheric profiles and scattering.
- Ring optical depth and geometry.
- Solar irradiance and presentation-mode behavior.

Identify observed, inferred and artistically reconstructed components.

## B. Deterministic visual QA

Capture identical camera/epoch/FOV/mode configurations between baseline and candidate.

Cover:
- Sun close/mid/far.
- Stars at rest, zoom and translation.
- The Milky Way in multiple directions.
- Exposure with Sun inside/outside frame.
- Major planets and selected moons.
- Rings, shadows, atmospheres and plumes.
- Proxima approach and return.
- UI, intro, loader and error states.

Record relevant metadata alongside every PNG.

## C. Interactive QA

Test real camera movement and controls, not just isolated fixed viewpoints.

Verify navigation, travel cancellation, selection, focus, keyboard, settings and responsiveness.

## D. Hardware QA

Collect owner-supplied real-GPU results where the agent's environment has no native GPU.

Make real-GPU screenshots clearly distinguishable from SwiftShader captures.

## E. Performance QA

Measure actual frame times and stutters, not only total CPU long-task duration.

Include the same route/configuration on baseline and candidate wherever feasible.

## F. Asset/release QA

Audit licences, provenance, checksums, sources, data files and clean extraction.

## Final acceptance rules

- No known unrepaired P0 runtime defect.
- No unexplained star jitter or invalid parallax under controlled tests.
- Sky/exposure transitions are coherent.
- Sun appearance improves in the owner's problem distances.
- No regression to corrected v3.7/v3.8 scenes.
- Improved Galactic background and representative celestial materials are demonstrated.
- The final interface and intro have consistent, usable design.
- Actual native-GPU hardware evidence is reviewed when supplied.
- Any remaining incomplete work is clearly stated and assigned to a later milestone.
- Full application compiles, runs and can be reproduced from the deliverable.

Passing unit tests alone is insufficient.

---

# 22. FINAL OUTPUTS — COMPLETE AND INDEPENDENTLY REVIEWABLE

## One consolidated application

**Filename:** `sol-solar-system-v3.8.1-final.zip`

This is the entire v3.8.1 application, not a patch archive.

It must include:
- All retained and updated modular source files.
- Every required runtime asset.
- All scientific datasets and catalogue shards.
- Ingestion tools and source-query inputs.
- Rendering code, shaders and materials.
- UI/UX and navigation source.
- Tests and QA tools.
- Configuration, manifest and lockfile.
- Documentation and release instructions.
- Updated provenance and issue register.

Do not require the owner to obtain or combine older ZIPs.

Exclude only rebuildable dependencies/build caches where appropriate, such as `node_modules`, generated `dist` and temporary caches.

Preserve original release tags, including `v3.8.0`. The new release should be explicitly tagged and reproducible.

## Reports — six complete documents in Markdown and image-rich PDF

1. **SOL v3.8.1 Complete Development and Architecture Report**
2. **SOL v3.8.1 Scientific Data, Physics and Asset Audit**
3. **SOL v3.8.1 Visual Rendering and Before/After QA Report**
4. **SOL v3.8.1 Performance, Hardware and Optimization Report**
5. **SOL v3.8.1 Requirements-to-Evidence Matrix**
6. **SOL v3.8.1 Master Handoff, Remaining Issues and v3.9/v4.0 Roadmap**

Every report must cover actual implemented work, research, testing, new problems, fixes, limitations, source references, remaining tasks and dependencies.

The PDFs must visibly embed important screenshots at readable sizes. Inspect the rendered PDF pages before delivery.

## Independent evidence

Deliver separately, in addition to documentation inside the main ZIP:

- Original high-resolution screenshot archive.
- Before/after comparison sheets.
- Screenshot metadata.
- Hardware benchmark results and traces where available.
- Relevant source/data citations and asset provenance.
- Release SHA-256 manifest and verification results.
- Detailed issue register and change history.
- Resume/handoff report for future versions.

No video is required.

Where physical-GPU execution cannot be performed by the agent, provide the owner with a practical benchmark and explicit instructions. Do not claim hardware verification until those results exist.

---

# 23. v3.9 AND v4.0 — PRESERVE THE LARGER VISION

v3.8.1 is a major visual foundation release.

It should enable, not consume, the larger scientific and exploration roadmap.

## v3.9: Genuine 3D Milky Way and deep interstellar exploration

Priority future work:
- Large-scale Gaia spatial data and appropriate uncertainty modelling.
- Spatially indexed catalogue tiles and streaming.
- Galactic stellar population models, dust and extinction.
- Distinct observed/inferred Galactic layers.
- Real 3D Galactic regions and interactive navigation.
- More realistic stellar diversity and resolved stellar environments.
- Better volumetric planetary and ring systems.
- More observed planetary/moon assets and terrain improvements.
- High-fidelity cross-scale GPU rendering.

Do not claim every Gaia source has an accurate individual 3D distance. Do not render an observationally unsupported Galaxy as though it were a measured reconstruction.

## v4.0: Integrated Galactic Expedition

The flagship goal remains convincing travel from planetary environments through Solar System space and nearby stars into a genuinely navigable Galactic region, with coherent science, visual fidelity and premium user experience.

Longer-term deep-sky, extragalactic and observable-universe ambitions remain in the roadmap, but must not derail v3.8.1.

---

# 24. EXECUTION INSTRUCTION

Begin by recovering and verifying v3.8.0, reading the handoff and requirements documents, and inspecting the existing astronomical rendering and navigation architecture.

Then implement the development stages described here, beginning with evidence-backed reproduction of the owner's real-world problems.

Treat the visual-system reconstruction as a serious engineering undertaking, not a series of arbitrary visual presets.

You may conduct further targeted web research when necessary to verify scientific data, asset rights, implementation techniques or currently supported APIs. Reuse the research provided here instead of repeating generic research unnecessarily.

**Your success is measured by whether SOL actually becomes more convincing, correct, stable and enjoyable—not by the number of lines rewritten, shaders added, tests counted or hours consumed.**

Provide meaningful progress reports throughout the work. Preserve recoverable checkpoints. Do not rush. Do not conceal limitations.

**Start actual inspection and implementation.**
