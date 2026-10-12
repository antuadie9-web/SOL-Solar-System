// Fetch JPL Horizons reference state vectors for the acceptance spec (tests/fixtures/horizons/spec.json).
// Writes tests/fixtures/horizons/vectors.json with full provenance (API URL, Horizons version line, fetch date).
// Usage: node tools/ingest/horizons.mjs      (network required; fixtures are committed so tests run offline)
import fs from 'node:fs';
const dir = 'tests/fixtures/horizons';
const spec = JSON.parse(fs.readFileSync(`${dir}/spec.json`, 'utf8'));
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
async function query(command, center, jds) {
  const p = new URLSearchParams({ format: 'json', COMMAND: `'${command}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', CENTER: `'${center}'`,
    TLIST: jds.map(String).join(' '), TLIST_TYPE: 'JD', TIME_TYPE: 'TDB', REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF', VEC_TABLE: '2', VEC_CORR: 'NONE', OUT_UNITS: 'KM-S', CSV_FORMAT: 'YES', VEC_LABELS: 'NO' });
  const url = `${API}?${p}`;
  for (let k = 0; k < 4; k++) {
    const r = await fetch(url); if (!r.ok) { await new Promise(s => setTimeout(s, 1500)); continue; }
    const j = await r.json(); const t = j.result || '';
    const body = t.split('$$SOE')[1]?.split('$$EOE')[0]; if (!body) throw new Error(`Horizons: no data for ${command} @ ${center}\n${t.slice(0, 800)}`);
    const rows = body.trim().split('\n').map(l => l.split(',').map(s => s.trim())).map(c => ({ jdTdb: +c[0], pos: [+c[2], +c[3], +c[4]], vel: [+c[5], +c[6], +c[7]] }));
    const target = (t.match(/Target body name:\s*(.+?)\s{2,}/) || [])[1] ?? command;
    const ver = j.signature ? `${j.signature.source} v${j.signature.version}` : 'unknown';
    const ephemSrc = (t.match(/Target primary\s*:.*\n|Ephemeris \/ .*\n/) || [''])[0].trim();
    return { url: url.replace(/&/g, '&'), target, ver, rows, ephemSrc };
  }
  throw new Error('Horizons fetch failed ' + command);
}
const only = process.argv[2];
const prevFile = `${dir}/vectors.json`;
const out = only && fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, 'utf8')) : { fetched: new Date().toISOString(), api: API, results: [] };
if (only) out.results = out.results.filter(r => r.group !== only);
for (const g of spec.groups) {
  if (only && g.id !== only) continue;
  for (const [id, t] of Object.entries(g.targets)) {
    const [cmd, center] = Array.isArray(t) ? [t[0], t[1] ?? g.center] : [t, g.center];
    const jds = g.epochs.map(e => spec.epochsJdTdb[e]);
    const q = await query(cmd, center, jds);
    out.results.push({ group: g.id, id, command: cmd, center, target: q.target, horizons: q.ver, url: q.url, rows: q.rows });
    console.log(g.id, id, q.target, q.rows.length, q.ver);
    await new Promise(s => setTimeout(s, 500));
  }
}
fs.writeFileSync(`${dir}/vectors.json`, JSON.stringify(out, null, 1));
