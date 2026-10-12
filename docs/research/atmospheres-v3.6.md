# SOL v3.6 — atmosphere model: sources, parameters, derivations, validation

Status labels: **MEASURED** (published value used directly) · **DERIVED** (computed here from published quantities) ·
**INFERRED** (physically motivated estimate where no tabulated value was located) · **APPROXIMATE** (rounded from a model).

## Technique
* Hillaire, S. (2020) *A Scalable and Production Ready Sky and Atmosphere Rendering Technique*, Computer Graphics Forum 39(4)
  (EGSR). Transmittance LUT, multiple-scattering LUT Ψms = L2nd / (1 − f_ms) with an isotropic phase, ground bounce.
* Bruneton, E. (2017) *Precomputed atmospheric scattering: a new implementation* (reference implementation and
  documentation): transmittance-LUT parameterisation (x_μ, x_r) and the Earth reference parameters.
* Cornette & Shanks (1992) phase function for Mie with per-channel asymmetry g.
* Implementation: `src/render/atmoModel.ts` (pure TS, CPU-built LUTs, tested in node) → `src/render/atmosphere.ts`
  (WGSL march: LUT sunlight, multiple scattering, analytic per-step integration) and `src/render/planetMaterial.ts`
  (ground sunlight from the LUT, diffuse skylight table with sky-view factor ½(1 + n·up)).

## Parameters
| Body | Layer | Values | Label / source |
|---|---|---|---|
| Earth | Rayleigh | σs = (5.802, 13.558, 33.1)·10⁻³ km⁻¹, H = 8 km | MEASURED — Bruneton 2017 / Hillaire 2020 |
| Earth | Mie | σs = 3.996·10⁻³, σa = 0.444·10⁻³ km⁻¹ (ω₀ 0.9), H = 1.2 km, g = 0.8 | MEASURED — same |
| Earth | Ozone | σa = (0.650, 1.881, 0.085)·10⁻³ km⁻¹, tent profile centred 25 km, half-width 15 km | MEASURED — same (v3.5 placed ozone on the Rayleigh profile, i.e. at the ground) |
| Mars | Rayleigh (CO₂) | σs = (0.97, 2.3, 5.7)·10⁻⁴ km⁻¹ at 680/550/440 nm, H = 11.1 km | DERIVED: n = p/kT (610 Pa, 210 K) = 2.1·10¹⁷ cm⁻³ × σ_CO₂(550 nm) ≈ 2.4 σ_air ≈ 1.1·10⁻²⁶ cm² (Sneep & Ubachs 2005; air: Bucholtz 1995), λ⁻⁴·⁰⁸ |
| Mars | Dust | vertical τ = 0.5 (H = 11.1 km), ω₀ = 0.975 (red) / 0.90 / 0.77, g = 0.67 / 0.69 / 0.72 | τ: typical non-storm MER/MSL opacity (Lemmon et al. 2015, Icarus 251) — MEASURED range 0.3–1.0; ω₀(red) 0.975 and g ≈ 0.67: Wolff et al. 2009 (JGR 114, E00D04) as used in arXiv:1905.01074 — MEASURED; ω₀(blue, 437 nm) = 0.765–0.769 (reff 1.6–1.8 µm), Wolff et al. 2010 (Icarus 208, 143; MARCI band 1, cross-checked against CRISM 440 nm EPFs) — MEASURED; green 0.90 INTERPOLATED; green/blue g INFERRED (larger size parameter → more forward). The v3.6 interim build used an inferred blue 0.80 / green 0.93 (too grey a haze in captures); replaced by the measured blue value, not by look. |
| Titan | Haze | vertical τ ≈ 3.0 / 4.5 / 6.5 (R/G/B), H = 65 km, ω₀ 0.95 / 0.88 / 0.72, g 0.65 | APPROXIMATE, after the Huygens DISR aerosol model (Tomasko et al. 2008, PSS 56) |
| Venus, giants | unchanged v3.5 presets through the new model | | as v3.5 (labelled art-level presets) |

Optical properties of Martian dust vary strongly with season and dust storms (τ up to ≈ 5 in global storms).
SOL shows a single "typical clear season" state; a seasonal / MCS-driven τ is listed in `docs/issues.md` (ATM-004).

## Mars sky colour check (CPU, sun 40° up, sky 46° up away from the Sun, R:G:B normalised)
| ω₀ (R/G/B) | sky R:G:B |
|---|---|
| 0.975 / 0.93 / 0.80 (interim) | 1.00 : 0.80 : 0.53 |
| 0.975 / 0.90 / 0.77 (v3.6 release) | 1.00 : 0.75 : 0.48 |
| 0.975 / 0.85 / 0.62 (darker blue, not used) | 1.00 : 0.66 : 0.32 |
The Pancam/Mastcam-described "butterscotch" daytime sky (red-dominant, blue strongly suppressed) is consistent with the
release values; no presentation tint is applied.

## Validation (tests/render/atmosphere.test.ts, all automated)
| Check | Result |
|---|---|
| Earth vertical τ vs analytic column (Rayleigh + Mie + ozone tent) | within 1 % per channel; τ = 0.062 / 0.142 / 0.271 |
| Transmittance LUT vs 2000-step direct integration (Earth & Mars; zenith, 60°, grazing, from altitude, below horizon) | within 1.5 % |
| Multiple-scattering LUT | finite, non-negative, ≥ 5× larger on the day side than the night side |
| Earth clear daytime zenith | B > G > R; low Sun (μ = 0.03) transmits ≥ 3× more red than blue |
| Mars sky 5° from a setting Sun vs 145° away | the aureole is ≥ 1.3× bluer (B/R) than the sky away from the Sun, which is red (R > B) — the observed blue Martian sunset emerges from the parameters, it is not painted |
| Diffuse skylight / direct (noon) | Earth 0.04 / 0.09 / 0.21 (R/G/B); Mars 0.62 / 0.56 / 0.45 at τ 0.5; non-negative everywhere |
| Mars dust column | τ = 0.500 ± 0.006; Titan τ > 3 all channels |

LUT build cost (node, this machine): 300–450 ms per atmosphere, once per body on first approach (main thread —
moving it to a worker is listed as PERF-005).

## What changed on screen (software captures, `docs/qa/v3.6/`)
* Titan: v3.5 showed the surface map as a blue-grey globe (haze τ ≈ 0.5); v3.6 shows the opaque orange haze globe.
* Mars: a visible dust limb and horizon haze; reddish skylight fills terrain shadows (v3.5: black shadows, no haze).
* Earth limb: ozone in its layer and multiple scattering give a deeper blue limb band.
Hardware look NOT TESTED.
