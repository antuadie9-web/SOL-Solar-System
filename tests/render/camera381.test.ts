// v3.8.1 CAM-381-01: free-look rotation is smoothed toward an accumulated target, frame-rate independently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CameraRig } from '../../src/render/camera';
function run(hz: number, eventEveryMs: number) {
  const r = new CameraRig(); r.toFree(); const steps: number[] = []; let prev = r.quat.clone(), tEv = 0;
  for (let t = 0; t < 1000; t += 1000 / hz) {
    while (tEv <= t && tEv < 500) { r.rotate(6, 0); tEv += eventEveryMs; }      // 500 ms of mouse drag
    r.update(1 / hz); steps.push(prev.angleTo(r.quat)); prev = r.quat.clone();
  }
  return { q: r.quat.clone(), steps };
}
test('free-look: the same drag ends at the same orientation at 60 and 144 Hz (frame-rate independent)', () => {
  const a = run(60, 8), b = run(144, 8);
  assert.ok(a.q.angleTo(b.q) < 2e-3, `${a.q.angleTo(b.q)} rad`);
});
test('free-look: per-frame steps vary smoothly even when mouse events arrive in bursts (no stepwise judder)', () => {
  const { steps } = run(60, 33);                                                   // events at 30 Hz against 60 Hz frames
  const active = steps.slice(3, 28); let worst = 0;
  for (let i = 1; i < active.length; i++) worst = Math.max(worst, Math.abs(active[i] - active[i - 1]) / Math.max(active[i - 1], 1e-9));
  assert.ok(worst < 0.9, `relative step change ${worst}`);
  assert.ok(Math.min(...active) > 0, 'the camera keeps moving between bursts instead of stopping and jumping');
});
test('an orientation set directly (UI / harness) is respected, not pulled back toward a stale target', () => {
  const r = new CameraRig(); r.toFree(); r.rotate(50, 0); for (let i = 0; i < 30; i++) r.update(1 / 60);
  const q = r.lookQuat([0, 0, 0], [1, 0, 0]); r.quat.copy(q); for (let i = 0; i < 10; i++) r.update(1 / 60);
  assert.ok(r.quat.angleTo(q) < 1e-9);
});
