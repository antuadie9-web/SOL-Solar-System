// The Moon: ELP/MPP02 (Chapront & Francou 2002, fitted to DE405) via astronomia — geocentric, mean ecliptic & equinox
// of date, rigorously precessed to the J2000 ecliptic (src/astro/precession.ts). Validated against JPL Horizons in
// tests/astro/ephemeris.test.ts.
import { elp } from 'astronomia';
import elpData from 'astronomia/data/elpMppDe';
import { V3 } from './vec';
import { ofDateToJ2000 } from './precession';
const M = new elp.Moon(elpData);
export function moonGeocentric(jdTT: number): V3 {
  const p = M.position(jdTT);   // { _ra: λ, _dec: β (ecliptic of date, rad), range km }
  const L = p._ra, B = p._dec, r = p.range, cB = Math.cos(B);
  return ofDateToJ2000([r * cB * Math.cos(L), r * cB * Math.sin(L), r * Math.sin(B)], jdTT);
}
