// Contract 3 — versioned catalogue shards, spatial sector index, streaming with cancellation and integrity checks
// (spec D1.3, F5 "Catalogue ingestion and streaming interface", F6 "Large-data engine strategy").
//
// A catalogue is published offline (tools/ingest/*) as immutable binary shards plus a manifest. Each shard covers one
// spatial sector (axis-aligned cube in a named frame) so the runtime can stream what is near the observer first and
// evict what is far. The browser never requests individual source records.
export interface ShardInfo {
  id: string;                  // stable within a release, e.g. 'c50:+1:-2:+0' (cell size : ix : iy : iz)
  file: string;                // relative to the manifest
  bytes: number;
  sha256: string;
  count: number;               // rows
  firstRow: number;            // global row index of the shard's first row (rows are stored sector-sorted)
  bounds: { min: [number, number, number]; max: [number, number, number] };   // in manifest.frame / manifest.unit
}
export interface CatalogManifest {
  schema: 'sol-catalog/2';
  catalog: string;             // 'stars3d'
  release: string;             // data release, e.g. 'GCNS(Gaia EDR3)+HIP2 2026-10-08'
  frame: 'ecliptic-j2000-heliocentric' | 'icrs-ssb' | 'galactocentric';
  unit: 'pc' | 'kpc' | 'Mpc';
  rowFormat: string;           // human description of one row
  rowFloats: number;           // float32 per row
  count: number;
  cell: number;                // sector cube size in `unit`
  shards: ShardInfo[];
  coverage: Record<string, number>;   // source count, position-known, distance-known, navigable-3d, excluded-with-reason …
}

export type ShardState = 'queued' | 'loading' | 'ready' | 'failed-missing' | 'failed-checksum' | 'failed-size' | 'aborted' | 'evicted';
export interface StreamEvents { onShard?: (s: ShardInfo, rows: Float32Array) => void; onState?: (id: string, st: ShardState, detail?: string) => void; onEvict?: (s: ShardInfo) => void }
type Fetcher = (url: string, signal: AbortSignal) => Promise<ArrayBuffer>;
type Hasher = (buf: ArrayBuffer) => Promise<string>;

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await globalThis.crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function validateManifest(m: any): string[] {
  const e: string[] = [];
  if (m?.schema !== 'sol-catalog/2') e.push('schema');
  if (!Array.isArray(m?.shards)) { e.push('shards'); return e; }
  let rows = 0; const ids = new Set<string>();
  for (const s of m.shards) {
    if (ids.has(s.id)) e.push('duplicate shard ' + s.id); ids.add(s.id);
    if (s.bytes !== s.count * m.rowFloats * 4) e.push('size mismatch ' + s.id);
    if (!/^[0-9a-f]{64}$/.test(s.sha256)) e.push('sha256 ' + s.id);
    rows += s.count;
  }
  if (rows !== m.count) e.push(`row total ${rows} ≠ count ${m.count}`);
  return e;
}
/** Distance from a point to a shard's bounding box (0 inside). */
export function boxDistance(p: [number, number, number], b: ShardInfo['bounds']) {
  let s = 0; for (let i = 0; i < 3; i++) { const d = Math.max(b.min[i] - p[i], 0, p[i] - b.max[i]); s += d * d; } return Math.sqrt(s);
}

/**
 * Priority streamer: requests shards nearest-first around an observer with bounded concurrency, verifies size and
 * SHA-256, reports per-shard state, supports cancelling everything (`abort`) or re-prioritising (`setObserver`).
 * Failed shards are reported, never silently dropped or duplicated.
 */
export class CatalogStream {
  state = new Map<string, ShardState>();
  private queue: ShardInfo[] = [];
  private ctl = new AbortController();
  private active = 0;
  private observer: [number, number, number] = [0, 0, 0];
  private settled!: Promise<void>; private resolveSettled!: () => void;
  constructor(public manifest: CatalogManifest, private baseUrl: string, private ev: StreamEvents = {},
    private fetcher: Fetcher = async (u, signal) => { const r = await fetch(u, { signal }); if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { missing: r.status === 404 }); return r.arrayBuffer(); },
    private hasher: Hasher = sha256Hex, public concurrency = 4, public verify = true) {
    const errs = validateManifest(manifest); if (errs.length) throw new Error('invalid catalogue manifest: ' + errs.join('; '));
    for (const s of manifest.shards) this.state.set(s.id, 'queued');
    this.queue = [...manifest.shards];
    this.settled = new Promise(r => (this.resolveSettled = r));
  }
  /** v3.5 (AUD-03) camera-driven residency: only shards whose box lies within `radius` of the observer are requested;
   *  ready shards farther than `evict` are released (state 'evicted', onEvict) and re-queued so they return when the
   *  observer comes back. null = load everything (v3.4 behaviour). Units: the manifest's unit. */
  private residency: { radius: number; evict: number } | null = null;
  setResidency(radius: number | null, evict?: number) { this.residency = radius === null ? null : { radius, evict: Math.max(radius, evict ?? radius * 1.5) }; }
  private inRange(s: ShardInfo) { return !this.residency || boxDistance(this.observer, s.bounds) <= this.residency.radius; }
  setObserver(p: [number, number, number]) { this.observer = p; this.queue.sort((a, b) => boxDistance(this.observer, a.bounds) - boxDistance(this.observer, b.bounds)); }
  /** Move the observer: re-prioritise, evict what is now beyond the eviction radius, request what came into range. */
  update(p: [number, number, number]) {
    this.setObserver(p);
    if (this.residency) for (const s of this.manifest.shards) {
      if (this.state.get(s.id) === 'ready' && boxDistance(p, s.bounds) > this.residency.evict) { this.set(s.id, 'evicted'); this.ev.onEvict?.(s); this.queue.push(s); }
    }
    this.setObserver(p); this.rearm(); this.pump();
    return this.settled;
  }
  start() { this.setObserver(this.observer); this.rearm(); this.pump(); return this.settled; }
  /** Shards currently resident (ready). */
  resident() { return this.manifest.shards.filter(s => this.state.get(s.id) === 'ready'); }
  private rearm() { if (this.done) { this.done = false; this.settled = new Promise(r => (this.resolveSettled = r)); } }
  private done = false;
  abort() { this.ctl.abort(); for (const s of this.queue) this.set(s.id, 'aborted'); this.queue = []; this.check(); }
  counts() { const c: Record<string, number> = {}; for (const v of this.state.values()) c[v] = (c[v] ?? 0) + 1; return c; }
  private set(id: string, st: ShardState, detail?: string) { this.state.set(id, st); this.ev.onState?.(id, st, detail); }
  private check() { if (!this.active && !this.queue.some(s => this.inRange(s))) { this.done = true; this.resolveSettled(); } }
  private pump() {
    while (this.active < this.concurrency && !this.ctl.signal.aborted) {
      const i = this.queue.findIndex(s => this.inRange(s)); if (i < 0) break;
      const s = this.queue.splice(i, 1)[0]; this.active++; this.set(s.id, 'loading');
      this.load(s).finally(() => { this.active--; this.pump(); this.check(); });
    }
    this.check();
  }
  private async load(s: ShardInfo) {
    try {
      const buf = await this.fetcher(new URL(s.file, this.baseUrl).toString(), this.ctl.signal);
      if (buf.byteLength !== s.bytes) return this.set(s.id, 'failed-size', `${buf.byteLength} ≠ ${s.bytes}`);
      if (this.verify && (await this.hasher(buf)) !== s.sha256) return this.set(s.id, 'failed-checksum');
      if (this.ctl.signal.aborted) return this.set(s.id, 'aborted');
      this.set(s.id, 'ready'); this.ev.onShard?.(s, new Float32Array(buf));
    } catch (e: any) {
      this.set(s.id, this.ctl.signal.aborted || e?.name === 'AbortError' ? 'aborted' : 'failed-missing', String(e?.message ?? e));
    }
  }
}
