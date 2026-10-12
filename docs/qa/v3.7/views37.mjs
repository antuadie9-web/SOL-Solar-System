// SOL v3.7 view matrix (spec §33–37). `bf` views: see golden37.mjs. SHOW = Saturn showcase epoch offset (+2190 d ≈ 2032-10,
// ring opening ≈ 20°+; at the 2026-10-08 base epoch Saturn is only ~1.5 yr past ring-plane crossing and its rings are dim
// and nearly edge-on to the Sun — captured too, as `sat-epoch2026`).
const SHOW = 2190;
const S = (name, bf, x = {}) => [name, 'saturn', { jdOff: SHOW, bf, ...x }];
const B = (name, id, bf, x = {}) => [name, id, { bf, ...x }];
export const RINGS = [
  S('sat-overview', { r: 700000, el: 22, az: 35 }), S('sat-overview-sci', { r: 700000, el: 22, az: 35 }, { mode: 'scientific' }), S('sat-overview-cin', { r: 700000, el: 22, az: 35 }, { mode: 'cinematic' }),
  S('sat-sunlit-oblique', { r: 380000, el: 18, az: 25 }), S('sat-backlit', { r: 450000, el: -9, az: 165 }), S('sat-backlit-sci', { r: 450000, el: -9, az: 165 }, { mode: 'scientific' }), S('sat-eclipse', { r: 450000, antiSun: true }),
  S('sat-edgeon', { r: 600000, el: 0.12, az: 70 }), S('sat-polar', { r: 750000, el: 88, az: 0 }),
  S('sat-ringshadow-on-planet', { r: 230000, el: 14, az: 10, fov: 40 }), S('sat-planetshadow-on-rings', { r: 450000, el: 32, az: 150 }),
  S('sat-regions-labelled', { r: 380000, el: 24, az: 50 }, { ui: true, set: { ringLabels: true } }),
  S('sat-cassini-division', { p: [119900, -26000, 9000], at: [119900, 0, 0], fov: 40 }),
  S('sat-encke-keeler', { p: [134000, -3500, 1200], at: [134800, 0, 0], fov: 30 }),
  S('sat-A-close', { p: [128000, -2500, 500], at: [128000, 0, 0], fov: 50 }), S('sat-B-close', { p: [104000, -2500, 500], at: [104000, 0, 0], fov: 50 }), S('sat-C-close', { p: [84000, -2500, 500], at: [84000, 0, 0], fov: 50 }),
  S('sat-dense-vs-sparse', { p: [92000, -9000, 2500], at: [92000, 0, 0], fov: 55 }),
  S('sat-F-ring', { p: [140180, -4000, 900], at: [140180, 0, 0], fov: 30 }),
  S('sat-nearfield-A', { p: [128000, 0, 0.03], at: [128000, 0.25, -0.01], fov: 60, frames: 8 }), S('sat-nearfield-B', { p: [104000, 0, 0.03], at: [104000, 0.25, -0.01], fov: 60, frames: 8 }),
  S('sat-particle-crop', { p: [104000, 0, 0.012], at: [104000, 0.04, -0.004], fov: 30, frames: 8 }),
  S('sat-distant-30Mkm', { r: 3e7, el: 22, az: 35, fov: 20 }), S('sat-distant-300Mkm', { r: 3e8, el: 22, az: 35, fov: 5 }),
  ['sat-epoch2026', 'saturn', { bf: { r: 700000, el: 22, az: 35 } }], ['sat-epoch2026-backlit', 'saturn', { bf: { r: 450000, el: -9, az: 165 } }],
  // Jupiter (2026-10-08)
  B('jup-overview', 'jupiter', { r: 900000, el: 12, az: 40 }), B('jup-overview-sci', 'jupiter', { r: 900000, el: 12, az: 40 }, { mode: 'scientific' }),
  B('jup-backlit', 'jupiter', { r: 700000, antiSun: true, fov: 60 }), B('jup-backlit-sci', 'jupiter', { r: 700000, antiSun: true, fov: 60 }, { mode: 'scientific' }), B('jup-forward-scatter', 'jupiter', { r: 700000, el: -2, az: 172, fov: 60 }),
  B('jup-edgeon', 'jupiter', { r: 800000, el: 0.05, az: 110 }), B('jup-halo-close', 'jupiter', { p: [108000, -70000, 22000], at: [108000, 0, 0], fov: 60 }),
  B('jup-main-ring-close', 'jupiter', { p: [126000, -14000, 3500], at: [126000, 0, 0], fov: 45 }), B('jup-gossamer', 'jupiter', { p: [205000, -160000, 45000], at: [180000, 0, 0], fov: 65 }),
  B('jup-regions-labelled', 'jupiter', { r: 700000, el: 12, az: 40 }, { ui: true, set: { ringLabels: true } }),
  // Uranus
  B('ura-overview', 'uranus', { r: 260000, el: 28, az: 30 }), B('ura-overview-sci', 'uranus', { r: 260000, el: 28, az: 30 }, { mode: 'scientific' }), B('ura-polar', 'uranus', { r: 300000, el: 86 }),
  B('ura-oblique', 'uranus', { r: 200000, el: 14, az: 70 }), B('ura-backlit', 'uranus', { r: 260000, antiSun: true }), B('ura-epsilon-close', 'uranus', { p: [51149, -3500, 900], at: [51149, 0, 0], fov: 40 }),
  B('ura-narrow-rings', 'uranus', { p: [45500, -14000, 4500], at: [45500, 0, 0], fov: 45 }), B('ura-diffuse-mu-nu', 'uranus', { r: 450000, el: 20, az: 40 }),
  B('ura-regions-labelled', 'uranus', { r: 220000, el: 28, az: 30 }, { ui: true, set: { ringLabels: true } }),
  // Neptune
  B('nep-overview', 'neptune', { r: 250000, el: 25, az: 30 }), B('nep-overview-sci', 'neptune', { r: 250000, el: 25, az: 30 }, { mode: 'scientific' }), B('nep-polar-arcs', 'neptune', { r: 200000, el: 84 }),
  B('nep-edgeon', 'neptune', { r: 250000, el: 0.1, az: 80 }), B('nep-backlit', 'neptune', { r: 250000, antiSun: true }), B('nep-oblique', 'neptune', { r: 160000, el: 14, az: 60 }),
  B('nep-adams-close', 'neptune', { p: [62933, -9000, 2500], at: [62933, 0, 0], fov: 45 }), B('nep-regions-labelled', 'neptune', { r: 200000, el: 25, az: 30 }, { ui: true, set: { ringLabels: true } }),
  // minor ring-bearing bodies
  B('chariklo-rings', 'chariklo', { r: 2400, el: 32, az: 30 }), B('chariklo-oblique', 'chariklo', { r: 1600, el: 12, az: 60 }), B('chariklo-edgeon', 'chariklo', { r: 2400, el: 0.2, az: 60 }), B('chariklo-labelled', 'chariklo', { r: 2400, el: 32, az: 30 }, { ui: true, set: { ringLabels: true } }),
  B('haumea-ring', 'haumea', { r: 11000, el: 30, az: 30 }), B('haumea-edgeon', 'haumea', { r: 11000, el: 0.2, az: 60 }), B('haumea-labelled', 'haumea', { r: 11000, el: 30, az: 30 }, { ui: true, set: { ringLabels: true } }),
  B('quaoar-rings', 'quaoar', { r: 17000, el: 30, az: 30 }), B('quaoar-edgeon', 'quaoar', { r: 17000, el: 0.2, az: 60 }), B('quaoar-labelled', 'quaoar', { r: 17000, el: 30, az: 30 }, { ui: true, set: { ringLabels: true } }),
];
// atmospheres: 13 bodies × (day, terminator, night/backlit, pole, limb, sci, cin)
const AT = [['mercury', 2439], ['venus', 6052], ['earth', 6378], ['mars', 3396], ['jupiter', 71492], ['saturn', 60268], ['uranus', 25559], ['neptune', 24764], ['titan', 2575], ['triton', 1353], ['pluto', 1188], ['io', 1822], ['enceladus', 252]];
const MINOR = ['mercury', 'io', 'enceladus', 'triton', 'pluto'];   // reduced set: day, backlit, limb, sci
export const ATMOS = AT.flatMap(([id, R]) => MINOR.includes(id) ? [
  B(`${id}-day`, id, { r: R * 3.4, el: 12, az: 25 }), B(`${id}-backlit`, id, { r: R * 3.4, antiSun: true }), B(`${id}-limb`, id, { p: [R * 1.02, -R * 0.55, R * 0.05], at: [R * 0.6, R * 0.6, 0], fov: 50 }), B(`${id}-day-sci`, id, { r: R * 3.4, el: 12, az: 25 }, { mode: 'scientific' }),
] : [
  B(`${id}-day`, id, { r: R * 3.4, el: 12, az: 25 }), B(`${id}-terminator`, id, { r: R * 3.4, el: 8, az: 95 }), B(`${id}-backlit`, id, { r: R * 3.4, antiSun: true }),
  B(`${id}-pole`, id, { r: R * 3.4, el: 80, az: 30 }), B(`${id}-limb`, id, { p: [R * 1.02, -R * 0.55, R * 0.05], at: [R * 0.6, R * 0.6, 0], fov: 50 }),
  B(`${id}-day-sci`, id, { r: R * 3.4, el: 12, az: 25 }, { mode: 'scientific' }),
  ...(['venus', 'earth', 'mars', 'jupiter', 'titan'].includes(id) ? [B(`${id}-day-cin`, id, { r: R * 3.4, el: 12, az: 25 }, { mode: 'cinematic' })] : []),
]);
export const ATMOS_CLOSE = [
  ['venus-cloudtop-flight', 'venus', { altKm: 120, look: 1.25 }], ['jupiter-cloudtop-flight', 'jupiter', { altKm: 900, look: 1.25 }], ['saturn-cloudtop-flight', 'saturn', { altKm: 1500, look: 1.25 }],
  ['uranus-cloudtop-flight', 'uranus', { altKm: 500, look: 1.25 }], ['neptune-cloudtop-flight', 'neptune', { altKm: 450, look: 1.25 }], ['titan-low-altitude', 'titan', { altKm: 40, look: 1.3 }],
  ['pluto-haze-backlit', 'pluto', { bf: { r: 1188 * 2.6, antiSun: true, fov: 60 } }], ['triton-limb-backlit', 'triton', { bf: { r: 1353 * 2.6, antiSun: true, fov: 60 } }], ['enceladus-plume-backlit', 'enceladus', { bf: { r: 252 * 6, antiSun: true, fov: 50 } }], ['io-plumes-limb', 'io', { bf: { r: 1822 * 2.4, el: 0, az: 90, fov: 50 } }],
  ['earth-sunset-limb', 'earth', { bf: { p: [6378 + 380, 0, 0], at: [6378 * 0.4, 6378 * 1.4, 0], fov: 60 } }],
];
// ordered frame sequences (spec §37) — names *_fNN
const pad = (i) => String(i).padStart(2, '0');
const lodH = [2e6, 3e5, 6e4, 1.2e4, 2500, 500, 100, 20, 4, 0.8, 0.15];
const zs = [3, 0.6, 0.12, 0.03, 0.008, -0.008, -0.03, -0.12, -0.6, -3];
export const SEQ = [
  ...lodH.map((h, i) => S(`seq-ring-lod_f${pad(i)}`, { p: [128000 - h * 1.2, -h * 1.5, h], at: [128000, 0, 0], fov: 55, frames: 6 })),
  ...zs.map((z, i) => S(`seq-ring-plane-traverse_f${pad(i)}`, { p: [128000, 0, z], at: [128000, 1.0, z * 0.2 - 0.002], fov: 70, frames: 6 })),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ['seq-neptune-arcs_f' + pad(i), 'neptune', { jdOff: i * 0.05, bf: { r: 200000, el: 84 } }]),
  ...[0, 1, 2, 3, 4, 5].map(i => ['seq-jupiter-rotation_f' + pad(i), 'jupiter', { jdOff: i * 0.05, bf: { r: 300000, el: 5, az: 30 } }]),
  ...[0, 1, 2, 3].map(i => ['seq-earth-cloud-rotation_f' + pad(i), 'earth', { jdOff: i * 0.04, bf: { r: 20000, el: 15, az: 20 } }]),
  ...[96, 92, 88, 84].map((a, i) => ['seq-earth-terminator-sweep_f' + pad(i), 'earth', { bf: { r: 20000, el: 5, az: a } }]),
];
// terrain descent / return sequences (Hadley Rille, Jezero) — same site placement as golden36, decreasing altitude
const site = (lat, lon, sunEl, rel, down) => (alt) => ({ site: { lat, lon, alt, sunEl, rel, down, span: lat > 20 && lon < 10 ? 30 : 1.03, step: lat > 20 && lon < 10 ? 0.25 : 0.01 } });
const had = site(26.1, 3.65, 9, 80, 0.22), jez = site(18.4, 77.5, 14, 200, 0.3), alts = [400, 60, 10, 2, 0.4];
export const TERRAIN = [
  ...alts.map((a, i) => [`seq-hadley-descent_f${pad(i)}`, 'moon', had(a)]), ...alts.map((a, i) => [`seq-jezero-descent_f${pad(i)}`, 'mars', jez(a)]),
  ['moon-hadley-ground', 'moon', had(0.05)], ['mars-jezero-ground', 'mars', jez(0.05)], ['moon-hadley-lowsun', 'moon', site(26.1, 3.65, 3, 80, 0.15)(2)],
  ['mars-jezero-12km', 'mars', jez(12)], ['moon-orbit-hadley', 'moon', { radii: 1.6 }], ['mars-orbit-jezero', 'mars', { radii: 1.6 }],
];
export const V37 = [...RINGS, ...ATMOS, ...ATMOS_CLOSE, ...SEQ, ...TERRAIN];
