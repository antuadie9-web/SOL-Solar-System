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
  assert.ok(d * k < d - R && d * k > d - 1.05 * R);
  assert.equal(pointDepthScale(R, R / 2), 0);
});
