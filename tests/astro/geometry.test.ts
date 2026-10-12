// Geometry, frame and orbit-overlay tests (tolerances are numerical-precision bounds or stated physical facts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EQ2GAL, EQ2ECL, radecToVec } from '../../src/astro/frames';
import { mulMV, mulMtV, len, sub, dot, norm, V3 } from '../../src/astro/vec';
import { precessEcliptic } from '../../src/astro/precession';
import { propagate } from '../../src/astro/twobody';
import { conicPolyline, trueAnomalyOf, solveKepler, rotOrbit, trueToMeanFraction, Elements } from '../../src/astro/kepler';
import { stateToElements, SolarSystem } from '../../src/astro/system';
import { DEG, GM_SUN, AU } from '../../src/astro/constants';
import sats from '../../public/assets/data/satellites.json';
import feat from '../../public/assets/data/featured.json';

const near = (a: number, b: number, tol: number, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b} (tol ${tol})`);
test('ICRS→Galactic matrix is orthonormal and maps the NGP (192.85948°, +27.12825°) to b=+90°', () => {
  const g = mulMV(EQ2GAL, radecToVec(192.85948, 27.12825)); near(g[2], 1, 1e-9, 'NGP z');
  const gc = mulMV(EQ2GAL, radecToVec(266.40499, -28.93617)); near(gc[0], 1, 1e-8, 'GC x');      // l=0,b=0
  for (const v of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as V3[]) near(len(mulMV(EQ2GAL, v)), 1, 1e-12);
});
test('Galactic round trip < 1e-14', () => { const v = norm([0.3, -0.7, 0.2]); const r = mulMtV(EQ2GAL, mulMV(EQ2GAL, v)); assert.ok(len(sub(r, v)) < 1e-14); });
test('equatorial↔ecliptic: celestial pole sits at ecliptic latitude 90°−ε', () => { const p = mulMV(EQ2ECL, [0, 0, 1]); near(Math.acos(p[2]) / DEG, 23.4392794444, 1e-9); });
test('ecliptic precession is reversible to < 1e-5 arcsec (polynomial inverse, 1950↔2000)', () => {
  const v: V3 = [AU * 0.3, AU * 0.9, AU * 0.05];
  const back = precessEcliptic(precessEcliptic(v, 2433282.5, 2451545), 2451545, 2433282.5);
  const err = len(sub(back, v)) / len(v) * 206264.806; assert.ok(err < 1e-5, `round-trip error ${err} arcsec`);
});
test('two-body propagation conserves energy and returns after one period (e=0.97 and hyperbolic)', () => {
  const mu = GM_SUN;
  for (const [r0, v0] of [[[1.5e8, 0, 0], [0, 50, 3]], [[8e7, 1e7, 0], [5, 60, 1]]] as [V3, V3][]) {
    const E0 = dot(v0, v0) / 2 - mu / len(r0);
    for (const dt of [86400 * 10, 86400 * 400, -86400 * 77]) { const [r, v] = propagate(r0, v0, mu, dt); near((dot(v, v) / 2 - mu / len(r)) / E0, 1, 1e-9, 'energy'); }
    if (E0 < 0) { const a = -mu / (2 * E0), T = 2 * Math.PI * Math.sqrt(a ** 3 / mu); const [r] = propagate(r0, v0, mu, T); assert.ok(len(sub(r, r0)) / len(r0) < 1e-9); }
  }
});
test('Kepler solver converges for e→1', () => { for (const e of [0, 0.5, 0.9, 0.99, 0.999]) for (let M = -3; M <= 3; M += 0.37) { const E = solveKepler(M, e); near(E - e * Math.sin(E), ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI, 1e-10, `e=${e}`); } });
test('adaptive conic: every chord within tolerance, denser at periapsis, phase monotonic', () => {
  const el: Elements = { a: 17.8 * AU, e: 0.967, i: 162 * DEG, node: 59 * DEG, peri: 112 * DEG, M: 0 };
  const tol = 1.5e-4, pl = conicPolyline(el, tol);
  assert.ok(pl.closed && pl.count > 64 && pl.count < 6000, `count ${pl.count}`);
  const p = (i: number): V3 => [pl.pts[i * 3], pl.pts[i * 3 + 1], pl.pts[i * 3 + 2]];
  // vertex spacing near periapsis is much smaller than near apoapsis
  let dmin = Infinity, dmax = 0; for (let i = 0; i < pl.count - 1; i++) { const d = len(sub(p(i + 1), p(i))); dmin = Math.min(dmin, d); dmax = Math.max(dmax, d); }
  assert.ok(dmax / dmin > 20);
  for (let i = 1; i < pl.count; i++) assert.ok(pl.phase[i] >= pl.phase[i - 1] - 1e-6 || pl.phase[i - 1] > 0.99, `phase at ${i}`);
});
test('hyperbolic arc is open and finite (1I/ʻOumuamua-like, e=1.2)', () => {
  const pl = conicPolyline({ a: -1.27 * AU, e: 1.2, i: 123 * DEG, node: 24 * DEG, peri: 241 * DEG, M: 0 }, 1.5e-4, 50 * AU);
  assert.ok(!pl.closed); for (let i = 0; i < pl.count * 3; i++) assert.ok(Number.isFinite(pl.pts[i]));
  assert.ok(pl.phase[0] === 0 && Math.abs(pl.phase[pl.count - 1] - 1) < 1e-9);
});
test('selected body lies on its drawn osculating orbit (planets, Moon, sampled moons, comets) within polyline tolerance', () => {
  const S = new SolarSystem(sats as any, feat as any); const jd = 2461321.5; S.update(jd, jd);
  for (const id of ['mercury', 'earth', 'mars', 'jupiter', 'neptune', 'moon', 'io', 'titan', 'halley', 'ceres']) {
    const b = S.get(id)!; const { el, frame } = b.orbitEl!(jd);
    const rel = b.rel; const local = mulMtV(frame, rel);   // into element frame
    const nu = trueAnomalyOf(local, el);
    const p = el.e === 1 ? 2 * el.a : Math.abs(el.a) * Math.abs(1 - el.e * el.e), r = p / (1 + el.e * Math.cos(nu));
    const onCurve = rotOrbit(r * Math.cos(nu), r * Math.sin(nu), el);
    assert.ok(len(sub(onCurve, local)) / len(local) < 1e-6, `${id}: off-curve ${(len(sub(onCurve, local))).toFixed(3)} km`);
    // for osculating (state-derived) orbits the drawn phase must equal the body's mean anomaly
    if (['mercury', 'earth', 'moon', 'io'].includes(id)) near(trueToMeanFraction(nu, el.e), ((el.M / (2 * Math.PI)) % 1 + 1) % 1, 1e-6, `${id} phase`);
  }
});
test('Uranus obliquity ≈ 97.8°: IAU north pole is 82.2° from the orbit normal and the spin is retrograde (W decreasing)', () => {
  const S = new SolarSystem(sats as any, feat as any); const jd = 2461321.5; S.update(jd, jd);
  const u = S.get('uranus')!, pole: V3 = [u.rot[2], u.rot[5], u.rot[8]];
  const n = norm(stateToElements as any ? (() => { const v = S.velocity(u, jd); const r = u.pos; return [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]] as V3; })() : [0, 0, 1]);
  near(Math.acos(dot(pole, n)) / DEG, 180 - 97.77, 0.1, 'IAU-pole angle');
  const W0 = (S.get('uranus')!.rotModel!)(0, 0)[2], W1 = (S.get('uranus')!.rotModel!)(1, 0)[2]; assert.ok(W1 < W0, 'retrograde');
});
