// v3.7.1 ring corrections: Uranus eccentric rings (RING-003) and the geometry-aware enhancement gain (RING-007).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RING_SYSTEMS } from '../../src/data/rings';
import { peakIF, peakIFAt, ringShadeIF } from '../../src/render/ringSystem';

test('RING-003: nine Uranian narrow rings carry French et al. (1988) Keplerian elements; λ stays circular', () => {
  const U = RING_SYSTEMS.uranus;
  for (const n of ['6', '5', '4', 'α', 'β', 'η', 'γ', 'δ', 'ε']) { const r = U.narrow.find(x => x.name === n)!; assert.ok(r.orbit, n); assert.ok(Math.abs(r.orbit!.a - r.r) < 1, n + ' a vs mean radius'); }
  assert.equal(U.narrow.find(x => x.name === 'λ')!.orbit, undefined);
  const e = U.narrow.find(x => x.name === 'ε')!.orbit!;
  // ε: periapse/apoapse radii 50,743 / 51,555 km (radial amplitude ae = 406 km; Smith et al. 1986 quote 404 km)
  assert.ok(Math.abs(e.a * e.e - 405.9) < 1); assert.equal(e.widthPeri, 19.7); assert.equal(e.widthApo, 96.4);
});
test('RING-003: tabulated apsidal precession agrees with the J2 secular rate 3/2·n·J2·(R/a)² to < 3 %', () => {
  const GM = 5.793939e6, J2 = 3.34343e-3, R = 26200;            // French et al. 1988 gravity solution (same kernel)
  for (const r of RING_SYSTEMS.uranus.narrow) {
    if (!r.orbit) continue;
    const n = Math.sqrt(GM / r.orbit.a ** 3) * 86400;             // rad/day
    const rate = 1.5 * n * J2 * (R / r.orbit.a) ** 2 * 180 / Math.PI;
    assert.ok(Math.abs(rate - r.orbit.periDotDegPerDay) / r.orbit.periDotDegPerDay < 0.03, `${r.name}: ${rate} vs ${r.orbit.periDotDegPerDay}`);
  }
});
test('RING-007: geometry-aware peak — backlit Jovian dust is far brighter than the back-scatter estimate, so the gain falls', () => {
  const J = RING_SYSTEMS.jupiter, AU = 1.496e8;
  const pBack = peakIF(J);
  // Sun 5.2 AU away 1° above the ring plane; camera 700,000 km opposite the Sun, 2° below the plane (forward scattering)
  const sun: [number, number, number] = [5.2 * AU * Math.cos(0.017), 0, 5.2 * AU * Math.sin(0.017)];
  const camF: [number, number, number] = [-700000 * Math.cos(0.035), 0, -700000 * Math.sin(0.035)];
  const camB: [number, number, number] = [700000 * Math.cos(0.4), 0, 700000 * Math.sin(0.4)];
  const pF = peakIFAt(J, null, sun, camF), pB = peakIFAt(J, null, sun, camB);
  assert.ok(pF > 20 * pB, `forward ${pF} vs back ${pB}`);
  const gain = (p: number) => Math.max(1, Math.min(J.enhanceMax, 0.08 / Math.max(p, pBack * 0.02)));
  assert.ok(gain(pF) * pF <= 0.0801 + 1e-9, 'forward-scattering peak mapped to the display target, not past it');
  assert.ok(ringShadeIF(0.1, 0, [0, 0, 1], [0, 0.6, 0.8], RING_SYSTEMS.saturn) > 0);
});
