// SOL v3.8 view matrix: far-Sun regimes (spec §18, §52), lighting, galactic sky, moons. Distances are test samples only.
const AU = 149597870.7, PC = 3.0856775814913673e13;
export const SUN_DIST = [0.05, 0.2, 1, 5, 30, 100, 1000, 10000, 63241];   // AU (63241 AU = 1 ly)
const pad = (x) => String(x).replace('.', 'p');
export const SUNFAR = [
  ...SUN_DIST.map(a => [`sunfar-${pad(a)}AU`, 'sun', { sunAt: { km: a * AU, fov: 50 } }]),
  ...[1, 30, 1000].map(a => [`sunfar-${pad(a)}AU-sci`, 'sun', { mode: 'scientific', sunAt: { km: a * AU, fov: 50 } }]),
  ...[1, 30, 1000].map(a => [`sunfar-${pad(a)}AU-cin`, 'sun', { mode: 'cinematic', sunAt: { km: a * AU, fov: 50 } }]),
  ['sunfar-1pc', 'sun', { sunAt: { km: PC, fov: 50 } }],
  ['sunfar-proxima-dist', 'sun', { sunAt: { km: 1.3020 * PC, fov: 50 } }],
  ['sunfar-30AU-off', 'sun', { sunAt: { km: 30 * AU, fov: 50, offDeg: 15 } }],
];
// transition sequence across apparent-size boundaries (log-spaced 0.3 AU … 3000 AU)
export const SUNSEQ = Array.from({ length: 16 }, (_, i) => { const a = 0.3 * Math.pow(10, i * 4 / 15); return [`seq-sunfar_f${String(i).padStart(2, '0')}`, 'sun', { sunAt: { km: a * AU, fov: 50 } }]; });
// v3.7.1 plume geometry checks (physical vs labelled enhancement) and Uranian eccentric rings
export const PLUMES = [
  // v3.8 QA: at the reference epoch Io is inside Jupiter's umbra for this geometry (sunVis 0 — plumes unlit, a wasted view);
  // +0.9 d (≈ half an Io orbit) puts it in sunlight.
  ['io-plumes-highphase', 'io', { jdOff: 0.9, bf: { r: 1822 * 2.4, el: 2, az: 160, fov: 50 } }], ['io-plumes-highphase-sci', 'io', { jdOff: 0.9, mode: 'scientific', bf: { r: 1822 * 2.4, el: 2, az: 160, fov: 50 } }],
  ['io-plumes-limb-sci', 'io', { mode: 'scientific', bf: { r: 1822 * 2.4, el: 0, az: 90, fov: 50 } }],
  ['enceladus-plume-161', 'enceladus', { bf: { r: 252 * 6, el: -12, az: 161, fov: 50 } }], ['enceladus-plume-161-sci', 'enceladus', { mode: 'scientific', bf: { r: 252 * 6, el: -12, az: 161, fov: 50 } }],
  ['enceladus-plume-backlit-sci', 'enceladus', { mode: 'scientific', bf: { r: 252 * 6, antiSun: true, fov: 50 } }],
  // diagnostics for the thin vertical line in enceladus-plume-161: guides off / plumes off
  ['enceladus-plume-161-noguides', 'enceladus', { set: { orbits: false }, bf: { r: 252 * 6, el: -12, az: 161, fov: 50 } }],
  ['enceladus-plume-161-noplumes', 'enceladus', { set: { plumes: false }, bf: { r: 252 * 6, el: -12, az: 161, fov: 50 } }],
];
const pad2 = (i) => String(i).padStart(2, '0');
export const URANUS = [0, 1, 2, 3].map(i => ['seq-ura-epsilon-precession_f' + pad2(i), 'uranus', { jdOff: i * 66, bf: { r: 140000, el: 86, az: 0, fov: 50 } }]);
// v3.7.1 minor-moon identity (measured dimensions/albedo/colour vs class priors); ids 'sat<NAIF>' for JPL-table moons
const M = (name, id, R) => [`moon-${name}`, id, { bf: { r: R * 3.4, el: 12, az: 25, fov: 50 } }];
export const MOONS = [M('pan', 'sat618', 17.3), M('atlas', 'sat615', 20.4), M('prometheus', 'sat616', 68.5), M('pandora', 'sat617', 51.5), M('janus', 'sat610', 101.7), M('epimetheus', 'sat611', 64.8),
  M('helene', 'sat612', 22.6), M('methone', 'sat632', 1.94), M('thebe', 'sat514', 58), M('metis', 'sat516', 30), M('amalthea', 'amalthea', 125), M('himalia', 'sat506', 75),
  M('puck', 'sat715', 81), M('larissa', 'sat807', 108), M('proteus', 'proteus', 212), M('nix', 'sat902', 24.9), M('hydra', 'sat903', 25.5), M('kiviuq', 'sat624', 19), M('sycorax', 'sat717', 80), M('phoebe', 'phoebe', 110)];
// v3.8 interstellar journey frames (Solar System → distant Sun → Proxima → return) are captured by journey38.mjs
// v3.8 Io plume visibility: Pele (330 km umbrella) and Tvashtar placed exactly on the limb, camera 4,000 km beyond the vent
PLUMES.push(...[0.45, 0.9].flatMap(j => [[`io-pele-limb-t${String(j).replace('.', 'p')}`, 'io', { jdOff: j, vent: { lat: -18.7, lon: 104.7, r: 4000, fov: 40 } }], [`io-pele-limb-t${String(j).replace('.', 'p')}-sci`, 'io', { jdOff: j, mode: 'scientific', vent: { lat: -18.7, lon: 104.7, r: 4000, fov: 40 } }]]),
  ['io-tvashtar-limb', 'io', { vent: { lat: 62.8, lon: 236.0, r: 4000, fov: 40 } }]);
// diagnostics for the radial streaks seen behind Prometheus (guides vs ring rendering)
MOONS.push(['moon-pan-norings', 'sat618', { set: { rings: false }, bf: { r: 17.3 * 3.4, el: 12, az: 25, fov: 50 } }], ['moon-prometheus-noorbits', 'sat616', { set: { orbits: false }, bf: { r: 68.5 * 3.4, el: 12, az: 25, fov: 50 } }], ['moon-prometheus-norings', 'sat616', { set: { rings: false }, bf: { r: 68.5 * 3.4, el: 12, az: 25, fov: 50 } }]);
export const V38 = [...SUNFAR, ...SUNSEQ, ...PLUMES, ...URANUS, ...MOONS];

// v3.8 Galactic sky views (spec §53): camera at a heliocentric position, looking along a direction given in ICRS (RA/Dec) or
// Galactic (l, b), converted to ecliptic J2000 here (IAU 2006 obliquity; Hipparcos ICRS→Galactic matrix).
const D2R = Math.PI / 180, EPS = 23.4392794444 * D2R;
const icrsToEcl = (v) => [v[0], Math.cos(EPS) * v[1] + Math.sin(EPS) * v[2], -Math.sin(EPS) * v[1] + Math.cos(EPS) * v[2]];
const radec = (ra, de) => icrsToEcl([Math.cos(de * D2R) * Math.cos(ra * D2R), Math.cos(de * D2R) * Math.sin(ra * D2R), Math.sin(de * D2R)]);
const G = [[-0.0548755604162154, -0.8734370902348850, -0.4838350155487132], [0.4941094278755837, -0.4448296299600112, 0.7469822444972189], [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669]];
const galDir = (l, b) => { const g = [Math.cos(b * D2R) * Math.cos(l * D2R), Math.cos(b * D2R) * Math.sin(l * D2R), Math.sin(b * D2R)]; return icrsToEcl([0, 1, 2].map(i => G[0][i] * g[0] + G[1][i] * g[1] + G[2][i] * g[2])); };
const PC_KM = 3.0856775814913673e13, aCen = radec(219.9, -60.83);
const perp = (() => { const z = [0, 0, 1], c = [aCen[1] * z[2] - aCen[2] * z[1], aCen[2] * z[0] - aCen[0] * z[2], aCen[0] * z[1] - aCen[1] * z[0]], n = Math.hypot(...c); return c.map(x => x / n); })();
export const GALSKY = [
  ['gal-plane-centre', 'sun', { sunAt: { km: 1.496e8, elDeg: 20, lookDir: galDir(0, 0), fov: 70 } }],
  ['gal-plane-centre-sci', 'sun', { mode: 'scientific', sunAt: { km: 1.496e8, elDeg: 20, lookDir: galDir(0, 0), fov: 70 } }],
  ['gal-plane-anticentre', 'sun', { sunAt: { km: 1.496e8, elDeg: 20, lookDir: galDir(180, 0), fov: 70 } }],
  ['gal-high-latitude-ngp', 'sun', { sunAt: { km: 1.496e8, elDeg: 20, lookDir: galDir(0, 90), fov: 70 } }],
  ['gal-parallax-acen-from-sun', 'sun', { ui: true, set: { orbits: false }, sunAt: { km: 1.496e8, dir: aCen, lookDir: aCen, fov: 60 } }],
  ['gal-parallax-acen-from-0p3pc-side', 'sun', { ui: true, set: { orbits: false }, sunAt: { km: 0.3 * PC_KM, dir: perp, lookDir: aCen, fov: 60 } }],
];
V38.push(...GALSKY);
