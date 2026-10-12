// Expands docs/assets/provenance-rules.json into docs/assets/asset-manifest.json (every shipped file under public/ with
// size, SHA-256, licence and truth label) and reports unmatched files and exact-hash duplicates.  node tools/validate/assets.mjs
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'docs/assets/provenance-rules.json'), 'utf8')).rules.map(r => ({ ...r, re: new RegExp(r.match) }));
const files = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : files.push(p); } };
walk(path.join(root, 'public'));
const out = [], unmatched = [], byHash = new Map();
for (const p of files.sort()) {
  const rel = path.relative(path.join(root, 'public'), p).split(path.sep).join('/');
  const buf = fs.readFileSync(p), sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const r = rules.find(x => x.re.test(rel));
  if (!r) { unmatched.push(rel); continue; }
  const { re, match, ...meta } = r; void re; void match;
  out.push({ path: rel, bytes: buf.length, sha256, ...meta });
  byHash.set(sha256, [...(byHash.get(sha256) ?? []), rel]);
}
const dups = [...byHash.values()].filter(v => v.length > 1);
const nonCommercial = out.filter(a => /^NO/.test(a.commercial)).map(a => a.path);
fs.writeFileSync(path.join(root, 'docs/assets/asset-manifest.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), count: out.length, unmatched, exactDuplicates: dups, nonCommercial, assets: out }, null, 1));
// v3.5 AUD-05: compact truth labels of every colour map for the runtime inspector/HUD (inferred / synthetic colour shown)
const mapTruth = {};
for (const a of out) { const m = /^assets\/tex\/([a-z0-9_]+)\.(jpg|png)$/.exec(a.path); if (!m || /_(n|hi|night|clouds|ocean)$/.test(m[1]) || m[1].startsWith('milkyway')) continue; mapTruth[m[1]] = { truth: a.truth, content: a.content, source: a.source, commercial: a.commercial }; }
fs.writeFileSync(path.join(root, 'src/data/mapTruth.json'), JSON.stringify(mapTruth, null, 1));
console.log(`assets ${out.length} · unmatched ${unmatched.length} · exact duplicates ${dups.length} · non-commercial ${nonCommercial.length}`);
if (unmatched.length) { console.error('UNMATCHED:', unmatched.join(', ')); process.exit(1); }
