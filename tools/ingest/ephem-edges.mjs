// Finalise public/assets/data/ephem: (1) repack each system so every Float64 block starts on an 8-byte boundary,
// (2) add window-edge states (first/last sample) so the runtime can extrapolate two-body without loading the binary,
// (3) record the SHA-256 of each binary.
import fs from 'node:fs'; import crypto from 'node:crypto';
const dir = 'public/assets/data/ephem', man = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, 'utf8'));
for (const sys of Object.values(man.systems)) {
  const buf = fs.readFileSync(`${dir}/${sys.file}`);
  const parts = []; let off = 0;
  for (const b of sys.bodies) {
    const P = new Float64Array(b.n * 3), V = new Float32Array(b.n * 3);
    for (let k = 0; k < b.n * 3; k++) { P[k] = buf.readDoubleLE(b.posOffset + k * 8); V[k] = buf.readFloatLE(b.velOffset + k * 4); }
    const st = k => [[P[k * 3], P[k * 3 + 1], P[k * 3 + 2]], [V[k * 3], V[k * 3 + 1], V[k * 3 + 2]]];
    b.edge = { first: st(0), last: st(b.n - 1) };
    b.posOffset = off; off += P.byteLength; b.velOffset = off; off += V.byteLength;
    const pad = (8 - (off % 8)) % 8; off += pad;
    parts.push(Buffer.from(P.buffer), Buffer.from(V.buffer), Buffer.alloc(pad));
  }
  const out = Buffer.concat(parts); fs.writeFileSync(`${dir}/${sys.file}`, out);
  sys.bytes = out.length; sys.sha256 = crypto.createHash('sha256').update(out).digest('hex');
}
fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify(man, null, 1));
console.log('ok');
