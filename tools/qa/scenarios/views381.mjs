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
// D (checkpoint 2) — the owner's problem distances in Scientific and Cinematic, plus 3,000 AU at both FOVs
export const SUNMODES = [0.39, 1, 1.52].flatMap(a => ['scientific', 'cinematic'].map(m => [`sun-ladder-${pad(a)}AU-f50-${m.slice(0, 3)}`, 'sun', { mode: m, sunAt: { km: a * AU, fov: 50 } }]));
V381.push(...SUNMODES);
// G (checkpoint 2) — observed Cassini shape models (Saturnian small moons) and the rights-cleared Uranian maps
const MB = (name, id, R, el = 12, az = 25) => [`moon381-${name}`, id, { bf: { r: R * 3.4, el, az, fov: 50 } }];
export const MOONS381 = [MB('pan', 'sat618', 20.3), MB('atlas', 'sat615', 23.8), MB('prometheus', 'sat616', 71.4), MB('pandora', 'sat617', 56.2), MB('janus', 'sat610', 103.4),
  MB('epimetheus', 'sat611', 73.1), MB('helene', 'sat612', 20.5), MB('telesto', 'sat613', 16.3), MB('calypso', 'sat614', 15.3), MB('daphnis', 'sat635', 5.6), ['moon381-hyperion', 'hyperion', { bf: { r: 170 * 3.4, el: 12, az: 25, fov: 50 } }],
  ...['ariel', 'titania', 'oberon'].map(n => [`moon381-${n}-south`, n, { bf: { r: { ariel: 579, titania: 789, oberon: 761 }[n] * 3.2, el: -40, abs: true, az: 0, fov: 50 } }])];
// B (checkpoint 2) — resolved photosphere of Proxima Centauri (measured radius 0.1542 R☉) at two distances
export const XSTAR381 = [['xstar-proxima-40R', 'star:proxima-centauri', 40], ['xstar-proxima-8R', 'star:proxima-centauri', 8], ['xstar-proxima-8R-sci', 'star:proxima-centauri', { radii: 8, mode: 'scientific' }]];
V381.push(...MOONS381, ...XSTAR381);
// G2 (checkpoint 2 review) — Cassini-like phase (~70°) so the observed shape relief reads, and the Uranian moons at the
// Voyager 2 epoch (1986-01-24): in 2026 their southern hemispheres are in seasonal darkness, so a "now" view shows the night side.
const VOYAGER_JD = 2446454.5, NOW_JD = 2461322.0;   // 1986-01-24 0h TT; capture clock (2026-10-08)
export const MOONS381B = [['janus', 'sat610', 103.4], ['epimetheus', 'sat611', 73.1], ['prometheus', 'sat616', 71.4], ['pan', 'sat618', 20.3], ['atlas', 'sat615', 23.8], ['hyperion', 'hyperion', 170]]
  .map(([n, id, R]) => [`moon381-${n}-ph70`, id, { bf: { r: R * 3.4, el: 10, az: 70, fov: 50 } }]);
export const URANIAN1986 = ['ariel', 'titania', 'oberon'].map(n => [`moon381-${n}-1986`, n, { jdOff: VOYAGER_JD - NOW_JD, bf: { r: { ariel: 579, titania: 789, oberon: 761 }[n] * 3.2, el: 15, az: 20, fov: 50 } }]);
V381.push(...MOONS381B, ...URANIAN1986);
// REV2-01 (SUN-381-07) glare audit: distance × FOV, auto exposure and a FIXED exposure (2^-10.26, the 1 AU / 20° auto value)
export const GLAREAUDIT = [0.3, 0.39, 0.6, 1, 1.52, 2.5, 5].flatMap(a => [20, 50].flatMap(f => [
  [`glare-${pad(a)}AU-f${f}-auto`, 'sun', { sunAt: { km: a * AU, fov: f } }],
  [`glare-${pad(a)}AU-f${f}-fixed`, 'sun', { sunAt: { km: a * AU, fov: f }, set: { autoExposure: false, manualExposure: Math.pow(2, -10.26) } }]]));
V381.push(...GLAREAUDIT);
// REV2-02 partial-mosaic boundaries on the shared pipeline: Triton (unobserved north, boundary 15–45°N, lit now),
// Pluto and Charon (unobserved south, boundary 30–45°S) at the 1988 equinox so the boundary is sunlit
const EQ1988 = 2447200.5 - NOW_JD;
export const PARTIAL381 = [['partial-triton-north', 'triton', { bf: { r: 1353 * 3.2, el: 28, abs: true, az: 0, fov: 50 } }],
  ['partial-pluto-south-1988', 'pluto', { jdOff: EQ1988, bf: { r: 1188 * 3.2, el: -32, abs: true, az: 0, fov: 50 } }],
  ['partial-charon-south-1988', 'charon', { jdOff: EQ1988, bf: { r: 606 * 3.2, el: -32, abs: true, az: 0, fov: 50 } }]];
V381.push(...PARTIAL381);
// SUN-381-07 point-regime law probe: unresolved Sun at 10–1000 AU (50° FOV, auto) to measure the star-law glare G(F)
export const GLAREFAR = [10, 30, 100, 1000].map(a => [`glare-${pad(a)}AU-f50-auto`, 'sun', { sunAt: { km: a * AU, fov: 50 } }]);
V381.push(...GLAREFAR);
