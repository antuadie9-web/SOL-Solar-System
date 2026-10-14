// Sampled ephemeris tier: JPL Horizons state vectors on a fixed grid (tools/ingest/sampled-ephem.mjs), evaluated by
// two-sided two-body propagation blended with a smoothstep weight. Exact at grid nodes, continuous in time, and —
// measured against Horizons at off-grid epochs — accurate to the per-body budget in docs/science/ephemeris-tiers.md.
// Outside the sampled window (or before a system's binary has streamed in) the nearest edge state is propagated
// two-body; `validity()` tells callers which case applies so the UI can label it.
import { V3 } from './vec';
import { propagate } from './twobody';

export interface SampledBodyMeta {
  id: string; command: string; center: string; t0: number; step: number; n: number; mu: number;
  posOffset: number; velOffset: number; edge?: { first: [V3, V3]; last: [V3, V3] };
}
export interface SampledSystem { file: string; bytes: number; fetched: string; window: [number, number]; bodies: SampledBodyMeta[]; sha256?: string }
export interface SampledManifest { format: string; frame: string; source: string; systems: Record<string, SampledSystem> }
interface Track { meta: SampledBodyMeta; P?: Float64Array; V?: Float32Array; system: string }
export type Validity = 'sampled' | 'extrapolated' | 'unavailable';

export class SampledEphemeris {
  // v3.4: several tracks per body are allowed (e.g. the 2000–2050 primary planet tracks and the 1900–2200 secondary
  // DE441 barycentre tier). Lookup order = manifest order with non-secondary systems first; the first track whose
  // window contains the epoch AND whose payload has streamed in wins. Edge extrapolation uses the nearest window edge.
  private tracks = new Map<string, Track[]>();
  manifest: SampledManifest | null = null;
  setManifest(m: SampledManifest) {
    this.manifest = m;
    const ordered = Object.entries(m.systems).sort((x, y) => Number(!!(x[1] as any).secondary) - Number(!!(y[1] as any).secondary));
    for (const [sys, s] of ordered) for (const b of s.bodies) {
      const list = this.tracks.get(b.id) ?? []; if (!list.some(t => t.system === sys)) list.push({ meta: b, system: sys }); this.tracks.set(b.id, list);
    }
  }
  /** Attach a system's binary payload (the ArrayBuffer of `<system>.bin`). */
  attach(system: string, buf: ArrayBuffer) {
    const s = this.manifest?.systems[system]; if (!s) return;
    if (buf.byteLength !== s.bytes) throw new Error(`ephemeris ${system}: ${buf.byteLength} bytes, manifest says ${s.bytes}`);
    for (const b of s.bodies) {
      const t = this.tracks.get(b.id)!.find(x => x.system === system)!;
      t.P = new Float64Array(buf, b.posOffset, b.n * 3); t.V = new Float32Array(buf, b.velOffset, b.n * 3);
    }
  }
  systems() { return Object.keys(this.manifest?.systems ?? {}); }
  isAttached(system: string) { const s = this.manifest?.systems[system]; return !!s && s.bodies.every(b => !!this.tracks.get(b.id)?.find(t => t.system === system)?.P); }
  has(id: string) { return this.tracks.has(id); }
  /** primary (first) system a body belongs to */
  systemOf(id: string) { return this.tracks.get(id)?.[0]?.system; }
  private covering(id: string, jd: number): Track | undefined {
    return this.tracks.get(id)?.find(t => t.P && jd >= t.meta.t0 && jd <= t.meta.t0 + (t.meta.n - 1) * t.meta.step);
  }
  /** a window covering jd exists but its payload has not streamed in yet */
  pending(id: string, jd: number): boolean {
    return !!this.tracks.get(id)?.some(t => !t.P && jd >= t.meta.t0 && jd <= t.meta.t0 + (t.meta.n - 1) * t.meta.step);
  }
  /** which tier answers at jd: 'sampled' (primary), 'sampled-ext' (secondary long window), 'extrapolated', 'unavailable' */
  tier(id: string, jd: number): Validity | 'sampled-ext' {
    const list = this.tracks.get(id); if (!list) return 'unavailable';
    const c = this.covering(id, jd); if (c) return c === list[0] ? 'sampled' : 'sampled-ext';
    if (this.pending(id, jd)) return 'unavailable';   // GA-EPH-01: caller's fallback answers (and labels itself) until the payload lands
    return list.some(t => t.meta.edge) ? 'extrapolated' : 'unavailable';
  }
  validity(id: string, jd: number): Validity { const t = this.tier(id, jd); return t === 'sampled-ext' ? 'sampled' : t; }
  /** Position (km, relative to the track's centre) at a TDB Julian date, or null when no data or edge state exists. */
  pos(id: string, jd: number): V3 | null {
    const list = this.tracks.get(id); if (!list) return null;
    const t = this.covering(id, jd);
    // v3.8.1 GA-EPH-01: while the payload of a window that CONTAINS jd is still streaming, answer null so the caller's own
    // fallback model (Lieske E5, ELP, J2 mean elements anchored to Horizons, VSOP87, …) is used. Previously the edge state of
    // that same window was two-body-propagated across up to ~25 years (2000 → 2026), putting moons up to 2–4 orbital radii
    // (and Charon's system barycentre millions of km) away until the payload arrived — then they jumped (docs/qa/ephem-activation.json).
    if (!t && this.pending(id, jd)) return null;
    if (!t) {
      // nearest edge over all windows that carry edge states
      let best: { r: V3; v: V3; dt: number; mu: number } | null = null;
      for (const x of list) {
        const m = x.meta; if (!m.edge) continue; const end = m.t0 + (m.n - 1) * m.step;
        const first = jd < m.t0 || (jd <= end && jd - m.t0 < end - jd);
        const dt = jd - (first ? m.t0 : end); const [r, v] = first ? m.edge.first : m.edge.last;
        if (!best || Math.abs(dt) < Math.abs(best.dt)) best = { r, v, dt, mu: m.mu };
      }
      return best ? propagate(best.r, best.v, best.mu, best.dt * 86400)[0] : null;
    }
    const m = t.meta;
    const P = t.P!, V = t.V!;
    const f = (jd - m.t0) / m.step; let i = Math.floor(f); if (i >= m.n - 1) i = m.n - 2;
    const w = f - i, h = m.step * 86400;
    const ra: V3 = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    if (w < 1e-12) return ra;
    const va: V3 = [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
    const j = i + 1, rb: V3 = [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]], vb: V3 = [V[j * 3], V[j * 3 + 1], V[j * 3 + 2]];
    const pa = propagate(ra, va, m.mu, w * h)[0], pb = propagate(rb, vb, m.mu, (w - 1) * h)[0];
    const s = w * w * (3 - 2 * w);
    return [pa[0] + (pb[0] - pa[0]) * s, pa[1] + (pb[1] - pa[1]) * s, pa[2] + (pb[2] - pa[2]) * s];
  }
}
export const SAMPLED = new SampledEphemeris();
