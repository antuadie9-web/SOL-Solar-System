// DEF-38-008: minor-moon sizes from JPL radii / MPC absolute magnitudes instead of a 2.5-km default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import SATS from '../../public/assets/data/satellites.json';
import { satRadius } from '../../src/astro/system';
const by = (n: string) => (SATS as any[]).find(s => s.name === n);
test('every satellite without a JPL physical radius gets a sourced size', () => {
  const miss = (SATS as any[]).filter(s => !s.R); assert.ok(miss.length > 400);
  for (const s of miss) { const r = satRadius(s); assert.ok(r > 0.2 && r < 120, `${s.name} ${r}`); }
});
test('known irregulars: Sycorax, Siarnaq, Thrymr, Elara within published ranges', () => {
  const syc = satRadius(by('Sycorax')); assert.ok(syc > 50 && syc < 90, 'Sycorax ' + syc);          // Herschel D=165±36 km; H 8.2 at pV 0.065 → 60
  const sia = satRadius(by('Siarnaq')); assert.ok(sia > 12 && sia < 25, 'Siarnaq ' + sia);          // D ≈ 39 km
  const thr = satRadius(by('Thrymr')); assert.ok(thr > 2 && thr < 6, 'Thrymr ' + thr);              // D ≈ 8 km
  assert.equal(satRadius(by('Elara')), 40);                                                           // JPL (NEOWISE) radius
});
