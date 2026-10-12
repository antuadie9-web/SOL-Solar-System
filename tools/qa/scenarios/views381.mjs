// SOL v3.8.1 Gate 1/2 view matrix (WP-A exposure continuity, WP-B stars, WP-C Galactic sky, WP-D Sun distances).
// Same harness as golden38 (`sunAt` camera kinds). Software-WebGPU captures prove function and composition, not the final
// hardware look. Distances/angles are test samples only.
const AU = 149597870.7, PC = 3.0856775814913673e13;
const pad = (x) => String(x).replace('.', 'p');
// A1 — Sun sweeping across the right frame edge (16:9, vFOV 50° → half-hFOV 39.6°) at 1 AU and 30 AU: the sky must not
// collapse when the Sun's centre crosses the edge (EXP-381-01).
export const EXPSWEEP = [1, 30].flatMap(a => [0, 20, 34, 38, 41, 45, 52, 65, 90].map(o => [`exp-sweep-${pad(a)}AU-off${o}`, 'sun', { sunAt: { km: a * AU, fov: 50, offDeg: o } }]));
// D — Sun distance ladder incl. the owner's problem views (Mercury ≈ 0.39, Earth 1, Mars 1.52 AU) at two FOVs
export const SUNLADDER = [0.3, 0.39, 1, 1.52, 5, 10, 30, 100, 1000, 3000].flatMap(a => [[`sun-ladder-${pad(a)}AU-f50`, 'sun', { sunAt: { km: a * AU, fov: 50 } }], [`sun-ladder-${pad(a)}AU-f20`, 'sun', { sunAt: { km: a * AU, fov: 20 } }]]);
export const V381 = [...EXPSWEEP, ...SUNLADDER];
