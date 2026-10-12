// Persistent user collections (bookmarks, recent targets) with a schema version and validation, so a stale or corrupt
// localStorage entry never breaks the interface (spec §10 "Preferences must persist without stale/incompatible state").
export interface Bookmark { id: string; name: string; target: string; yaw: number; pitch: number; dist: number; fov: number; jdTT: number; created: number }
const KEY_BM = 'sol.bookmarks.v1', KEY_RECENT = 'sol.recent.v1';
const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null);
const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
export function validBookmark(b: any): b is Bookmark {
  return !!b && typeof b.id === 'string' && typeof b.name === 'string' && typeof b.target === 'string' && ['yaw', 'pitch', 'dist', 'fov', 'jdTT', 'created'].every(k => isNum(b[k])) && b.dist > 0;
}
export class Store {
  bookmarks: Bookmark[] = []; recent: string[] = [];
  constructor(private storage = ls()) {
    try { const raw = JSON.parse(this.storage?.getItem(KEY_BM) || '[]'); this.bookmarks = Array.isArray(raw) ? raw.filter(validBookmark) : []; } catch { this.bookmarks = []; }
    try { const raw = JSON.parse(this.storage?.getItem(KEY_RECENT) || '[]'); this.recent = Array.isArray(raw) ? raw.filter((x: unknown) => typeof x === 'string').slice(0, 12) : []; } catch { this.recent = []; }
  }
  private save() { try { this.storage?.setItem(KEY_BM, JSON.stringify(this.bookmarks)); this.storage?.setItem(KEY_RECENT, JSON.stringify(this.recent)); } catch { /* quota/blocked: keep in memory */ } }
  addBookmark(b: Omit<Bookmark, 'id' | 'created'>) { const bm: Bookmark = { ...b, id: Math.random().toString(36).slice(2, 10), created: Date.now() }; if (!validBookmark(bm)) return null; this.bookmarks.unshift(bm); this.bookmarks = this.bookmarks.slice(0, 64); this.save(); return bm; }
  removeBookmark(id: string) { this.bookmarks = this.bookmarks.filter(b => b.id !== id); this.save(); }
  renameBookmark(id: string, name: string) { const b = this.bookmarks.find(x => x.id === id); if (b && name.trim()) { b.name = name.trim().slice(0, 60); this.save(); } }
  pushRecent(id: string) { this.recent = [id, ...this.recent.filter(x => x !== id)].slice(0, 12); this.save(); }
}
