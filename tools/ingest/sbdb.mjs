// Refresh public/assets/data/featured.json orbital elements from the JPL SBDB API at FULL PRECISION (full-prec=1).
// The shipped baseline file carried elements rounded to 3 significant figures (e.g. Ceres a=2.77, i=10.6) which caused
// 0.1–0.3° position errors; see docs/rnd-ledger.md (R-004). Physical fields already present are kept.
// Usage: node tools/ingest/sbdb.mjs
import fs from 'node:fs';
const file = 'public/assets/data/featured.json';
const F = JSON.parse(fs.readFileSync(file, 'utf8'));
const API = 'https://ssd-api.jpl.nasa.gov/sbdb.api';
const prov = { source: API, params: 'full-prec=1&phys-par=1', fetched: new Date().toISOString(), objects: {} };
const keys = Object.keys(F);
async function one(k) {
  const sstr = k === '3I' ? 'C/2025 N1' : k;
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`${API}?sstr=${encodeURIComponent(sstr)}&full-prec=1&phys-par=1`);
    if (!r.ok) { await new Promise(s => setTimeout(s, 1000 * (a + 1))); continue; }
    const d = await r.json(); if (!d.orbit) throw new Error(`${k}: ${JSON.stringify(d).slice(0, 200)}`);
    const el = Object.fromEntries(d.orbit.elements.map(e => [e.name, e.value == null ? null : +e.value]));
    const f = F[k];
    for (const n of ['e', 'q', 'i', 'om', 'w', 'tp', 'a', 'ma']) if (el[n] != null && Number.isFinite(el[n])) f[n] = el[n];
    f.ep = +d.orbit.epoch;
    const nongrav = (d.orbit.model_pars || []).filter(p => /^A[123]$|^DT$/.test(p.name)).map(p => `${p.name}=${p.value}`);
    prov.objects[k] = { fullname: d.object.fullname, orbit_id: d.orbit.orbit_id, soln_date: d.orbit.soln_date, epochJdTdb: +d.orbit.epoch, equinox: d.orbit.equinox,
      first_obs: d.orbit.first_obs, last_obs: d.orbit.last_obs, condition_code: d.orbit.condition_code, nongrav: nongrav.length ? nongrav : undefined, comment: d.orbit.comment };
    return;
  }
  throw new Error('SBDB failed ' + k);
}
for (let i = 0; i < keys.length; i += 6) await Promise.all(keys.slice(i, i + 6).map(one));
fs.writeFileSync(file, JSON.stringify(F));
fs.mkdirSync('public/assets/data/provenance', { recursive: true });
fs.writeFileSync('public/assets/data/provenance/featured.sbdb.json', JSON.stringify(prov, null, 1));
console.log('refreshed', keys.length, 'objects');
