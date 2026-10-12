// SOL v3.8 — Milky Way structural model (spec §25, P9 foundation). A PARAMETRIC, literature-based description of the
// Galaxy used for Galactic context (UI map, coordinates, future far-field rendering). It is an INFERRED 3-D reconstruction
// from published fits — not an observed 3-D map — and every parameter carries its source. SOL's sky background remains
// the observed 2-D Gaia panorama; nothing in this module is drawn as if it were measured structure.
//
// Frame: Galactocentric, kpc, right-handed: +x from the Galactic centre (GC) toward the Sun's projection REVERSED
// (the Astropy convention: Sun at x = −R0), +y toward Galactic longitude l = 90° (direction of rotation), +z toward the NGP.
import { GALACTOCENTRIC } from '../contracts/frames';

export interface Cited<T> { value: T; sigma?: T; source: string }
const BHG16 = 'Bland-Hawthorn & Gerhard 2016, ARA&A 54, 529 (review, recommended values)';
const REID19 = 'Reid et al. 2019, ApJ 885, 131, Table 2 (BeSSeL maser parallaxes; log-spiral arms with kinks)';

export const MW = {
  /** Sun–GC distance used for the frame (Astropy v4.0 default; GRAVITY 2018). Reid 2019 fit 8.15 ± 0.15 kpc. */
  R0_kpc: { value: GALACTOCENTRIC.R0_kpc, source: 'GRAVITY Collaboration 2018, A&A 615, L15 (as Astropy v4.0 galcen_distance)' } as Cited<number>,
  zSun_pc: { value: GALACTOCENTRIC.zSun_pc, source: 'Bennett & Bovy 2019, MNRAS 482, 1417' } as Cited<number>,
  thinDisc: { scaleLength_kpc: { value: 2.6, sigma: 0.5, source: BHG16 }, scaleHeight_pc: { value: 300, sigma: 50, source: BHG16 } },
  thickDisc: { scaleLength_kpc: { value: 2.0, sigma: 0.2, source: BHG16 }, scaleHeight_pc: { value: 900, sigma: 180, source: BHG16 }, localFraction: { value: 0.12, sigma: 0.04, source: BHG16 } },
  bar: { halfLength_kpc: { value: 5.0, sigma: 0.2, source: BHG16 }, angleDeg: { value: 27, sigma: 2, source: BHG16 + ' (long bar angle to the Sun–GC line)' } },
  /** dust layer (extinction model): exponential disc */
  dust: { scaleLength_kpc: { value: 2.26, source: 'Drimmel & Spergel 2001, ApJ 556, 181 (dust disc)' }, scaleHeight_pc: { value: 134, source: 'Drimmel & Spergel 2001, ApJ 556, 181' } },
  sgrAstar: { distance_kpc: { value: 8.178, sigma: 0.013, source: 'GRAVITY Collaboration 2019, A&A 625, L10' }, raDeg: 266.41683708, decDeg: -29.00781056, source: 'Reid & Brunthaler 2004 (ICRS position of Sgr A*)' },
  rotation: { theta0_kms: { value: 236, sigma: 7, source: REID19 } },
};

/** Reid et al. (2019) Table 2: ln(R/Rk) = −(β − βk) tan ψ (ψ< for β ≤ βk, ψ> beyond); β = Galactocentric azimuth (0 toward
 *  the Sun, increasing in the direction of Galactic rotation, i.e. toward l = 90° seen from the Sun… see azimuthToXY). */
export interface SpiralArm { name: string; betaMin: number; betaMax: number; betaKink: number; Rkink: number; pitchLo: number; pitchHi: number; width: number; source: string }
export const ARMS: SpiralArm[] = [
  { name: '3-kpc (near)', betaMin: 15, betaMax: 18, betaKink: 15, Rkink: 3.52, pitchLo: -4.2, pitchHi: -4.2, width: 0.18, source: REID19 },
  { name: 'Norma', betaMin: 5, betaMax: 54, betaKink: 18, Rkink: 4.46, pitchLo: -1.0, pitchHi: 19.5, width: 0.14, source: REID19 },
  { name: 'Scutum–Centaurus', betaMin: 0, betaMax: 104, betaKink: 23, Rkink: 4.91, pitchLo: 14.1, pitchHi: 12.1, width: 0.23, source: REID19 },
  { name: 'Sagittarius–Carina', betaMin: 2, betaMax: 97, betaKink: 24, Rkink: 6.04, pitchLo: 17.1, pitchHi: 1.0, width: 0.27, source: REID19 },
  { name: 'Local (Orion spur)', betaMin: -8, betaMax: 34, betaKink: 9, Rkink: 8.26, pitchLo: 11.4, pitchHi: 11.4, width: 0.31, source: REID19 },
  { name: 'Perseus', betaMin: -23, betaMax: 115, betaKink: 40, Rkink: 8.87, pitchLo: 10.3, pitchHi: 8.7, width: 0.35, source: REID19 },
  { name: 'Outer (Norma–Outer)', betaMin: -16, betaMax: 71, betaKink: 18, Rkink: 12.24, pitchLo: 3.0, pitchHi: 9.4, width: 0.65, source: REID19 },
];
/** Arm radius (kpc) at Galactocentric azimuth β (deg). */
export function armRadius(a: SpiralArm, betaDeg: number) {
  const psi = (betaDeg <= a.betaKink ? a.pitchLo : a.pitchHi) * Math.PI / 180;
  return a.Rkink * Math.exp(-(betaDeg - a.betaKink) * Math.PI / 180 * Math.tan(psi));
}
/** Reid 2019 azimuth convention: β = 0 on the GC→Sun line, increasing in the direction of Galactic rotation (toward l = 90°
 *  at the Sun). In the Galactocentric frame above (Sun at −x, +y toward l = 90°): x = −R cos β, y = R sin β. Verified by
 *  reproducing Reid's tabulated 4th-quadrant tangencies (3-kpc 337.0°, Norma 327.5°, Sct–Cen 306.1°, Sgr–Car 285.6°) to
 *  < 0.4° when the fitted spirals are continued to β < 0 (the tangencies entered the fits as priors outside the maser
 *  β range) — tests/galaxy/milkyway38.test.ts. */
export function azimuthToXY(R: number, betaDeg: number): [number, number] { const b = betaDeg * Math.PI / 180; return [-R * Math.cos(b), R * Math.sin(b)]; }
/** Sampled arm centre-line (kpc, Galactocentric x/y) for drawing. */
export function armPolyline(a: SpiralArm, step = 1, extendDeg = 0): [number, number][] {
  const out: [number, number][] = [];
  for (let b = a.betaMin - extendDeg; b <= a.betaMax + extendDeg + 1e-9; b += step) out.push(azimuthToXY(armRadius(a, b), b));
  return out;
}
/** Relative stellar number density of the two-disc model (normalised to 1 at the Sun), kpc inputs. */
export function discDensity(R: number, zKpc: number) {
  const t = MW.thinDisc, k = MW.thickDisc, R0 = MW.R0_kpc.value, f = k.localFraction.value;
  const thin = Math.exp(-(R - R0) / t.scaleLength_kpc.value) * Math.exp(-Math.abs(zKpc) * 1000 / t.scaleHeight_pc.value);
  const thick = Math.exp(-(R - R0) / k.scaleLength_kpc.value) * Math.exp(-Math.abs(zKpc) * 1000 / k.scaleHeight_pc.value);
  return (1 - f) * thin + f * thick;
}
/** Camera context: Galactocentric position (kpc) of a point given in heliocentric Galactic Cartesian kpc (x→GC, y→l=90°,
 *  z→NGP), using the same R0 / z☉ as the frame contract (small z☉ tilt neglected here: < 0.15° — display only). */
export function helioGalToGalactocentric(p: [number, number, number]): [number, number, number] {
  const R0 = MW.R0_kpc.value, zs = MW.zSun_pc.value / 1000;
  return [p[0] - R0, p[1], p[2] + zs];
}
