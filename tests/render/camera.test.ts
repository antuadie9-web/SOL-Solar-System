// v3.5 AUD-02: the camera rig and the camera state machine can no longer disagree. Every way the rig (or a caller
// writing rig fields directly, as ui.ts and the QA harness do) changes target/mode/flight is reported to the machine;
// a per-frame invariant check repairs and counts anything that slips through (expected: 0 repairs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
(globalThis as any).performance ??= { now: () => Date.now() };
import { CameraRig } from '../../src/render/camera';

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const body = (id: string, pos: [number, number, number], r = 1000): any => ({ id, pos, radius: r, radii: [r, r, r], rot: I, kind: 'planet', def: {} });

test('travel → arrive keeps machine and rig in step; history records the previous target', async () => {
  const rig = new CameraRig(); const a = body('a', [1e8, 0, 0]), b = body('b', [2e8, 0, 0]);
  rig.pos = [1e8 + 5e4, 0, 0]; rig.setTarget(a);
  assert.equal(rig.sm.mode, 'orbit'); assert.equal(rig.sm.target, 'a');
  rig.goTo(b, { dur: 0.001 });
  assert.equal(rig.sm.mode, 'travel'); assert.equal(rig.sm.target, 'b'); assert.equal(rig.expectedMode(), 'travel');
  await new Promise(r => setTimeout(r, 5));
  rig.update(1 / 60);
  assert.equal(rig.flight, null); assert.equal(rig.sm.mode, 'orbit');
  assert.deepEqual(rig.sm.history.map(h => h.target), ['a']);
  assert.equal(rig.desyncRepairs, 0);
});

test('direct writes that desynchronised v3.4 (flight = null, target = x, mode = free) are reported', () => {
  const rig = new CameraRig(); const a = body('a', [1e8, 0, 0]), b = body('b', [3e8, 0, 0]);
  rig.pos = [1e8 + 5e4, 0, 0]; rig.setTarget(a); rig.goTo(b, { dur: 10 });
  assert.equal(rig.sm.mode, 'travel');
  rig.flight = null;                                   // ui.ts "jump" path / QA harness
  assert.equal(rig.sm.mode, 'orbit', 'removing a flight is an interruption, not a silent drop');
  rig.target = a;                                      // ui.ts direct retarget
  assert.equal(rig.sm.target, 'a');
  rig.mode = 'free'; assert.equal(rig.sm.mode, 'free');
  rig.mode = 'orbit'; assert.equal(rig.sm.mode, 'orbit');
  rig.update(1 / 60); assert.equal(rig.desyncRepairs, 0);
});

test('gesture during travel (cancelFlight) and free flight round-trip; invariant holds every frame', () => {
  const rig = new CameraRig(); const a = body('a', [1e8, 0, 0]), b = body('b', [4e8, 0, 0]);
  rig.pos = [1e8 + 5e4, 0, 0]; rig.setTarget(a);
  for (let k = 0; k < 20; k++) {
    rig.goTo(k % 2 ? a : b, { dur: 10 }); rig.update(1 / 60); assert.equal(rig.sm.mode, 'travel');
    rig.cancelFlight(); rig.update(1 / 60); assert.equal(rig.sm.mode, 'orbit');
    rig.toFree(); rig.update(1 / 60); assert.equal(rig.sm.mode, 'free');
    rig.setTarget(k % 2 ? b : a); rig.update(1 / 60); assert.equal(rig.sm.mode, 'orbit');
  }
  assert.equal(rig.desyncRepairs, 0);
  // the safety net itself: an external machine write is repaired and counted
  rig.sm.seed('zzz', 'travel'); rig.update(1 / 60);
  assert.equal(rig.desyncRepairs, 1); assert.equal(rig.sm.mode, 'orbit'); assert.equal(rig.sm.target, rig.target!.id);
});
