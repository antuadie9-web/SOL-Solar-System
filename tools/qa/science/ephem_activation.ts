// GA-EPH-01: measure the position change each body undergoes when its sampled-ephemeris payload streams in after boot.
// Pre-attach state = what the app renders between first frame and attach; post = after attach. Epochs: several in window.
import fs from 'node:fs';
import { SolarSystem } from '../../../src/astro/system';
import { SAMPLED } from '../../../src/astro/sampled';
import { sub, len } from '../../../src/astro/vec';
import sats from '../../../public/assets/data/satellites.json';
import feat from '../../../public/assets/data/featured.json';
const man = JSON.parse(fs.readFileSync('public/assets/data/ephem/manifest.json', 'utf8'));
const osc = fs.existsSync('public/assets/data/satellites_osc.json') ? JSON.parse(fs.readFileSync('public/assets/data/satellites_osc.json', 'utf8')) : null;
SAMPLED.setManifest(man);
const S = new SolarSystem(sats as any, feat as any, osc);
const epochs = (process.env.JDS ?? '2461328.5,2451545.0,2469000.5').split(',').map(Number);
const ids = S.bodies.filter(b => b.kind !== 'star').map(b => b.id);
const pre = new Map<string, any>(), tiers = new Map<string, string>();
for (const jd of epochs) { S.update(jd, jd); for (const id of ids) { const b = S.get(id)!; const pp = b.parent && b.parent.kind !== 'star' ? b.parent.pos : [0, 0, 0]; pre.set(id + '@' + jd, [b.pos[0] - pp[0], b.pos[1] - pp[1], b.pos[2] - pp[2]]); tiers.set(id + '@' + jd, b.ephemTier()); } }
for (const [k, s] of Object.entries<any>(man.systems)) { const b = fs.readFileSync('public/assets/data/ephem/' + s.file); SAMPLED.attach(k, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
const out: any[] = [];
for (const jd of epochs) {
  S.update(jd, jd);
  for (const id of ids) {
    const b = S.get(id)!, p0 = pre.get(id + '@' + jd);
    const par = b.parent && b.parent.kind !== 'star' ? b.parent : null;
    const rel = par ? sub(b.pos as any, par.pos as any) : (b.pos as any), d = len(sub(rel, p0));
    const dist = par ? len(sub(b.pos as any, par.pos as any)) : len(b.pos as any);
    if (d > 0) out.push({ jd, id, parent: par?.id ?? 'sun', jumpKm: +d.toFixed(1), jumpRel: +(d / dist).toExponential(2), radiusKm: b.radius, tierBefore: tiers.get(id + '@' + jd), tierAfter: b.ephemTier() });
  }
}
out.sort((a, b) => b.jumpRel - a.jumpRel);
fs.mkdirSync('docs/qa', { recursive: true });
fs.writeFileSync(process.env.OUT ?? 'docs/qa/ephem-activation.json', JSON.stringify({ epochs, n: out.length, rows: out }, null, 1));
for (const r of out.filter(r => r.jd === epochs[0]).slice(0, 25)) console.log(r.id.padEnd(12), String(r.jumpKm).padStart(14), r.jumpRel, '|', r.tierBefore, '→', r.tierAfter);
console.log('bodies with jumps:', out.filter(r => r.jd === epochs[0]).length);
