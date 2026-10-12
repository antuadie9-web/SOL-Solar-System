// Osculating state vectors for every satellite in satellites.json at one modern epoch (JPL Horizons, planet-centred,
// ICRF/J2000 ecliptic, geometric, TDB). Runtime propagates them as two-body orbits (src/astro/system.ts), replacing
// mean elements whose Saturn-system orientation could not be reproduced (R-006). Accuracy degrades away from the epoch;
// the inspector labels these orbits "osculating @ epoch".
import fs from 'node:fs';
const EPOCH = 2461321.5; // 2026-10-08.0 TDB
const sats = JSON.parse(fs.readFileSync('public/assets/data/satellites.json', 'utf8'));
const centers = { Mars: '500@499', Jupiter: '500@599', Saturn: '500@699', Uranus: '500@799', Neptune: '500@899', Pluto: '500@999' };
const outFile = 'public/assets/data/satellites_osc.json';
const out = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : { epochJdTdb: EPOCH, frame: 'ICRF/J2000 ecliptic, planet-centred, km, km/s', source: 'https://ssd.jpl.nasa.gov/api/horizons.api', fetched: null, states: {}, missing: {} };
const codes = [...new Set(sats.map(s => s.code))].filter(c => !(c in out.states));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let done = 0;
for (const code of codes) {
  const s = sats.find(x => x.code === code); const center = centers[s.planet]; if (!center) continue;
  const p = new URLSearchParams({ format: 'json', COMMAND: `'${code}'`, OBJ_DATA: 'NO', EPHEM_TYPE: 'VECTORS', CENTER: `'${center}'`, TLIST: String(EPOCH), TIME_TYPE: 'TDB', REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF', VEC_TABLE: '2', VEC_CORR: 'NONE', OUT_UNITS: 'KM-S', CSV_FORMAT: 'YES' });
  let ok = false;
  for (let k = 0; k < 5 && !ok; k++) {
    try {
      const r = await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + p); const t = await r.text();
      if (!r.ok || t.startsWith('<')) { await sleep(2000 * (k + 1)); continue; }
      const j = JSON.parse(t); const body = j.result.split('$$SOE')[1]?.split('$$EOE')[0];
      if (!body) { out.missing[code] = j.result.slice(0, 200).replace(/\s+/g, ' '); ok = true; break; }
      const c = body.trim().split(',').map(x => x.trim());
      out.states[code] = { name: s.name, planet: s.planet, center, r: [+c[2], +c[3], +c[4]], v: [+c[5], +c[6], +c[7]] }; ok = true;
    } catch { await sleep(2000 * (k + 1)); }
  }
  if (++done % 25 === 0) { out.fetched = new Date().toISOString(); fs.writeFileSync(outFile, JSON.stringify(out)); console.log(done, '/', codes.length); }
  await sleep(250);
}
out.fetched = new Date().toISOString(); fs.writeFileSync(outFile, JSON.stringify(out));
console.log('states', Object.keys(out.states).length, 'missing', Object.keys(out.missing).length);
