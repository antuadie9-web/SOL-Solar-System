// v3.8.1 GA-SCI-01: unresolved-body findability enhancements are presentation-only and absent in Scientific mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { visibilityGain, pointFloor, POINT_FLOOR, MODE_INFO } from '../../src/render/presentation';

test('Scientific mode: physical gain 1 and no point floor for any body kind', () => {
  for (const boost of [1, 3000, 4e6]) assert.equal(visibilityGain('scientific', boost), 1);
  for (const [k, r] of [['planet', 24622], ['dwarf', 1188], ['moon', 2634], ['moon', 100]] as const) assert.equal(pointFloor('scientific', k, r, 1e-3, 1), 0);
});
test('Exploration/Cinematic keep the labelled enhancement unchanged', () => {
  assert.equal(visibilityGain('exploration', 4e6), 4e6); assert.equal(visibilityGain('cinematic', 0), 1);
  assert.ok(Math.abs(pointFloor('exploration', 'planet', 24622, 1e-3, 1) / (POINT_FLOOR.planet * 1e-6 * 4.54) - 1) < 1e-12);
  assert.equal(pointFloor('exploration', 'moon', 400, 1e-3, 1), 0);   // small moons were never floored
  assert.match(MODE_INFO.scientific.note, /true brightness/);
});
test('engine routes every unresolved-body boost through the contract (no direct setting reads)', () => {
  const src = fs.readFileSync('src/render/engine.ts', 'utf8');
  for (const k of ['bodyBoost', 'asteroidBoost', 'cometBoost']) {
    const uses = [...src.matchAll(new RegExp(`'${k}'`, 'g'))].map(m => src.slice(Math.max(0, m.index! - 60), m.index!));
    assert.ok(uses.length > 0, k);
    for (const u of uses) assert.match(u, /visibilityGain\(/, `${k} read outside visibilityGain`);
  }
  assert.ok(!/0\.22 : b\.kind === 'dwarf'/.test(src), 'inline floor table removed');
});
