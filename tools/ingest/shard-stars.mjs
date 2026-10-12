// SOL v3.4 — partition the 3D star catalogue (stars3d v1, one 13 MB file) into spatial sector shards + a versioned
// manifest (src/contracts/catalog.ts schema 'sol-catalog/2'). Rows are re-ordered sector by sector; named.json indices
// are remapped. Deterministic: same input → byte-identical output.   node tools/ingest/shard-stars.mjs
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const dir = 'public/assets/catalogs/stars';
const src = fs.existsSync(path.join(dir, 'stars3d.bin')) ? path.join(dir, 'stars3d.bin') : '.cache/stars3d.v1.bin';
const v1 = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
fs.mkdirSync('.cache', { recursive: true });
if (!fs.existsSync('.cache/named.v1.json')) fs.copyFileSync(path.join(dir, 'named.json'), '.cache/named.v1.json');   // v1 (pre-shard) indices
const named = JSON.parse(fs.readFileSync('.cache/named.v1.json', 'utf8'));
const buf = fs.readFileSync(src); const D = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const F = 10, n = D.length / F; if (n !== v1.count) throw new Error('row count mismatch');
const CELL = 50;                                    // pc; 100 pc GCNS sphere → ≤ 4³ inner cells + sparse outer Hipparcos cells
const key = i => [0, 1, 2].map(k => Math.floor(D[i * F + k] / CELL));
const groups = new Map();
for (let i = 0; i < n; i++) { const k = key(i).join(':'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
const keys = [...groups.keys()].sort((a, b) => { const A = a.split(':').map(Number), B = b.split(':').map(Number); return (Math.hypot(...A.map(x => x + 0.5)) - Math.hypot(...B.map(x => x + 0.5))) || a.localeCompare(b); });
// merge sparse distant cells (<200 rows) into one "outer" shard per octant to avoid hundreds of tiny requests
const shardsRows = []; const outer = new Map();
for (const k of keys) {
  const rows = groups.get(k); const c = k.split(':').map(Number);
  if (rows.length < 200) { const o = 'outer:' + c.map(x => (x < 0 ? '-' : '+')).join(''); if (!outer.has(o)) outer.set(o, []); outer.get(o).push(...rows); }
  else shardsRows.push(['c50:' + c.map(x => (x >= 0 ? '+' : '') + x).join(':'), rows]);
}
for (const [o, rows] of [...outer.entries()].sort()) shardsRows.push([o, rows]);
const outDir = path.join(dir, 'shards'); fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
const remap = new Int32Array(n); let row = 0; const shards = [];
for (const [id, rows] of shardsRows) {
  const out = new Float32Array(rows.length * F); const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  rows.forEach((i, j) => { out.set(D.subarray(i * F, i * F + F), j * F); remap[i] = row + j; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], D[i * F + k]); mx[k] = Math.max(mx[k], D[i * F + k]); } });
  const file = `shards/${id.replace(/[:+]/g, m => (m === ':' ? '_' : 'p'))}.bin`;
  const b = Buffer.from(out.buffer); fs.writeFileSync(path.join(dir, file), b);
  shards.push({ id, file, bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex'), count: rows.length, firstRow: row,
    bounds: { min: mn.map(x => +x.toFixed(3)), max: mx.map(x => +x.toFixed(3)) } });
  row += rows.length;
}
const distKnown = n; // every row in v1 passed a parallax S/N > 5 or GCNS posterior cut
const manifest = { schema: 'sol-catalog/2', catalog: 'stars3d', release: `GCNS (Gaia EDR3/DR3) + Hipparcos-2 · built ${v1.built}`, frame: 'ecliptic-j2000-heliocentric', unit: 'pc',
  rowFormat: v1.format, rowFloats: F, count: n, cell: CELL, shards,
  coverage: { sourceRows: n, positionKnown: n, distanceKnown: distKnown, navigable3d: n, gcnsWithin100pc: v1.gcns_d100pc, hipparcosFill: v1.hipparcosFill, excludedWithReason: 'see manifest.json cuts (v1 build)' },
  provenance: { v1: 'manifest.json', sources: v1.sources, cuts: v1.cuts, truth: v1.truth, v1sha256: v1.sha256 } };
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(dir, 'named.json'), JSON.stringify(named.map(s => ({ ...s, index: remap[s.index] })), null, 0));
if (src.startsWith(dir)) fs.renameSync(src, '.cache/stars3d.v1.bin');   // the single-file v1 payload is superseded by the shards
console.log(`stars3d: ${n} rows → ${shards.length} shards (cell ${CELL} pc); largest ${Math.max(...shards.map(s => s.count))} rows`);
