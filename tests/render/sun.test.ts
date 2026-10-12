// Sun exposure/glare policy (spec §9 acceptance: close Sun not a clipped white ball; far Sun keeps its glare).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunMeterWeight, glareWeight, SUN_LOOKS, SUN_L0, SUN_L_MEAN } from '../../src/render/sun';
test('metering: tiny discs are not metered (sky exposure, glare reads); large discs land disc centre ≈0.96× display white (v3.3 final)', () => {
  assert.equal(sunMeterWeight(4), 0);
  // display value of disc centre = key · L0 / (L_mean · w);  key 0.16
  const centre = (w: number) => 0.16 * SUN_L0 / (SUN_L_MEAN * w);
  const close = centre(sunMeterWeight(900)); assert.ok(close > 0.8 && close < 1.2, `close ${close}`);
  const mid = centre(sunMeterWeight(77)); assert.ok(mid < 1.6, `0.05 AU (≈77 px) ${mid}`);
  const v32 = centre(0.05); assert.ok(v32 > 3.5, `v3.2 metered disc centre at ${v32}× white (documents the overexposed ball)`);
});
test('glare fades out as the disc fills the frame, stays full for a point-like Sun', () => {
  assert.equal(glareWeight(2, 1000), 1); assert.ok(glareWeight(600, 1000) < 0.1);
  let prev = 2; for (let r = 1; r < 800; r += 7) { const g = glareWeight(r, 1000); assert.ok(g <= prev + 1e-12); prev = g; }
});
test('three art-direction looks, display grading only (tint ≤ 1, contrast within 0.9–1.3)', () => {
  assert.deepEqual(Object.keys(SUN_LOOKS).sort(), ['cinematic', 'natural', 'scientific']);
  for (const l of Object.values(SUN_LOOKS)) { assert.ok(l.tint.every(x => x > 0 && x <= 1)); assert.ok(l.contrast >= 0.9 && l.contrast <= 1.3); }
});
