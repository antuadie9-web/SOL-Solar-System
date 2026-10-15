# SOL v3.8.1 — Titan atmosphere: Level-2 acceptance (WP-E / Gate C)

Status: **ACCEPTED (software WebGPU, SwiftShader)** at 11e21fb, re-checked after WPE-MA-01 at c257166 (disc photometry ±1 %, day and low-altitude views identical), with the limitations below. No native-GPU (RTX) evidence.

## 1. Model and governing equations
- Shell radiance: single scattering in the true medium (Rayleigh + three aerosol populations, Cornette–Shanks phase per
  population/channel) + orders ≥ 2 from a Hillaire-style isotropic multiple-scattering LUT built in the **similarity-scaled
  medium** σs′ = σs(1−g), σe′ = σe − σs·g, attenuated toward the camera by the scaled transmittance (Tv2). Single scattering and
  the view transmittance of the true medium are unchanged. Same mathematics in CPU (atmoModel.ts) and WGSL (atmosphere.ts).
- Focus-shell march for the 510 km detached haze; disc-integrated flux twin (discTable) for the point regime (CONT-14d).
- Exposure: highlight protection from the CPU limb estimate on 20 tangent heights to 0.95 of the shell, at the GPU's step budget.

## 2. Parameters — provenance class
| quantity | value | class | source |
|---|---|---|---|
| haze vertical τ(λ), three altitude regions | power laws, total ≈ 9 at 550 nm | MEASURED-DERIVED | DISR, Tomasko et al. 2008 (PSS 56, 669) as revised in the JPL-Titan NAI 2013 report |
| detached haze altitude 510 km, width | 18 km gaussian | OBSERVED 2017 state, INFERRED for 2026 | Cassini ISS limb profiles |
| asymmetry g (main 0.70/0.73/0.76; detached 0.36–0.45) | | DERIVED / ASSUMED | DISR aerosol model (fractal aggregates); detached: smaller particles |
| single-scattering albedo upper 0.97/0.955/0.91 (R/G/B), lower 0.98/0.96/0.88, detached 0.94/0.92/0.86 | | **FITTED** (effective) | to p_V ≈ 0.22, B−V phase curve; NOT a retrieval |
| DISR-derived ω0 for comparison: >144 km 0.945/0.909/0.838; 30–80 km 0.987/0.966/0.932 | | MEASURED-DERIVED | same NAI 2013 report |

The fitted upper-haze ω0 exceeds DISR by 0.03–0.07: it absorbs the residual RT bias of §3. This is documented, not hidden.

## 3. Accuracy against independent references
- **CPU ↔ GPU (implementation parity, not physics):** GPU disc vs CPU disc-integral point within 4 % at α 20–165°
  (meas_ref/pt_ref 0.917/0.919, 0.967/0.945, 2.270/2.284, 27.16/26.82, 465.8/472.5).
- **Monte Carlo (independent plane-parallel MC, tools/qa/rt/mc.py, mcr.py — same profile and phase functions, no LUT):**
  surface diffuse irradiance 0.60/0.63/0.93 × MC (R/G/B); nadir I/F 0.73/0.72/0.69 × MC. Before WPE-TI-01 the surface
  irradiance was ≈ 0.04 × MC. Resolution convergence < 5 %. **Remaining approximation error: −27 to −40 % in diffuse
  radiance**, from the isotropic-MS/transport approximation (exact only in the diffusive limit). Tolerance accepted for
  presentation; the fitted ω0 compensates in the disc integral. An exact treatment (e.g. a DOM/adding-doubling LUT) is a
  possible later refinement, not required for Gate C.
- **Observations:** p_V and B−V are the FIT targets, therefore not validation. Not validated independently: colour of the
  surface sky (no colour-calibrated DISR comparison), polarisation (not modelled).

## 4. Visual acceptance (SW captures; work/qa/titan-l2b, work/qa/ti03, work/qa/wpe-reg)
| view | result |
|---|---|
| day / day-sci / terminator / limb | WPE-TI-01 restores the diffuse field; limb ≈ 17 % darker than c57fce9 (no longer over-bright) |
| backlit | clipping 3.98 % → 0.47 % → **0.00 %**; night disc 171 → 75 → **0**/255; orange main haze and blue detached haze separate (sheet titan-ti03-backlit.jpg) |
| low altitude | mean 48.7 → 46.6; olive-orange cast (TI-02, see §5) |
No shader/WGSL errors. Capture cost: L2b 359 s capture + 247 s photometry; TI-03 diagnostics 4 × ~70 s.

## 5. Documented limitations
- **WPE-TI-02 (U, assessed):** olive surface-sky cast. Model agrees with MC (R:G:B 1 : 0.63 : 0.09 vs 1 : 0.60 : 0.06).
  Attributed to three monochromatic channel samples of a steep red spectrum. Correct fix = spectrally integrated,
  CIE-weighted channel coefficients (WPE-SPEC-01). No colour multiplier is applied.
- **WPE-TI-04 (P/U, deferred):** spherically symmetric haze; no hemispheric asymmetry or polar hood. The default epoch
  (Oct 2026) is ≈ 1.4 yr after northern autumnal equinox; no observation fixes the amplitude for that date. Re-open only with
  date-appropriate evidence; requires non-symmetric transmittance and an updated disc twin.
- Surface τ: DISR first results (2005) quote ≈ 4.5 at 531 nm; the 2008/2013 laws used here sum to ≈ 9 — recorded uncertainty.
- Glare/bloom are presentation optics; Scientific mode keeps them at physical weight 1.
- Evidence class SW only; no RTX 3050 timings or look are claimed.
