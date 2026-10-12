// v3.8 Milky Way structural model + Galactic frames (spec §23, §25).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARMS, armPolyline, armRadius, MW, discDensity } from '../../src/galaxy/milkyWayModel';
import { ICRS_TO_GAL } from '../../src/contracts/frames';
const lOf = (x: number, y: number, R0: number) => { const l = Math.atan2(y, x + R0) * 180 / Math.PI; return (l + 360) % 360; };
test('Reid 2019 arm tangencies are reproduced (R0 = 8.15 kpc as fitted): 3-kpc 337.0°, Norma 327.5°, Sct–Cen 306.1°, Sgr–Car 285.6°', () => {
  for (const [name, lt] of [['3-kpc (near)', 337.0], ['Norma', 327.5], ['Scutum–Centaurus', 306.1], ['Sagittarius–Carina', 285.6]] as [string, number][]) {
    const a = ARMS.find(x => x.name === name)!; let best = 400;
    for (const [x, y] of armPolyline(a, 0.25, 80)) { const l = lOf(x, y, 8.15); if (l > 180 && l < best) best = l; }
    assert.ok(Math.abs(best - lt) < 0.5, `${name}: model tangency ${best.toFixed(1)}° vs ${lt}°`);
  }
});
test('W3(OH) (l = 133.9°, d = 1.95 kpc, a Perseus maser) lies within one arm width of the Perseus model; the Local arm passes within 0.6 kpc of the Sun', () => {
  const P = ARMS.find(a => a.name === 'Perseus')!; const l = 133.9 * Math.PI / 180, x = -8.15 + 1.95 * Math.cos(l), y = 1.95 * Math.sin(l), R = Math.hypot(x, y), beta = Math.atan2(y, -x) * 180 / Math.PI;
  assert.ok(Math.abs(armRadius(P, beta) - R) < 0.35, `${armRadius(P, beta)} vs ${R}`);
  const L = ARMS.find(a => a.name.startsWith('Local'))!; assert.ok(Math.abs(armRadius(L, 0) - 8.15) < 0.6);
});
test('ICRS→Galactic: Sgr A* maps to l ≈ 359.94°, b ≈ −0.05°; the NGP (192.859508°, 27.128336°) maps to b = 90°', () => {
  const g = (ra: number, de: number) => { const r = ra * Math.PI / 180, d = de * Math.PI / 180, v = [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)], M = ICRS_TO_GAL;
    const x = M[0] * v[0] + M[1] * v[1] + M[2] * v[2], y = M[3] * v[0] + M[4] * v[1] + M[5] * v[2], z = M[6] * v[0] + M[7] * v[1] + M[8] * v[2];
    return [((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360, Math.asin(z) * 180 / Math.PI]; };
  const [l, b] = g(MW.sgrAstar.raDeg, MW.sgrAstar.decDeg); assert.ok(Math.abs(l - 359.944) < 0.01 && Math.abs(b + 0.046) < 0.01, `${l} ${b}`);
  assert.ok(Math.abs(g(192.859508, 27.128336)[1] - 90) < 1e-4);
});
test('two-disc density is 1 at the Sun and falls with height (thin-disc scale height 300 pc)', () => {
  assert.ok(Math.abs(discDensity(MW.R0_kpc.value, 0) - 1) < 1e-12);
  assert.ok(discDensity(MW.R0_kpc.value, 0.3) < 0.45 && discDensity(MW.R0_kpc.value, 0.3) > 0.35);
});
