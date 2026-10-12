// Contract 5 — camera mode state machine, interruption and navigation history (spec D1.5, F5 "Simulation and camera").
// One explicit transition table; every travel can be interrupted by any user gesture; history allows "back" without
// losing the target frame. The rig (src/render/camera.ts) reports into this machine; the UI reads `mode` and `history`.
// Travel is a camera move, never a change of the physical database: positions and radii are not touched here.
export type CamMode = 'orbit' | 'follow' | 'travel' | 'free' | 'surface' | 'tour' | 'galactic' | 'cinematic';
export type CamEvent =
  | { type: 'travel'; target: string } | { type: 'arrive' } | { type: 'gesture' } | { type: 'free' } | { type: 'orbit' }
  | { type: 'land' } | { type: 'takeoff' } | { type: 'tour-start' } | { type: 'tour-end' } | { type: 'galactic' } | { type: 'cinematic' }
  | { type: 'device-lost' } | { type: 'back' };
export interface HistoryEntry { target: string; mode: CamMode; t: number }

/** Allowed transitions (from → event → to). Anything not listed is rejected and reported (never a silent jump). */
const T: Record<CamMode, Partial<Record<CamEvent['type'], CamMode>>> = {
  orbit:     { travel: 'travel', free: 'free', land: 'surface', 'tour-start': 'tour', galactic: 'galactic', cinematic: 'cinematic', orbit: 'orbit', gesture: 'orbit', back: 'travel' },
  follow:    { travel: 'travel', free: 'free', orbit: 'orbit', gesture: 'follow', back: 'travel' },
  travel:    { arrive: 'orbit', gesture: 'orbit', free: 'free', travel: 'travel', 'tour-end': 'orbit', back: 'travel' },
  free:      { orbit: 'orbit', travel: 'travel', land: 'surface', gesture: 'free', back: 'travel' },
  surface:   { takeoff: 'orbit', travel: 'travel', free: 'free', gesture: 'surface', back: 'travel' },
  tour:      { 'tour-end': 'orbit', gesture: 'orbit', travel: 'tour', arrive: 'tour', back: 'travel' },
  galactic:  { orbit: 'orbit', travel: 'travel', gesture: 'galactic', free: 'free', back: 'travel' },
  cinematic: { gesture: 'orbit', orbit: 'orbit', travel: 'travel', back: 'travel' },
};
export class CameraStateMachine {
  mode: CamMode = 'orbit';
  target = '';
  history: HistoryEntry[] = [];
  rejected: { from: CamMode; event: string; t: number }[] = [];
  private subs = new Set<(m: CamMode, prev: CamMode, e: CamEvent) => void>();
  constructor(private now: () => number = () => Date.now(), public maxHistory = 50) {}
  on(f: (m: CamMode, prev: CamMode, e: CamEvent) => void) { this.subs.add(f); return () => this.subs.delete(f); }
  /** Dispatch an event; returns the new mode or null if the transition is not allowed. */
  dispatch(e: CamEvent): CamMode | null {
    if (e.type === 'device-lost') { const p = this.mode; this.mode = 'orbit'; this.subs.forEach(f => f(this.mode, p, e)); return this.mode; } // safe state
    if (e.type === 'back') {
      const prev = this.history.pop(); if (!prev) return null;
      const p = this.mode; this.mode = 'travel'; this.target = prev.target; this.subs.forEach(f => f(this.mode, p, e)); return this.mode;
    }
    const to = T[this.mode][e.type];
    if (!to) { this.rejected.push({ from: this.mode, event: e.type, t: this.now() }); if (this.rejected.length > 100) this.rejected.shift(); return null; }
    if (e.type === 'travel') {
      if (this.target && this.target !== e.target) { this.history.push({ target: this.target, mode: this.mode, t: this.now() }); if (this.history.length > this.maxHistory) this.history.shift(); }
      this.target = e.target;
    }
    const p = this.mode; this.mode = to; this.subs.forEach(f => f(this.mode, p, e)); return to;
  }
  /** v3.5: the rig changed its focus without a travel (select + follow, UI jump): record the previous target in the
   *  history (so "back" works) and keep the mode. */
  retarget(target: string) {
    if (this.target && this.target !== target) { this.history.push({ target: this.target, mode: this.mode, t: this.now() }); if (this.history.length > this.maxHistory) this.history.shift(); }
    this.target = target;
  }
  /** Seed the current target without creating a history entry (boot / restored bookmark). */
  seed(target: string, mode: CamMode = 'orbit') { this.target = target; this.mode = mode; }
}

/**
 * Scale-aware travel duration (seconds of camera time, explicitly NOT a spacecraft ETA): grows with the logarithm of
 * the distance ratio so Earth→Moon and Earth→Neptune both feel deliberate but neither stalls; reduced motion shortens it.
 */
export function travelDuration(fromDistKm: number, toDistKm: number, separationKm: number, reducedMotion = false) {
  const r = Math.log10(Math.max(separationKm, 1) / Math.max(1, Math.min(fromDistKm, toDistKm)));
  const d = Math.min(9, Math.max(1.6, 1.4 + 0.75 * Math.max(0, r)));
  return reducedMotion ? Math.min(1.2, d * 0.35) : d;
}
