// v3.7.1 minor-moon visual identity (spec §14): measured properties where published, labelled class priors otherwise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveSmallMoon, tintFromIndices, SMALL_MOONS, CLASS_PRIORS } from '../../src/data/smallMoons';
const sats = JSON.parse(readFileSync('public/assets/data/satellites.json', 'utf8'));
test('solar colours give a neutral tint; D-type colours are red', () => {
  const n = tintFromIndices(0.65, 0.36); for (const c of n) assert.ok(Math.abs(c - 1) < 1e-9);
  const d = tintFromIndices(0.87, 0.48); assert.ok(d[0] > 1.05 && d[2] < 0.85);
});
test('measured entries reproduce published values (Pan, Thebe, Himalia, Janus)', () => {
  const pan = resolveSmallMoon('Pan', 'Saturn', 133600, 0, 14); assert.equal(pan.albedo, 0.86); assert.deepEqual(pan.radii, [17.3, 14.1, 10.5]);
  const thebe = resolveSmallMoon('Thebe', 'Jupiter', 221900, 1, 49); assert.equal(thebe.albedo, 0.047); assert.ok(thebe.tint[0] > thebe.tint[2] * 1.3);
  const him = resolveSmallMoon('Himalia', 'Jupiter', 11.4e6, 28, 85); assert.equal(him.periodH, 7.7819); assert.ok(him.irregular);
  assert.ok(resolveSmallMoon('Helene', 'Saturn', 377400, 0, 18).albedo <= 1, 'pV > 1 capped for reflectance');
});
test('the JPL minor-moon table no longer collapses to one look: ≥ 6 distinct (albedo, tint) appearances, priors labelled', () => {
  const looks = new Set<string>(); let measured = 0, prior = 0;
  for (const s of sats) {
    if (!['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].includes(s.planet)) continue;
    const m = resolveSmallMoon(s.name, s.planet, s.a, s.i ?? 0, s.R ?? 10);
    looks.add(`${m.albedo.toFixed(3)}|${m.tint.map(x => x.toFixed(3)).join(',')}`);
    if (SMALL_MOONS[s.name]) measured++; else { prior++; assert.match(m.status, /REPRESENTATIVE/); }
  }
  assert.ok(looks.size >= 6, `${looks.size} looks`); assert.ok(measured >= 30, `${measured}`); assert.ok(prior > 100);
});
test('every class prior cites a source and a physical basis', () => { for (const [k, p] of Object.entries(CLASS_PRIORS)) { assert.ok(p.source.length > 5, k); assert.ok(p.basis.length > 20, k); } });
