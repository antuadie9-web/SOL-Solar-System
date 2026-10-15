import { buildLUTs, buildSkyIrradiance, physicalFrom, sampleT, aeroDensity, extinction, aeroScatter } from '../../src/render/atmoModel';
import { CATALOG } from '../../src/data/catalog';
import fs from 'node:fs';
const ti = CATALOG.find(b => b.id === 'titan')!; const A = physicalFrom(ti.atmo as any, ti.radius); const L = buildLUTs(A);
const sky = buildSkyIrradiance(A, L, 96);
for (const mus of [1, 0.5]) { const i = Math.round((mus + 0.2) / 1.2 * 31); const Td = sampleT(A, L.T, A.Rg, mus);
  console.log('mus', mus, 'direct', Td.map(x => (x * mus).toExponential(2)), 'sky E', [0, 1, 2].map(k => sky[i * 4 + k].toFixed(4))); }
const rows = []; for (let h = 0; h <= 750; h += 1) { const e = extinction(A, h); const r = Math.exp(-h / A.rayleigh.H);
  rows.push({ h, ext: e, ray: [0, 1, 2].map(k => A.rayleigh.scat[k] * r), aer: A.aerosols!.map(a => a.scat.map(x => x * aeroDensity(a.prof, h))) }); }
fs.writeFileSync('prof.json', JSON.stringify({ rows, g: A.aerosols!.map(a => a.g) }));
