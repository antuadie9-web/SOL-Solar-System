// Shape families produce measurably different silhouettes (axis ratios, concavity) and are deterministic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { familyGeometry } from '../../src/render/geometry';
import { visualProfile } from '../../src/render/identity';
import { CATALOG } from '../../src/data/catalog';
// v3.8: Itokawa now uses its observed Gaskell shape model; the contact-binary FAMILY (still used for unmodelled bilobed
// bodies) is tested with Itokawa's former family parameters.
const prof = (id: string) => id === 'itokawa' ? { ...visualProfile(CATALOG.find(d => d.id === id)!), shape: 'contact-binary' as const, craterDensity: 0.05, roughness: 0.2, shapeParams: { lobe: 0.62, neck: 0.42 } } : visualProfile(CATALOG.find(d => d.id === id)!);
function metrics(id: string) {
  const { geo, stats } = familyGeometry(prof(id), 32); const p = geo.attributes.position.array as Float32Array;
  let rmin = 9, rmax = 0, s = 0, s2 = 0; const n = p.length / 3;
  for (let k = 0; k < p.length; k += 3) { const r = Math.hypot(p[k], p[k + 1], p[k + 2]); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); s += r; s2 += r * r; }
  const mean = s / n; return { stats, n, spread: Math.sqrt(s2 / n - mean * mean) / mean, ratio: rmin / rmax, hash: Array.from(p.slice(0, 30)).join(',') };
}
test('family geometry is deterministic for a given body', () => { assert.equal(metrics('itokawa').hash, metrics('itokawa').hash); });
test('families differ: contact binary has a waist, sponge has many craters, rubble-top has boulders', () => {
  const ito = metrics('itokawa'), hyp = metrics('hyperion'), ryu = metrics('ryugu'), hal = metrics('halley');
  assert.ok(ito.ratio < 0.6, `itokawa neck ratio ${ito.ratio}`);
  assert.ok(hyp.stats.craters > 300, `hyperion craters ${hyp.stats.craters}`);
  assert.ok(ryu.stats.boulders > 100, `ryugu boulders ${ryu.stats.boulders}`);
  assert.equal(hal.stats.family, 'comet-nucleus');
  const sigs = [ito, hyp, ryu, hal].map(m => `${m.spread.toFixed(4)}/${m.ratio.toFixed(3)}`); assert.equal(new Set(sigs).size, 4, sigs.join(' '));
});
test('extents are normalised per axis (measured radii applied once by the engine)', () => {
  const { geo } = familyGeometry(prof('psyche'), 24); const p = geo.attributes.position.array as Float32Array; const e = [0, 0, 0];
  for (let k = 0; k < p.length; k += 3) for (let i = 0; i < 3; i++) e[i] = Math.max(e[i], Math.abs(p[k + i]));
  for (const x of e) assert.ok(Math.abs(x - 1) < 1e-6, String(e));
});
test('contact binaries (Itokawa) and peanut nuclei (Halley) have a real waist along the long axis', () => {
  for (const [id, lim] of [['itokawa', 0.8], ['halley', 0.9]] as [string, number][]) {
    const { geo } = familyGeometry(prof(id), 48); const p = geo.attributes.position.array as Float32Array;
    // cross-section radius profile along x (long axis), normalised extents
    const bins = new Array(21).fill(0);
    for (let k = 0; k < p.length; k += 3) { const i = Math.round((p[k] + 1) * 10); bins[i] = Math.max(bins[i], Math.hypot(p[k + 1], p[k + 2])); }
    const mid = Math.min(...bins.slice(7, 14)), lobes = Math.max(...bins.slice(1, 7)) ;
    assert.ok(mid < lim * Math.max(lobes, Math.max(...bins.slice(14, 20))), `${id}: waist ${mid.toFixed(3)} vs lobe ${lobes.toFixed(3)}`);
  }
});
