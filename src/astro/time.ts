// Time scales (NAIF/IERS conventions). The simulation clock runs in TT; ephemerides are evaluated in TDB; the UI shows UTC.
//  • UTC → TAI: IERS leap-second table (Bulletin C 72, 2026-07-06: no leap second at end of Dec 2026; TAI−UTC = 37 s
//    since 2017-01-01). Beyond the announced horizon the last value is held and flagged `predicted`.
//  • TT = TAI + 32.184 s.  Before 1972 (no leap seconds) TT−UT is the ΔT model of astronomia (Espenak & Meeus polynomials).
//  • TDB − TT: Fairhead & Bretagnon leading terms (|Δ| ≤ 1.7 ms, error < 30 µs).
//  • UT1: approximated by UTC (|UT1−UTC| < 0.9 s by IERS definition) inside the leap-second era; TT − ΔT outside it.
// See docs/science/time-scales.md for validity ranges.
import { deltat } from 'astronomia';
export const jdFromDate = (d: Date) => d.getTime() / 86400000 + 2440587.5;
export const dateFromJd = (jd: number) => new Date((jd - 2440587.5) * 86400000);

/** [MJD (UTC) from which the value applies, TAI−UTC seconds] — IERS Leap_Second.dat, 1972 onward. */
export const LEAP_SECONDS: [number, number][] = [
  [41317, 10], [41499, 11], [41683, 12], [42048, 13], [42413, 14], [42778, 15], [43144, 16], [43509, 17], [43874, 18], [44239, 19],
  [44786, 20], [45151, 21], [45516, 22], [46247, 23], [47161, 24], [47892, 25], [48257, 26], [48804, 27], [49169, 28], [49534, 29],
  [50083, 30], [50630, 31], [51179, 32], [53736, 33], [54832, 34], [56109, 35], [57204, 36], [57754, 37],
];
/** Last date covered by an IERS announcement (Bulletin C 72: no step at 2026-12-31 → valid through 2027-06-30). */
export const LEAP_TABLE_VALID_UNTIL_MJD = 61586; // 2027-06-30 (next possible step not yet announced)
const MJD0 = 2400000.5, LEAP_ERA_START = 41317;

export function taiMinusUtc(jdUtc: number): number | null {
  const mjd = jdUtc - MJD0; if (mjd < LEAP_ERA_START) return null;
  let v = LEAP_SECONDS[0][1];
  for (const [m, s] of LEAP_SECONDS) { if (mjd >= m) v = s; else break; }
  return v;
}
const decimalYear = (jd: number) => 2000 + (jd - 2451544.5) / 365.25;
/** TT − UTC in seconds (pre-1972: ΔT = TT − UT model). */
export function ttMinusUtc(jdUtc: number) {
  const t = taiMinusUtc(jdUtc);
  return t === null ? deltat.deltaT(decimalYear(jdUtc)) : t + 32.184;
}
export const utcToTT = (jdUtc: number) => jdUtc + ttMinusUtc(jdUtc) / 86400;
export function ttToUtc(jdTT: number) {
  let u = jdTT - ttMinusUtc(jdTT) / 86400;
  for (let k = 0; k < 3; k++) u = jdTT - ttMinusUtc(u) / 86400;   // fixed point across leap boundaries
  return u;
}
/** TDB − TT in seconds (Fairhead & Bretagnon 1990 leading terms). */
export function tdbMinusTT(jdTT: number) {
  const g = (357.53 + 0.98560028 * (jdTT - 2451545)) * Math.PI / 180;
  return 0.001657 * Math.sin(g) + 0.000014 * Math.sin(2 * g);
}
export const ttToTdb = (jdTT: number) => jdTT + tdbMinusTT(jdTT) / 86400;
/** UT1 approximation for Earth orientation (see header). */
export function ut1FromTT(jdTT: number) {
  const utc = ttToUtc(jdTT);
  return taiMinusUtc(utc) === null ? jdTT - deltat.deltaT(decimalYear(jdTT)) / 86400 : utc;
}
export interface TimeScaleStatus { leapEra: boolean; predicted: boolean; ttMinusUtc: number; note: string }
export function timeScaleStatus(jdUtc: number): TimeScaleStatus {
  const mjd = jdUtc - MJD0, d = ttMinusUtc(jdUtc);
  if (mjd < LEAP_ERA_START) return { leapEra: false, predicted: false, ttMinusUtc: d, note: 'Before 1972: UTC≈UT; TT−UT from the ΔT model (uncertainty grows into the past).' };
  if (mjd > LEAP_TABLE_VALID_UNTIL_MJD) return { leapEra: true, predicted: true, ttMinusUtc: d, note: 'Beyond the announced IERS leap-second horizon: TAI−UTC held at 37 s (future leap seconds unknown).' };
  return { leapEra: true, predicted: false, ttMinusUtc: d, note: 'IERS leap-second table (Bulletin C 72).' };
}
// Gregorian/Julian calendar from JD (handles BCE, proleptic Julian before 1582-10-15)
export function calendar(jd: number) {
  const Z = Math.floor(jd + 0.5), F = jd + 0.5 - Z;
  let A = Z;
  if (Z >= 2299161) { const al = Math.floor((Z - 1867216.25) / 36524.25); A = Z + 1 + al - Math.floor(al / 4); }
  const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
  const dayF = B - D - Math.floor(30.6001 * E) + F;
  const month = E < 14 ? E - 1 : E - 13, year = month > 2 ? C - 4716 : C - 4715;
  const day = Math.floor(dayF), s = (dayF - day) * 86400;
  return { year, month, day, h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: Math.floor(s % 60), ms: s % 1 };
}
export function jdFromCalendar(y: number, mo: number, d: number, h = 0, mi = 0, s = 0) {
  if (mo <= 2) { y -= 1; mo += 12; }
  const greg = y > 1582 || (y === 1582 && (mo > 10 || (mo === 10 && d >= 15)));
  const A = Math.floor(y / 100), B = greg ? 2 - A + Math.floor(A / 4) : 0;
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + B - 1524.5 + (h + mi / 60 + s / 3600) / 24;
}
