// Guide policy (spec §10 default modes): clean must not draw unrelated orbits; selected always wins; fades are smooth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideRelevance, guideExtras, approach, screenFade, GUIDE_MODES, type GuideBody } from '../../src/render/guides';
const B = (id: string, kind: string, radius: number, parentId: string | null, parentKind: string | null): GuideBody => ({ id, kind, radius, parentId, parentKind });
const earth = B('earth', 'planet', 6371, 'sun', 'star'), mars = B('mars', 'planet', 3389, 'sun', 'star'), moon = B('moon', 'moon', 1737, 'earth', 'planet');
const io = B('io', 'moon', 1821, 'jupiter', 'planet'), eu = B('europa', 'moon', 1560, 'jupiter', 'planet'), jup = B('jupiter', 'planet', 69911, 'sun', 'star');
const halley = B('halley', 'comet', 5.5, 'sun', 'star'), sun = B('sun', 'star', 695700, null, null), tiny = B('s2', 'moon', 5, 'jupiter', 'planet');
test('clean: with a moon selected only its own orbit is drawn', () => {
  const c = { mode: 'clean' as const, selected: io, hovered: null, target: io };
  assert.equal(guideRelevance(io, c), 1);
  for (const b of [eu, jup, earth, mars, halley, moon]) assert.equal(guideRelevance(b, c), 0, b.id);
});
test('clean at Solar-System scale shows faint planetary context only', () => {
  const c = { mode: 'clean' as const, selected: sun, hovered: null, target: sun };
  assert.ok(guideRelevance(earth, c) > 0 && guideRelevance(earth, c) < 0.75);
  assert.equal(guideRelevance(halley, c), 0); assert.equal(guideRelevance(moon, c), 0);
});
test('focused: selected moon brings its parent and major siblings, not small ones', () => {
  const c = { mode: 'focused' as const, selected: io, hovered: null, target: io };
  assert.ok(guideRelevance(jup, c) > 0); assert.ok(guideRelevance(eu, c) > 0); assert.equal(guideRelevance(tiny, c), 0); assert.equal(guideRelevance(earth, c), 0);
});
test('everything includes comets; hovered beats context', () => {
  assert.ok(guideRelevance(halley, { mode: 'everything', selected: null, hovered: null, target: null }) > 0);
  assert.ok(guideRelevance(halley, { mode: 'clean', selected: io, hovered: halley, target: io }) > 0.8);
});
test('scientific mode adds landmarks, axes, trajectory and ecliptic; clean adds none', () => {
  assert.deepEqual(guideExtras('clean'), { landmarks: false, axis: false, trajectory: false, ecliptic: false });
  const s = guideExtras('science'); assert.ok(s.landmarks && s.axis && s.trajectory && s.ecliptic);
  assert.equal(GUIDE_MODES.length, 5);
});
test('opacity approach is monotone and frame-rate independent', () => {
  let a = 0; const steps60 = Array.from({ length: 60 }, () => (a = approach(a, 1, 1 / 60)));
  for (let i = 1; i < steps60.length; i++) assert.ok(steps60[i] >= steps60[i - 1]);
  let b = 0; for (let i = 0; i < 30; i++) b = approach(b, 1, 1 / 30);
  assert.ok(Math.abs(a - b) < 1e-9, `60 Hz ${a} vs 30 Hz ${b}`);
});
test('screenFade: 0 below 2 px, 1 near 100 px, reduced (not removed) when an unselected orbit fills the view', () => {
  assert.equal(screenFade(1, 1000, false), 0); assert.ok(screenFade(100, 1000, false) > 0.99);
  const big = screenFade(10000, 1000, false); assert.ok(big > 0.15 && big < 0.3); assert.ok(screenFade(10000, 1000, true) > 0.99);
});
