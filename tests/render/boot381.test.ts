// v3.8.1 regression guard (found in checkpoint-2 QA): every body the system builds has a colour, albedo and radius.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SolarSystem } from '../../src/astro/system';
test('every catalogue and JPL-table body has colour, albedo and a positive radius (observed-shape moons included)', () => {
  const sats = JSON.parse(fs.readFileSync('public/assets/data/satellites.json', 'utf8')), featured = JSON.parse(fs.readFileSync('public/assets/data/featured.json', 'utf8'));
  const sys = new SolarSystem(sats, featured, null);
  for (const b of sys.bodies) { assert.ok(Array.isArray(b.def.color) && b.def.color.length === 3, b.id + ' colour'); assert.ok(b.radius > 0, b.id + ' radius'); assert.ok(typeof b.albedo === 'number', b.id + ' albedo'); }
  for (const n of ['Pan', 'Atlas', 'Janus', 'Hyperion']) { const b = sys.bodies.find(x => x.name === n)!; assert.ok(b.def.model, n + ' observed shape model'); }
});
