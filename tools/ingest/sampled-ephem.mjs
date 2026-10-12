// Build the "sampled" ephemeris tier: JPL Horizons geometric state vectors (ICRF, J2000 ecliptic, TDB) on a fixed grid,
// interpolated at runtime by two-sided two-body ("Kepler-blend") propagation (src/astro/sampled.ts).
// Output: public/assets/data/ephem/<system>.bin + public/assets/data/ephem/manifest.json (provenance, steps, measured error).
// Usage: node tools/ingest/sampled-ephem.mjs [systemFilter] && node tools/ingest/ephem-edges.mjs
import fs from 'node:fs';
const START = 2451544.5, STOP = 2469807.5; // 2000-01-01.0 → 2050-01-01.0 TDB
// [id, horizons command, center, stepDays, GM_center + GM_body (km³/s²)]
const SYSTEMS = {
  planets: [['mercury', '199', '500@10', 1, 1.32712440041e11 + 22031.87], ['venus', '299', '500@10', 2, 1.32712440041e11 + 324858.59], ['earth-bary', '3', '500@10', 2, 1.32712440041e11 + 398600.44 + 4902.80],
    ['mars', '499', '500@10', 2, 1.32712440041e11 + 42828.38], ['jupiter-bary', '5', '500@10', 8, 1.32712440041e11 + 126712764.1], ['saturn-bary', '6', '500@10', 8, 1.32712440041e11 + 37940585.2],
    ['uranus-bary', '7', '500@10', 16, 1.32712440041e11 + 5794556.4], ['neptune-bary', '8', '500@10', 16, 1.32712440041e11 + 6836527.1]],
  mars: [['phobos', '401', '500@499', 0.25, 42828.375214 + 0.0007087], ['deimos', '402', '500@499', 1, 42828.375214 + 0.000096]],
  jupiter: [['io', '501', '500@599', 0.25, 126686531.9 + 5959.916], ['europa', '502', '500@599', 0.5, 126686531.9 + 3202.739], ['ganymede', '503', '500@599', 1, 126686531.9 + 9887.834], ['callisto', '504', '500@599', 2, 126686531.9 + 7179.289]],
  saturn: [['mimas', '601', '500@699', 0.25, 37931206.234 + 2.503], ['enceladus', '602', '500@699', 0.25, 37931206.234 + 7.211], ['tethys', '603', '500@699', 0.5, 37931206.234 + 41.21], ['dione', '604', '500@699', 0.5, 37931206.234 + 73.11],
    ['rhea', '605', '500@699', 1, 37931206.234 + 153.94], ['titan', '606', '500@699', 1, 37931206.234 + 8978.14], ['hyperion', '607', '500@699', 2, 37931206.234 + 0.37], ['iapetus', '608', '500@699', 4, 37931206.234 + 120.52], ['phoebe', '609', '500@699', 8, 37931206.234 + 0.55]],
  uranus: [['miranda', '705', '500@799', 0.25, 5793951.3 + 4.3], ['ariel', '701', '500@799', 0.5, 5793951.3 + 83.46], ['umbriel', '702', '500@799', 0.5, 5793951.3 + 85.09], ['titania', '703', '500@799', 1, 5793951.3 + 226.94], ['oberon', '704', '500@799', 1, 5793951.3 + 205.32]],
  neptune: [['triton', '801', '500@899', 1, 6835099.5 + 1428.5], ['nereid', '802', '500@899', 8, 6835099.5 + 2.06], ['proteus', '808', '500@899', 0.25, 6835099.5 + 2.58]],
  pluto: [['pluto-bary', '9', '500@10', 10, 1.32712440041e11 + 975.5], ['charon', '901', '500@999', 0.5, 869.3 + 106.1], ['nix', '902', '500@9', 2, 975.5], ['hydra', '903', '500@9', 2, 975.5]],
  comets: [['halley', 'DES=1P;CAP', '500@10', 2, 1.32712440041e11], ['encke', 'DES=2P;CAP', '500@10', 1, 1.32712440041e11], ['cg67p', 'DES=67P;CAP', '500@10', 1, 1.32712440041e11]],
};
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchRange(cmd, center, a, b, step) {
  const stepStr = step >= 1 ? `${step}d` : `${Math.round(step * 24)}h`;
  const p = new URLSearchParams({ format: 'json', COMMAND: `'${cmd}'`, OBJ_DATA: 'NO', EPHEM_TYPE: 'VECTORS', CENTER: `'${center}'`, START_TIME: `'JD${a}'`, STOP_TIME: `'JD${b}'`, STEP_SIZE: `'${stepStr}'`,
    TIME_TYPE: 'TDB', REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF', VEC_TABLE: '2', VEC_CORR: 'NONE', OUT_UNITS: 'KM-S', CSV_FORMAT: 'YES' });
  for (let k = 0; k < 6; k++) {
    try {
      const r = await fetch(`${API}?${p}`); const t = await r.text();
      if (!r.ok || t.startsWith('<')) { await sleep(3000 * (k + 1)); continue; }
      const j = JSON.parse(t); const body = j.result.split('$$SOE')[1]?.split('$$EOE')[0];
      if (!body) throw new Error(j.result.slice(0, 600));
      return { rows: body.trim().split('\n').map(l => l.split(',').map(s => s.trim())).map(c => [+c[0], +c[2], +c[3], +c[4], +c[5], +c[6], +c[7]]), ver: j.signature?.version };
    } catch (e) { if (k === 5) throw e; await sleep(3000 * (k + 1)); }
  }
}
const only = process.argv[2];
const dir = 'public/assets/data/ephem'; fs.mkdirSync(dir, { recursive: true });
const manPath = `${dir}/manifest.json`;
const man = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : { format: 'SOL sampled ephemeris v1', frame: 'ICRF / J2000 ecliptic, geometric (VEC_CORR=NONE), km & km/s, TDB', source: API, interpolation: 'two-sided two-body propagation blended with smoothstep weight (src/astro/sampled.ts)', systems: {} };
for (const [sys, list] of Object.entries(SYSTEMS)) {
  if (only && sys !== only) continue;
  const bodies = []; const chunks = [];
  let offset = 0;
  for (const [id, cmd, center, step, mu] of list) {
    const n = Math.round((STOP - START) / step) + 1, maxRows = 60000, rows = [];
    for (let i = 0; i < n; i += maxRows) {
      const a = START + i * step, b = START + Math.min(n - 1, i + maxRows - 1) * step;
      const r = await fetchRange(cmd, center, a, b, step); rows.push(...r.rows); await sleep(400);
    }
    if (rows.length !== n) throw new Error(`${id}: expected ${n} rows, got ${rows.length}`);
    const P = new Float64Array(n * 3), V = new Float32Array(n * 3);
    rows.forEach((r, k) => { P.set([r[1], r[2], r[3]], k * 3); V.set([r[4], r[5], r[6]], k * 3); });
    const pad = (8 - ((offset + P.byteLength + V.byteLength) % 8)) % 8;
    chunks.push(Buffer.from(P.buffer), Buffer.from(V.buffer), Buffer.alloc(pad));
    bodies.push({ id, command: cmd, center, t0: START, step, n, mu, posOffset: offset, velOffset: offset + P.byteLength });
    offset += P.byteLength + V.byteLength + pad;
    console.log(sys, id, n, 'rows');
  }
  fs.writeFileSync(`${dir}/${sys}.bin`, Buffer.concat(chunks));
  man.systems[sys] = { file: `${sys}.bin`, bytes: offset, fetched: new Date().toISOString(), window: [START, STOP], bodies };
  fs.writeFileSync(manPath, JSON.stringify(man, null, 1));
}
