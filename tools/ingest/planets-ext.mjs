// SOL v3.4 (ISSUE SCI-003) — long-window sampled tier for the giant-planet system barycentres, 1900–2200 TDB, from
// JPL Horizons (DE441 barycentres 5/6/7/8, heliocentric, ecliptic J2000, geometric). It is a SECOND track per body
// (src/astro/sampled.ts multi-window): the 2000–2050 primary tracks keep precedence; outside them this tier replaces
// VSOP87B, whose Neptune error reached 2.44″ by 2075.  node tools/ingest/planets-ext.mjs
import fs from 'node:fs'; import crypto from 'node:crypto';
const dir = 'public/assets/data/ephem', man = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, 'utf8'));
const T0 = 2415020.5, T1 = 2524593.5;                    // 1900-01-01 … 2200-01-01 TDB
const B = [['jupiter-bary', '5', 8, 132839152805.1], ['saturn-bary', '6', 16, 132750380626.2], ['uranus-bary', '7', 32, 132718234597.4], ['neptune-bary', '8', 32, 132719276568.1]];
const bodies = []; const parts = []; let off = 0;
for (const [id, cmd, step, mu] of B) {
  const n = Math.floor((T1 - T0) / step) + 1, stop = T0 + (n - 1) * step;
  const p = new URLSearchParams({ format: 'json', COMMAND: `'${cmd}'`, OBJ_DATA: 'NO', EPHEM_TYPE: 'VECTORS', CENTER: "'500@10'", START_TIME: `'JD${T0}'`, STOP_TIME: `'JD${stop}'`, STEP_SIZE: `'${step}d'`, TIME_TYPE: 'TDB', REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF', VEC_TABLE: '2', VEC_CORR: 'NONE', OUT_UNITS: 'KM-S', CSV_FORMAT: 'YES' });
  const j = await (await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + p)).json();
  if (!j.result?.includes('$$SOE')) throw new Error(id + ': ' + (j.error ?? j.result?.slice(0, 400)));
  const rows = j.result.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n').map(l => l.split(',').map(s => s.trim())).map(c => [+c[0], +c[2], +c[3], +c[4], +c[5], +c[6], +c[7]]);
  if (rows.length !== n) throw new Error(`${id}: ${rows.length} rows vs ${n}`);
  const P = new Float64Array(n * 3), V = new Float32Array(n * 3);
  rows.forEach((r, k) => { P.set([r[1], r[2], r[3]], k * 3); V.set([r[4], r[5], r[6]], k * 3); });
  const src = j.result.match(/Target body name:.*\{source: ([^}]+)\}/)?.[1] ?? 'DE441';
  const pb = Buffer.from(P.buffer), vb = Buffer.from(V.buffer);
  bodies.push({ id, command: cmd, center: '500@10', t0: T0, step, n, mu, posOffset: off, velOffset: off + pb.length, source: src,
    edge: { first: [[rows[0][1], rows[0][2], rows[0][3]], [rows[0][4], rows[0][5], rows[0][6]]], last: [[rows[n - 1][1], rows[n - 1][2], rows[n - 1][3]], [rows[n - 1][4], rows[n - 1][5], rows[n - 1][6]]] } });
  const pad = Buffer.alloc((8 - (vb.length % 8)) % 8);   // keep every Float64 block 8-byte aligned
  parts.push(pb, vb, pad); off += pb.length + vb.length + pad.length;
  console.log(id, n, 'rows', src);
}
const buf = Buffer.concat(parts);
fs.writeFileSync(`${dir}/planets-ext.bin`, buf);
man.systems['planets-ext'] = { file: 'planets-ext.bin', bytes: buf.length, fetched: new Date().toISOString(), window: [T0, T1], sha256: crypto.createHash('sha256').update(buf).digest('hex'), secondary: true,
  note: 'secondary long-window tier (DE441 barycentres); primary 2000–2050 tracks take precedence', bodies };
fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify(man, null, 1));
