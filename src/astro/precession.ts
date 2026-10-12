// Precession of ecliptic coordinates between epochs (Meeus, Astronomical Algorithms 2nd ed., eq. 21.5;
// IAU 1976 ecliptic precession, Lieske et al. 1977). Rotates a vector given in the mean ecliptic & equinox of `jdFrom`
// into the mean ecliptic & equinox of `jdTo`. Replaces the earlier longitude-only correction, which ignored the motion
// of the ecliptic (≈47″/century) and caused Moon errors of 5–42 km over 1950–2050 (R-003 in docs/rnd-ledger.md).
import { V3 } from './vec';
const AS = Math.PI / (180 * 3600), DEG = Math.PI / 180;
export function precessEcliptic(v: V3, jdFrom: number, jdTo: number): V3 {
  const T = (jdFrom - 2451545) / 36525, t = (jdTo - jdFrom) / 36525;
  const eta = ((47.0029 - 0.06603 * T + 0.000598 * T * T) * t + (-0.03302 + 0.000598 * T) * t * t + 0.00006 * t * t * t) * AS;
  const Pi = 174.876384 * DEG + (3289.4789 * T + 0.60622 * T * T) * AS - ((869.8089 + 0.50491 * T) * t - 0.03536 * t * t) * AS;
  const p = ((5029.0966 + 2.22226 * T - 0.000042 * T * T) * t + (1.11113 - 0.000042 * T) * t * t - 0.000006 * t * t * t) * AS;
  const r = Math.hypot(v[0], v[1], v[2]); if (r === 0) return [0, 0, 0];
  const lam0 = Math.atan2(v[1], v[0]), bet0 = Math.asin(v[2] / r);
  const cb = Math.cos(bet0), sb = Math.sin(bet0), ce = Math.cos(eta), se = Math.sin(eta), sPL = Math.sin(Pi - lam0), cPL = Math.cos(Pi - lam0);
  const A = ce * cb * sPL - se * sb, B = cb * cPL, C = ce * sb + se * cb * sPL;
  const lam = p + Pi - Math.atan2(A, B), bet = Math.asin(Math.max(-1, Math.min(1, C)));
  const cbb = Math.cos(bet);
  return [r * cbb * Math.cos(lam), r * cbb * Math.sin(lam), r * Math.sin(bet)];
}
export const ofDateToJ2000 = (v: V3, jd: number) => precessEcliptic(v, jd, 2451545.0);
