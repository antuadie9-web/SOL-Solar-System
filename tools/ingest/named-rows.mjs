// SOL v3.5 (AUD-03) — extract the rows of the 157 named, navigable stars from the sector shards into one small file
// (named-rows.bin, 157 × 10 float32 ≈ 6 KB) so search/travel targets exist at boot WITHOUT streaming the 13 MB catalogue.
// The 3D star layer itself now streams only when the camera needs it (src/contracts/catalog.ts residency).
// Deterministic; verifies every shard's SHA-256 first.   node tools/ingest/named-rows.mjs
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const dir = 'public/assets/catalogs/stars';
const man = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const named = JSON.parse(fs.readFileSync(path.join(dir, 'named.json'), 'utf8'));
const F = man.rowFloats, out = new Float32Array(named.length * F);
const shardOf = i => man.shards.find(s => i >= s.firstRow && i < s.firstRow + s.count);
const cache = new Map();
named.forEach((n, j) => {
  const s = shardOf(n.index); if (!s) throw new Error('no shard for ' + n.name);
  if (!cache.has(s.id)) {
    const b = fs.readFileSync(path.join(dir, s.file));
    if (crypto.createHash('sha256').update(b).digest('hex') !== s.sha256) throw new Error('checksum ' + s.id);
    cache.set(s.id, new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4));
  }
  const D = cache.get(s.id), r = n.index - s.firstRow;
  out.set(D.subarray(r * F, r * F + F), j * F);
});
const buf = Buffer.from(out.buffer);
fs.writeFileSync(path.join(dir, 'named-rows.bin'), buf);
const meta = { schema: 'sol-named-rows/1', rowFormat: man.rowFormat, rowFloats: F, count: named.length, order: 'same order as named.json', sha256: crypto.createHash('sha256').update(buf).digest('hex'), release: man.release, shardsTouched: cache.size };
fs.writeFileSync(path.join(dir, 'named-rows.json'), JSON.stringify(meta, null, 1));
console.log(`named rows: ${named.length} stars from ${cache.size} shards → ${buf.length} bytes`);
