---
title: "SOL v3.7 — Final Completion Report (v3.7.1 corrections, consolidated into v3.8)"
subtitle: "Starting state, outstanding obligations, root causes, corrections, validation and actual acceptance status"
date: "2026-10-11"
---

# 1. Summary for the reviewer

**What this report covers.** The owner supplied `sol-solar-system-v3.7.zip` (v3.7.0) and the master specification
*SOL v3.7 Completion, v3.8 Major Upgrade & v4.0 Readiness*. Part III of that specification requires the outstanding v3.7
obligations to be finished, with a recoverable corrective checkpoint, before v3.8 work is accepted. This report documents that
work. Per the owner's 2026-10-11 instruction, the corrections ship **inside the single consolidated release
`sol-solar-system-v3.8-final.zip`**. No separate v3.7.1 ZIP is produced. The history is preserved in Git: tag `v3.7.0` is the upload
byte-for-byte, and branch `v3.7.1` holds the corrections only.

**Honest headline.**

* The four owner-reported v3.7 rendering defects have **verified root causes and fixes** in the runtime:
  * the Venus terminator underexposure (5.6 EV);
  * clipped Jupiter backlit rings;
  * barely visible Io plumes;
  * the Enceladus plume.
* Every fix was checked with matched before/after captures (software WebGPU).
* Fixing them exposed **further defects**, several of them in my own first-round v3.7.1 corrections. These were found by
  the matched captures and fixed: DEF-38-003, -004 and -005 are follow-ups to v3.7.1 work.
* The moon visual-identity requirement (§14) is **substantially advanced but not complete**:
  * measured sizes, albedos and colours are in place;
  * there are size-dependent geology classes and two new observed shape models;
  * sizes for 414 previously unsized minor moons now come from JPL and the MPC;
  * a J2-orbit error that put Pan inside the A ring is corrected;
  * **controlled spacecraft mosaics for the small moons were not added** (see §7).
* All images are **SwiftShader software-WebGPU** captures. Hardware look and performance remain **UNVERIFIED**.

| Item | Status at hand-off |
|---|---|
| Baseline secured (tag `v3.7.0` = upload, 2,158 files, identical file list) | DONE |
| Venus terminator (ATM-011) — root cause + fix, no multiplier | DONE (software-verified) |
| Jupiter backlit rings (RING-007) — geometry-aware labelled gain | DONE (software-verified) |
| Io plumes (ATM-012) — physical normalisation, labelled enhancement, limb geometry | DONE (software-verified); appearance REPRESENTATIVE |
| Enceladus plumes — location/direction/brightness/clipping | DONE (software-verified) |
| Uranus eccentric rings (RING-003) | DONE |
| Moon identity inventory + appearance policy (§14) | PARTIAL (see §7) |
| Ring advanced techniques (volumetric R5, wakes, spokes) | OPEN — not claimed |
| Volumetric clouds / weather | OPEN — not claimed |
| Real-GPU validation | BLOCKED (no GPU in this environment) |

# 2. Starting state (v3.7.0 as uploaded)

* **Archive.** `sol-solar-system-v3.7.zip`, 424,126,260 bytes, SHA-256 `553daadc…`. Extracted, committed unchanged as
  `a3b47dc` and tagged `v3.7.0`. Its file list matches the ZIP exactly (2,158 files).
* **Reproduction.**
  * `tsc` reports 0 errors.
  * The test suite passes 286/286.
  * Asset validation: 1,510 files matched, 0 unmatched, 3 marked "NC" (non-commercial).
  * `vite build` succeeds, producing 3.8 MB of JS.
* **Runtime.**
  * Chromium 154 with SwiftShader WebGPU.
  * The GPU device is lost after about 4 s unless the small-body compute pass is disabled (`?qa-off=smallcompute`). This
    reproduces issue GPU-003 and is a software-adapter limitation, documented and not hidden.
* **Prior documentation reviewed.** `SOL_V3.7_COMPLETE_DEVELOPMENT_REPORT.md`, `requirements-matrix-v3.7.md`,
  `docs/issues.md`, `SOL_V3.7_RING_SYSTEM_RESEARCH_AND_IMPLEMENTATION.md`, `SOL_V3.7_PLANETARY_ATMOSPHERES_AND_CLOUDS.md` and
  the v3.7 image index.

# 3. Outstanding-work register (classified, spec §9)

Class key: **RD** release defect · **PI** promised but incomplete · **IU** implemented but unverified · **QS** quality
shortfall · **SL** scientific-data limitation · **LT** long-term (outside the v3.7 commitment).

| ID | Item | Class | Outcome |
|---|---|---|---|
| ATM-011 | Venus terminator ≈ 5.6 EV dark | RD | Fixed (root cause §4.1) |
| RING-007 | Jupiter backlit rings saturate (×200) | RD | Fixed (§4.2) |
| ATM-012 | Io plumes barely visible | RD/QS | Fixed (§4.3); appearance REPRESENTATIVE |
| — | Enceladus plume check | IU | Verified; clipping defect found and fixed (§4.4) |
| RING-003 | Uranian rings drawn circular | PI | Fixed — French et al. 1988 elements |
| §14 | Small moons look alike | QS | Partly fixed (§7) |
| DEF-38-002 | Sun (all point sources) clipped beyond 1e13 km | RD (pre-existing) | Fixed (found in v3.8 QA) |
| DEF-38-008 | 414 of 460 JPL-table moons had a 2.5–8 km placeholder radius | SL/RD | Fixed — JPL/MPC sizes |
| DEF-38-009 | Pan 500 km outside the Encke gap (J2 osculating error) | RD | Fixed |
| DEF-38-013 | Catalogue G-band magnitudes used as V | RD | Fixed (in v3.8 notes; affects star brightness) |
| RING-004 | Volumetric rings, wakes, spokes, propellers | LT | OPEN — not claimed |
| RING-005/006 | Jupiter halo thickness; Neptune arc absolute longitude | SL | OPEN (REPRESENTATIVE) |
| CLD-001 | Volumetric clouds, weather | LT | OPEN |
| SCI-004/005 | Mimas interpolation; rounded small-body elements | SL | OPEN |
| PERF-002 | KTX2/Basis compression | PI | OPEN (needs target-GPU test) |
| GPU-001 | Real-GPU validation | Blocked | BLOCKED |

# 4. Root causes and corrections

## 4.1 Venus terminator (ATM-011)

**Investigation.** The spec's checklist was followed: optical depth, LUT sampling, intersections, transmittance,
cloud-deck shading, multiple scattering, shadow geometry, exposure, tone mapping and compositing. With metering debug written
into every capture's metadata, the atmosphere was ruled out. At the terminator view the **auto-exposure** read −9.25 EV, against
−1.23 EV for the day view.

**Root cause.**

* The meter counted every resolved body in the *forward hemisphere*. That included the Sun: a 6.7 px disc, 85° off-axis and
  outside the frame.
* Even at a weight of 0.004, solar radiance outweighed Venus and closed the exposure by about 8 EV.

**Fix (no multiplier).**

* Each body now meters by the fraction of its disc that lies *in the frame* (`frameFrac`).
* **Follow-up DEF-38-003:** the first version returned 0 for a planet that fills the frame from close range (camera 120 km
  above the clouds), so the cloud-top flight was overexposed by +2.1 EV. Bodies with an angular radius above 8° are now metered
  by a 12 × 12 grid of view rays intersected with the sphere, normalised like the square estimate.

**Result.**

| View | v3.7.0 | Final |
|---|---|---|
| Terminator | −9.25 EV | −1.32 EV |
| Cloud-top flight | −1.43 EV | −1.29 EV (intermediate fix: +0.71 EV) |
| Day | −1.23 EV | −1.23 EV |

Code: `src/render/engine.ts` (`frameFrac`, `frameCoverage`).

![Venus terminator — v3.7.0 (left, −9.25 EV) vs v3.8-final (right). Same camera, epoch and mode.](img/pair-venus-terminator.jpg)

![Venus cloud-top flight at 120 km — v3.7.0 vs final. The DEF-38-003 washout (+2.1 EV) that appeared in the first fix is gone.](img/pair-venus-cloudtop-flight.jpg)

![Venus backlit (180° phase) — v3.7.0 / intermediate v3.8 build (DEF-38-001 regression) / final. The limb ring is the forward-scattered haze. Radial-profile peak: v3.7.0 46.3, intermediate v3.8 build 10.9 (DEF-38-001 regression), final 46.4.](img/venus-backlit-3way.jpg)

## 4.2 Jupiter backlit rings (RING-007)

* **Root cause.** The ×200 Exploration gain came from the rings' *backscatter* peak I/F. At high phase the dusty main and halo
  rings are about 10³ times brighter (strongly forward-scattering), so the same gain drove them to white.
* **Fix.** `peakIFAt()` evaluates the brightest ring I/F for the **current** Sun/camera geometry, using a CPU twin of the GPU
  shader (`ringShadeIF`). The gain maps that value to a fixed display target.
* **Scientific mode stays at ×1.** The gain is labelled on the interface (it gives the "Rings: brightness ×N" note) and recorded
  in each capture's metadata.
* **Follow-up DEF-38-005.** The label persisted after leaving Jupiter. Labels are now rebuilt every frame.

![Jupiter backlit — v3.7.0 (×200, clipped) vs final (geometry-aware gain).](img/pair-jup-backlit.jpg)

## 4.3 Io plumes (ATM-012)

* **Physics check.**
  * Plume reflectance L/F ≈ ϖ·P·τ/(4π), giving ≈ 2×10⁻³, against a surface I/F of about 0.2.
  * At moderate phase the plumes are therefore physically about 0.3–1 % of the surface brightness.
  * The faintness in v3.7 was **largely real**, not a bug.
* **What was wrong.**
  * **Ad hoc normalisation:** splats used a 1/250 normalisation factor.
  * **No view on the sunlit limb:** no QA view put a plume on the sunlit limb.
  * **Eclipsed view:** at the reference epoch, the v3.7 "high-phase" view had Io inside Jupiter's umbra.
* **Fixes.**
  * **Cross-section-normalised splats:** each particle carries Σ/N of the plume's scattering cross-section. The rendered I/F no
    longer depends on particle count or splat size.
  * **Geometry-aware labelled enhancement:** ×1 in Scientific, up to ×60 elsewhere, always shown on the interface.
  * **Vent-on-limb views:** a new QA view type (`vent`) places Pele or Tvashtar exactly on the limb at the highest phase the local
    solar elevation allows.
  * **Smoother canopy:** umbrella splat size changed from height/18 to height/8.

![Pele on the limb — final build, Exploration (labelled ×13) and Scientific (physical). The plume is visible even at physical brightness at this phase.](img/io-pele-limb.jpg)

## 4.4 Enceladus plume

* **Checks.** Location: four tiger stripes, 20 jets at −83° to −87° latitude. Direction: local vertical with 0.12 spread. Phase
  function: Henyey–Greenstein g = 0.75. Brightness: I/F ≈ 0.01 at 161° phase, consistent with Hedman et al. 2009.
* **Defect found (DEF-38-004).** The plume brightness estimate used only the *single* brightest jet. The 20 jets overlap in
  projection, so the true peak was about 10× higher. The labelled ×4 gain then clipped the core to white (1,751 saturated
  pixels).
* **Fix.** Jet columns are summed with a projected-separation overlap weight. Result: gain ×1 (physical) and 0 saturated pixels.

![Enceladus backlit — v3.7.0 vs final.](img/pair-enceladus-plume-backlit.jpg)

## 4.5 Rings (spec §11)

**Done.**

* **Uranian eccentric rings (RING-003):**
  * Keplerian elements for nine narrow rings from the French et al. 1988 PDS SPICE kit, B1950 node.
  * Uranus spin sense −z_IAU.
  * ε ring width 19.7 → 96.4 km from periapse to apoapse, with τ·w conserved.
  * The tabulated apsidal precession matches the J2 secular rate to < 3 % (test `rings371`).
* **Saturn first-view freeze (PERF-008):** removed with a pre-smoothed colour asset.
* **Pan outside the Encke gap (DEF-38-009):**
  * *Root cause:* two-body propagation of an osculating Horizons state ignores J2. The osculating semi-major axis of inner
    moons exceeds the geometric one by (3/2)·J2·(R/a)²·a, about 500 km for Pan.
  * *Fix:* mean elements with apsidal and nodal precession, longitude anchored to the Horizons state.
  * *Check:* a 12-year test keeps Pan inside the Encke gap and Daphnis inside the Keeler gap.

**Open (not claimed).** R5 volumetric rings, self-gravity wakes, spokes, propellers, Jupiter halo thickness, and Neptune arc
absolute longitude.

![Pan before (A ring visible through it — Pan was placed 500 km outside the Encke gap) and after the J2 fix.](img/pair-pan.jpg)

# 5. Atmospheres (spec §12)

* **Per-body review.** `src/data/atmospheres.ts` gives each body's class, composition, pressure, cloud type and render status.
  There is no false shell on Mercury, and the giants are shell-over-map with no solid surface. These were re-checked.
* **Unchanged statuses.** No volumetric clouds; static cloud maps on Earth, Venus and the giants (CLD-001 OPEN). Titan haze
  τ > 3 and the thin hazes of Triton and Pluto are unchanged from v3.7.
* **Regression found and fixed (DEF-38-001).** Moving the LUT build into a Web Worker (v3.8 PERF-005) introduced a half-float
  encoder that flushed subnormals to zero. The multiple-scattering terms were lost and Venus' backlit limb dimmed about 4×.
  It is fixed with an IEEE binary16 encoder and a test, and the result is identical to v3.7.0 within 0.1 profile units.

# 6. v3.6 obligations re-checked (spec §13)

| Item | Status |
|---|---|
| Atmosphere LUT construction on the main thread | FIXED (Web Worker) |
| Terrain patch generation on the main thread | OPEN (about 6 ms per patch; not a measured travel stall in profiling) |
| Mars dust, Titan haze, Moon/Mars registration, terrain continuity | Unchanged from v3.6; no new defect found in this pass |
| Restricted assets | 3 NC files remain (asset audit) |

# 7. Moon and satellite visual identity (spec §14)

**Inventory.**

* `docs/inventory/moons-v371.json` lists measured triaxial dimensions, albedo, colour indices and rotation for the small moons
  where they are published (≈ 36, with sources per entry). The remaining ~420 moons are assigned to a dynamical class.
* Sizes now come from **JPL Horizons radii, or MPC absolute magnitude H with the moon's own albedo**
  (D = 1329 km / √pV · 10^(−H/5)). The tool is `tools/ingest/sat_sizes.py`, and its inputs are committed.
* The inspector labels the source of every size.

**What changed visually.**

* **Facets.** Planar facets now only appear on small shards; they fade out between 15 and 80 km. Janus and Epimetheus lost
  their "sawn-off" limbs.
* **Boulder speckle.** The speckle fades out between 3 and 25 km. Large dark moons no longer share one white-blotch motif and
  are crater-dominated instead.
* **Observed shapes.** Itokawa (Gaskell 2008) and Phoebe (Gaskell 2012) now use their PDS shape models.

**Not done.**

* **Controlled small-moon mosaics.** The Cassini ISS / Galileo SSI controlled mosaics of the small moons were not ingested.
  The surfaces remain deterministic reconstructions, labelled REPRESENTATIVE.
* **Saturn ring moons.** Pan, Atlas, Prometheus and Pandora render as bright, nearly featureless bodies under auto-exposure.
  Their high albedo is physical, but their real ridges, grooves and crater textures are not reproduced.

![Minor moons — before the size-dependent geology (left of each pair) vs final.](img/pair-moons-identity.jpg)

![Final minor-moon set (same view template: 3.4 R, 25° phase).](img/moons-final-grid.jpg)

# 8. Tests and verification

* **Test suite.**
  * `master` at release: 310/310 tests.
  * Branch `v3.7.1`: 302/302 tests.
  * New tests: `halfFloat38`, `plumes38`, `identity38`, `satsizes38`, `innermoons38`, `photometry38`.
* **Other checks.** `tsc` reports 0 errors, and the production build succeeds. Shader validation is a smoke gate: any WGSL or
  uncaptured GPU error fails the capture run.
* **Clean-extract verification** of the final ZIP: see the master hand-off, §Release verification.

# 9. Acceptance status

**Accepted.** The release-critical v3.7 defects are fixed and software-verified. These are §10's Venus, Jupiter, Io and Enceladus
items, plus the defects found during QA.

**Not accepted / open.**

* §14 is partial: small-moon mosaics are missing.
* §11's advanced ring techniques are not implemented.
* Hardware validation is blocked.

None of these items has been moved silently to v3.9: each remains listed in the issue register with its dependency.
