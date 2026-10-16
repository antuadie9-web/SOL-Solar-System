# SOL v3.8.1 — Independent Architecture Audit, Major Reconstruction and Visual Excellence Brief

**Project:** SOL — Solar System and Stellar Neighbourhood Simulator  
**Status:** v3.8.1 development, post-Checkpoint 2 and REV2/CONT-381  
**Repository:** https://github.com/antuadie9-web/SOL-Solar-System  
**Purpose:** Full-system technical audit, evidence-led architectural reconstruction, major visual upgrades, scientific validation, optimization and release readiness.

---

## 0. Governing philosophy

SOL is intended to become an exceptionally convincing, scientifically credible, technically sophisticated and beautifully designed astronomical exploration experience.

The objective is not merely a collection of accurate celestial spheres. It is a coherent system where astronomical data, geometry, physical lighting, materials, atmospheric scattering, stellar photometry, rendering, camera movement, spatial scale, interface design and performance work together naturally.

Use the highest reasoning and engineering capability available to solve the important problems, while using time, context and tool calls intelligently.

Do not hallucinate findings, invent scientific data, overthink settled decisions, overengineer straightforward solutions, introduce unnecessary technology or optimize without measurements.

Avoid both extremes: superficial cosmetic patching and indiscriminate full-project rewrites.

**Major subsystem reconstruction is authorized wherever objective evidence demonstrates that the existing design prevents the required quality, correctness or stability.**

Preserve scientifically sound infrastructure and successful implementations. The amount of rewritten code is never itself a measure of progress.

The master v3.8.1 requirements remain in force. This document adds an independent source-audit perspective and prioritizes the remaining reconstruction work.

## 1. Mandatory repository recovery and exhaustive inventory

Before substantial new implementation:

1. Inspect the latest local repository state, working tree, commits, branches and tags.
2. Preserve `v3.8.1-cp2` and all earlier history without modification.
3. Push the latest verified development state to the designated GitHub repository. The external audit previously observed remote `main` at `898a7fa`; newer local REV2/AST work must not be omitted.
4. Verify the push with a fresh remote fetch or clone, including all required history and tags.
5. Record the exact reviewed commit SHA. Never mix screenshots, reports, code or tests from different builds without identifying their respective revisions.
6. Recover existing QA scripts and cached outputs rather than rerunning completed work blindly.

Perform a comprehensive repository audit, including:

- Source modules and their dependencies.
- Shader functions, materials, post-processing and renderer lifecycle.
- Astronomy, numerical precision and scientific data.
- Resource creation, disposal, streaming and memory residency.
- Assets, licences, provenance and missing-data behavior.
- UI, input, navigation, persistence and accessibility.
- Test coverage, known issues, CI/QA tooling and deployment configuration.
- Build output, static asset URLs, worker bundling and browser compatibility.
- Every supported celestial object family and its presentation pipeline.

Inventory **every tracked file**, classifying source text, generated artifacts, scientific data, imagery, 3D geometry, fonts, tests, documents and other assets.

For all human-readable source files, perform a full local static review rather than inspecting only the entry points. Use automated indexing and targeted analysis to make this feasible.

For binary files, validate size, structure, metadata, decoding, integrity, coordinate conventions and provenance. Do not claim that arbitrary binary bytes are human-readable code.

Create a dependency map covering the full scene and data pipeline.

Do not spend substantial effort rereading archival historical reports that are already reflected in the current requirements unless they are needed to resolve a discrepancy.

### Gate 0 output

Produce an architecture inventory, source-risk register, asset/data inventory, scientific-validity matrix, technical-debt assessment, benchmark readiness review and a prioritized reconstruction decision matrix.

Each proposed reconstruction must have:

- Existing implementation and owning files.
- Observed defect or demonstrated architectural limitation.
- Scientific/visual/performance impact.
- Proposed replacement or improvement.
- Alternative approaches considered.
- Expected benefits and costs.
- Regression risks.
- Measurable acceptance tests.

Separate confirmed defects from unverified risks and discretionary aesthetic improvements.

## 2. Shared radiometry, exposure and image-formation reconstruction

**Highest architectural priority.**

Audit the relationships among:

- Physical irradiance and source radiance.
- Angular size and apparent brightness.
- Point-source versus resolved-disc representations.
- Physically derived illumination and display presentation.
- The scene exposure meter.
- Sky exposure and dark-adapted viewing modes.
- Atmospheric transmittance and scattering.
- Ring illumination and coverage-aware metering.
- Bloom, glare, diffraction and PSF integration.
- Tone mapping, colour management and output encoding.
- Scientific, Exploration and Cinematic modes.

The repository currently places important responsibilities across `render/engine.ts`, `render/presentation.ts`, `render/sun.ts`, `render/points.ts`, `render/starDisc.ts`, `render/planetMaterial.ts`, `render/ringSystem.ts` and `render/sky.ts`.

These systems must share explicit contracts rather than silently implementing competing brightness rules.

Investigate whether an internal radiometric contract layer can centralize quantities and ownership without producing a large abstraction framework.

### Required principles

Physical source properties must not change when changing camera mode or renderer representation.

Exploration enhancements must be identifiable as presentation transformations.

Scientific mode must not silently apply arbitrary minimum brightness floors, nonphysical night-side illumination, decorative spikes or unlabelled material enhancements.

Specifically investigate the unresolved-body brightness floor in `render/engine.ts`. Determine whether it can influence Scientific mode and whether its effect is clearly disclosed.

Preserve the corrected Sun point/disc handover, continuous glare and EXP-381-03 exposure behavior.

Validate point-source flux conservation, resolved-disc surface radiance and integrated image brightness as separate quantities.

Do not add arbitrary distance-specific brightness caps.

Test the complete Sun transition from near-Solar distances to interstellar distances, including 0.25–300 AU, 3,000 AU and 1 pc.

Validate equivalent stellar transitions, including Proxima and other representative spectral types.

Measure numerical continuity **and perceptual continuity in motion**.

Audit the remaining unusually large exposure changes and viewport-entry/exit cases using recorded frame sequences.

For rings, verify exposure protection at every relevant screen-coverage boundary, including the last visible sliver.

### Acceptance

No unintended brightness inversions, sudden discontinuities, stale-cache exposure dependence, duplicate light contributions or unlabelled physical-display substitutions.

Every shared lighting contract must have numerical tests and reproducible visual scenarios.

## 3. Atmospheric and cloud rendering reconstruction — WP-E

**Primary visual reconstruction priority.**

SOL already contains atmospheric LUTs and scattering approximations. Do not discard them without first understanding their mathematical and implementation limitations.

Audit:

- Rayleigh and Mie scattering.
- Absorption and species-specific optical depth.
- Density profiles and scale heights.
- Multiple scattering and its approximations.
- Sunlight transmittance.
- Ground/surface irradiance.
- View-path extinction.
- Limb brightness.
- Day/night transitions and twilight.
- Aerial perspective.
- Cloud illumination and cloud shadows.
- Phase-angle response and backlighting.
- Exposure and tone-mapping interactions.
- Numeric precision, LUT resolution and interpolation error.

Review the existing implementation against relevant Hillaire and Bruneton atmospheric-rendering methods, accounting for their assumptions and limitations.

Do not blindly transfer Earth atmospheric constants or scattering behavior to other planets.

### Body-specific requirements

**Earth:** Preserve correct Rayleigh behavior, improve physically meaningful cloud coverage, cloud depth, shadows, terminator appearance, limb scattering and orbital-to-near-surface continuity. Investigate an appropriate scalable cloud representation rather than relying only on a static global texture.

**Venus:** Verify the corrected double-counted haze and terminator. Improve cloud-deck depth, illumination gradients, high optical depth and twilight behavior without allowing arbitrary night-side fill.

**Mars:** Improve dust/aerosol scattering, low-altitude horizon behavior, haze, sunsets and transitions between regional atmospheric conditions. Investigate optional scientifically grounded dust-state variation rather than implying one permanently uniform atmosphere.

**Titan:** Prioritize detached haze, deep atmospheric optical depth, wavelength-dependent coloration, twilight and backlit atmospheric layering. Preserve the observational distinction between visible haze and its obscured surface.

**Jupiter and Saturn:** Improve credible cloud-layer shading, limbs, bands, haze and body-specific atmospheric structure. Avoid treating coloured surface maps as complete atmospheric volumes.

**Uranus and Neptune:** Improve methane-related coloration, limb behavior, haze, observed cloud/storm structure where reliable sources exist, and appropriate time dependence.

**Pluto and Triton:** Improve thin atmospheric and haze-layer presentation, grazing-angle scattering and observational constraints.

**Other tenuous atmospheres and exospheres:** Do not add visually dramatic opaque shells without scientific justification.

### Architecture decision

Allow selective reconstruction of atmosphere shaders, LUT generation, cloud rendering and compositing.

Use Three.js WebGPU and TSL as the default implementation.

Raw WebGPU or WASM may be considered only for an isolated, measured bottleneck or a capability unavailable through the selected rendering API. Neither is a default requirement.

### Acceptance

Matched orbital, limb, terminator, eclipse, night-side, backlit and near-surface images for relevant bodies.

Verify atmosphere/surface continuity while moving the camera, not only in fixed screenshots.

Compare representative images against real spacecraft observations with matching geometry wherever practical.

## 4. Planetary rings and near-field reconstruction — WP-F

**High-priority visual and physical reconstruction.**

Retain measured radial optical-depth profiles, ring radii and orbital geometry.

Audit the integration between far-field annulus shading, ring-profile LOD, narrow rings, near-field particle impostors, ring shadows and exposure metering.

Investigate:

- Correct normal optical depth.
- Lit/unlit ring branches.
- Forward and back-scattering.
- Opposition effects.
- Phase-angle response.
- Radial ring structure.
- Near/far transparency and alpha compositing.
- Shadow projection onto planets and rings.
- Eclipse and partial-shadow transitions.
- Edge-on geometry and realistic thinness.
- Ring-plane crossing and close fly-through behavior.
- Near-field particle statistics and spatial distribution.
- Moons embedded within or adjacent to the ring system.
- Temporal and camera-relative particle stability.
- Performance under dense ring coverage.

The present near-field Saturn field is an approximation. It does not include collision dynamics or self-gravity wakes; do not label it as an exact physical simulation.

Determine whether a stronger statistical or geometry-aware near-field representation could create a convincing sense of particle structure without requiring infeasible individual-particle dynamics.

Prioritize Saturn's C, B and A rings, Cassini Division, Encke gap and representative ring-moon regions, then the scientifically relevant rings of Uranus, Neptune and Jupiter.

Complete the existing RING-381-01/02 verification before further changes.

### Acceptance

No white frames, persistent black slabs from compositing errors, sudden LOD pops, incorrect near/far ordering or unstable exposure.

Require face-on, oblique, edge-on, ring-plane and ring-shadow views, including continuous sweeps.

## 5. Surface-material and partial-mosaic reconstruction

**High-priority content and shading reconstruction.**

Preserve observed mosaics and shape models.

Reconsider the current large general-purpose surface-material function if its shared structure makes body-specific scientific shading difficult or contributes to recurrent regressions.

Separate applicable material concerns such as:

- Surface reflectance and phase functions.
- Texture and normal frequency.
- Geometric relief versus shader relief.
- Measured maps versus inferred reconstructions.
- Regolith and ice behavior.
- Albedo and roughness calibration.
- Specular response where physically appropriate.
- Surface shadowing and topographic self-shadowing.
- Texture filtering, mipmaps and derivatives.
- Highlight preservation and exposure.
- LOD continuity.

Avoid one universal crater, noise or reflectance model for every rocky, icy, porous, mantled or volatile-rich body.

### AST-381-03 completion

Finish the ongoing observed/reconstructed transition work before starting an unrelated full material rewrite.

All six bodies require final validation:

Ariel, Titania, Oberon, Triton, Pluto and Charon.

Verify absence of:

- Dark filtering outlines.
- Bright boundary hairlines.
- Dotted crater rims.
- Abrupt normal discontinuities.
- Reconstruction colour bands.
- Resolution-dependent halos.
- Mipmap/LOD artifacts.
- Incorrect observed-region modification.

Keep reconstructed regions visibly honest in the inspector and provenance documentation.

Do not invent high-resolution geological detail and describe it as measured.

### Small-moon materials

Preserve Cassini-derived meshes.

Validate procedural sub-resolution crater distributions by body and available observation.

Retain geological diversity: smooth mantled surfaces, irregular porous structures, regolith, icy relief and scientifically supported differences.

Fix overbright, clay-like lit surfaces through correct reflectance and exposure—not arbitrary darkening.

Where rights-cleared controlled spacecraft mosaics exist, evaluate their suitability before generating replacement surface patterns.

### Acceptance

Matched close, medium and far-distance scenes at multiple phase angles and illumination directions.

Use observational references with documented viewing geometry whenever possible.

## 6. Lunar and Martian terrain reconstruction — WP-H

Preserve the existing cube-sphere quadtree, DEM tile pyramid and patch-local precision architecture.

Audit and improve:

- DEM data quality and spatial resolution.
- Regional imagery availability and registration.
- Terrain patch continuity.
- Skirts, seams and cube-face transitions.
- Screen-space refinement and LOD hysteresis.
- Tile streaming and deferred rebuilds.
- Terrain normals and derivative precision.
- Surface albedo and topographic detail matching.
- Realistic local slopes, craters and geological structures.
- Low-Sun terrain shadows.
- Horizon approximation accuracy.
- Occlusion and depth precision.
- Camera movement at low altitude.
- Ground contact, clipping and collision avoidance.
- Practical surface exploration and navigation.

The present application documents that metre-scale terrain and full landing/walking functionality are not complete. Do not present these as already implemented.

Select terrain regions according to actual observational data quality and visual potential.

Don't claim a particular local site is accurately modeled unless it is supported by appropriate data.

### Acceptance

Continuous orbit-to-ground camera motion with stable geometry and no visible popping or severe frame-time spikes.

Near-surface images must withstand realistic scale and material inspection, not just distant orbital screenshots.

## 7. Solar, stellar and Galactic presentation

Preserve the recent stellar-coordinate precision fixes and measured-radius work.

Audit the physical/display distinction for:

- Solar photosphere and limb darkening.
- Granulation and representative activity.
- Glare, PSF and optical scattering.
- Star colour and spectral approximations.
- Point-spread stability at different DPRs.
- Point-to-resolved-disc transitions.
- Per-channel stellar limb behavior.
- Apparent flux over large distances.
- Star catalogue streaming and visibility.
- Gaia sky-map tone and diffuse-light calibration.
- Catalogue stars versus embedded panorama stars.
- Near-Solar and interstellar view transitions.

Validate that any modelled photospheric features are labelled appropriately rather than represented as direct observations of distant stellar surfaces.

For the Gaia backdrop, improve colour and depth cues while retaining the observed data's limitations.

Do not turn the Milky Way into a fictional collection of brightly coloured nebulae solely for visual impact.

Do not begin the full navigable 3D Milky Way planned for v3.9 inside this v3.8.1 reconstruction.

### Specific streaming risks

Audit catalogue activation, shard loading, residency boundaries and distance-triggered LOD.

Verify that stars do not appear or disappear abruptly merely because data arrive while the camera is moving.

## 8. Astronomical science, geometry and numerical correctness

**Scientific validity remains a release-critical requirement.**

Review:

- Julian dates and time-scale conversions.
- UTC, TAI, TT, TDB and UT1 handling.
- Leap-second validity and future-time warnings.
- Frame orientation and transformations.
- J2000/ICRF/ecliptic conventions.
- Planetary and lunar ephemerides.
- Position interpolation and extrapolation.
- Orbital elements and perturbation limitations.
- Moon rotation and synchronous assumptions.
- Body shape, reference radii and ellipsoids.
- Ring and moon orbital alignment.
- Eclipses and occlusion geometry.
- Stellar positions and proper motions.
- Photometry, spectral colour and distances.
- Catalogue uncertainty and provenance.
- Scientific data ingestion and numerical tolerances.

### Newly identified risk: streamed ephemeris transitions

The existing source loads some ephemeris systems after the initial frame and selects between fallback models and sampled data.

Audit whether this causes positional discontinuities when a new dataset becomes available.

Compare both representations at the activation epoch and measure the discrepancy.

If necessary, design a scientifically defensible activation strategy that maintains coherent rendering and navigation without falsifying the underlying ephemeris.

### Unresolved point brightness

Investigate the minimum displayed brightness applied to unresolved planets and moons.

Ensure that any findability enhancement is isolated from physically grounded Scientific mode and is appropriately labelled elsewhere.

### Ephemeris accuracy

Retain the documented high-accuracy Horizons-sampled windows.

Do not silently extrapolate outside source validity.

Resolve SCI-004, SCI-005 and SCI-008 according to the master register, and audit other outstanding science items.

Distinguish geometric simulation from light-time-corrected apparent observations. Do not claim observer-apparent accuracy unless such corrections are implemented and validated.

### Acceptance

Automated reference-vector comparisons, temporal boundary tests, frame-conversion invariants, orbital/rotational checks, source uncertainty reporting and reproducible scientific fixtures.

## 9. Renderer and application architecture

Target maintainability and correctness, not aesthetic code rearrangement.

The present central rendering and UI controllers contain many responsibilities.

Investigate careful separation of:

- Scene and object lifecycle.
- Astronomical state synchronization.
- Physical lighting and photometric metering.
- Presentation modes and optical effects.
- Celestial-body renderer families.
- Texture/geometry/LOD resource managers.
- Ring and atmospheric subsystems.
- Camera/flight/navigation state.
- Input and interaction.
- UI view-model/state.
- Diagnostics and QA instrumentation.

Avoid introducing a generic engine abstraction or architectural framework unless it solves a documented SOL problem.

Maintain one authoritative state for physical simulation quantities.

Avoid scattered duplicated equations, hidden shared mutable state, undocumented shader constants and multiple sources of truth for exposure or camera transforms.

### WebGPU-only policy

Desktop Google Chrome, hardware WebGPU only.

The code currently disables Three.js's WebGL fallback using a private `_getFallback` property.

Audit the reliability of that method against the pinned Three.js version. Preserve the required hard failure if native WebGPU is unavailable.

Do not silently introduce a WebGL2 fallback or mobile rendering path.

Do not upgrade Three.js solely because a newer version exists. Upgrade only after checking compatibility, performance, shaders, API behavior and regression results.

## 10. UI/UX, intro, information and navigation

Treat the project as a premium scientific exploration product.

Audit:

- Overall typography, layout, colour and information hierarchy.
- Text clarity, contrast and spacing.
- Panels, dialogs and settings.
- Search, selection and object discovery.
- Context-sensitive inspector data.
- Galactic map and nearby-star view.
- Breadcrumb and navigation logic.
- Camera controls and flight transitions.
- Loading, errors, recovery and reduced motion.
- Keyboard support and accessibility.
- Diagnostics and scientific evidence labels.
- Desktop viewport and high-DPI adaptation.
- Responsiveness of interaction, not mobile support.
- UI frame-time cost and DOM update behavior.

### Galactic context

Complete the expanded-map layout so it cannot overlap the main navigation, time dock or important controls.

Improve legibility, scale and presentation of observed, inferred and modelled structures.

### Intro

Improve the observed solar anchor's treatment and editorial quality.

Preserve its real observational source, date and credit.

A dated solar observation must not be described as the live solar surface at arbitrary simulation epochs.

Connect the intro transition coherently to the live simulation, without unnecessary loading animations.

### Camera

Audit mouse smoothing, free flight, orbit control, body selection, precision, acceleration, collision and transition cancellation.

Test continuous camera travel across body-fixed, heliocentric and interstellar contexts.

A correct scientific simulator with uncomfortable controls is not an acceptable final product.

## 11. Performance, stability and memory architecture

Preserve maximum feasible visual fidelity while making performance evidence-driven.

The target test machine is:

- AMD Ryzen 5 5600H.
- NVIDIA RTX 3050 Laptop GPU with 4 GB VRAM.
- 16 GB system RAM.
- Desktop Google Chrome, hardware WebGPU.

These specifications are a practical acceptance target, not a ceiling on optional visual quality.

Audit:

- Main-thread CPU frame cost.
- GPU pass timings where supported.
- Shader compilation and pipeline creation.
- Resource uploads and texture streaming.
- GPU memory pressure and estimated residency.
- Terrain patch build time.
- Worker utilization and fallback behavior.
- Draw calls and instancing.
- Transparent overdraw.
- Bloom/post-processing cost.
- Rendering resolution, DPR and MSAA.
- High-resolution texture and asset budgets.
- Cold versus warm journeys.
- Object-selection and travel hitches.
- Interstellar star-catalogue streaming.
- Garbage collection and allocations.
- Resource cleanup and device-loss handling.
- Browser resize and visibility changes.
- Long-session stability.

The current residency estimates are not equivalent to measured GPU allocation or VRAM usage. Make that distinction explicit.

Avoid assuming a performance problem's cause from a single screenshot or a software renderer.

Run the existing RTX 3050 benchmark and incorporate its raw JSON results when available.

Set performance budgets from hardware evidence. Target smooth, responsive interactive exploration and minimize high-percentile frame-time spikes.

Do not claim guaranteed 4K/60 FPS on 4 GB VRAM without measurements.

Provide sensible adjustable quality while protecting scientific correctness.

## 12. QA architecture and CONT-381 completion

Preserve the existing regression harness and all 330 reported tests, then add meaningful coverage wherever defects reveal gaps.

Rerun the actual suite before trusting the reported count.

Complete the documented 10 continuity contracts and 13 transition risks.

For important transitions, test:

- Immediately before a threshold.
- Exactly at the threshold.
- Immediately after the threshold.
- Continuous approach and recession.
- Different FOV and DPR settings.
- Fixed and adaptive exposure.
- Relevant viewing modes.
- Different camera and scene orderings.
- Cold and warm resource states.

Do not equate successful static captures with temporal correctness.

### Evidence standards

Every confirmed defect must have:

- Reproduction conditions.
- Root-cause analysis.
- Affected files/modules.
- The correction implemented.
- Unit/integration tests.
- Before/after evidence.
- Additional regression coverage.
- Remaining limitations.

For visual comparisons, record epoch, camera position, orientation, distance, FOV, lighting, exposure, quality settings and adapter type.

Do not fabricate hardware screenshots, FPS or benchmark results.

If the environment lacks a native GPU, label its results SOFTWARE WEBGPU / UNVERIFIED ON HARDWARE.

Use high-resolution original screenshots rather than relying exclusively on small contact sheets.

For motion, record a video or sufficiently dense original frame sequence.

## 13. Research and source authority

Perform targeted research before replacing complex scientific or visual systems.

Prefer original scientific publications, mission datasets, official framework documentation, instrument publications and verified source repositories.

Relevant starting points:

- Three.js WebGPURenderer documentation: https://threejs.org/docs/pages/WebGPURenderer.html
- Hillaire atmospheric rendering: https://doi.org/10.1111/cgf.14050
- Bruneton atmospheric implementation: https://ebruneton.github.io/precomputed_atmospheric_scattering/
- JPL Horizons: https://ssd.jpl.nasa.gov/horizons/manual.html
- NAIF SPICE time conventions: https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/time.html
- NASA PDS: https://pds.nasa.gov/
- USGS Astrogeology: https://www.usgs.gov/centers/astrogeology-science-center
- ESA Gaia: https://www.cosmos.esa.int/web/gaia

For every research-derived change, record the source, applicable assumptions, data epoch, uncertainty and relevance to SOL.

Do not cite papers as proof that a particular shader implementation is correct without checking the actual equations and code.

## 14. Assets, licensing and scientific provenance

Review the entire asset manifest and all added source files.

The existing validation reports zero unmatched and zero non-commercial assets, but this is not a substitute for checking source rights and attribution.

Retain a per-asset record of:

- Original source.
- Product/instrument and observation epoch.
- Data resolution and coverage.
- Processing operations.
- Coordinate reference/projection.
- Licence/usage conditions.
- Credit requirements.
- Observed versus reconstructed classification.
- Whether the image is true colour, enhanced colour or grayscale/tinted.

NASA content may have third-party or endorsement-related restrictions. ESA products can have specific licence obligations.

Do not assume that every publicly downloadable space image is unrestricted.

No hidden copyrighted imagery, unlicensed textures, fabricated source attributions or silent substitution of lower-quality data.

## 15. Prioritization and efficient execution

Prioritize work using the combination of:

1. Scientific correctness and impact.
2. Confirmed visual severity.
3. Number of systems affected by the root cause.
4. Expected improvement in perceived realism.
5. Navigation/performance impact.
6. Regression and implementation risk.
7. Engineering cost and evidence availability.

Do not prioritize a reconstruction merely because it would be large or technically impressive.

### Recommended execution sequence

**Gate A — Recovery and independent audit**

Recover and push latest work, inventory the entire project, verify baseline, audit actual code and define reconstruction decisions.

**Gate B — Finish current REV2 and shared consistency defects**

Complete AST-381-03, outstanding solar/ring acceptance and confirmed scientific/rendering continuity problems.

**Gate C — Major atmospheres and clouds reconstruction**

Execute WP-E with validated per-body physical approaches.

**Gate D — Rings, moon materials and surface realism**

Complete WP-F, relevant WP-G and the most visually consequential material issues.

**Gate E — Terrain and exploration**

Complete WP-H and close-range camera/navigation requirements.

**Gate F — Stellar, Galactic, Sun and UX integration**

Improve sky/optics, UI, intro and information presentation without starting the v3.9 Galaxy rebuild.

**Gate G — Native hardware profiling and optimization**

Integrate RTX 3050 results, address measured bottlenecks and polish continuous travel.

**Gate H — Final scientific, visual and engineering release QA**

Complete regression, rights review, issue accounting, final reports and release packaging.

These are execution gates, not a mandatory fixed number of Git checkpoint tags.

Create recoverable checkpoints where useful, while continuing autonomously through approved tasks.

## 16. Usage efficiency requirements

Use one coherent agent workflow. No unnecessary sub-agent orchestration.

Before a costly operation, establish what question it answers and what result would change the next decision.

Reuse research, source assets, code, QA environments, screenshots and diagnostics already available.

Favor small discriminatory tests before launching large screenshot batches.

Do not rerun completed tests merely to fill a report.

Batch related capture jobs where appropriate, while preserving reproducibility and build identity.

Avoid repeated sandbox setup by using persistent caches and resumable scripts.

Save and push verified progress at meaningful intervals, particularly before long tests, major rewrites and usage limits.

Keep concise progress communication and detailed milestone reports.

Spend additional reasoning and implementation effort whenever the scientific or engineering importance justifies it. **Token efficiency must not become an excuse for shallow analysis or unverified changes.**

## 17. Required phase and final deliverables

Each substantial phase must deliver:

- Full implementation summary.
- Commit identifiers and source-file references.
- Architecture/research decisions.
- Scientific-data and physical-model assumptions.
- Tests and actual results.
- Native or software adapter identification.
- Original screenshots at useful resolution.
- Matched before/after comparisons.
- Diagnostic views and continuous-motion evidence.
- Performance metrics where available.
- Known defects and limitations.
- Updated issue register.
- Remaining dependencies and next-step plan.

Reports must be supplied in Markdown and reviewed, image-rich PDF.

Screenshots, video evidence and diagnostics must be provided as separate easy-to-review files as well as included in the complete archive where appropriate.

Complete the established project report set; do not fabricate or omit required reports.

For final release:

- Verify full source, assets and history.
- Reproduce the build from a clean checkout.
- Run test/typecheck/asset validation.
- Verify runtime and loading behavior.
- Complete hardware validation or clearly document missing hardware evidence.
- Inspect all final PDFs.
- Audit unresolved issue severity.
- Verify release ZIP extraction, integrity and file contents.
- Push the final verified state and tag to GitHub.

No silent requirement removal, hidden defect closure or claims unsupported by evidence.

## 18. Release acceptance principles

SOL v3.8.1 must demonstrate clear improvement over v3.8.0 and Checkpoint 2 in:

- Astronomical scientific credibility.
- Physical lighting and image formation.
- Planet and moon visual realism.
- Atmospheres and clouds.
- Rings and scattering.
- Surface materials and terrain.
- Stellar and Galactic presentation.
- Camera/navigation quality.
- UI/UX refinement.
- Interactive stability.
- Frame-time performance.
- Data/source transparency.
- Testability and recovery.

Every known critical defect must be resolved before final acceptance.

For lower-severity limitations, provide explicit documentation and evidence rather than claiming perfection.

If a requested feature is technically infeasible within the existing platform and scientific constraints, demonstrate why and propose the strongest viable alternative.

Do not compromise on correctness, invent observations or hide unsupported claims.

**Final instruction:** Work systematically, intelligently and with maximum justified effort. Preserve good architecture, reconstruct weak subsystems where evidence warrants it, and make the completed simulator substantially more convincing in actual motion and use—not merely more complex in source code.

---

**End of master brief.**