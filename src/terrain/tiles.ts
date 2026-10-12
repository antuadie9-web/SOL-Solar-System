// SOL v3.6 terrain tile pyramid (pure: no rendering imports, runs in node tests).
//
// Format (tools/ingest/terrain_tiles.py, manifest `terrain/<body>/tiles.json`): level L has 4·2^L samples per degree,
// pixel centres at (i + 0.5)/ppd degrees east of 0°E / south of 90°N, so the levels nest exactly (a level-L sample is the
// mean of its 2×2 level-(L+1) children). A tile is 240×240 samples plus a 1-sample apron (242×242 int16 metres relative
// to refRadiusKm, gzip). Levels 0–2 cover the globe; finer levels exist only where the manifest lists tiles (regions).
//
// Residency: tiles are fetched on demand (bounded concurrency), held in an LRU under a byte budget, and sampled
// "best resident level first" — a query never blocks and never invents relief: where a fine tile is absent or still in
// flight it answers from the finest resident ancestor and reports which level it used (so the mesh builder can rebuild
// a patch once the finer data arrives).
export interface TileLevelInfo { level: number; ppd: number; globalCoverage: boolean; tiles: number; list: [number, number][] | null }
export interface TileRegion { name: string; label: string; level: number; ppd: number; latN: number; latS: number; lonW: number; lonE: number; vs16ppd?: { meanM: number; rmsM: number; p99absM: number } }
export interface TileManifest { body: string; refRadiusKm: number; tileSamples: number; apron: number; path: string; levels: TileLevelInfo[]; regions: TileRegion[]; sources?: any[]; truth?: string }
export type TileFetch = (level: number, row: number, col: number) => Promise<Int16Array>;
const S = 240, W = 242;

export function ppdOf(level: number) { return 4 * (1 << level); }
/** Tile (row, col) holding the sample nearest (lat, lon) at `level`, plus the in-tile sample coordinates (apron-relative). */
export function locate(level: number, latDeg: number, lonDeg: number) {
  const ppd = ppdOf(level), lon = ((lonDeg % 360) + 360) % 360;
  const fx = lon * ppd - 0.5, fy = Math.max(-0.5, Math.min(180 * ppd - 0.5, (90 - latDeg) * ppd - 0.5));
  const cols = 6 << level, rows = 3 << level;
  let col = Math.floor((fx + 0.5) / S); let row = Math.floor((fy + 0.5) / S);
  col = ((col % cols) + cols) % cols; row = Math.max(0, Math.min(rows - 1, row));
  let x = fx - col * S + 1; if (x < 0) x += 360 * ppd; if (x > W - 1) x -= 360 * ppd;
  const y = fy - row * S + 1;
  return { row, col, x: Math.max(0, Math.min(W - 1.000001, x)), y: Math.max(0, Math.min(W - 1.000001, y)) };
}
/** Bilinear sample (metres) of a 242×242 apron tile. */
export function sampleTile(t: Int16Array, x: number, y: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0, x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(W - 1, y0 + 1);
  return (t[y0 * W + x0] * (1 - tx) + t[y0 * W + x1] * tx) * (1 - ty) + (t[y1 * W + x0] * (1 - tx) + t[y1 * W + x1] * tx) * ty;
}

interface Entry { data?: Int16Array; state: 'loading' | 'ready' | 'failed'; used: number }
export class TilePyramid {
  readonly maxLevel: number;
  private exists: Set<number>[] = [];
  private globalTo = 0;
  private cache = new Map<number, Entry>();
  private queue: [number, number, number][] = []; private inflight = 0; private clock = 0;
  /** bumped whenever a tile becomes resident; patch builders compare it to know when to refine */
  version = 0;
  stats = { fetched: 0, failed: 0, evicted: 0, bytes: 0 };
  constructor(public man: TileManifest, private fetchTile: TileFetch, public budgetBytes = 256 * 2 ** 20, private concurrency = 6) {
    let mx = 0;
    for (const lv of man.levels) {
      mx = Math.max(mx, lv.level);
      if (lv.globalCoverage) this.globalTo = Math.max(this.globalTo, lv.level);
      this.exists[lv.level] = new Set((lv.list ?? []).map(([r, c]) => r * 65536 + c));
    }
    this.maxLevel = mx;
  }
  get refRadiusKm() { return this.man.refRadiusKm; }
  /** Does the dataset contain this tile at all (global levels always do)? */
  has(L: number, r: number, c: number) { return L <= this.globalTo || !!this.exists[L]?.has(r * 65536 + c); }
  /** Finest level whose data covers (lat, lon), capped at `cap`. */
  dataLevelAt(latDeg: number, lonDeg: number, cap = this.maxLevel) {
    for (let L = Math.min(cap, this.maxLevel); L > this.globalTo; L--) { const p = locate(L, latDeg, lonDeg); if (this.has(L, p.row, p.col)) return L; }
    return Math.min(cap, this.globalTo);
  }
  private key(L: number, r: number, c: number) { return (L * 65536 + r) * 65536 + c; }
  resident(L: number, r: number, c: number) { const e = this.cache.get(this.key(L, r, c)); if (e?.state === 'ready') { e.used = ++this.clock; return e.data!; } return undefined; }
  /** Queue a fetch (idempotent). Higher levels are fetched first when several are queued in one frame. */
  request(L: number, r: number, c: number) {
    if (!this.has(L, r, c)) return;
    const k = this.key(L, r, c); const e = this.cache.get(k);
    if (e) { e.used = ++this.clock; return; }
    this.cache.set(k, { state: 'loading', used: ++this.clock });
    this.queue.push([L, r, c]); this.pump();
  }
  private pump() {
    this.queue.sort((a, b) => a[0] - b[0]);       // pop() takes the finest first
    while (this.inflight < this.concurrency && this.queue.length) {
      const [L, r, c] = this.queue.pop()!; const k = this.key(L, r, c); this.inflight++;
      this.fetchTile(L, r, c).then(d => {
        if (d.length !== W * W) throw new Error(`tile ${L}/${r}/${c}: ${d.length} samples`);
        const e = this.cache.get(k); if (!e) return;
        e.data = d; e.state = 'ready'; this.stats.fetched++; this.stats.bytes += d.byteLength; this.version++; this.enforce();
      }).catch(() => { const e = this.cache.get(k); if (e) e.state = 'failed'; this.stats.failed++; })
        .finally(() => { this.inflight--; this.pump(); });
    }
  }
  private enforce() {
    if (this.stats.bytes <= this.budgetBytes) return;
    const ready = [...this.cache.entries()].filter(([k, e]) => e.state === 'ready' && k >= 65536 * 65536).sort((a, b) => a[1].used - b[1].used);
    for (const [k, e] of ready) { if (this.stats.bytes <= this.budgetBytes * 0.9) break; this.stats.bytes -= e.data!.byteLength; this.cache.delete(k); this.stats.evicted++; }
  }
  /** Sample height (km above refRadius) from the finest RESIDENT level ≤ want; requests the wanted level's tile. */
  height(latDeg: number, lonDeg: number, want = this.maxLevel, request = true): { h: number; level: number } {
    const top = this.dataLevelAt(latDeg, lonDeg, want);
    for (let L = top; L >= 0; L--) {
      const p = locate(L, latDeg, lonDeg); const t = this.resident(L, p.row, p.col);
      if (t) return { h: sampleTile(t, p.x, p.y) / 1000, level: L };
      if (request) this.request(L, p.row, p.col);
    }
    return { h: 0, level: -1 };
  }
  heightDir(d: [number, number, number], want = this.maxLevel, request = true) {
    return this.height(Math.asin(Math.max(-1, Math.min(1, d[2]))) * 180 / Math.PI, Math.atan2(d[1], d[0]) * 180 / Math.PI, want, request);
  }
  /** Load every level-0 tile (18 tiles: the coarse global base every query can fall back to). */
  async warm() { const rows = 3, cols = 6; await Promise.all(Array.from({ length: rows * cols }, (_, i) => this.fetchTile(0, Math.floor(i / cols), i % cols).then(d => { this.cache.set(this.key(0, Math.floor(i / cols), i % cols), { data: d, state: 'ready', used: ++this.clock }); this.stats.bytes += d.byteLength; this.version++; }))); }
  counts() { let ready = 0, loading = 0, failed = 0; for (const e of this.cache.values()) e.state === 'ready' ? ready++ : e.state === 'loading' ? loading++ : failed++; return { ready, loading, failed, queued: this.queue.length, residentMiB: +(this.stats.bytes / 2 ** 20).toFixed(1), budgetMiB: +(this.budgetBytes / 2 ** 20).toFixed(0), fetched: this.stats.fetched, evicted: this.stats.evicted }; }
}
/** Level whose sample spacing best matches a patch of angular size `patchDeg` meshed with `quads` quads per edge. */
export function levelForPatch(patchDeg: number, quads: number) { const ppd = quads / patchDeg; return Math.max(0, Math.ceil(Math.log2(ppd / 4) - 1e-9)); }
