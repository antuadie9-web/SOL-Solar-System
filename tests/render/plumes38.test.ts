// DEF-38-004: plume peak-I/F estimate sums overlapping Enceladus jets; Io umbrellas (well separated) unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLUMES, plumePeakIF } from '../../src/render/plumes';
const n = (v: number[]) => { const l = Math.hypot(...v); return v.map(x => x / l) as [number, number, number]; };
test('Enceladus backlit: summed jets ≫ single jet; Io at 90° phase ≈ single-plume value', () => {
  const sun = n([1, 0, -0.3]), cam = n([-1, 0, 0.3]);            // camera opposite the Sun (backlit), south pole in view
  const one = plumePeakIF(PLUMES.enceladus.slice(0, 1), sun, cam, 252), all = plumePeakIF(PLUMES.enceladus, sun, cam, 252);
  console.log('enceladus single', one, 'all', all);
  assert.ok(all > 4 * one && all < PLUMES.enceladus.length * one);
  const s2 = n([1, 0, 0]), c2 = n([0, 1, 0]);
  const io = plumePeakIF(PLUMES.io, s2, c2, 1821.6), ioMax = Math.max(...PLUMES.io.map(p => plumePeakIF([p], s2, c2, 1821.6)));
  console.log('io', io, ioMax); assert.ok(io < ioMax * 1.25);
});
