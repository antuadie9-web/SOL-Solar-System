// DEF-38-007: size-dependent geology — planar facets only on small shards; the profile carries the body radius.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { familyGeometry } from '../../src/render/geometry';
import { visualProfile } from '../../src/render/identity';
import { CATALOG } from '../../src/data/catalog';
const spread = (g: any) => { const p = g.attributes.position.array as Float32Array, r: number[] = []; for (let i = 0; i < p.length; i += 3) r.push(Math.hypot(p[i], p[i + 1], p[i + 2])); r.sort((a, b) => a - b); return r[Math.floor(r.length * 0.98)] / r[Math.floor(r.length * 0.02)]; };
test('fragment facets fade with size (15–80 km): a 120-km body is rounder than a 5-km shard of the same seed', () => {
  const base: any = { id: 'x', seed: 4242, tier: 'C', shape: 'fragment', surface: 'dark-rubble', craterDensity: 0.8, roughness: 0.4, basis: '', sources: [] };
  const small = spread(familyGeometry({ ...base, radiusKm: 5 }, 32).geo), big = spread(familyGeometry({ ...base, radiusKm: 120 }, 32).geo);
  assert.ok(big < small, `big ${big} small ${small}`);
});
test('visualProfile always carries radiusKm', () => {
  for (const d of CATALOG.slice(0, 80)) { const p = visualProfile(d); assert.equal(typeof p.radiusKm, 'number', d.id); }
});
