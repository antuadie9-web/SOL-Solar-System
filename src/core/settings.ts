// Persistent user settings with change notifications.
export type Val = number | boolean | string;
export const DEFAULTS: Record<string, Val> = {
  quality: 'high', renderScale: 1, hiTextures: true, bloom: true, bloomStrength: 0.35, glare: true, lensSpikes: true,
  autoExposure: true, ev: 0, manualExposure: 50, darkExposure: 2.5e4,
  stars: true, starBrightness: 1, milkyWay: true, skyBrightness: 1, constellations: false, ecliptic: false,
  atmospheres: true, clouds: true, cityLights: true, rings: true, cometTails: true, cometBoost: 3000,
  asteroids: true, asteroidBoost: 4000000, asteroidColors: false, bodyBoost: 1,
  orbits: true, guideMode: 'clean', orbitOpacity: 0.9, orbitTrails: true, labels: true, labelDensity: 1, markers: true,
  units: 'metric', timeFormat: 'utc', fov: 50, sensitivity: 1, inertia: 1, ui: true, sound: false, showFps: false,
  textureBudgetMiB: 1536, corona: true, orbitMarkers: true, trajectory: true, markUnknown: true, terrain: true, reducedMotion: false, showDiagnostics: false,
  // v3.3
  sunLook: 'natural', sunDetail: 'high', uiScale: 1, highContrast: false, onboarded: false,
  // v3.4
  prominences: true, ringParticles: true, toneMap: 'neutral',
  // v3.5 viewing modes & visibility (presentation only — never physics): Scientific | Exploration | Cinematic
  viewMode: 'exploration', nightInspect: true, inspectLevel: 1, skyEV: 0, planetshine: true, airglow: true, modeBadge: true,
  // v3.6 (additive keys with defaults — no stored value changes meaning, so no schema bump/migration is needed)
  terrainBudgetMiB: 512, multiScatter: true,
  // v3.7 (additive)
  ringEnhance: true, ringLabels: false, plumes: true,
};
// Schema version for persisted settings. The storage key carries the version (`sol.settings.v<N>`); on boot the newest
// key present is read and migrated forward step by step (v5/v6 → v7 → v8). Every bump has an explicit migration below
// and a test (tests/ui/ui.test.ts). (v3.4 added toneMap/prominences/ringParticles WITHOUT a bump — harmless, because
// unknown/missing keys fall back to DEFAULTS — but the v3.4 CHANGELOG wrongly said "schema bumped" — AUD-01.)
export const SETTINGS_SCHEMA = 8;
/** v6 → v7: `orbitLevel` (0 planets · 1 major · 2 everything) became `guideMode`; trajectory/landmarks moved into modes. */
export function migrateV6(saved: Record<string, Val>): Record<string, Val> {
  const out = { ...saved };
  if ('orbitLevel' in out) { const l = Number(out.orbitLevel); out.guideMode = l >= 2 ? 'everything' : 'clean'; delete out.orbitLevel; }
  return out;
}
/** v7 → v8 (v3.5): `presentation` (a v3.3 key that nothing ever read) is removed — its role is taken by `viewMode`;
 *  `starBrightness` = 3 (the v3.3/3.4 DEFAULT, a hidden 3× boost although the UI said "1 = physically calibrated") is
 *  reset to the calibrated 1 because star visibility is now handled by the sky exposure of the viewing modes. Any other
 *  user-chosen star brightness is kept. */
export function migrateV7(saved: Record<string, Val>): Record<string, Val> {
  const out = { ...saved };
  delete out.presentation;
  if (out.starBrightness === 3) out.starBrightness = 1;
  return out;
}
/** Migrate a stored object from schema `from` to the current schema. */
export function migrateSettings(saved: Record<string, Val>, from: number): Record<string, Val> {
  let s = { ...saved };
  if (from <= 6) s = migrateV6(s);
  if (from <= 7) s = migrateV7(s);
  return s;
}
export class Settings {
  private v: Record<string, Val>; private subs = new Set<(k: string, v: Val) => void>();
  constructor(private key = `sol.settings.v${SETTINGS_SCHEMA}`) {
    let saved: Record<string, Val> = {};
    try { saved = JSON.parse(globalThis.localStorage?.getItem(key) || '{}'); } catch { }
    // migrate from the newest older schema present; drop unknown keys and values whose type no longer matches the default
    if (!Object.keys(saved).length) {
      for (const v of [7, 6, 5]) {
        try { const raw = globalThis.localStorage?.getItem(`sol.settings.v${v}`); if (raw) { saved = migrateSettings(JSON.parse(raw), v); break; } } catch { }
      }
    }
    const clean: Record<string, Val> = {};
    for (const [k, v] of Object.entries(saved)) if (k in DEFAULTS && typeof v === typeof DEFAULTS[k] && (typeof v !== 'number' || Number.isFinite(v))) clean[k] = v;
    if (typeof clean.renderScale === 'number') clean.renderScale = Math.min(1, Math.max(0.5, clean.renderScale));
    this.v = { ...DEFAULTS, ...clean };
    if (typeof matchMedia !== 'undefined' && !('reducedMotion' in clean) && matchMedia('(prefers-reduced-motion: reduce)').matches) this.v.reducedMotion = true;
  }
  get(k: string) { return this.v[k]; }
  set(k: string, val: Val) { this.v[k] = val; try { localStorage.setItem(this.key, JSON.stringify(this.v)); } catch { /* storage full/blocked: keep in memory */ } this.subs.forEach(f => f(k, val)); }
  toggle(k: string) { this.set(k, !this.v[k]); return this.v[k]; }
  on(f: (k: string, v: Val) => void) { this.subs.add(f); return () => this.subs.delete(f); }
  reset() { this.v = { ...DEFAULTS }; localStorage.removeItem(this.key); for (const k in this.v) this.subs.forEach(f => f(k, this.v[k])); }
}
