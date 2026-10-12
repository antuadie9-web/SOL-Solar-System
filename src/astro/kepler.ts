// Two-body orbits.
import { DEG, TAU, GAUSS_K, AU } from './constants';
import { V3 } from './vec';
export interface Elements { a: number; e: number; i: number; node: number; peri: number; M: number } // a in any unit, angles rad
export function solveKepler(M: number, e: number) {
  M = ((M % TAU) + TAU) % TAU; if (M > Math.PI) M -= TAU;
  let E = e < 0.8 ? M : (M > 0 ? Math.PI : -Math.PI) * 0.85;
  for (let k = 0; k < 60; k++) {
    const f = E - e * Math.sin(E) - M, fp = 1 - e * Math.cos(E);
    const d = f / (fp - 0.5 * f * e * Math.sin(E) / fp); // Halley
    E -= d; if (Math.abs(d) < 1e-14) break;
  }
  return E;
}
// position in the reference frame of the elements (x → reference direction)
export function elemToPos(el: Elements): V3 {
  const E = solveKepler(el.M, el.e);
  const cE = Math.cos(E), sE = Math.sin(E), q = Math.sqrt(1 - el.e * el.e);
  const xo = el.a * (cE - el.e), yo = el.a * q * sE;
  return rotOrbit(xo, yo, el);
}
export function rotOrbit(xo: number, yo: number, el: Elements): V3 {
  const cO = Math.cos(el.node), sO = Math.sin(el.node), cw = Math.cos(el.peri), sw = Math.sin(el.peri), ci = Math.cos(el.i), si = Math.sin(el.i);
  const x1 = cw * xo - sw * yo, y1 = sw * xo + cw * yo;
  return [cO * x1 - sO * ci * y1, sO * x1 + cO * ci * y1, si * y1];
}
// polyline of one revolution, starting at true anomaly 0, points in the element frame; adaptive density near periapsis
export function orbitPolyline(el: Elements, n: number): Float64Array {
  const out = new Float64Array(n * 3), q = Math.sqrt(1 - el.e * el.e);
  for (let k = 0; k < n; k++) {
    const E = (k / n) * TAU;
    const p = rotOrbit(el.a * (Math.cos(E) - el.e), el.a * q * Math.sin(E), el);
    out[k * 3] = p[0]; out[k * 3 + 1] = p[1]; out[k * 3 + 2] = p[2];
  }
  return out;
}
export const meanMotionSun = (aAU: number) => GAUSS_K / Math.pow(aAU, 1.5); // rad/day
// heliocentric osculating elements (AU, deg) + epoch → ecliptic J2000 position, km
export function helioPos(aAU: number, e: number, iDeg: number, OmDeg: number, wDeg: number, M0Deg: number, epoch: number, jd: number): V3 {
  const n = meanMotionSun(aAU);
  const p = elemToPos({ a: aAU * AU, e, i: iDeg * DEG, node: OmDeg * DEG, peri: wDeg * DEG, M: M0Deg * DEG + n * (jd - epoch) });
  return p;
}

// ── Adaptive conic tessellation (Phase 2 orbit overlay) ──────────────────────────────────────────────────────────────
// Samples an osculating conic in true anomaly ν, recursively bisecting any span whose mid-point deviates from the chord
// by more than `tolRel` × local radius (so the polyline error is a fixed fraction of the distance scale everywhere,
// dense at periapsis, sparse at apoapsis). Each vertex carries its mean-anomaly fraction so overlays can place the body
// and the fading trail by orbital TIME rather than by vertex index. Hyperbolic/parabolic arcs are open and limited to
// r ≤ rMax.
export interface ConicPolyline { pts: Float64Array; phase: Float32Array; closed: boolean; count: number; nuRange: [number, number] }
export function trueToMeanFraction(nu: number, e: number): number {
  if (e < 1) {
    const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
    const M = E - e * Math.sin(E);
    return (((M / TAU) % 1) + 1) % 1;
  }
  if (e > 1) { const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2)); return e * Math.sinh(H) - H; }
  const D = Math.tan(nu / 2); return D + D * D * D / 3; // parabolic (Barker), unnormalised
}
export function conicPolyline(el: Elements, tolRel = 1.5e-4, rMax = Infinity, maxPts = 6000): ConicPolyline {
  const e = el.e, p = e === 1 ? 2 * Math.abs(el.a) : Math.abs(el.a) * Math.abs(1 - e * e);
  const rAt = (nu: number) => p / (1 + e * Math.cos(nu));
  const P = (nu: number): V3 => { const r = rAt(nu); return rotOrbit(r * Math.cos(nu), r * Math.sin(nu), el); };
  let nu0 = -Math.PI, nu1 = Math.PI; const closed = e < 1;
  if (!closed) {
    const nuInf = Math.acos(-1 / Math.max(e, 1 + 1e-9));
    // limit the open arc to r ≤ rMax (and stay strictly inside the asymptotes)
    const lim = Number.isFinite(rMax) ? Math.acos(Math.max(-1, Math.min(1, (p / rMax - 1) / e))) : nuInf * 0.98;
    nu1 = Math.min(nuInf * 0.999, lim); nu0 = -nu1;
  }
  const out: number[] = []; const ph: number[] = [];
  const push = (nu: number) => { const v = P(nu); out.push(v[0], v[1], v[2]); ph.push(trueToMeanFraction(nu, e)); };
  const seg = (a: number, b: number, pa: V3, pb: V3, depth: number) => {
    const m = (a + b) / 2, pm = P(m);
    const cx = (pa[0] + pb[0]) / 2 - pm[0], cy = (pa[1] + pb[1]) / 2 - pm[1], cz = (pa[2] + pb[2]) / 2 - pm[2];
    const dev = Math.hypot(cx, cy, cz), r = rAt(m);
    if (depth < 14 && dev > tolRel * r && out.length / 3 < maxPts) { seg(a, m, pa, pm, depth + 1); seg(m, b, pm, pb, depth + 1); }
    else push(b);
  };
  const N0 = 32; let prevNu = nu0, prevP = P(nu0);
  push(nu0);
  for (let k = 1; k <= N0; k++) { const nu = nu0 + (nu1 - nu0) * k / N0, pn = P(nu); seg(prevNu, nu, prevP, pn, 0); prevNu = nu; prevP = pn; }
  if (closed) { out.splice(out.length - 3, 3); ph.pop(); } // last vertex duplicates the first
  // hyperbolic/parabolic phases → 0..1 along the drawn arc
  if (!closed) { const a = ph[0], b = ph[ph.length - 1]; for (let i = 0; i < ph.length; i++) ph[i] = (ph[i] - a) / (b - a); }
  return { pts: Float64Array.from(out), phase: Float32Array.from(ph), closed, count: out.length / 3, nuRange: [nu0, nu1] };
}
/** True anomaly of a position given in the element frame (inverse of rotOrbit's rotation). */
export function trueAnomalyOf(pos: V3, el: Elements): number {
  const cO = Math.cos(el.node), sO = Math.sin(el.node), ci = Math.cos(el.i), si = Math.sin(el.i);
  // undo Rz(Ω): x1 = cO x + sO y, y1' = −sO x + cO y ; undo Rx(i): y1 = ci y1' + si z
  const x1 = cO * pos[0] + sO * pos[1], yy = -sO * pos[0] + cO * pos[1], y1 = ci * yy + si * pos[2];
  return Math.atan2(y1, x1) - el.peri;
}
