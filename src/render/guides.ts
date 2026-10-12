// Guide (orbit/axis/trajectory) presentation policy — spec §10 "Better default modes" and §13 overlay strategy.
// Pure functions so the policy is unit-tested independently of the GPU (tests/render/guides.test.ts).
//
// Modes
//   clean      default: only the selected / hovered body's orbit; at Solar-System scale (nothing or the Sun selected)
//              the eight planetary orbits as faint context so the map stays legible. No spaghetti.
//   focused    the selected body's system: its orbit, its parent's orbit, its siblings when the parent is a planet,
//              and the major moons of a selected planet.
//   system     planets + dwarf planets + major moons (the v3.2 "Major bodies" level).
//   science    'system' plus nodes/apsides markers, spin axis + equator, ephemeris trajectory, ecliptic.
//   everything every catalogued orbit including comets and small bodies (explicit opt-in).
export type GuideMode = 'clean' | 'focused' | 'system' | 'science' | 'everything';
export const GUIDE_MODES: { id: GuideMode; label: string; hint: string }[] = [
  { id: 'clean', label: 'Clean', hint: 'Selected orbit only' },
  { id: 'focused', label: 'Focused', hint: 'Selected system' },
  { id: 'system', label: 'Solar System', hint: 'Major orbits' },
  { id: 'science', label: 'Scientific', hint: 'Nodes, apsides, axes, trajectories' },
  { id: 'everything', label: 'Everything', hint: 'All orbits incl. comets' },
];
export interface GuideBody { id: string; kind: string; radius: number; parentId: string | null; parentKind: string | null }
export interface GuideContext { mode: GuideMode; selected: GuideBody | null; hovered: GuideBody | null; target: GuideBody | null }

const major = (b: GuideBody) => b.kind === 'planet' || b.kind === 'dwarf' || (b.kind === 'moon' && b.radius > 150);

/** Relevance 0..1 of a body's orbit for the current mode (before distance/screen-size fades). */
export function guideRelevance(b: GuideBody, c: GuideContext): number {
  if (c.selected && b.id === c.selected.id) return 1;
  if (c.hovered && b.id === c.hovered.id) return 0.85;
  const sel = c.selected;
  const systemScale = !sel || sel.kind === 'star';
  switch (c.mode) {
    case 'clean':
      return systemScale && b.kind === 'planet' ? 0.6 : 0;
    case 'focused': {
      if (systemScale) return b.kind === 'planet' ? 0.6 : b.kind === 'dwarf' ? 0.35 : 0;
      if (b.id === sel!.parentId) return 0.55;                                   // the planet whose moon we look at
      if (sel!.parentKind !== 'star' && b.parentId === sel!.parentId && major(b)) return 0.5;   // sibling moons
      if (b.parentId === sel!.id && major(b)) return 0.7;                        // moons of the selected planet
      return 0;
    }
    case 'system':
    case 'science':
      return b.kind === 'planet' ? 0.8 : major(b) ? 0.55 : 0;
    case 'everything':
      return b.kind === 'planet' ? 0.8 : major(b) ? 0.6 : 0.4;
  }
}
/** Which auxiliary guides a mode shows for the selected body. */
export function guideExtras(mode: GuideMode) {
  return { landmarks: mode === 'science' || mode === 'everything', axis: mode === 'science', trajectory: mode === 'science' || mode === 'everything', ecliptic: mode === 'science' };
}
/** Smooth hysteresis-free fade: exponential approach toward the target opacity (no popping at LOD thresholds). */
export function approach(cur: number, target: number, dt: number, rate = 6) {
  return target + (cur - target) * Math.exp(-rate * Math.max(0, dt));
}
/** Opacity of an orbit from its projected size in pixels: fades in from 2–24 px, gently out when it fills the view. */
export function screenFade(apx: number, viewH: number, selected: boolean) {
  const s = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return s(2, 24, apx) * (selected ? 1 : 1 - 0.8 * s(viewH * 1.2, viewH * 8, apx));
}
