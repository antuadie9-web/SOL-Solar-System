// Convert PDS global DEMs into SOL terrain height grids (Phase 4 first tier, 16 pixels/degree ≈ 1.9 km/px Moon, 3.7 km/px Mars).
//  Moon: LRO LOLA LDEM_16 (PDS LRO-L-LOLA-3-RDR-V1, ldem_16.img; LSB int16, height = DN × 0.5 m above 1737.4 km sphere)
//  Mars: MGS MOLA MEGDR MEGR90N000EB (PDS MGS-M-MOLA-5-MEGDR-L3-V1.0; MSB int16, radius = DN + 3,396,000 m)
// Both: simple cylindrical, planetocentric, east-positive longitude 0→360 from the west edge, +90° latitude in the first line,
// pixel centres at (i + 0.5)/16°. NASA/PDS data, public domain. Output: little-endian int16 metres relative to refRadius.
// Usage: node tools/ingest/dem.mjs <ldem_16.img> <megr90n000eb.img>
import fs from 'node:fs'; import crypto from 'node:crypto';
const [moonImg, marsImg] = process.argv.slice(2);
const W = 5760, H = 2880;
const out = (body, src, read, refRadiusKm, scaleM, sourceUrl, note) => {
  const b = fs.readFileSync(src); const a = new Int16Array(W * H); let mn = 1e9, mx = -1e9;
  for (let i = 0; i < W * H; i++) { const v = Math.round(read(b, i * 2) * scaleM); a[i] = Math.max(-32768, Math.min(32767, v)); mn = Math.min(mn, v); mx = Math.max(mx, v); }
  const dir = `public/assets/terrain/${body}`; fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/dem16.bin`, Buffer.from(a.buffer));
  const sha = crypto.createHash('sha256').update(Buffer.from(a.buffer)).digest('hex');
  fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify({ body, file: 'dem16.bin', width: W, height: H, type: 'int16 LE metres relative to refRadiusKm', refRadiusKm, ppd: 16,
    lon0: 0, lonDirection: 'east', latTop: 90, pixelCentre: 0.5, minM: mn, maxM: mx, source: sourceUrl, note, license: 'NASA/PDS — public domain', truth: 'OBSERVED (laser altimetry, gridded)', sha256: sha }, null, 1));
  console.log(body, mn, mx, sha.slice(0, 12));
};
out('moon', moonImg, (b, o) => b.readInt16LE(o), 1737.4, 0.5, 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img', 'LOLA LDEM_16, Smith et al. (LRO LOLA team)');
out('mars', marsImg, (b, o) => b.readInt16BE(o), 3396.0, 1, 'https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megr90n000eb.img', 'MOLA MEGDR radius, Smith et al. 2003');
