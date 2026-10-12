// Guide-line precision (owner defect: orbit/axis lines "vibrate"). Tolerances declared before measurement:
//  • relative-to-eye reconstruction must reproduce a camera-relative offset d to within float32 rounding of d itself
//    (≤ 2⁻²² · d, i.e. ≤ 0.24 µrad — far below one pixel at any field of view) anywhere out to 100 AU. Note: an absolute
//    1 m bound is impossible for any float32 output once d > ~16,000 km, because the result itself is stored in float32;
//    what matters for jitter is that the error scales with d (angularly constant) instead of with the distance from the Sun;
//  • the v3.2 path (float32 vertex + float32 translation) is expected to fail that bound by orders of magnitude, which
//    documents the root cause rather than assuming it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitDouble, splitArray, rteF32, naiveF32, convertLength, LENGTH_UNITS_KM } from '../../src/contracts/precision';
const AU = 149597870.7;
test('splitDouble: hi is float32 and hi+lo reproduces x to ≲ 2⁻⁴⁸ relative', () => {
  for (const x of [1, Math.PI * 1e9, 30.07 * AU, -4.5e9 + 0.123, 1e-7]) {
    const [h, l] = splitDouble(x); assert.equal(Math.fround(h), h); assert.equal(Math.fround(l), l);
    assert.ok(Math.abs(h + l - x) <= Math.abs(x) * 2 ** -46 + 1e-30, `x=${x}`);
  }
});
test('RTE error ≤ float32 rounding of the camera offset out to 100 AU; the v3.2 float32 path errs by ≥ 10 km there', () => {
  let worstRte = 0, worstNaive = 0;
  for (const R of [1, 5.2, 30, 100]) for (const d of [10, 1e3, 1e5, 1e6]) {
    const p = R * AU + 0.37, cam = p - d - 0.11;           // point and camera, float64 truth
    const truth = p - cam;
    const [ph, pl] = splitDouble(p), [oh, ol] = splitDouble(-cam);
    worstRte = Math.max(worstRte, Math.abs(rteF32(ph, pl, oh, ol) - truth) / Math.max(truth, 1e-3) * 2 ** 22);
    worstNaive = Math.max(worstNaive, Math.abs(naiveF32(p, -cam) - truth));
  }
  assert.ok(worstRte <= 1, `RTE worst ${worstRte} (in units of 2⁻²²·d)`);
  assert.ok(worstNaive >= 10, `naive worst ${worstNaive} km (expected to demonstrate the defect)`);
});
test('RTE is temporally stable at 30 AU: 1 m camera steps 50 km from a vertex move it 1 m ± 1 %, the v3.2 path moves it 0 or ≥ 256 km', () => {
  const p = 30 * AU + 0.4; let prev: number | null = null, prevN: number | null = null; let naiveJumps = 0;
  for (let k = 0; k < 200; k++) {
    const cam = p - 50 - k * 0.001; const [ph, pl] = splitDouble(p), [oh, ol] = splitDouble(-cam);
    const r = rteF32(ph, pl, oh, ol), n = naiveF32(p, -cam);
    if (prev !== null) assert.ok(Math.abs(r - prev - 0.001) < 1e-5, `step ${k}: ${r - prev}`);
    if (prevN !== null && n !== prevN) { naiveJumps++; assert.ok(Math.abs(n - prevN) >= 256, `naive step ${n - prevN}`); }
    prev = r; prevN = n;
  }
  void naiveJumps;
});
test('splitArray keeps layout and precision', () => { const a = new Float64Array([AU * 9.5, -AU * 0.3, 12.5]); const { hi, lo } = splitArray(a); for (let i = 0; i < 3; i++) assert.ok(Math.abs(hi[i] + lo[i] - a[i]) < 1e-3); });
test('length units are the exact IAU definitions and convert consistently', () => {
  assert.equal(LENGTH_UNITS_KM.AU, 149597870.7);
  assert.ok(Math.abs(LENGTH_UNITS_KM.pc - 648000 / Math.PI * 149597870.7) / LENGTH_UNITS_KM.pc < 1e-15);
  assert.ok(Math.abs(convertLength(1, 'pc', 'ly') - 3.261563777) < 1e-8);
  assert.ok(Math.abs(convertLength(convertLength(8.2, 'kpc', 'km'), 'km', 'kpc') - 8.2) < 1e-12);
});
