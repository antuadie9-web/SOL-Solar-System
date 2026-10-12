import { SolarSystem } from '../src/astro/system';
import { jdFromCalendar, utcToTT } from '../src/astro/time';
import { sub, len, dot, norm, mulMtV, scale } from '../src/astro/vec';
import { AU, RAD } from '../src/astro/constants';
import sats from '../public/assets/data/satellites.json';
import feat from '../public/assets/data/featured.json';
import { jupitermoons, julian } from 'astronomia';
const S = new SolarSystem(sats as any, feat as any);
const at = (y: number, m: number, d: number, h = 0) => { const ut = jdFromCalendar(y, m, d, h); S.update(utcToTT(ut), ut); return ut; };
const g = (id: string) => S.get(id)!;
const ang = (a: number[], b: number[]) => Math.acos(dot(norm(a as any), norm(b as any))) * RAD;
at(2026, 1, 3, 17); console.log('Earth perihelion 2026-01-03 17h r=', (len(g('earth').pos) / AU).toFixed(6), '(JPL 0.983301)');
// subsolar latitude at equinox: sun direction in Earth body-fixed frame
for (const [y, m, d, h, lbl] of [[2026, 3, 20, 14.75, 'equinox'], [2026, 6, 21, 8.4, 'solstice']] as any) {
  at(y, m, d, h); const e = g('earth'); const s = mulMtV(e.rot, norm(scale(e.pos, -1)));
  console.log(lbl, 'subsolar lat', (Math.asin(s[2]) * RAD).toFixed(3), 'lon', (Math.atan2(s[1], s[0]) * RAD).toFixed(2));
}
at(2026, 3, 20, 12); { const e = g('earth'); const s = mulMtV(e.rot, norm(scale(e.pos, -1))); console.log('2026-03-20 12:00 UT subsolar lon (expect ≈ -1.9° from EoT -7.5min)', (Math.atan2(s[1], s[0]) * RAD).toFixed(2)); }
at(2026, 3, 3, 11.6); { const e = g('earth'), m = g('moon'); console.log('full moon 2026-03-03 11:38 elong', ang(sub(m.pos, e.pos), sub(e.pos, [0,0,0] as any)).toFixed(2), 'dist', len(sub(m.pos, e.pos)).toFixed(0)); }
at(2026, 8, 12, 17.8); { const e = g('earth'), m = g('moon'); console.log('eclipse 2026-08-12 sun-moon sep', ang(sub(m.pos, e.pos), scale(e.pos, -1)).toFixed(3)); }
at(2020, 12, 21, 18); { const e = g('earth'); console.log('Jup-Sat conj sep', ang(sub(g('jupiter').pos, e.pos), sub(g('saturn').pos, e.pos)).toFixed(3), '(actual 0.102)'); }
at(2027, 2, 19); { const e = g('earth'), ma = g('mars'); console.log('Mars opp 2027-02-19 dist AU', (len(sub(ma.pos, e.pos)) / AU).toFixed(4)); }
// Galilean check vs Meeus ch.44 (astronomia jupitermoons.e5 high accuracy): apparent X offsets in Jupiter radii
{ const ut = at(2026, 10, 7, 0); const jde = utcToTT(ut);
  const pos = jupitermoons.positions(jde); const e = g('earth'), j = g('jupiter');
  const los = norm(sub(j.pos, e.pos));
  // sky basis: north = ecliptic-ish, use Jupiter pole projected
  const pole = [j.rot[2], j.rot[5], j.rot[8]] as any;
  const xw = norm([los[1] * pole[2] - los[2] * pole[1], los[2] * pole[0] - los[0] * pole[2], los[0] * pole[1] - los[1] * pole[0]] as any);
  for (const [k, id] of [[0, 'io'], [1, 'europa'], [2, 'ganymede'], [3, 'callisto']] as any) {
    const rel = sub(g(id).pos, j.pos); const X = -dot(rel as any, xw) / 71492;
    console.log(id, 'model X', X.toFixed(2), ' Meeus X', pos[k].x.toFixed(2));
  }
}
{ at(2026, 10, 7); console.log('3I/ATLAS r AU', (len(g('atlas3i').pos)/AU).toFixed(3), 'Halley r', (len(g('halley').pos)/AU).toFixed(2), 'Pluto-Charon sep', len(sub(g('charon').pos, g('pluto').pos)).toFixed(0), 'bodies', S.bodies.length); }
{ at(2025, 3, 23, 12); const e = g('earth'), s = g('saturn'); const pole = [s.rot[2], s.rot[5], s.rot[8]] as any; const v = norm(sub(e.pos, s.pos)); console.log('Saturn ring tilt 2025-03-23', (Math.asin(dot(pole, v)) * RAD).toFixed(3)); }
