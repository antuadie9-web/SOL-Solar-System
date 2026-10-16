// v3.8.1 CONT-14: shared point↔disc exposure contract (presentation.ts pointExposure).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointExposure, POINT_HANDOVER_PX } from '../../src/render/presentation';

const scene = 2 ** 7.4, sky = 2 ** 20.7;   // measured titan-handover (Exploration next to sunlit Saturn)
test('starts on the scene exposure at the hand-over and is the identity when sky = scene (Scientific)', () => {
  assert.equal(pointExposure(scene, sky, POINT_HANDOVER_PX), scene);
  assert.equal(pointExposure(scene, sky, 9), scene);
  for (const r of [3, 1.2, 0.3, 0.01]) assert.ok(Math.abs(pointExposure(scene, scene, r) / scene - 1) < 1e-12);
});
test('displayed signal (E·rpx²) is continuous and never increases while the body recedes; meets the sky domain', () => {
  let prev = Infinity;
  for (let i = 0; i <= 400; i++) {
    const r = 3.5 * Math.pow(1e-4, i / 400), s = pointExposure(scene, sky, r) * r * r;
    assert.ok(s <= prev * (1 + 1e-9), `rise at ${r}`); prev = s;
  }
  assert.ok(Math.abs(pointExposure(scene, sky, 1e-3) / sky - 1) < 1e-12);
});
test('a sky darker than the scene is approached symmetrically (no step down at the hand-over)', () => {
  const r = 3.4, e = pointExposure(sky, scene, r);
  assert.ok(e < sky && e > sky * 0.8);
});
import { pointDepthScale } from '../../src/render/presentation';
test('point sprite sits just in front of its own bounding sphere, on the line of sight', () => {
  const d = 3e6, R = 2574.7, k = pointDepthScale(R, d);
  assert.ok(d * k < d - R && d * k > d - R - 6e-4 * d);
  assert.equal(pointDepthScale(R, R / 2), 0);
  // CONT-14f-H: the pull never drops below the measured depth-resolution floor, yet stays inside any occulting pair's separation
  const far = 3e6, kf = pointDepthScale(R, far);
  assert.ok(far * (1 - kf) >= R + 5e-4 * far * 0.999 && far * (1 - kf) < R + 6e-4 * far);
});
import { discPhaseIntegral, discReflectance, pointBodyFlux, lumNormalised } from '../../src/render/presentation';
test('CONT-14c: Lambert disc integral reproduces the textbook a = 3p/2 relation', () => {
  assert.ok(Math.abs(discPhaseIntegral('earth', 0) - 2 * Math.PI / 3) < 0.01);
  assert.ok(Math.abs(discReflectance(0.3, 'earth') - 0.45) < 0.003);
});
test('CONT-14c: point flux at zero phase equals the geometric-albedo definition for every kind', () => {
  for (const k of ['rocky', 'icy', 'gas', 'earth'] as const) {
    const F = pointBodyFlux(0.2, k, 0, 1e-3, 2);
    assert.ok(Math.abs(F / (0.2 * Math.PI * 1e-6 / 4) - 1) < 1e-9, k);
  }
});
test('CONT-14c: point = disc integral at every phase (shared model), phase curve monotone', () => {
  for (const k of ['rocky', 'icy', 'gas'] as const) {
    let prev = Infinity;
    for (let a = 0; a <= 170; a += 10) {
      const F = pointBodyFlux(0.3, k, a, 1, 1), D = discReflectance(0.3, k) * discPhaseIntegral(k, a);
      assert.ok(Math.abs(F - D) < 1e-12); assert.ok(F <= prev + 1e-12, `${k} ${a}`); prev = F;
    }
  }
});
test('CONT-14c: point tint is luminance-normalised', () => {
  const c = lumNormalised([0.38, 0.34, 0.3]); assert.ok(Math.abs(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] - 1) < 1e-9);
});
