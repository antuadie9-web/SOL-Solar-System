import { buildLUTs, physicalFrom, rayRadiance, aeroDensity, extinction } from '/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/exp/../src380/sol-solar-system-v3.8-final/src/render/atmoModel';
import { CATALOG } from '/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/exp/../src380/sol-solar-system-v3.8-final/src/data/catalog';
import { titanAerosols, TITAN_SSA } from '/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/exp/../src380/sol-solar-system-v3.8-final/src/data/titanAtmo';
import fs from 'node:fs';
const ti = CATALOG.find(b => b.id === 'titan')!; const A = physicalFrom(ti.atmo as any, ti.radius);
const ssa = JSON.parse(process.argv[2]); A.aerosols = titanAerosols({ ...TITAN_SSA, ...ssa });
const L = buildLUTs(A); const Lr = rayRadiance(A, L, [0, 0, A.Rt + 50], [0, 0, -1], [0, 0, 1], 80, 12);
console.log('model nadir I/F', Lr.map(x => (Math.PI * x).toFixed(4)));
const rows = []; for (let h = 0; h <= 750; h += 1) { const e = extinction(A, h); const r = Math.exp(-h / A.rayleigh.H);
  rows.push({ h, ext: e, ray: [0, 1, 2].map(k => A.rayleigh.scat[k] * r), aer: A.aerosols!.map(a => a.scat.map(x => x * aeroDensity(a.prof, h))) }); }
fs.writeFileSync('prof.json', JSON.stringify({ rows, g: A.aerosols!.map(a => a.g) }));
