# SOL — prioritized issue tracker (updated for v3.5.0)

Status: **FIXED** (code + test/evidence in repo) · **PARTIAL** · **OPEN** · **BLOCKED** (needs something unavailable here).
Severity P0 = correctness/stability blocker, P1 = major fidelity/UX gap, P2 = polish/coverage.

| ID | Sev | Area | Finding (evidence) | Status / where |
|---|---|---|---|---|
| SCI-001 | P0 | Ephemeris | Saturn/Uranus/Neptune/Mars moons from mean elements off by up to 2.4 million km (R-006) | FIXED — sampled tier + osculating states; `tests/astro/ephemeris.test.ts` |
| SCI-002 | P0 | Ephemeris | Small-body elements truncated to 3 s.f. → 10⁶ km errors (R-004) | FIXED — `tools/ingest/sbdb.mjs` |
| SCI-003 | P2 | Ephemeris | VSOP87B Neptune 2.4″ at 2075 (budget 2″) — outside sampled window | FIXED v3.4 — secondary 1900–2200 Horizons DE441 barycentre tier; Neptune 2075 now 0.080″; exemption removed |
| SCI-004 | P2 | Ephemeris | Mimas interpolation error 166 km (≈0.9·10⁻³ a) | OPEN — halve step or J2-aware propagation |
| SCI-005 | P1 | Small bodies | `smallbodies.bin` elements rounded (~4 s.f.) → O(10⁵ km) for points | OPEN — on-demand full-precision SBDB fetch when an object is selected/approached |
| SCI-006 | P0 | Frames | Moon/E5 precession in longitude only (R-003) | FIXED |
| SCI-007 | P1 | Time | TT−UTC model wrong before 2017; no TDB/UT1 distinction (R-009) | FIXED — `src/astro/time.ts`, `tests/astro/time.test.ts` |
| SCI-008 | P1 | Rotation | Unknown spin axes silently drawn at RA 0/Dec 90; unmeasured moons assumed synchronous | PARTIAL — labelled in inspector; real pole data per body still to source |
| SCI-009 | P1 | Ephemeris | Pluto 2-body barycentre orbit 5.5 million km off | FIXED — Horizons sampled barycentre + Charon |
| SCI-010 | P2 | Ephemeris | Halley 27 million km (2-body from 1994 elements) | FIXED in window (sampled); outside window labelled extrapolation |
| GPU-001 | P0 | Backend | three r186 auto-falls back to WebGL2 | FIXED — fallback removed, backend asserted (R-010) |
| GPU-002 | P0 | Stability | Device loss silent (black canvas) | FIXED — explicit error screen; recovery (re-init) OPEN |
| GPU-003 | P1 | Stability | SwiftShader GPU-process crash in asteroid compute pass | DIAGNOSED — any WebGPU compute (even raw, no three.js) kills SwiftShader on Chromium 154 arm64 (R-013); hardware check in RTX3050 guide §2a |
| BOOT-001 | P0 | Startup | Missing required asset → crash (reproduced) | FIXED — staged boot with required/optional lists |
| BOOT-002 | P0 | Memory | All surface maps eager-loaded, hi maps never evicted, size-changing re-upload | FIXED — `TextureStore` (lazy, budget, LRU, dispose) |
| PERF-001 | P1 | Perf | No frame-time / residency instrumentation | FIXED — `engine.diagnostics()` + overlay; GPU timestamp queries OPEN |
| PERF-002 | P1 | Memory | No GPU-compressed textures (KTX2/Basis) | OPEN — needs target-GPU format test + transcoder pipeline |
| PERF-003 | P1 | Perf | Real-GPU frame-time baseline | BLOCKED — no GPU in build environment; protocol in `docs/qa/benchmark-protocol.md` |
| CAM-001 | P0 | Camera | Wheel/drag ignored during travel ("stuck") | FIXED — gestures cancel flight preserving view direction |
| CAM-002 | P1 | Camera | NaN/inside-body states possible | FIXED — finite guard + min-distance clamp |
| CAM-003 | P1 | Camera | Inconsistent pixel-ratio formula boot vs settings | FIXED — `pixelRatioFor()` |
| CAM-004 | P1 | Camera | Full state machine (Surface/Tour/Galactic), bookmarks, undo | OPEN — Phase 6/7 |
| SUN-001 | P1 | Sun | Sun vanished below 0.55 px | FIXED — photometric point source with flux-conserving cross-fade |
| SUN-002 | P1 | Sun | Disc clipped white until 420 px wide | FIXED — exposure weights the disc from ~8 px; verify on hardware |
| SUN-003 | P1 | Sun | Corona/chromosphere/eclipse corona | FIXED — physical Baumbach corona + chromosphere, eclipse metering (R-015) |
| SUN-004b | P0 | Sun | Owner: close/mid Sun immature, white ball | IMPLEMENTED, VISUALLY UNAPPROVED — new photosphere, metering, glare policy, 3 looks (R-020); owner choice of look pending; hardware look NOT TESTED |
| SUN-005 | P2 | Sun | Dated HMI-informed active-region layer | OPEN — licensed multi-epoch reprojection needed |
| SUN-007 | P1 | Sun | Granulation hash periodic (≈9.7 cells) → diagonal banding at the limb | FIXED v3.5 — PCG3D hash + second warp octave |
| SUN-006 | P2 | Sun | Prominences / illustrative flares (toggle) | PARTIAL v3.4 — simulated limb prominences with toggle and physically scaled Scientific look; flares not implemented |
| EXP-001 | P0 | Exposure | NaN exposure on exact night-side views → permanent white frame | FIXED (R-014) |
| EXP-002 | P0 (v3.5 audit) | Exposure | Bright bodies clipped (measured on v3.4 screens: Io 45 %, Triton 47 %, Europa 32 %, Vesta 35 %, Pluto 40 %, 67P 80 % of disc pixels with a channel ≥ 250) | FIXED v3.5 (software captures) — highlight-protected metering from per-map p99 statistics × photometric peak; Io 0.001 %, Triton 0 %, Europa 0.008 %, Vesta 0.001 %, Pluto 0 %, 67P 0 %; hardware look pending |
| SUN-004 | P2 | Optics | Bloom haloed correctly exposed bodies | FIXED — threshold 6× display white (verify on hardware) |
| ORB-001 | P1 | Overlays | Fixed 720-vertex orbits, nearest-vertex phase | FIXED — adaptive conic (chord ≤1.5·10⁻⁴ r), exact phase, tests |
| ORB-002 | P1 | Overlays | Heliocentric orbits cross the view near a planet ("spaghetti"); comets at level 1 | FIXED — context fade to zero, comets at level 2 |
| ORB-003 | P1 | Overlays | Sampled ephemeris trajectory, apsides/nodes markers | FIXED — amber ephemeris trajectory ±½ period, Pe/Ap/☊/☋ landmarks; legend in Guides panel (v3.3) |
| ORB-004 | P0 | Overlays | Owner: lines vibrate/shimmer in distant views | FIXED (code + numeric test) — relative-to-eye hi/lo vertices (R-019); hardware slow-pan video NOT TESTED |
| ORB-005 | P1 | Overlays | Owner: guide clutter, always-on spaghetti | FIXED — 5 guide modes, clean default, inside-orbit suppression, spin axis/equator only in scientific mode |
| AST-001 | P1 | Assets | 3 shape models unused despite README claim | FIXED — wired |
| AST-002 | P1 | Assets | Ariel 43 %, Oberon 58 %, Titania 50 % unobserved | FIXED — masked, labelled reconstruction + coverage row; albedo calibration corrected (R-016) |
| AST-003 | P1 | Assets | Licences: 31 files personal/non-commercial (Albers mosaics) | PARTIAL v3.4 — 28 of 31 replaced by USGS public-domain / NASA PIA17214 mosaics (tools/ingest/usgs_mosaics.py); Ariel/Titania/Oberon remain NC (no PD global mosaic located) |
| AST-004 | P1 | Assets | Ryugu/Itokawa/Ida/Lutetia/Miranda/Umbriel need mission shapes/maps | OPEN — family reconstructions (tier C) shipped and labelled; licensed JAXA/PDS products to verify |
| AST-005 | P0 | Visual identity | Owner: bodies look alike (shared 7-lobe/26-crater + one fBm recipe) | FIXED for featured bodies — profiles + 7 shape / 8 surface families (R-021); owner visual sign-off pending |
| AST-006 | P2 | Assets | GLB import kept first mesh only | FIXED — all primitives merged, content reported (R-022) |
| AST-007 | P2 | Assets | Byte-duplicate JetBrains Mono 500 file | FIXED — removed |
| TYPE-001 | P2 | Code | Render modules under `@ts-nocheck` | OPEN — incremental typing |
| UX-001 | P1 | UI | Reduced motion, diagnostics overlay, texture budget | FIXED |
| UX-002 | P0 | UI | Owner: UI not premium/complete | IMPLEMENTED, VISUALLY UNAPPROVED — full redesign (see CHANGELOG 3.3.0); still OPEN: drag-resize/dock panels, compare mode, i18n string tables, screen-reader audit with real AT |
| UX-003 | P2 | UI | Labels drawn across nearer bodies | FIXED |
| CAM-005 | P1 | Camera | Surface explorer, Galactic navigator, cinematic flight modes | OPEN — orbit/free/travel/tour/co-rotate exist; others Phase 4/7 |
| QA-001 | P1 | QA | Playwright Chromium 141 loses SwiftShader device after canvas configure | WORKED AROUND — harness uses Debian Chromium 154 (R-023) |
| GAL-001 | P0 | Scope | No 3D stars / galaxy / DSOs / exoplanets | PARTIAL — 335,865 stars in true 3D (GCNS + Hipparcos), 157 navigable named stars (R-018); Galaxy model, Gaia DR3 bulk tiles, DSOs, exoplanets OPEN |
| GEO-001 | P1 | Cartography | v3.3 Vesta map 150° off (Claudia vs IAU-2014 system) and Charon map 180° off; Pluto/Charon/Triton maps contained invented fill in unobserved latitudes | FIXED v3.4 — USGS mosaics re-indexed from ISIS labels, verified by Marcia crater (Vesta) and Herschel (Mimas); unobserved parts flagged noData → labelled reconstruction |
| TONE-001 | P1 | Colour | AgX desaturated the photosphere and planet colour to near-grey (measured) | FIXED v3.4 — Khronos PBR Neutral default, AgX selectable; hardware look NOT TESTED |
| RING-001 | P1 | Rings | No near-field ring structure | PARTIAL v3.4 — particle slice (a⁻³ sizes, τ density, shear, shadow) within ~90 m of the plane; wakes, collisions, particle shadowing, mid-range layered self-shadow OPEN |
| CAT-001 | P1 | Catalogues | Single 13 MB star file, no streaming contract | FIXED v3.4 — 85 SHA-256-verified sector shards via CatalogStream; Gaia DR3 bulk (beyond 100 pc) still OPEN |
| ARCH-001 | P0 | Architecture | No frame/object/catalogue/LOD/camera/evidence contracts | IMPLEMENTED v3.4 — src/contracts/*, src/navigation/cameraState.ts, 14 tests; engine.ts/ui.ts still monolithic (no rewrite) |
| TER-001 | P0 | Scope | No terrain LOD / surface travel | PARTIAL v3.6 — tile pyramid + streaming, 118 m Moon / 200 m Mars regional tiles, SSE refinement, horizon shadows, patch-local precision; global high-res pyramids, Earth/Mercury/icy moons, surface camera mode, worker builds OPEN |

### Final visual QA (2026-10-09)
| ID | Sev | Area | Finding | Status |
|---|---|---|---|---|
| VQA-001 | P1 | Sun | Close disc flat beige (over-metered, AgX compression) | FIXED in code; software capture only |
| VQA-002 | P1 | Sun | Repeating/woven granulation at limb | v3.4 claim FIXED was premature (periodic hash remained); FIXED v3.5 (SUN-007) |
| VQA-003 | P1 | Exposure | Small bodies near-white, dark bodies not dark | IMPROVED — still photographic auto-exposure per subject; bright icy bodies (Miranda, Hyperion) still render near 200/255 by design |
| VQA-004 | P1 | Exposure | Mid-size planet discs clipped + brown bloom halo | FIXED |
| VQA-005 | P2 | Rings | Blue band at Saturn ring outer edge | FIXED |
| VQA-006 | P2 | Sun | At 0.05 AU (~72 px disc) granulation is below resolution, so disc reads smooth warm-white | BY DESIGN (band-limited to avoid shimmer) |

### v3.5 (2026-10-09) — lighting & visibility milestone
| ID | Sev | Area | Finding (evidence) | Status |
|---|---|---|---|---|
| LGT-001 | P0 | Sky | Stars/Milky Way vanish near any sunlit body (single scene exposure; MW gain LS·4e-6) | FIXED — viewing modes; sky exposure domain (presentation.ts); Scientific keeps the physical behaviour, labelled |
| LGT-002 | P0 | Depth | Far-plane sprites at reversed depth 1e-9·w drawn IN FRONT of bodies farther than ≈2·10⁴ km | FIXED — z = 0 exactly (points.ts, lines.ts) |
| LGT-003 | P1 | Sky | Milky Way map double-counted catalogue stars; calibration ≈100× too bright | FIXED — star-removed diffuse layer, derived μ-calibration |
| LGT-004 | P0 | Surfaces | Night sides pure black, no secondary light, unbounded night-side exposure pumping | FIXED — planetshine (physical), labelled inspection light (Exploration/Cinematic), night cap |
| LGT-005 | P2 | Earth | No airglow | FIXED — calibrated 95 km layer, night only |
| RING-002 | P1 | Rings | Ring-particle slice stayed visible after leaving Saturn | FIXED — hidden unless updated this frame |
| COM-001 | P1 | Comets | 3000× coma boost at the nucleus → white frame (67P 80 % clipped) | FIXED — boost fades to ×1 within 2·10⁵ km |
| AUD-01 | P2 | Settings | Docs claimed a schema bump that did not happen | FIXED — schema 8, migration chain, tests, docs corrected |
| AUD-02 | P1 | Camera | Rig ↔ state machine desync via direct field writes | FIXED — accessors + invariant + tests |
| AUD-03 | P1 | Catalogues | All shards streamed at boot | FIXED — named-star extract at boot; residency-driven streaming beyond 300 AU |
| AUD-04 | P1 | LOD | Detail contract not driving rendering | PARTIAL→FIXED for atmosphere sampling, hi-res streaming, terrain switch; geometry LOD per tier OPEN |
| AUD-05 | P1 | Honesty | Inferred/representative map colour not shown | FIXED — HUD + inspector labels from the manifest |
| AUD-06 | P2 | Tests | Tautological p99 assertion hid a percentile bug | FIXED — nearest-rank + real assertions |
| AUD-07 | P1 | Honesty | Docs claimed visible sunspots at 0.05 AU | FIXED — claim withdrawn; `sun_spots` metric in QA |
| RES-01 | P2 | Research | universesimulator.org and ARK Starmap require WebGL/WebGL 2 — not inspectable in this environment | OPEN — inspect on a GPU desktop |
| GAS-001 | P2 | Giants | Upper-haze forward scattering at the giants' night limb; ring shine on Saturn | OPEN |
| SKY-002 | P2 | Sky | Zodiacal light & gegenschein (Leinert 1998 model) | OPEN — natural next layer of the sky domain |
| PERF-004 | P1 | Perf | Real-GPU cost of the new terms (planetshine, airglow march term, grade) | PENDING-HARDWARE (benchmark protocol unchanged) |

### v3.6 (2026-10-09) — atmospheres, terrain, close Sun, integration
| ID | Sev | Area | Finding (evidence) | Status |
|---|---|---|---|---|
| ATM-001 | P1 | Titan | Surface visible through a τ ≈ 0.5 haze (blue globe) | FIXED — Titan haze τ ≈ 3–6.5 (APPROXIMATE, Tomasko 2008) |
| ATM-002 | P1 | Mars | Dust τ ≈ 0.01 (50× too clear), artistic red Rayleigh | FIXED — derived CO₂ Rayleigh + τ 0.5 dust with per-channel ω₀/g |
| ATM-003 | P1 | All | Ozone on the ground profile, grey Mie g, single scattering, plane-parallel ground light | FIXED — LUTs, tent ozone, multi-scatter, LUT ground light, skylight |
| ATM-004 | P2 | Mars | Single typical dust state (no season / storm τ, no clouds) | OPEN |
| ATM-005 | P2 | All | Aerial perspective blends with a grey alpha (no per-channel transmittance) | OPEN |
| TER-002 | P1 | Terrain | Patch bounding radius from one corner → holes with cone culling near cube-face edges (Gale) | FIXED (found in v3.6 QA) |
| TER-003 | P1 | Terrain | No cast shadows | FIXED — horizon maps (8 azimuths) |
| TER-004 | P1 | Terrain | Body-centred float32 vertices (≈ 0.27 m error at the surface) | FIXED — patch-local origins via frame anchors (test) |
| TER-005 | P2 | Terrain | Albedo maps much coarser than the 118–231 m relief | OPEN — needs LROC WAC / CTX-class mosaics |
| SUN-008 | P1 | Sun | Single granule scale, hairline lanes at close range | IMPROVED — size distribution, exploding granules, bright points; look unapproved |
| PERF-005 | P2 | Perf | LUT builds (0.3–0.45 s) and terrain patch builds (≈ 6 ms each) on the main thread | OPEN — Web Worker |
| PERF-006 | P1 | Perf | Real-GPU cost of LUT atmosphere, horizon-shadowed terrain (≈ 450 patches near the ground), 192-segment focused spheres | PENDING-HARDWARE |
| AUD-04b | P1 | LOD | Geometry LOD per tier | FIXED — plain ellipsoids 24/96(128)/192 by tier |
| QA-002 | P2 | QA | v3.5 `qa-final/exp-b` ring-leak PNGs pre-dated the RING-002 fix | RESOLVED — fresh v3.5 capture is clean |

## v3.7 (2026-10-10)
| ID | Sev | Area | Issue | Status |
|---|---|---|---|---|
| RING-001 | P1 | Saturn near field | B-ring particle cap 24,000 ≈ 55 % of τ | FIXED (cap 65,536; τ from the PPS profile). PPS-saturated core τ 4.5 still capped |
| RING-002b | P1 | Rings close | 8–30 m float32 banding of r 30 m above the plane | FIXED — precise near-field patch (series r0 + Δr, camera-relative vertices) |
| RING-003 | P2 | Uranus | Eccentric/inclined rings (ε e = 0.0079) drawn circular | OPEN |
| RING-004 | P2 | All | R5 volumetric ring rendering, wakes, spokes, propellers | OPEN |
| RING-005 | P2 | Jupiter | Halo/gossamer vertical thickness not rendered | OPEN |
| RING-006 | P2 | Neptune | Arc absolute longitude not anchored to an observed epoch | OPEN (REPRESENTATIVE) |
| RING-007 | P2 | Jupiter | Exploration gain ×1000 made the backlit (forward-scattering) rings blinding | FIXED — cap ×200; a geometry-aware gain is OPEN |
| ATM-010 | P2 | Giants | Shell coefficients channel-averaged; no 3-D cloud layers or storms beyond maps | OPEN |
| ATM-011 | P1 | Venus | Venus terminator view (phase 95°) metered ≈ 5.6 EV darker than the day view (`venus-terminator`, exposure −6.87 EV vs −1.23). Two hypotheses tested and ruled out in v3.7 (CPU limb protection capped at +2 EV; highlight peak metered over μ ≥ 0.3 behind atmospheres) — exposure unchanged, root cause NOT yet isolated | OPEN |
| ATM-012 | P2 | Io | Plumes barely visible at the limb at physical τ (gain ×4) | OPEN (needs a dedicated limb plume view/brightness check) |
| CLD-001 | P1 | All | No volumetric clouds, cloud shadows or weather anywhere | OPEN |
| NAV-001 | P1 | Moon/Mars | No surface walking/collision mode; descents shown as ordered frames only | OPEN |
| INT-001 | P1 | Interstellar | True-scale interstellar travel demonstration not attempted (P7/P8 prerequisites) | OPEN |

## v3.8.1 (2026-10-12) — visual foundation reconstruction (register; details in docs/v3.8.1/WORKLOG.md)
| ID | Sev | Area | Finding (evidence) | Status |
|---|---|---|---|---|
| STAR-J01 | P0 | Stars | Single-float32 camera in the 3-D star layer → selected-star jitter 38.9 px RMS (Proxima zoom 50→0.05 AU), 70 px (Sirius); CPU trace tools/qa/star-stability.ts | FIXED — hi/lo split camera, reordered subtraction (5.5e-5 px); HW confirmation pending |
| STAR-P01 | P1 | Stars | PSF σ 0.85 CSS px (1.7 device px on 2× displays), point-sampled | FIXED — σ 0.62 device px, exact per-pixel erf integral, normalised θ⁻³ wing; tests psf381 |
| EXP-381-01 | P0 | Exposure | Binary "Sun centre within ±1.1 NDC" veil re-coupled the whole sky (7–12 EV drop at the frame edge) | FIXED — continuous angular/brightness veil, bounded ≤ 2 EV (Exploration), 1.6 EV (Cinematic); Scientific physical |
| SKY-381-02 | P1 | Sky | Implicit mip selection across the atan wrap → anticentre seam | FIXED — explicit LOD from pixel angle |
| SKY-381-03 | P2 | Sky | Dither hash re-seeded every frame → temporal boil | FIXED — static |
| SKY-381-04 | P0 | Sky | Runtime Milky Way = 4k DR2 map + 5×5 median + box blur (≈ 20′ effective) → muddy, no dust detail | FIXED — Gaia EDR3 8192×4096 log-luma + 2k chroma, catalogue-matched removal of the 99,049 drawn stars only (1.3 % flux), streamed after boot |
| SKY-381-05/06 | P1 | Sky | Brown wash (dim + saturated chroma) | IMPROVED — luminance-dependent chroma, Exploration/Cinematic presentation gains (labelled) |
| SUN-381-01 | P0 | Sun | Fixed-size (45 % frame) glare quad with constant fog term and fixed 6-fold spikes | FIXED — angle-space glare, log-amplitude, extent from threshold |
| SUN-381-02 | P1 | Sun | Resolved disc clipped by 10⁴–10⁶ below 40 px radius | FIXED (Exploration/Cinematic) — local HDR disc presentation 3→12 px; Scientific physical |
| SUN-381-03 | P1 | Sun | Default "natural" disc tint (1, 0.74, 0.46) = orange lamp | FIXED — neutral white balance (sunlight = white), gentle labelled grade |
| SUN-381-04/05 | P0 | Sun | White blob ≈ 3–5 R☉ = art aureole (5 % of disc) + physical corona both 10²–10³ × white at 1–5 AU (isolated by layer switch-off captures) | FIXED (Exploration/Cinematic) — display caps / local corona scale, eclipse metering untouched |
| PERF-381-01 | P0 | Perf | No real-GPU evidence possible in the sandbox | KIT READY — in-app ?bench=1 + Windows launcher; awaiting owner results |
| ARCH-381-01 | P2 | Release | Supplied v3.8.0 archive contains no .git → tag a0cfcc6 unverifiable | NOTED — new repository, baseline tag v3.8.0-supplied |
| SKY-381-07 | P1 | Sky | Owner req.: validate star removal in the rendered domain | DONE — tools/qa/sky_removal_qa.py; double counting ≤ 0.5 % after (≤ 11.7 % before), no holes/halos/seam/colour artefacts vs random-sky reference |
| AST-381-01 | P1 | Rights | Ariel/Titania/Oberon non-commercial (AST-003) | FIXED — USGS Voyager mosaics via NASA/JPL (JPL Image Use Policy); registration verified vs IAU Gazetteer; 0 non-commercial assets |
| AST-381-02 | P1 | Moons | Smooth generic small Saturnian moons | FIXED (shape) — Cassini ISS shape models (Thomas et al., PDS) for 11 moons; surfaces still procedural (labelled) |
| STAR-381-R | P1 | Stars | Radii without bolometric correction (Proxima ≈ 0.07 R☉) | FIXED for 6 nearest stars (measured, cited); others labelled estimated |
| STAR-381-D | P1 | Stars | No resolved stellar disc | IMPLEMENTED — physically constrained impostor, PSF flux hand-over |
| CAM-381-01 | P0 | Camera | Free-look applied per mouse event → judder at real frame rates | FIXED — frame-rate-independent smoothing; test fails on v3.8.0 |
| GAL-381-01 | P1 | UI | Galactic card illegible, provenance thin | REDESIGNED — legend, coverage, scale, HiDPI, enlarge |
| UX-381-01 | P1 | UI | Intro modest | REDESIGNED — "Into the Universe", resume, skip for repeat users |
| BOOT-381-01 | P0 | Startup | (found in cp2 QA) observed-shape moons lost colour/albedo → boot crash | FIXED + regression test |
| QA-381-01 | P2 | QA | Galactic card covered the aim point in 640×360 captures | FIXED — hidden in clean-capture mode |
| SUN-381-06 | P0 | Sun | (cp2 capture review) resolved-Sun glare collapsed at the resolution threshold: Mercury-distance Sun drawn smaller/flatter than at 1 AU | FIXED — glare = fixed fraction of displayed disc radiance, disc-scaled footprint, smooth hand-over; recaptured |
| STAR-381-D2 | P1 | Stars | Resolved photosphere at sky exposure → Scientific frame-filling over-exposure | FIXED — meters like the Sun; exposure glides sky→scene |
| STAR-381-D3 | P2 | Stars | M-dwarf red channel clipped, limb flat | FIXED — brightest-channel metering and local HDR target |
| AST-381-01b | P2 | Moons | 1986 terminator baked into map edges → dark seam (double shading) | FIXED — rim treated as unobserved |
| AST-381-01c | P2 | Moons | Bilinear seam at observed/unobserved boundary | FIXED — half-texel dilated mask (first attempt broke all partial maps via placeholder texel size; caught by capture, fixed with textureSize) |
| QA-381-02 | P2 | QA | Uranian-moon "now" views show seasonal night side | Views at the Voyager epoch (1986-01-24) |

### Owner review of Checkpoint 2 (2026-10-13) — cp2 accepted as a development milestone; findings carried forward
Classification: **D** = confirmed defect, **P** = visual preference / presentation, **U** = scientific uncertainty.
| ID | Sev | Class | Finding (owner) | Reproducible test | Status |
|---|---|---|---|---|---|
| REV2-01 SUN-381-07 | P1 | D? (audit) | 20° FOV Mars-distance Sun shows disproportionately large/intense glare; spikes too stylised by default | views sun-ladder-{0p39,1,1p52}AU-f20 (+ fixed-exposure variants); glare-energy table vs angR, EV, FOV | OPEN — audit |
| REV2-02 AST-381-03 | P1 | D | Uranian observed/reconstructed boundary highly conspicuous (albedo, shading, roughness, texture-frequency mismatch); check Triton/Pluto/Charon | moon381-{ariel,titania,oberon}-1986, triton-limb, pluto-day, charon views | OPEN |
| REV2-03 AST-381-04 | P1 | D/P | Small moons too bright, uniform, clay-like; facets/creases to check against source | moon381-*-ph70, moon381-* (phase 25°); per-moon photometry table | OPEN |
| REV2-04 ATM/RING | P1 | D/P | Venus terminator, Titan haze, Mars horizon, Pluto/Triton haze, giant limbs; ring edge-on black bands, transparency, depth order, scattering, shadows, moon–ring integration | reg set (venus-terminator, titan-limb, mars-limb, pluto-haze-backlit, triton-limb, jupiter-limb, sat-*) | OPEN (WP-E/F) |
| REV2-05 STAR/SKY | P2 | P/U | Proxima disc very uniform; Gaia background flat/brown | xstar-proxima-*, sky views | OPEN |
| REV2-06 UX-381-02 | P2 | D (overlap) / P (intro) | Intro solar disc featureless; enlarged Galactic card overlaps header/breadcrumbs; footer version | U*, L2 captures | OPEN |
| REV2-07 | — | process | Preserve verified improvements; SW≠HW; full evidence | all | standing rule |

### CONT-381 cross-system continuity audit (owner 2026-10-13) — plan & inventory in docs/v3.8.1/CONTINUITY_AUDIT.md
| ID | Sev | Status |
|---|---|---|
| CONT-01 Sun point↔disc | P1 | CONFIRMED (=SUN-381-07), fixed in shared laws, verifying |
| CONT-08 thick-atmosphere twilight/fill | P1 | CONFIRMED, fixed (ATM-381-01 iter 2), verifying |
| CONT-02…07, 09…13 | — | risks under investigation (not confirmed) |

### REV2/CONT status update (2026-10-13 evening session)
| ID | Finding | Status |
|---|---|---|
| SUN-381-07b/c (CONT-01) | point regime on sky exposure: sprite+bloom G 1.5–2.8k vs resolved 0.6–0.75k at hand-over; far law G(100 AU) ≈ 0.69k | FIX: displayed irradiance of unresolved Sun capped at the 100 AU value (non-Scientific); verifying glare-t3 |
| AST-381-03 iter 4/5 (CONT-07) | dark outline = bilinear/mip filtering of black no-data texels into observed edge texels; band = guide switching to a constant mean ~10° from data | FIX: native-resolution data masks + normalised filtering; multi-scale normalised-convolution guide; verifying partial-new5 |
| RING-381-01 (CONT-09) | **CONFIRMED systemic**: ring systems were not exposure-meter subjects → Saturn off-frame close ring views metered to dark sky (+14.6 EV, white frames: sat-A-close, sat-nearfield-A, sat-cassini-division) | FIX: view-ray/ring-plane meter subject; Cassini Division verified (6.76 EV); close-ups verifying rings-t2 |
| ATM-381-02 (CONT-08) | Venus deck reflectance is disc-integrated (contains haze) but sun/view paths were attenuated by full haze extinction (double count) | FIX: delta-M effective transmittance T^(1−g²); Venus terminator now a gradual Minnaert fall-off ending at the geometric terminator (venus-t1) |

### Focused acceptance checks (owner 2026-10-13 23:00) — results
| Check | Result (software WebGPU) |
|---|---|
| CONT-01 continuous Sun travel 0.25→300 AU, 20° auto / 20° fixed / 50° auto | PASS after SUN-381-08/08b + EXP-381-03: halo monotone, continuous at the 3.5 px hand-over (≈F^0.25 beyond); EV max 5.6–6.1 per 8 % step (meter ramp, Sun display level constant). Interim 100 AU cap withdrawn. |
| RING-381-01 continuous pan Saturn→lit rings→ring shadow→ansa→sky (3.2 R) | PASS after RING-381-02: EV 6.2–6.95 on rings, smooth rise to 14.6 EV, max 0.96 EV/step; exit-sliver over-exposure fixed. Residual: a few-px ring corner may clip at the very edge (minor). |
| AST-381-03 boundaries (iter 6) | IMPROVED, OPEN: dark outline largely removed; residual faint dotted edge (Triton) and a lighter band inside the reconstruction; procedural crater rims alias as dotted rings at Voyager-epoch scale. |
| AST-381-03 iter 7–8b | crater-function rim step (dotted rings, all procedural bodies); guide began at core colour beside darkened rims (Pluto −40 %, Charon −24 %); detail-frequency step at mask edge; c/m normalisation amplifying rim data | FIX: continuous crater height; edge-colour guide relaxing over 4°; detail ∝ reconW; normalisation removed. Matched cp2/current acceptance queued (ast3_queue.sh) |

### Gate A (independent architecture audit, 2026-10-14) — see docs/v3.8.1/GATE_A_AUDIT.md
| ID | Class | Finding | Status |
|---|---|---|---|
| GA-SCI-01 | D (science) | point brightness floor + body/asteroid/comet visibility boosts applied in Scientific mode | FIXED bdce6bd (findability contract, 3 tests) |
| GA-EPH-01 | D (science, continuity) | pending ephemeris windows answered with a ~25-yr two-body edge extrapolation; 471 bodies jumped on payload activation | FIXED 9d1e515 (75 bodies, ≤ 0.09 orbital radii; ephem_activation.ts) |
| GA-EPH-02 | D (science) | equatorial satellite frames of retrograde rotators (Uranus, Pluto) ran backwards (Ariel/Miranda fallback 74°/149° off after 1 d) | FIXED 9d1e515 |
| GA-EPH-03 | D (science) | Pluto small-moon fallback orbited Pluto's centre, not the barycentre (Nix 37,000 km after 7 d) | FIXED 9d1e515 (2,800 km) |
| GA-EPH-04 | U | comets / Pluto barycentre fallbacks still differ by 10⁶–10⁷ km until their payload lands | OPEN (P2) |
| GA-ARCH-01 | U | WebGPU-only depends on private `_getFallback` | CONTROLLED: three pinned 0.186.1, post-init GPUDevice assertion, test pins the field |
| GA-TEX-01 | D | linear-texture placeholders ignored their colour (masks = 0.5 "half no-data" while streaming / after demotion; demoted normal maps grey) | FIXED 1d889aa |
| GA-RES-01 | U (perf) | body views never released in long sessions | OPEN (needs HW long-session data) |
| CONT-14 | U | unresolved planets/moons on SKY exposure vs resolved disc on SCENE exposure; ×1.6 point colour factor | TEST PENDING (titan-handover travel) |
| AST-381-03 iter 8c–10 | D | residual beaded boundary line: 8c–9 (ramp, luminance test, speck holes, signed-distance mask) were not the cause; ROOT CAUSE (iter 10): the excluded 0.4° rim is drawn from the guide, which held raw Lanczos-ringed rim pixels | FIXED 4e3d06f (quick matched capture Triton/Charon); six-body acceptance running |
