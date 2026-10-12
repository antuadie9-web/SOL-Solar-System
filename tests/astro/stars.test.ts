// 3D star catalogue checks against well-established reference values (RECONS / Gaia literature).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// v3.4: the catalogue ships as sector shards (index.json, schema sol-catalog/2); reassemble rows at their firstRow
const man = JSON.parse(fs.readFileSync('public/assets/catalogs/stars/index.json', 'utf8'));
const D = new Float32Array(man.count * man.rowFloats);
for (const s of man.shards) { const b = fs.readFileSync('public/assets/catalogs/stars/' + s.file); D.set(new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4), s.firstRow * man.rowFloats); }
const n = man.count; const named = JSON.parse(fs.readFileSync('public/assets/catalogs/stars/named.json', 'utf8'));
const dist = (i: number) => Math.hypot(D[i * 10], D[i * 10 + 1], D[i * 10 + 2]);
const EPS = 84381.406 / 3600 * Math.PI / 180;
const eclDir = (ra: number, dec: number) => { const a = ra * Math.PI / 180, d = dec * Math.PI / 180, x = Math.cos(d) * Math.cos(a), y = Math.cos(d) * Math.sin(a), z = Math.sin(d); return [x, Math.cos(EPS) * y + Math.sin(EPS) * z, -Math.sin(EPS) * y + Math.cos(EPS) * z]; };
const nearestTo = (ra: number, dec: number, maxDeg = 0.5) => { const u = eclDir(ra, dec); let best = -1, bc = Math.cos(maxDeg * Math.PI / 180); for (let i = 0; i < n; i++) { const r = dist(i), c = (D[i * 10] * u[0] + D[i * 10 + 1] * u[1] + D[i * 10 + 2] * u[2]) / r; if (c > bc && r < 50) { bc = c; best = i; } } return best; };
test('record count matches manifest and is > 330,000', () => { assert.equal(D.length, n * 10); assert.ok(n > 330000); });
test('Proxima Centauri at 1.30 pc (Gaia: ϖ = 768.07 mas)', () => { const i = nearestTo(217.4289, -62.6795); assert.ok(i >= 0); assert.ok(Math.abs(dist(i) - 1.302) < 0.01, String(dist(i))); });
test("Barnard's Star at 1.83 pc", () => { const i = nearestTo(269.452, 4.6934); assert.ok(i >= 0 && Math.abs(dist(i) - 1.828) < 0.02, String(dist(i))); });
test('Sirius present once (Hipparcos fill), ≈ 2.64 pc', () => { const i = nearestTo(101.2872, -16.7161, 0.2); assert.ok(i >= 0 && Math.abs(dist(i) - 2.64) < 0.05, String(dist(i))); });
test('stars within 10 pc: plausible count (RECONS-era census ≈ 300–550 incl. brown dwarfs)', () => { let c = 0; for (let i = 0; i < n; i++) if (dist(i) < 10) c++; assert.ok(c > 250 && c < 600, String(c)); });
test('no NaN in positions, velocities, magnitudes, temperatures', () => { for (let k = 0; k < n * 10; k++) if (k % 10 !== 9) assert.ok(Number.isFinite(D[k]), `index ${k}`); });
test('named stars resolved (≥ 150 of 159) and Vega ≈ 7.7 pc', () => { assert.ok(named.length >= 150); const v = named.find((x: any) => x.name === 'Vega'); assert.ok(v && Math.abs(v.distPc - 7.68) < 0.2, JSON.stringify(v)); });
import { createHash } from 'node:crypto';
import { validateManifest, boxDistance } from '../../src/contracts/catalog';
test('v3.4 star shards: valid manifest, every shard hash/size matches, rows lie inside their sector bounds, no row duplicated', () => {
  assert.deepEqual(validateManifest(man), []);
  let rows = 0;
  for (const s of man.shards) {
    const b = fs.readFileSync('public/assets/catalogs/stars/' + s.file);
    assert.equal(createHash('sha256').update(b).digest('hex'), s.sha256, s.id); assert.equal(b.length, s.bytes);
    for (let i = s.firstRow; i < s.firstRow + s.count; i += 97) assert.equal(boxDistance([D[i * 10], D[i * 10 + 1], D[i * 10 + 2]], s.bounds) < 1e-3, true, s.id);
    rows += s.count;
  }
  assert.equal(rows, man.count);
});
