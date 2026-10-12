import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baumbach } from '../../src/astro/solar';
// Allen's Astrophysical Quantities: K+F corona at the limb ≈ 1e-6…4e-6 of mean disc radiance, ~1e-8 at 2 R☉, ~1e-9 by 4–5 R☉.
test('Baumbach profile magnitude at the limb, 2 R☉ and 5 R☉', () => {
  assert.ok(Math.abs(baumbach(1) - 4.0432e-6) < 1e-9);
  const r2 = baumbach(2); assert.ok(r2 > 1e-8 && r2 < 3e-8, String(r2));
  const r5 = baumbach(5); assert.ok(r5 > 5e-10 && r5 < 2e-9, String(r5));
});
test('corona is monotonically fainter outward', () => { let p = baumbach(1); for (let r = 1.01; r < 8; r += 0.01) { const v = baumbach(r); assert.ok(v < p); p = v; } });
