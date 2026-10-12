// SOL v3.8.1 (STAR-381-R) — measured stellar radii for the nearest navigable stars (interferometry / eclipsing fits).
// v3.4–3.8.0 derived every radius from M and Teff WITHOUT a bolometric correction ("order of magnitude"); for M dwarfs
// that is wrong by large factors (Proxima came out ≈ 0.07 R☉ instead of the measured 0.154 R☉), which matters as soon as a
// star is approached closely enough to resolve its disc. Values are MEASURED with the cited 1σ uncertainty; every other
// star keeps the labelled estimate.
export interface MeasuredRadius { rSun: number; sigma: number; method: string; source: string }
export const MEASURED_RADII: Record<string, MeasuredRadius> = {
  'Proxima Centauri': { rSun: 0.1542, sigma: 0.0045, method: 'VLTI interferometry + surface-brightness relation', source: 'Kervella, Thévenin & Lovis 2017, A&A 598, L7' },
  'Rigil Kentaurus': {   // α Centauri A
    rSun: 1.2234, sigma: 0.0053, method: 'VLTI/PIONIER interferometry', source: 'Kervella et al. 2017, A&A 597, A137' },
  'Toliman': {   // α Centauri B
    rSun: 0.8632, sigma: 0.0037, method: 'VLTI/PIONIER interferometry', source: 'Kervella et al. 2017, A&A 597, A137' },
  'Sirius': { rSun: 1.711, sigma: 0.013, method: 'VLTI/VINCI interferometry', source: 'Kervella et al. 2003, A&A 408, 681' },
  "Barnard's Star": { rSun: 0.1867, sigma: 0.0012, method: 'CHARA interferometry', source: 'Boyajian et al. 2012, ApJ 757, 112' },
  'Procyon': { rSun: 2.048, sigma: 0.025, method: 'VLTI/VINCI interferometry', source: 'Kervella et al. 2004, A&A 413, 251' },
};
export const R_SUN_KM = 695700;
/** Quadratic-free linear limb-darkening coefficient in V by effective temperature — REPRESENTATIVE trend of the
 *  Claret (2000) tables (strong darkening for cool dwarfs, weaker for hot stars); not a per-star fit. */
export function limbDarkeningV(teff: number) { return Math.min(0.85, Math.max(0.35, 0.95 - teff / 14000)); }
/** V-band mean surface brightness of a star relative to the Sun's: S = 10^(−0.4 (M_V − M_V☉)) / (R/R☉)², M_V☉ = 4.83. */
export function surfaceBrightnessRelSun(MV: number, rSun: number) { return Math.pow(10, -0.4 * (MV - 4.83)) / (rSun * rSun); }
