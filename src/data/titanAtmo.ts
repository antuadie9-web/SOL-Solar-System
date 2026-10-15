// SOL v3.8.1 WP-E — Titan's atmosphere as measured populations (Gate C reference case).
//
// Evidence classes per value: MEASURED (in-situ / spacecraft retrieval, cited), DERIVED (computed from measured values),
// INFERRED (model choice within the literature's range, documented reason), FITTED (inferred parameter adjusted within
// its stated uncertainty so the disc-integrated model matches measured photometry — see tests/render/titanAtmo381.test.ts).
//
// Channels are R, G, B at representative wavelengths 600, 550, 450 nm.
//
// Main haze — Huygens DISR (Tomasko et al. 2008, PSS 56, 669; summary in Tomasko & West 2010, "Aerosols in Titan's
// atmosphere", Titan from Cassini-Huygens ch. 12, Fig. 12.4), MEASURED extinction optical depth fits (λ in nm):
//   above 80 km:  τ = 1.012e7 λ^−2.339, number density falling with a 65-km scale height above 80 km
//   30–80 km:     τ = 2.029e4 λ^−1.409, constant extinction (cumulative τ linear in altitude)
//   below 30 km:  τ = 6.270e2 λ^−0.9706, constant extinction
//   → at 600/550/450 nm: above 80 km 3.21 / 3.94 / 6.30, 30–80 km 2.47 / 2.79 / 3.71, below 30 km 1.26 / 1.37 / 1.67.
// Above 80 km the DISR 65-km scale height is used unchanged up to the detached-haze gap. (A decreasing-H law above 250 km,
// suggested by Tomasko et al. 2016, was tested and rejected: it removes the 250–350 km haze that produces Titan's
// high-phase brightness surge — F(163°)/F(0) fell from ≈ 1.1 to 0.8 at 450 nm, against Cassini ISS ≥ 1 (García Muñoz et al.
// 2017, Nature Astronomy 1, 0114: "at α ∼ 160–166° comparable to or higher than at full illumination", strongest at
// λ ≲ 600 nm).)
// Single-scattering albedo: higher-altitude aerosols darker (tholin-like, strongly absorbing toward the blue), below 80 km
// less absorbing (Tomasko et al. 2008, Fig. 12.19) — values below FITTED within the figure's ±0.05 band to Titan's
// geometric albedo p_V = 0.22 and colour B−V = 1.28 (catalog / standard photometry).
// Phase function: fractal aggregates of ~3000 monomers of 50 nm (DISR solar aureole), strongly forward scattering; a
// Cornette–Shanks lobe with g decreasing toward the red (larger size parameter in the blue) — INFERRED g = 0.70/0.73/0.76,
// chosen (with the SSA) against BOTH the full-phase colour and the Cassini ISS high-phase surge (tests). A two-lobe phase
// function with a narrow diffraction peak was tested and rejected: at α = 160–166° the scattering angle is 14–20°, outside a
// g ≈ 0.9 peak, and the surge fell.
//
// Detached haze — Cassini ISS: a thin layer above a depleted gap; 500 ± 8 km in 2005–2007 (Seignovert et al. 2017,
// Icarus 292, 13), collapsed in 2012, reappeared 2016 at 450 ± 20 km and 2017 at 510 ± 20 km, optically weaker than in
// 2005 (West et al. 2018, Nature Astronomy 2, 495). No observations after Cassini's end (Sept 2017): the 2017 state is
// rendered for the present epoch and labelled INFERRED. Particles: ≥ 10 monomers of 60 nm (Seignovert 2017) → small
// aggregates, weaker forward scattering and a bluer extinction law (INFERRED g, λ^−3, ω0).
// Gas: N₂ Rayleigh column ≈ 10.6 × Earth's (1.47 bar, g = 1.352 m s⁻²) → τ_R(550 nm) ≈ 1.0 — DERIVED; scale height 27 km
// (20.6 km at 94 K at the surface, ≈ 45 km in the warm stratosphere) — INFERRED single exponential.
// Surface reflectance 0.13 at 531 nm, 0.18 at 830 nm (DISR surface lamp; Tomasko et al. 2005) — MEASURED (landing site).
import type { Aerosol, AeroProfile } from '../render/atmoModel';
type V3 = [number, number, number];

const tauAbove80: V3 = [3.21, 3.94, 6.30], tau3080: V3 = [2.47, 2.79, 3.71], tauBelow30: V3 = [1.26, 1.37, 1.67];
/** FITTED single-scattering albedos (see header). */
export const TITAN_SSA = { upper: [0.90, 0.85, 0.72] as V3, lower: [0.96, 0.94, 0.86] as V3, detached: [0.94, 0.92, 0.86] as V3 };
const GAP = { c: 445, w: 32, d: 0.65 };   // depleted layer below the detached haze (West et al. 2018) — INFERRED depth/width
const upperProf: AeroProfile = { kind: 'exp', base: 80, H0: 65, k: 0, below: 0, gap: GAP };
/** relative density of the undepleted upper haze at altitude h (1 at 80 km) */
const upperRel = (h: number) => Math.exp(-(h - 80) / 65);
/** ∫ρ dh above 80 km of the upper-haze profile (gap included), so its vertical τ equals the DISR value */
function upperColumn() { let I = 0; for (let h = 80; h < 1500; h += 0.25) { const q = (h - GAP.c) / GAP.w; I += upperRel(h) * (1 - GAP.d * Math.exp(-q * q)) * 0.25; } return I; }
const scatExt = (ext: V3, ssa: V3) => ({ ext, scat: [ext[0] * ssa[0], ext[1] * ssa[1], ext[2] * ssa[2]] as V3 });

export function titanAerosols(ssa = TITAN_SSA): Aerosol[] {
  // upper haze: vertical τ above 80 km = β80 · ∫ρ dh (the soft 4-km lower edge overlaps the lower haze's soft top)
  const I = upperColumn();
  const up = scatExt([tauAbove80[0] / I, tauAbove80[1] / I, tauAbove80[2] / I], ssa.upper);
  // lower haze: 30–80 km constant (τ/50 km); below 30 km relative density from the measured τ below 30 km (grey mean)
  const b3080: V3 = [tau3080[0] / 50, tau3080[1] / 50, tau3080[2] / 50];
  const lowRel = ((tauBelow30[0] / 30) / b3080[0] + (tauBelow30[1] / 30) / b3080[1] + (tauBelow30[2] / 30) / b3080[2]) / 3;
  const lo = scatExt(b3080, ssa.lower);
  // detached layer (2017 state): peak extinction = 0.5 × the undepleted main-haze extinction 70 km below it (West et al.
  // 2018 profiles: "optically much weaker" after the reappearance), λ^−3 relative to 550 nm — INFERRED
  const c = 510, w = 18, pk = 0.5 * up.ext[1] * upperRel(c - 70);
  const det = scatExt([pk * Math.pow(550 / 600, 3), pk, pk * Math.pow(550 / 450, 3)], ssa.detached);
  return [
    { label: 'upper haze (tholin aggregates, > 80 km)', ...up, g: [0.70, 0.73, 0.76], prof: upperProf },
    { label: 'lower haze (0–80 km)', ...lo, g: [0.70, 0.73, 0.76], prof: { kind: 'band', h0: -50, h1: 80, soft: 4, step: 30, lowRel } },
    { label: 'detached haze (2017 state, inferred for the present epoch)', ...det, g: [0.36, 0.40, 0.45], prof: { kind: 'gauss', c, w } },
  ];
}
/** Rayleigh (N₂) per channel, 1/km at the surface, DERIVED τ_R(550) = 1.0 over a 27-km scale height, λ^−4. */
export const TITAN_RAYLEIGH: V3 = [1.0 / 27 * Math.pow(550 / 600, 4), 1.0 / 27, 1.0 / 27 * Math.pow(550 / 450, 4)];
