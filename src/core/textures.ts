// Texture residency manager (P0: bounded VRAM, lazy loading, LRU eviction).
//
// Every planetary map is represented by ONE stable THREE.Texture object that materials keep for their whole life;
// the store swaps its image between three residency levels:
//   placeholder (1×1, the body's catalogue colour)  →  base map (<name>.jpg)  →  high-resolution map (<name>_hi.jpg)
// Base maps are fetched only when a body is first resolved on screen (no eager boot download of every surface map).
// High-resolution maps are requested by the engine when a body is large on screen and are admitted only while the
// estimated resident bytes stay under the budget; least-recently-used hi maps fall back to base maps first, then idle
// base maps fall back to placeholders. Before an image of a different size is swapped in, the GPU texture is disposed
// (three's WebGPU backend cannot re-upload a different-sized image into an existing GPUTexture).
// Byte figures are ESTIMATES (w × h × 4 × 4/3 for RGBA8 + mip chain) — browser APIs do not expose real VRAM use.
import * as THREE from 'three/webgpu';
import { decodeImage, configureMapTexture } from './assets';

type Level = 'placeholder' | 'base' | 'hi';
interface Entry { name: string; tex: THREE.Texture; srgb: boolean; level: Level; loading: Level | null; bmp: ImageBitmap | null; baseBmp: ImageBitmap | null; bytes: number; lastUse: number; hiAvailable: boolean; phColor: [number, number, number]; failed: Set<Level>; failCount: number; failAt: number; ready: Promise<void>; resolveReady: () => void; loadT0: number; ctl: AbortController | null; }
const MiB = 1024 * 1024;
const estBytes = (w: number, h: number) => Math.round(w * h * 4 * 4 / 3);

export class TextureStore {
  private map = new Map<string, Entry>();
  budgetBytes: number;
  frame = 0;
  onChange?: (name: string, level: Level) => void;
  constructor(budgetMiB = 1536) { this.budgetBytes = budgetMiB * MiB; }

  private placeholder(color: [number, number, number], srgb: boolean) {
    const c = new Uint8Array([Math.round(255 * Math.pow(color[0], 1 / 2.2)), Math.round(255 * Math.pow(color[1], 1 / 2.2)), Math.round(255 * Math.pow(color[2], 1 / 2.2)), 255]);
    const t = new THREE.DataTexture(c, 1, 1, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.needsUpdate = true;
    return t.image;
  }
  /** Stable texture for `name`; starts the base-map download on first request. */
  get(name: string, opts: { srgb: boolean; hiAvailable?: boolean; color?: [number, number, number]; priority?: boolean }): THREE.Texture {
    let e = this.map.get(name);
    if (!e) {
      const tex = new THREE.Texture(); configureMapTexture(tex, opts.srgb);
      // GA-TEX-01: a linear texture with an explicit placeholder colour (data masks: white = observed) keeps it; only
      // colourless linear maps default to the flat tangent-space normal (0.5, 0.5, 1)
      (tex as any).image = this.placeholder(opts.color ?? (opts.srgb ? [0.5, 0.5, 0.5] : [0.5, 0.5, 1.0]), opts.srgb);
      tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
      let resolveReady!: () => void; const ready = new Promise<void>(r => (resolveReady = r));
      e = { name, tex, srgb: opts.srgb, level: 'placeholder', loading: null, bmp: null, baseBmp: null, bytes: 4, lastUse: this.frame, hiAvailable: !!opts.hiAvailable, phColor: opts.color ?? (opts.srgb ? [0.5, 0.5, 0.5] : [0.5, 0.5, 1.0]), failed: new Set(), failCount: 0, failAt: 0, loadT0: 0, ctl: null, ready, resolveReady };
      this.map.set(name, e);
    }
    e.lastUse = this.frame;
    if (e.level === 'placeholder' && !e.loading) { if (e.failed.has('base')) this.heal(e); else void this.load(e, 'base', opts.priority); }
    return e.tex;
  }
  ready(name: string) { return this.map.get(name)?.ready ?? Promise.resolve(); }
  /** TEX-381-01: a map in use must never stay a placeholder. Every path that leaves an entry at the placeholder level with no
   *  load in flight (eviction of an idle base map, a superseded or failed decode) is healed here: the view touches its maps
   *  every frame it is drawn, so a drawn map re-requests its base level. Failed base loads retry with back-off (20 s,
   *  doubling, capped at 5 min) instead of being given up for the whole session. */
  touch(name: string) { const e = this.map.get(name); if (!e) return; e.lastUse = this.frame; this.heal(e); }
  reloads = 0;
  stalls = 0;
  /** TEX-381-01c: a base load that has neither landed nor failed after LOAD_STALL_MS (a fetch or decode that never settles
   *  left `loading` set forever, so the map stayed a placeholder for the whole session) is aborted and treated as a failed
   *  attempt: it enters the same back-off retry as a decode error. */
  static LOAD_STALL_MS = 45000;
  private heal(e: Entry) {
    if (e.level === 'placeholder' && e.loading === 'base' && performance.now() - e.loadT0 > TextureStore.LOAD_STALL_MS) {
      this.stalls++; console.warn(`texture ${e.name} (base) load stalled ${((performance.now() - e.loadT0) / 1000).toFixed(0)} s — aborted, will retry`);
      e.ctl?.abort(); e.ctl = null; e.loading = null; e.failed.add('base'); e.failCount++; e.failAt = performance.now();
    }
    if (e.level !== 'placeholder' || e.loading) return;
    if (e.failed.has('base')) {
      // back-off 20, 40, 80 s, then every 300 s for as long as the map is drawn (a network outage longer than the fast
      // retries no longer leaves the body a placeholder for the rest of the session; stats() keeps reporting it as failed)
      if (performance.now() - e.failAt < Math.min(300000, 20000 * 2 ** (e.failCount - 1))) return;
      e.failed.delete('base');
    }
    this.reloads++; void this.load(e, 'base', true);
  }
  level(name: string): Level | 'absent' { return this.map.get(name)?.level ?? 'absent'; }
  /** Ask for the high-resolution map (no-op if unavailable, already resident, or over budget). */
  requestHi(name: string) {
    const e = this.map.get(name); if (!e || !e.hiAvailable || e.level === 'hi' || e.loading || e.failed.has('hi') || e.level !== 'base') return false;
    const projected = this.residentBytes() + (e.bmp ? e.bmp.width * e.bmp.height * 4 * 4 / 3 * 3 : 128 * MiB);
    if (projected > this.budgetBytes) { this.evict(projected - this.budgetBytes, e); if (this.residentBytes() + 128 * MiB > this.budgetBytes) return false; }
    void this.load(e, 'hi', true); return true;
  }
  private async load(e: Entry, level: 'base' | 'hi', priority = false) {
    e.loading = level; e.loadT0 = performance.now(); const ctl = new AbortController(); e.ctl = ctl;
    try {
      const bmp = await decodeImage(`tex/${e.name}${level === 'hi' ? '_hi' : ''}.jpg`, { priority, signal: ctl.signal });
      if (ctl.signal.aborted) { bmp.close(); return; }      // TEX-381-01c: abandoned by the stall watchdog
      if (e.loading !== level) { bmp.close(); return; }       // superseded (evicted meanwhile)
      if (level === 'base') e.baseBmp = bmp;
      this.swap(e, bmp, level);
      if (level === 'base') e.resolveReady();
    } catch (err) {
      if (ctl.signal.aborted) return;                      // already counted as a failed attempt by the watchdog
      e.failed.add(level); if (level === 'base') { e.failCount++; e.failAt = performance.now(); } console.warn(`texture ${e.name} (${level}) unavailable`, err);
      if (level === 'base') e.resolveReady();
    } finally { if (e.ctl === ctl) { e.ctl = null; if (e.loading === level) e.loading = null; } }
  }
  // GA-TEX-01: demotion to placeholder keeps the entry's own placeholder colour (was grey for every map: a flat-normal map
  // became tilted, a data mask became 50 % "no data")
  private swap(e: Entry, bmp: ImageBitmap | null, level: Level) {
    e.tex.dispose();                                   // free the GPU texture; three re-creates it at the new size
    const old = e.bmp;
    if (bmp) { (e.tex as any).image = bmp; e.tex.generateMipmaps = true; e.tex.minFilter = THREE.LinearMipmapLinearFilter; e.bytes = estBytes(bmp.width, bmp.height); }
    else { const keep = e.baseBmp; e.baseBmp = null; keep?.close(); (e.tex as any).image = this.placeholder(e.phColor, e.srgb); e.tex.generateMipmaps = false; e.tex.minFilter = THREE.LinearFilter; e.bytes = 4; }
    e.bmp = bmp; e.level = level; e.tex.needsUpdate = true;
    if (old && old !== e.baseBmp) old.close();          // the base bitmap is kept on the CPU side for instant demotion
    if (level === 'placeholder' && e.baseBmp) { e.baseBmp.close(); e.baseBmp = null; }
    this.onChange?.(e.name, level);
  }
  residentBytes() { let s = 0; for (const e of this.map.values()) s += e.bytes; return s; }
  /** Release at least `bytes` by demoting least-recently-used entries (hi → base, then idle base → placeholder). */
  evict(bytes: number, keep?: Entry) {
    const lru = [...this.map.values()].filter(e => e !== keep).sort((a, b) => a.lastUse - b.lastUse);
    let freed = 0;
    for (const e of lru) { if (freed >= bytes) break; if (e.level === 'hi' && this.frame - e.lastUse > 30) { const before = e.bytes; e.loading = null; this.demoteToBase(e); freed += before - e.bytes; } }
    for (const e of lru) { if (freed >= bytes) break; if (e.level === 'base' && this.frame - e.lastUse > 600) { const before = e.bytes; e.loading = null; this.swap(e, null, 'placeholder'); freed += before; } }
    return freed;
  }
  private demoteToBase(e: Entry) { if (e.baseBmp) this.swap(e, e.baseBmp, 'base'); else { this.swap(e, null, 'placeholder'); void this.load(e, 'base'); } }
  /** Per-frame bookkeeping: count frames; every ~2 s enforce the budget and demote hi maps unused for ~20 s. */
  tick() {
    this.frame++;
    if (this.frame % 120 !== 0) return;
    for (const e of this.map.values()) if (e.level === 'hi' && this.frame - e.lastUse > 1200) this.demoteToBase(e);
    const over = this.residentBytes() - this.budgetBytes; if (over > 0) this.evict(over);
  }
  stats() {
    const lv = { placeholder: 0, base: 0, hi: 0 } as Record<Level, number>;
    for (const e of this.map.values()) lv[e.level]++;
    return { entries: this.map.size, ...lv, residentMiB: +(this.residentBytes() / MiB).toFixed(1), budgetMiB: +(this.budgetBytes / MiB).toFixed(0), loading: [...this.map.values()].filter(e => e.loading).map(e => `${e.name}:${e.loading}`), reloads: this.reloads, stalls: this.stalls, failed: [...this.map.values()].filter(e => e.failed.size).map(e => `${e.name}:${[...e.failed].join('+')}`) };
  }
}
