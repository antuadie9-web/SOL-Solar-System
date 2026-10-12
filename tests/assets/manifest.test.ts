// Asset integrity (spec §15): every shipped file has provenance/licence metadata; no unintended exact duplicates;
// non-commercial assets are explicitly flagged; every texture/model the catalogue references exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path';
import { CATALOG } from '../../src/data/catalog';
const root = process.cwd();
const rules = JSON.parse(fs.readFileSync(path.join(root, 'docs/assets/provenance-rules.json'), 'utf8')).rules.map((r: any) => ({ ...r, re: new RegExp(r.match) }));
const files: string[] = []; const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : files.push(path.relative(path.join(root, 'public'), p).split(path.sep).join('/')); } };
walk(path.join(root, 'public'));
test('every file under public/ matches a provenance rule with source, licence and commercial status', () => {
  const miss = files.filter(f => !rules.some((r: any) => r.re.test(f))); assert.deepEqual(miss, []);
  for (const r of rules) for (const k of ['source', 'licence', 'commercial', 'truth']) assert.ok(r[k] !== undefined, `${r.match} lacks ${k}`);
});
test('catalogue texture and model references resolve to shipped files', () => {
  for (const d of CATALOG) {
    for (const t of [d.tex, d.normal, d.night, d.clouds, d.ocean].filter(Boolean) as string[]) assert.ok(files.includes(`assets/tex/${t}.jpg`) || files.includes(`assets/tex/${t}.png`), `${d.id}: ${t}`);
    if (d.model) assert.ok(files.includes(`assets/models/${d.model}.glb`), `${d.id}: ${d.model}`);
  }
});
test('non-commercial imagery is flagged, not silently redistributed as free (v3.8.1: none remain)', () => {
  const man = JSON.parse(fs.readFileSync('docs/assets/asset-manifest.json', 'utf8'));
  for (const a of man.assets) if (/^NO/.test(a.commercial)) assert.ok(man.nonCommercial.includes(a.path), a.path);
  // AST-381-01: the former Steve Albers (personal / non-commercial) Uranian-moon maps were replaced by USGS Voyager mosaics (JPL)
  for (const b of ['ariel', 'titania', 'oberon']) { const r = rules.find((x: any) => x.re.test(`assets/tex/${b}.jpg`)); assert.match(r.commercial, /^yes/, b); assert.match(r.attribution, /NASA\/JPL-Caltech/); }
});
test('v3.4 AST-003: the replaced Galilean/Saturnian/Neptunian/Pluto-system/Dawn maps are public-domain USGS or NASA products with provenance', () => {
  for (const b of ['io', 'europa', 'ganymede', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'iapetus', 'triton', 'pluto', 'charon', 'ceres', 'vesta']) {
    const r = rules.find((x: any) => x.re.test(`assets/tex/${b}.jpg`)); assert.match(r.commercial, /^yes/, b);
    assert.ok(fs.existsSync(r.provenance), b + ' provenance file');
    const p = JSON.parse(fs.readFileSync(r.provenance, 'utf8')); assert.ok(p.checksum || p.md5, b); assert.ok(p.tiers.hi.sha256 && p.tiers.base.sha256, b);
  }
});
