// v3.8.1 GA-EPH-01…03: positions before a sampled-ephemeris payload streams in must come from the body's own fallback model
// (not a decades-long two-body extrapolation of the window edge), and that fallback must agree with the payload it hands over to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SolarSystem } from '../../src/astro/system';
import { SampledEphemeris, SAMPLED } from '../../src/astro/sampled';
import { sub, len } from '../../src/astro/vec';
import sats from '../../public/assets/data/satellites.json';
import feat from '../../public/assets/data/featured.json';
const man = JSON.parse(fs.readFileSync('public/assets/data/ephem/manifest.json', 'utf8'));
const osc = JSON.parse(fs.readFileSync('public/assets/data/satellites_osc.json', 'utf8'));

test('GA-EPH-01: a window that covers jd but has not streamed yet answers null / unavailable (no edge extrapolation)', () => {
  const E = new SampledEphemeris(); E.setManifest(man);
  const jd = 2461328.5;
  for (const id of ['ariel', 'mimas', 'charon']) { assert.equal(E.pos(id, jd), null, id); assert.equal(E.tier(id, jd), 'unavailable', id); assert.ok(E.pending(id, jd)); }
  // outside every window the edge extrapolation is still used (documented tier)
  assert.notEqual(E.pos('ariel', 2470500.5), null);
});

test('GA-EPH-02/03: fallback models hand over to the Horizons payload without large jumps (7 d after the state epoch)', () => {
  SAMPLED.setManifest(man);
  const S = new SolarSystem(sats as any, feat as any, osc);
  const jd = osc.epochJdTdb + 7;
  const rel = (id: string) => { S.update(jd, jd); const b = S.get(id)!; return sub(b.pos as any, b.parent!.pos as any); };
  const ids = ['ariel', 'miranda', 'sat902', 'sat903', 'umbriel', 'titania'];
  const before = new Map(ids.map(id => [id, rel(id)]));
  for (const [k, s] of Object.entries<any>(man.systems)) { const b = fs.readFileSync('public/assets/data/ephem/' + s.file); SAMPLED.attach(k, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
  for (const id of ids) {
    const a = rel(id), jump = len(sub(a, before.get(id)!)) / len(a);
    // was: Ariel 1.97, Miranda 0.59, Nix 0.78, Hydra 0.37 orbital radii
    assert.ok(jump < 0.07, `${id}: hand-over jump ${jump.toFixed(3)} orbital radii`);
  }
});
