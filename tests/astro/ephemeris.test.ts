// Ephemeris acceptance tests against committed JPL Horizons fixtures (tests/fixtures/horizons).
// Tolerances live in spec.json and were declared before comparison; this file never edits them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SolarSystem } from '../../src/astro/system';
import { sub, len, dot, norm } from '../../src/astro/vec';
import spec from '../fixtures/horizons/spec.json';
import vec from '../fixtures/horizons/vectors.json';
import sats from '../../public/assets/data/satellites.json';
import feat from '../../public/assets/data/featured.json';

import { SAMPLED } from '../../src/astro/sampled';
import fs from 'node:fs';
const man = JSON.parse(fs.readFileSync('public/assets/data/ephem/manifest.json', 'utf8'));
SAMPLED.setManifest(man);
for (const [k, s] of Object.entries<any>(man.systems)) { const b = fs.readFileSync('public/assets/data/ephem/' + s.file); SAMPLED.attach(k, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
const osc = fs.existsSync('public/assets/data/satellites_osc.json') ? JSON.parse(fs.readFileSync('public/assets/data/satellites_osc.json', 'utf8')) : null;
const S = new SolarSystem(sats as any, feat as any, osc);
const RAD2AS = 206264.806;
const centerBody: Record<string, string | null> = { '500@10': null, '500@399': 'earth', '500@599': 'jupiter', '500@499': 'mars', '500@699': 'saturn', '500@899': 'neptune', '500@799': 'uranus', '500@999': 'pluto' };
export interface Residual { tier: string; group: string; id: string; jd: number; errKm: number; angArcsec: number; radialRel: number; pass: boolean; tol: string }
export const residuals: Residual[] = [];
for (const r of (vec as any).results) {
  const g = (spec as any).groups.find((x: any) => x.id === r.group);
  for (const row of r.rows) {
    const known = ((spec as any).knownDeviations ?? []).find((k: any) => k.group === r.group && k.id === r.id && k.jd === row.jdTdb);
    test(`${r.group}/${r.id} @ JD ${row.jdTdb}`, known ? { todo: `known deviation: ${known.reason}` } : {}, () => {
      // SOL clock runs in TT; TDB−TT < 2 ms, i.e. < 0.1 km for the fastest bodies tested — below every tolerance.
      S.update(row.jdTdb, row.jdTdb);
      const b = S.get(r.id); assert.ok(b, `body ${r.id} exists`);
      const cid = centerBody[r.center]; const c = cid ? S.get(cid)! : null;
      const p = c ? sub(b!.pos, c.pos) : b!.pos;
      const ref = row.pos as [number, number, number];
      const errKm = len(sub(p, ref)), rr = len(ref);
      const angArcsec = Math.acos(Math.min(1, dot(norm(p), norm(ref)))) * RAD2AS;
      const radialRel = Math.abs(len(p) - rr) / rr;
      const t = g.tol; let pass = true; let tol = '';
      if (t.angArcsec !== undefined) { pass &&= angArcsec <= t.angArcsec; tol += `ang<=${t.angArcsec}" `; }
      if (t.radialRel !== undefined) { pass &&= radialRel <= t.radialRel; tol += `radial<=${t.radialRel} `; }
      if (t.absKm !== undefined) { pass &&= errKm <= t.absKm; tol += `err<=${t.absKm}km `; }
      if (t.relToA !== undefined) { const a = (g.targets[r.id] as any[])[2]; pass &&= errKm <= t.relToA * a; tol += `err<=${t.relToA}a(${(t.relToA * a).toFixed(0)}km) `; }
      if (r.group === 'pluto-system') {
        if (r.id === 'pluto') { pass &&= errKm <= t.plutoAbsKm; tol += `err<=${t.plutoAbsKm}km`; }
        else { const a = (g.targets[r.id] as any[])[2]; pass &&= errKm <= t.charonRelToA * a; tol += `err<=${t.charonRelToA}a`; }
      }
      residuals.push({ tier: b!.ephemTier(), group: r.group, id: r.id, jd: row.jdTdb, errKm, angArcsec, radialRel, pass, tol });
      assert.ok(pass, `${r.id} JD${row.jdTdb}: err ${errKm.toFixed(3)} km, ${angArcsec.toFixed(3)}", radial ${radialRel.toExponential(2)} > tol ${tol}`);
    });
  }
}
test.after(() => {
  const fs = require('node:fs'); fs.mkdirSync('docs/qa', { recursive: true });
  fs.writeFileSync('docs/qa/ephemeris-residuals.json', JSON.stringify({ generated: new Date().toISOString(), horizonsFetched: (vec as any).fetched, residuals }, null, 1));
});
