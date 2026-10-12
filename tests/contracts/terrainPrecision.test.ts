// v3.6 terrain placement through the frame hierarchy: camera-relative patch origins keep ground-level precision.
// Emulates the GPU float32 path (Math.fround on every uploaded value and on the vertex transform) for a camera 2 m above
// the lunar surface and compares with the exact float64 vertex position relative to the camera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchor, toAncestor, type M3, type V3d } from '../../src/contracts/frames';
const f = Math.fround;
const rotZ = (a: number): M3 => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const mul = (m: M3, v: V3d): V3d => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mulF = (m: M3, v: V3d): V3d => { const g = m.map(f); return [f(f(f(g[0] * v[0]) + f(g[1] * v[1])) + f(g[2] * v[2])), f(f(f(g[3] * v[0]) + f(g[4] * v[1])) + f(g[5] * v[2])), f(f(f(g[6] * v[0]) + f(g[7] * v[1])) + f(g[8] * v[2]))]; };
test('patch-local origin + float64 anchor placement: < 2 mm at 2 m altitude; v3.5 body-centred float32 path: decimetres', () => {
  const R = 1737.4, rot = rotZ(0.7311), lat = 0.4556, lon = 0.0637;
  const up: V3d = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  const bodyCentreFromCam: V3d = mul(rot, up).map(x => -x * (R + 0.002)) as V3d;          // camera 2 m above the ground
  let worst36 = 0, worst35 = 0;
  for (let k = 0; k < 200; k++) {
    // a vertex within ~1.5 km of the patch centre (patch centre = the ground under the camera)
    const centre: V3d = up.map(x => x * R) as V3d;
    const off: V3d = [Math.sin(k) * 1.2, Math.cos(k * 1.7) * 1.1, Math.sin(k * 0.3) * 0.05];
    const vtx: V3d = [centre[0] + off[0], centre[1] + off[1], centre[2] + off[2]];
    const exact = mul(rot, vtx).map((x, i) => x + bodyCentreFromCam[i]);
    // v3.6: origin through the anchor hierarchy in float64, uploaded as float32; vertex stored relative to the centre
    const camA = anchor('camera', 'ecliptic-j2000', null, [0, 0, 0]), bf = anchor('b', 'body-fixed', camA, bodyCentreFromCam, rot), gp = anchor('p', 'ground-patch', bf, centre);
    const o = toAncestor([0, 0, 0], gp, camA).map(f) as V3d, lv = off.map(f) as V3d;
    const p36 = mulF(rot, lv).map((x, i) => f(x + o[i]));
    // v3.5: body-centred float32 vertex, float32 body translation
    const t = bodyCentreFromCam.map(f) as V3d, bv = vtx.map(f) as V3d;
    const p35 = mulF(rot, bv).map((x, i) => f(x + t[i]));
    worst36 = Math.max(worst36, Math.hypot(...p36.map((x, i) => x - exact[i])) * 1e6);   // mm
    worst35 = Math.max(worst35, Math.hypot(...p35.map((x, i) => x - exact[i])) * 1e6);
  }
  assert.ok(worst36 < 2, `v3.6 worst ${worst36.toFixed(3)} mm`);
  assert.ok(worst35 > 20, `v3.5 worst ${worst35.toFixed(1)} mm (expected decimetre-class)`);
  console.log(`placement error: v3.6 ${worst36.toFixed(3)} mm, v3.5 path ${worst35.toFixed(1)} mm`);
});
