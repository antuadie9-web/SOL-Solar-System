// Visual identity (spec §8): stable per-id seeds, distinct families for featured bodies, honest tiers, geometry families
// that actually differ in silhouette.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../../src/data/catalog';
import { visualProfile, stableSeed, CURATED_IDS, SURFACE_INDEX } from '../../src/render/identity';
test('every catalogue body has a profile; seeds are stable and depend only on the id', () => {
  for (const d of CATALOG) { const a = visualProfile(d), b = visualProfile({ ...d }); assert.equal(a.seed, b.seed); assert.equal(a.seed, stableSeed(d.id)); assert.ok(SURFACE_INDEX[a.surface] !== undefined); }
  const seeds = new Set(CATALOG.map(d => stableSeed(d.id))); assert.ok(seeds.size >= CATALOG.length - 1, 'seed collisions');
});
test('curated ids all exist in the catalogue', () => { const ids = new Set(CATALOG.map(d => d.id)); for (const id of CURATED_IDS) assert.ok(ids.has(id), id); });
test('no reconstructed body is labelled as observed (tier A requires a map without gaps)', () => {
  for (const d of CATALOG) { const p = visualProfile(d); if (p.tier === 'A') assert.ok(d.tex && !d.noData, d.id); if (!d.tex && !d.model) assert.ok(p.tier === 'C' || p.tier === 'D' || d.kind === 'star' || d.kind === 'planet', `${d.id} tier ${p.tier}`); }
});
test('featured irregular bodies use distinct shape families (no single shared recipe)', () => {
  const ids = ['hyperion', 'itokawa', 'ryugu', 'halley', 'phoebe', 'amalthea', 'psyche', 'apophis', 'didymos', 'ida', 'lutetia'];
  const fams = new Set(ids.map(id => visualProfile(CATALOG.find(d => d.id === id)!).shape)); assert.ok(fams.size >= 5, [...fams].join(','));
  const surf = new Set(CATALOG.filter(d => !d.tex).map(d => visualProfile(d).surface)); assert.ok(surf.size >= 6, [...surf].join(','));
});
test('Ariel/Titania/Oberon remain partial-coverage (tier B) with reconstruction notes', () => {
  for (const id of ['ariel', 'titania', 'oberon']) { const d = CATALOG.find(x => x.id === id)!; assert.equal(visualProfile(d).tier, 'B'); assert.ok(d.noData!.fraction > 0.3); }
});
