// Rebuild the Uranus and Neptune "barycentre" tracks so they are consistent with the satellite ephemerides.
// Finding (R-008): Horizons' Uranus (799, source ura184_merged) differs from Uranus Barycenter (7, source DE441) by
// ≈360 km after removing the moon offsets — the two JPL solutions are not mutually consistent at that level. Moons are
// sampled relative to 799, so SOL derives a ura184-consistent barycentre: bary = r799 + Σ GMᵢ·rᵢ / GM_sys, using the
// moon tracks at the (aligned) grid nodes. Same for Neptune (nep097/nep105 vs DE441).
import fs from 'node:fs';
const dir = 'public/assets/data/ephem', man = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, 'utf8'));
const CFG = { uranus: { cmd: '799', planetGM: 5793951.3, moons: [['titania', 226.94], ['oberon', 205.32], ['umbriel', 85.09], ['ariel', 83.46], ['miranda', 4.3]] },
              neptune: { cmd: '899', planetGM: 6835099.5, moons: [['triton', 1428.5]] } };
const load = (sys) => { const b = fs.readFileSync(`${dir}/${man.systems[sys].file}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const planetsBuf = Buffer.from(load('planets'));
for (const [pid, cfg] of Object.entries(CFG)) {
  const meta = man.systems.planets.bodies.find(b => b.id === `${pid}-bary`);
  const p = new URLSearchParams({ format: 'json', COMMAND: `'${cfg.cmd}'`, OBJ_DATA: 'NO', EPHEM_TYPE: 'VECTORS', CENTER: "'500@10'", START_TIME: `'JD${meta.t0}'`, STOP_TIME: `'JD${meta.t0 + (meta.n - 1) * meta.step}'`, STEP_SIZE: `'${meta.step}d'`, TIME_TYPE: 'TDB', REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF', VEC_TABLE: '2', VEC_CORR: 'NONE', OUT_UNITS: 'KM-S', CSV_FORMAT: 'YES' });
  const j = await (await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + p)).json();
  const rows = j.result.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n').map(l => l.split(',').map(s => s.trim())).map(c => [+c[0], +c[2], +c[3], +c[4], +c[5], +c[6], +c[7]]);
  if (rows.length !== meta.n) throw new Error(`${pid}: ${rows.length} rows vs ${meta.n}`);
  const sysBuf = load(pid), sysMeta = man.systems[pid];
  const Mtot = cfg.planetGM + cfg.moons.reduce((a, [, g]) => a + g, 0);
  const P = new Float64Array(meta.n * 3), V = new Float32Array(meta.n * 3);
  rows.forEach((r, k) => {
    const pos = [r[1], r[2], r[3]], vel = [r[4], r[5], r[6]], jd = r[0];
    for (const [mid, gm] of cfg.moons) {
      const mm = sysMeta.bodies.find(b => b.id === mid); const idx = Math.round((jd - mm.t0) / mm.step);
      if (Math.abs(mm.t0 + idx * mm.step - jd) > 1e-6) throw new Error('grid misaligned ' + mid);
      const MP = new Float64Array(sysBuf, mm.posOffset, mm.n * 3), MV = new Float32Array(sysBuf, mm.velOffset, mm.n * 3);
      for (let c = 0; c < 3; c++) { pos[c] += gm / Mtot * MP[idx * 3 + c]; vel[c] += gm / Mtot * MV[idx * 3 + c]; }
    }
    P.set(pos, k * 3); V.set(vel, k * 3);
  });
  Buffer.from(P.buffer).copy(planetsBuf, meta.posOffset); Buffer.from(V.buffer).copy(planetsBuf, meta.velOffset);
  meta.derivation = `${cfg.cmd} (${j.result.match(/Target body name:.*\{source: ([^}]+)\}/)?.[1]}) + Σ GM·r_moon / GM_sys from SOL ${pid} tracks`;
  console.log(pid, 'rebuilt', meta.derivation);
}
fs.writeFileSync(`${dir}/planets.bin`, planetsBuf);
fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify(man, null, 1));
