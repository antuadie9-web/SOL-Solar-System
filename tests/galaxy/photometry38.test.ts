// DEF-38-013: catalogue magnitudes are Gaia G (or Hipparcos Hp); SOL renders and reports Johnson V.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bprpFromTeff, gMinusV, rowMV } from '../../src/galaxy/photometry';
const teffBPRP = (c: number) => 5040 / (0.4929 + 0.5092 * c - 0.0353 * c * c);   // the ingest's own fit
test('BP−RP inversion is exact for the ingest fit', () => { for (const c of [-0.2, 0.5, 0.82, 1.5, 2.5, 3.83]) assert.ok(Math.abs(bprpFromTeff(teffBPRP(c)) - c) < 1e-6, String(c)); });
test('Riello et al. 2021 G−V: Sun-like ≈ −0.15 (Sun G − V ≈ −0.16), Proxima (BP−RP 3.83) ≈ −2.3', () => {
  assert.ok(Math.abs(gMinusV(0.82) + 0.152) < 0.01, String(gMinusV(0.82)));
  const g = gMinusV(3.83); assert.ok(g < -2.1 && g > -2.5, String(g));
});
test('Proxima: M_G 13.41 → M_V within 0.25 mag of SIMBAD (V 11.13 at ϖ 768.07 mas → M_V 15.56)', () => {
  const MV = rowMV(13.41, teffBPRP(3.83), 0); assert.ok(Math.abs(MV - 15.56) < 0.25, String(MV));
  assert.equal(rowMV(1.0, 6000, 2), 1.0);   // Hipparcos rows: Hp kept (≈ V)
});
