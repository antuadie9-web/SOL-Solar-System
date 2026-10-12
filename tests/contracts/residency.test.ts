// v3.5 AUD-03: catalogue residency is driven by the observer — only shards in range are requested, moving the observer
// requests new ones and evicts far ones (which come back on return). v3.4 streamed every shard at boot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { CatalogStream, type CatalogManifest } from '../../src/contracts/catalog';

function line(n = 10) {
  const F = 10, files = new Map<string, ArrayBuffer>(); const shards = [] as CatalogManifest['shards'];
  for (let k = 0; k < n; k++) {               // shards along x: [50k, 50k+50] pc
    const buf = new Float32Array(2 * F).fill(k).buffer; files.set(`http://x/s${k}.bin`, buf);
    shards.push({ id: 's' + k, file: `s${k}.bin`, bytes: buf.byteLength, sha256: createHash('sha256').update(Buffer.from(buf)).digest('hex'), count: 2, firstRow: 2 * k, bounds: { min: [50 * k, 0, 0], max: [50 * k + 50, 50, 50] } });
  }
  const man: CatalogManifest = { schema: 'sol-catalog/2', catalog: 't', release: 't', frame: 'ecliptic-j2000-heliocentric', unit: 'pc', rowFormat: 't', rowFloats: F, count: 2 * n, cell: 50, shards, coverage: {} };
  return { man, files };
}
const hasher = async (b: ArrayBuffer) => createHash('sha256').update(Buffer.from(b)).digest('hex');

test('residency: only in-range shards load; moving loads new ones, evicts far ones, and returning reloads them', async () => {
  const { man, files } = line();
  const loaded: string[] = [], evicted: string[] = [];
  const st = new CatalogStream(man, 'http://x/', { onShard: s => loaded.push(s.id), onEvict: s => evicted.push(s.id) }, async u => files.get(u)!, hasher, 2);
  st.setResidency(60, 120); st.setObserver([10, 10, 10]);
  await st.start();
  assert.deepEqual(loaded.sort(), ['s0', 's1'], 'box distance ≤ 60 pc from (10,10,10): s0 (0) and s1 (40)');
  assert.equal(st.counts().queued, 8);
  await st.update([310, 10, 10]);                    // fly 300 pc along +x
  assert.ok(['s5', 's6', 's7'].every(id => st.state.get(id) === 'ready'));
  assert.deepEqual(evicted.sort(), ['s0', 's1'], 'both beyond 120 pc are released');
  await st.update([10, 10, 10]);                     // come back
  assert.equal(st.state.get('s0'), 'ready'); assert.equal(st.state.get('s1'), 'ready');
  assert.ok(st.resident().length <= 4);
});

test('residency null keeps the v3.4 load-everything behaviour', async () => {
  const { man, files } = line(5); let n = 0;
  const st = new CatalogStream(man, 'http://x/', { onShard: () => n++ }, async u => files.get(u)!, hasher, 3);
  await st.start(); assert.equal(n, 5);
});

test('named-rows extract matches named.json and its checksum (boot-time navigation targets without the shards)', () => {
  const dir = 'public/assets/catalogs/stars';
  const named = JSON.parse(fs.readFileSync(`${dir}/named.json`, 'utf8')), meta = JSON.parse(fs.readFileSync(`${dir}/named-rows.json`, 'utf8'));
  const buf = fs.readFileSync(`${dir}/named-rows.bin`);
  assert.equal(meta.count, named.length); assert.equal(buf.length, named.length * 40);
  assert.equal(createHash('sha256').update(buf).digest('hex'), meta.sha256);
  // Sirius: ~2.64 pc
  const i = named.findIndex((n: any) => n.name === 'Sirius'), r = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4).subarray(i * 10, i * 10 + 3);
  assert.ok(Math.abs(Math.hypot(r[0], r[1], r[2]) - 2.637) < 0.01);
});
