// Pure UI logic: formatting, settings migration, persisted bookmarks, tours resolve to real catalogue bodies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDist, fmtDur, niceLength, esc } from '../../src/ui/format';
import { Store, validBookmark } from '../../src/ui/store';
import { TOURS } from '../../src/ui/tours';
import { CATALOG } from '../../src/data/catalog';
import { migrateV6, DEFAULTS } from '../../src/core/settings';
test('distance formatting chooses sensible units', () => {
  assert.equal(fmtDist(0.25), '250 m'); assert.equal(fmtDist(384400), '384,400 km'); assert.equal(fmtDist(149597870.7), '1.000 AU');
  assert.match(fmtDist(1.0e13), /ly$/); assert.match(fmtDist(3.0857e14), /pc$/); assert.equal(fmtDur(90), '1 min 30 s');
});
test('niceLength returns 1/2/5×10ⁿ', () => { for (const x of [0.37, 7, 3200, 9.9e8]) { const n = niceLength(x); const m = n / 10 ** Math.floor(Math.log10(n)); assert.ok([1, 2, 5].some(k => Math.abs(m - k) < 1e-9), `${x}→${n}`); } });
test('esc neutralises markup', () => assert.equal(esc('<b>"x"&</b>'), '&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;'));
test('settings v6→v7 migration maps orbitLevel to guideMode and drops the old key', () => {
  assert.deepEqual(migrateV6({ orbitLevel: 2, bloom: false }), { guideMode: 'everything', bloom: false });
  assert.equal(migrateV6({ orbitLevel: 1 }).guideMode, 'clean'); assert.equal(DEFAULTS.guideMode, 'clean'); assert.ok(!('orbitLevel' in DEFAULTS));
});
test('bookmarks persist, reject corrupt entries and survive bad JSON', () => {
  const mem = new Map<string, string>(); const st: any = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) };
  const s = new Store(st); const b = s.addBookmark({ name: 'Saturn', target: 'saturn', yaw: 1, pitch: 0.2, dist: 4e5, fov: 50, jdTT: 2461000.5 })!;
  assert.ok(validBookmark(b)); assert.equal(new Store(st).bookmarks.length, 1);
  mem.set('sol.bookmarks.v1', JSON.stringify([{ id: 'x', name: 'bad', target: 'earth', dist: -1 }, b])); assert.equal(new Store(st).bookmarks.length, 1);
  mem.set('sol.bookmarks.v1', '{not json'); assert.equal(new Store(st).bookmarks.length, 0);
});
test('every tour stop names a catalogue body or a named catalogue star (v3.8 stellar journey)', () => { const ids = new Set(CATALOG.map(d => d.id)); const stars = new Set((JSON.parse(require('fs').readFileSync('public/assets/catalogs/stars/named.json', 'utf8')) as { name: string }[]).map(n => 'star:' + n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))); for (const t of TOURS) for (const s of t.stops) assert.ok(ids.has(s.target) || stars.has(s.target), `${t.id}: ${s.target}`); });

// v3.5 AUD-01 / AUD-05
import { migrateV7, migrateSettings, SETTINGS_SCHEMA } from '../../src/core/settings';
import { colourTruth } from '../../src/data/mapTruth';
test('settings v7→v8: unused `presentation` dropped, hidden 3× star boost reset, chain v6→v8 applies both steps; schema is 8', () => {
  assert.equal(SETTINGS_SCHEMA, 8);
  assert.deepEqual(migrateV7({ presentation: 'scientific', starBrightness: 3, ev: 1 }), { starBrightness: 1, ev: 1 });
  assert.equal(migrateV7({ starBrightness: 5 }).starBrightness, 5, 'a user-chosen value is kept');
  const m = migrateSettings({ orbitLevel: 2, starBrightness: 3, presentation: 'x' }, 6);
  assert.equal(m.guideMode, 'everything'); assert.equal(m.starBrightness, 1); assert.ok(!('orbitLevel' in m) && !('presentation' in m));
  for (const k of ['viewMode', 'nightInspect', 'inspectLevel', 'skyEV', 'planetshine', 'airglow']) assert.ok(k in DEFAULTS, k);
  assert.equal(DEFAULTS.viewMode, 'exploration');
});
test('map colour truth: inferred / representative / near-IR maps are labelled, observed ones are not', () => {
  assert.equal(colourTruth('europa').cls, 'inferred');
  assert.equal(colourTruth('jupiter').cls, 'representative');
  assert.equal(colourTruth('titan').cls, 'non-visible');
  assert.equal(colourTruth('io').cls, 'observed');
  assert.equal(colourTruth(undefined, true).cls, 'reconstructed');
});
