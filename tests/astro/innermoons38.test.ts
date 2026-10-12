// DEF-38-009: J2-dominated inner moons use mean elements anchored to the Horizons state (Pan clears the Encke gap).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SolarSystem } from '../../src/astro/system';
import { SAMPLED } from '../../src/astro/sampled';
import sats from '../../public/assets/data/satellites.json';
import feat from '../../public/assets/data/featured.json';
const man = JSON.parse(fs.readFileSync('public/assets/data/ephem/manifest.json', 'utf8')); SAMPLED.setManifest(man);
for (const [k, s] of Object.entries<any>(man.systems)) { const b = fs.readFileSync('public/assets/data/ephem/' + s.file); SAMPLED.attach(k, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
const osc = JSON.parse(fs.readFileSync('public/assets/data/satellites_osc.json', 'utf8'));
const S = new SolarSystem(sats as any, feat as any, osc);
const rOf = (id: string) => { const b = S.get(id)!, p = S.get('saturn')!; return Math.hypot(b.pos[0] - p.pos[0], b.pos[1] - p.pos[1], b.pos[2] - p.pos[2]); };
test('Pan stays inside the Encke gap (133,423–133,745 km) and Daphnis inside the Keeler gap over 2020–2032', () => {
  for (let jd = 2458850; jd < 2463230; jd += 97.3) { S.update(jd, jd); const rp = rOf('sat618'), rd = rOf('sat635');
    assert.ok(rp > 133423 && rp < 133745, `Pan r=${rp} @${jd}`); assert.ok(rd > 136485 && rd < 136526, `Daphnis r=${rd} @${jd}`); }
});
test('anchored phase: at the Horizons epoch Pan is within 0.5 % of a of the Horizons state', () => {
  const ep = osc.epochJdTdb, st = osc.states[618]; S.update(ep, ep);
  const b = S.get('sat618')!, p = S.get('saturn')!, d = [b.pos[0] - p.pos[0] - st.r[0], b.pos[1] - p.pos[1] - st.r[1], b.pos[2] - p.pos[2] - st.r[2]];
  assert.ok(Math.hypot(...d) < 0.005 * 133600, 'offset ' + Math.hypot(...d));
});
