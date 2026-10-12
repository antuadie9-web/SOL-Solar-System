// Curated catalogue of resolved bodies: physical parameters (IAU 2015 / JPL SSD / NASA fact sheets, 2026),
// texture assignments, atmosphere & ring presets and short descriptions.
export type Kind = 'star' | 'planet' | 'dwarf' | 'moon' | 'asteroid' | 'comet' | 'tno' | 'xstar'; // xstar = catalogue star beyond the Sun
export interface AtmoPreset {
  height: number;           // km, top of the modelled shell
  rayleigh: [number, number, number]; // scattering coeff at surface, 1/km
  rayleighH: number;        // scale height km
  mie: number; mieH: number; mieG: number; mieColor?: [number, number, number];
  absorb?: [number, number, number]; // extra absorption (ozone/haze), 1/km at mie height
  ground?: number;          // offset of the "surface" the shell sits on (km), e.g. cloud tops
  sunset?: number;          // artistic exposure boost for limb
  /** v3.5 nightglow layer (Earth): peak altitude, 1/e half-width (km), colour normalised to Y = 1 */
  airglow?: { height: number; width: number; color: [number, number, number] };
  /** v3.6 physical extension (render/atmoModel.ts): per-channel Mie single-scattering albedo & asymmetry, layered absorber */
  phys?: import('../render/atmoModel').AtmoPhysPreset;
}
export interface BodyDef {
  id: string; name: string; kind: Kind; parent?: string;
  radius: number; radii?: [number, number, number];  // mean, triaxial (a,b,c) km
  GM?: number; albedo: number; color: [number, number, number];
  tex?: string; texHi?: boolean; normal?: string; night?: string; clouds?: string; ocean?: string;
  rot?: string; periodH?: number; pole?: [number, number];
  /** v3.8: 'body-fixed' = the shape model's own body-fixed axes are kept (no long-axis re-orientation at load) */
  modelFrame?: 'body-fixed';
  atmo?: AtmoPreset; rings?: { inner: number; outer: number; tex?: string; color: [number, number, number]; opacity: number };
  model?: string; modelScale?: number; procedural?: { seed: number; craters: number; rough: number; tint?: [number, number, number]; spot?: [number, number, number] };
  sbdb?: string; sat?: string; // ephemeris source keys
  subtitle: string; desc: string; facts?: string[]; stats?: [string, string][];
  limb?: number; // Minnaert k for gas giants
  terrain?: string; // DEM terrain id under public/assets/terrain/<id> (Phase 4)
  noData?: { threshold: number; fraction: number; note: string }; // map regions with no observations (Phase 3, AST-002)
  priority?: number;
  /** v3.7: the visible surface is a cloud deck this far above the solid radius (Venus ≈ 70 km); physics keeps the solid radius */
  cloudTopKm?: number;
}
// Earth: Bruneton 2017 / Hillaire 2020 reference atmosphere (Rayleigh, Mie σs 3.996e-3 & σa 0.444e-3 /km, ozone tent at 25 ± 15 km)
const EARTH_ATMO: AtmoPreset = { airglow: { height: 95, width: 7, color: [0.54, 1.2, 0.42] }, height: 100, rayleigh: [5.802e-3, 13.558e-3, 33.1e-3], rayleighH: 8.0, mie: 3.996e-3, mieH: 1.2, mieG: 0.8,
  phys: { mieAlbedo: [0.9, 0.9, 0.9], ozone: { ext: [0.65e-3, 1.881e-3, 0.085e-3], center: 25, halfWidth: 15 }, groundAlbedo: [0.3, 0.3, 0.3], source: 'Bruneton 2017; Hillaire 2020 (EGSR) Earth parameters' } };
export const CATALOG: BodyDef[] = [
  { id: 'sun', name: 'Sun', kind: 'star', radius: 695700, GM: 1.32712440041e11, albedo: 1, color: [1, 0.96, 0.9], rot: 'sun', priority: 100,
    subtitle: 'G2V main-sequence star',
    desc: 'A 4.6-billion-year-old sphere of hydrogen and helium holding 99.86% of the Solar System’s mass. Its core fuses about 600 million tonnes of hydrogen every second; the energy takes up to 170,000 years to reach the photosphere, then 8 minutes 20 seconds to reach Earth.',
    facts: ['Solar Cycle 25 peaked in late 2024; activity is now declining toward the 2030 minimum.', 'The photosphere is 5,772 K; the corona above it exceeds 1 million K.', 'Parker Solar Probe skims just 6.1 million km above the surface at 191 km/s.'],
    stats: [['Spectral type', 'G2V'], ['Effective temperature', '5,772 K'], ['Luminosity', '3.828 × 10²⁶ W'], ['Mass', '1.989 × 10³⁰ kg'], ['Age', '4.6 Gyr'], ['Sidereal rotation (equator)', '25.38 d']] },
  // ── planets ──────────────────────────────────────────────────────────────
  { id: 'mercury', name: 'Mercury', kind: 'planet', radius: 2439.4, radii: [2440.53, 2440.53, 2438.26], GM: 22031.868551, albedo: 0.142, color: [0.62, 0.59, 0.56], tex: 'mercury', texHi: true, rot: 'mercury', priority: 90,
    subtitle: 'The swift, scorched innermost planet',
    desc: 'An iron-rich world barely larger than the Moon. With no real atmosphere to hold heat, its surface swings from 430 °C in sunlight to −180 °C at night. A 3:2 spin–orbit resonance makes one solar day last two Mercurian years.',
    facts: ['Its iron core fills about 85% of the planet’s radius.', 'Water ice survives in permanently shadowed polar craters.', 'ESA–JAXA BepiColombo enters Mercury orbit in November 2026.'],
    stats: [['Sidereal day', '58.646 d'], ['Solar day', '175.94 d'], ['Surface temperature', '−180 to 430 °C'], ['Moons', '0']] },
  { id: 'venus', name: 'Venus', kind: 'planet', radius: 6051.8, cloudTopKm: 70, GM: 324858.592, albedo: 0.689, color: [0.95, 0.86, 0.66], tex: 'venus', texHi: false, rot: 'venus', priority: 90,
    // v3.7 Venus: the shell sits on the cloud tops (≈ 70 km): CO₂ Rayleigh DERIVED there (≈ 30 mbar, 230 K → 1.0e-3 km⁻¹ at 550 nm,
    // H ≈ 15.9 km) + sulfuric-acid upper haze (τ ≈ 0.3, H ≈ 5 km, ω₀ lower in blue/UV: the unknown UV absorber) APPROXIMATE.
    // The surface is never visible at visible wavelengths (cloud τ ≈ 30 below the shell; the cloud map is the visible surface).
    atmo: { height: 160, ground: 70, rayleigh: [0.43e-3, 1.0e-3, 2.45e-3], rayleighH: 15.9, mie: 0.06, mieH: 5, mieG: 0.7, mieColor: [1.0, 0.97, 0.85], phys: { mieAlbedo: [1.0, 0.97, 0.85], mieG: [0.68, 0.7, 0.72], source: 'DERIVED Rayleigh at the cloud tops; upper haze APPROXIMATE (Esposito et al. 1983; Titov et al. 2018)' } },
    subtitle: 'A runaway greenhouse wrapped in acid cloud',
    desc: 'Earth’s near-twin in size hides beneath a carbon-dioxide atmosphere 92 times denser than ours. The sulfuric-acid cloud deck you see super-rotates around the planet in about four days, while the surface below bakes at 464 °C.',
    facts: ['It spins backwards: the Sun rises in the west.', 'A Venusian sidereal day (243 d) is longer than its year (225 d).', 'Brightest planet in our sky, reaching magnitude −4.9.'],
    stats: [['Sidereal day', '243.02 d (retrograde)'], ['Cloud-top rotation', '≈ 4 d'], ['Surface pressure', '92 bar'], ['Surface temperature', '464 °C'], ['Moons', '0']] },
  { id: 'earth', name: 'Earth', kind: 'planet', radius: 6371.0, radii: [6378.1366, 6378.1366, 6356.7519], GM: 398600.435436, albedo: 0.434, color: [0.35, 0.55, 0.9], tex: 'earth', texHi: true, normal: 'earth_n', night: 'earth_night', clouds: 'earth_clouds', ocean: 'earth_ocean', rot: 'earth', priority: 95,
    atmo: EARTH_ATMO,
    subtitle: 'The pale blue dot',
    desc: 'The only world known to harbour life. Liquid water covers 71% of the surface, plate tectonics recycle the crust, and a geodynamo in the molten outer core raises the magnetic field that shields the nitrogen–oxygen atmosphere.',
    facts: ['Perihelion falls in early January, aphelion in early July.', 'The day lengthens by about 1.7 ms per century as tides slow the spin.', 'The Moon stabilises Earth’s axial tilt near 23.4°.'],
    stats: [['Sidereal day', '23 h 56 min 4 s'], ['Axial tilt', '23.44°'], ['Mean surface temperature', '15 °C'], ['Surface pressure', '1.013 bar'], ['Moons', '1']] },
  { id: 'mars', name: 'Mars', kind: 'planet', radius: 3389.5, radii: [3396.19, 3396.19, 3376.20], GM: 42828.375214, albedo: 0.170, color: [0.82, 0.45, 0.28], tex: 'mars', texHi: true, normal: 'mars_n', rot: 'mars', terrain: 'mars', priority: 90,
    // v3.6 Mars (DERIVED/MEASURED, see docs/research/atmospheres-v3.6.md): CO₂ Rayleigh from n·σ (610 Pa, 210 K; σ_CO₂ ≈ 2.4 σ_air,
    // Sneep & Ubachs 2005), dust τ = 0.5 (typical non-storm MER/MSL opacity, Lemmon et al. 2015) over H = 11.1 km, ω₀ 0.975 red
    // (Wolff et al. 2009), 0.77 blue (437 nm, Wolff et al. 2010 MARCI/CRISM — MEASURED), green 0.90 INTERPOLATED, g ≈ 0.67 red.
    // (v3.6 interim used an inferred blue 0.80 / green 0.93, which gave a too-grey haze.)
    // v3.5 used a dust extinction of 0.9e-3 /km (τ ≈ 0.01 — 50× too clear) with an artistic red "Rayleigh".
    atmo: { height: 80, rayleigh: [0.97e-4, 2.3e-4, 5.7e-4], rayleighH: 11.1, mie: 0.045, mieH: 11.1, mieG: 0.68, mieColor: [0.975, 0.90, 0.77],
      phys: { mieAlbedo: [0.975, 0.90, 0.77], mieG: [0.67, 0.69, 0.72], groundAlbedo: [0.30, 0.17, 0.08], source: 'Lemmon 2015 τ; ω₀ red 0.975 (Wolff 2009), blue 0.765–0.769 at 437 nm (Wolff 2010, Icarus 208, MARCI band 1 vs CRISM 440 nm), green interpolated; g red ≈ 0.67' } },
    subtitle: 'The rusted desert world',
    desc: 'Iron-oxide dust paints Mars red. Its thin CO₂ air hangs over Olympus Mons, the tallest volcano in the Solar System, and Valles Marineris, a canyon system as long as the United States is wide. Ancient deltas show it was once warm and wet.',
    facts: ['Olympus Mons rises about 22 km above the datum.', 'Martian sunsets glow blue: fine dust scatters blue light forward.', 'Perseverance has been caching samples in Jezero crater since 2021.'],
    stats: [['Sidereal day', '24 h 37 min 22 s'], ['Axial tilt', '25.19°'], ['Surface pressure', '≈ 6 mbar'], ['Mean temperature', '−63 °C'], ['Moons', '2']] },
  { id: 'jupiter', name: 'Jupiter', kind: 'planet', radius: 69911, radii: [71492, 71492, 66854], GM: 126686531.9, albedo: 0.538, color: [0.85, 0.76, 0.64], tex: 'jupiter', texHi: true, rot: 'jupiter', limb: 0.94, priority: 92,
    // v3.7 Jupiter (docs/SOL_V3.7_PLANETARY_ATMOSPHERES_AND_CLOUDS.md): H₂/He Rayleigh DERIVED at 1 bar/165 K (n·σ_H₂, σ ∝ λ⁻⁴),
    // H = 27 km; blue-absorbing upper-tropospheric haze APPROXIMATE (τ ≈ 0.3). Shell densities taken 2 H above the 1-bar level (densityShiftH): the cloud
    // map already contains the integrated colour below; the shell adds limb/terminator/backlit scattering only.
    atmo: { height: 400, rayleigh: [1.5e-3, 3.5e-3, 8.5e-3], rayleighH: 27, mie: 0.01, mieH: 30, mieG: 0.65, mieColor: [0.97, 0.9, 0.75], phys: { mieAlbedo: [0.97, 0.9, 0.75], mieG: [0.62, 0.65, 0.68], source: 'DERIVED Rayleigh; haze APPROXIMATE (cf. Sromovsky et al. 2017, Braude et al. 2020)', densityShiftH: 2 } },
    rings: { inner: 92000, outer: 129000, color: [0.6, 0.5, 0.42], opacity: 0.015 },
    subtitle: 'King of the planets',
    desc: 'More than twice as massive as all other planets combined. Jupiter’s ammonia-ice cloud bands are torn by jet streams and storms; the Great Red Spot, an anticyclone wider than Earth, has raged for at least 190 years and is slowly shrinking.',
    facts: ['Shortest day of any planet: 9 h 55 min.', 'Its magnetosphere would look larger than the full Moon in our sky.', 'ESA’s JUICE arrives in 2031; NASA’s Europa Clipper in 2030.'],
    stats: [['Rotation (System III)', '9 h 55 min 30 s'], ['Axial tilt', '3.13°'], ['Cloud-top temperature', '−108 °C'], ['Known moons', '115']] },
  { id: 'saturn', name: 'Saturn', kind: 'planet', radius: 58232, radii: [60268, 60268, 54364], GM: 37931206.2, albedo: 0.499, color: [0.92, 0.84, 0.65], tex: 'saturn', texHi: true, rot: 'saturn', limb: 0.92, priority: 92,
    // v3.7 Saturn: Rayleigh DERIVED at 1 bar/134 K, H ≈ 60 km; thick yellow upper haze (τ ≈ 1.5 above the clouds, APPROXIMATE,
    // cf. Pérez-Hoyos & Sánchez-Lavega 2006); shell densities from 2 H above 1 bar
    atmo: { height: 800, rayleigh: [1.85e-3, 4.3e-3, 1.05e-2], rayleighH: 60, mie: 0.025, mieH: 60, mieG: 0.65, mieColor: [0.98, 0.95, 0.85], phys: { mieAlbedo: [0.98, 0.95, 0.85], mieG: [0.63, 0.65, 0.67], source: 'DERIVED Rayleigh; haze APPROXIMATE', densityShiftH: 2 } },
    rings: { inner: 69570, outer: 140240, tex: 'saturn_ring', color: [1.9, 1.75, 1.55], opacity: 1 },
    subtitle: 'The jewel of the Solar System',
    desc: 'A gas giant less dense than water, girdled by rings 280,000 km across yet typically only about 10 metres thick. The rings are countless fragments of water ice, shepherded by small moons into thousands of ringlets, gaps and spiral density waves.',
    facts: ['A hexagonal jet stream circles its north pole.', 'The rings passed edge-on to Earth on 23 March 2025 and are opening again.', 'Its rotation period was only pinned down in 2019, from waves in the rings.'],
    stats: [['Rotation', '10 h 33 min 38 s'], ['Axial tilt', '26.73°'], ['Cloud-top temperature', '−139 °C'], ['Known moons', '293']] },
  { id: 'uranus', name: 'Uranus', kind: 'planet', radius: 25362, radii: [25559, 25559, 24973], GM: 5793951.3, albedo: 0.488, color: [0.67, 0.86, 0.9], tex: 'uranus', rot: 'uranus', limb: 0.85, priority: 90,
    // v3.7 Uranus (ice giant, NOT a recoloured Neptune): Rayleigh DERIVED at 1 bar/76 K (H = RT/μg = 31 km); CH₄ absorption
    // strongest in red (APPROXIMATE channel means); a thicker, whiter aerosol haze than Neptune's (Irwin et al. 2024, MNRAS 527 —
    // the reason Uranus looks paler) τ ≈ 0.4. Shell densities from 2 H above 1 bar.
    atmo: { height: 400, rayleigh: [3.3e-3, 7.6e-3, 1.85e-2], rayleighH: 31, mie: 0.013, mieH: 31, mieG: 0.6, mieColor: [0.95, 0.97, 0.98], absorb: [0.065, 0.008, 0.0007], phys: { mieAlbedo: [0.95, 0.97, 0.98], mieG: [0.58, 0.6, 0.62], source: 'DERIVED Rayleigh; CH₄/haze APPROXIMATE after Irwin et al. 2024', densityShiftH: 2 } },
    rings: { inner: 41837, outer: 51149, color: [0.25, 0.25, 0.27], opacity: 0.35 },
    subtitle: 'The sideways ice giant',
    desc: 'Tipped onto its side, probably by an ancient collision, Uranus rolls around the Sun with each pole facing it for 42 years at a time. Methane in its hydrogen–helium atmosphere absorbs red light, leaving the pale cyan glow.',
    facts: ['First planet found with a telescope (William Herschel, 1781).', 'Its 13 known rings are dark and narrow.', 'Its northern spring equinox was in 2007; northern summer solstice comes in 2028.'],
    stats: [['Rotation', '17 h 14 min (retrograde)'], ['Axial tilt', '97.77°'], ['Cloud-top temperature', '−197 °C'], ['Known moons', '29']] },
  { id: 'neptune', name: 'Neptune', kind: 'planet', radius: 24622, radii: [24764, 24764, 24341], GM: 6835099.97, albedo: 0.442, color: [0.4, 0.55, 0.92], tex: 'neptune', rot: 'neptune', limb: 0.85, priority: 90,
    // v3.7 Neptune: Rayleigh DERIVED at 1 bar/72 K (H = 23 km), stronger CH₄ red absorption, thinner haze (τ ≈ 0.15) → deeper blue
    // (Irwin et al. 2024). Shell densities from 2 H above 1 bar.
    atmo: { height: 300, rayleigh: [3.45e-3, 8.0e-3, 1.95e-2], rayleighH: 23, mie: 0.0065, mieH: 23, mieG: 0.6, mieColor: [0.95, 0.97, 0.98], absorb: [0.09, 0.011, 0.001], phys: { mieAlbedo: [0.95, 0.97, 0.98], mieG: [0.58, 0.6, 0.62], source: 'DERIVED Rayleigh; CH₄/haze APPROXIMATE after Irwin et al. 2024', densityShiftH: 2 } },
    rings: { inner: 41900, outer: 62930, color: [0.3, 0.28, 0.27], opacity: 0.06 },
    subtitle: 'The windswept blue giant',
    desc: 'Found by mathematics before it was seen: its pull on Uranus betrayed its position in 1846. Neptune drives the fastest winds in the Solar System, gusting to 2,100 km/h, powered by internal heat at 30 times Earth’s distance from the Sun.',
    facts: ['It completed its first orbit since discovery in 2011.', 'Triton orbits backwards and is slowly spiralling inward.', 'Only Voyager 2 has visited (August 1989).'],
    stats: [['Rotation', '16 h 6 min'], ['Axial tilt', '28.32°'], ['Cloud-top temperature', '−201 °C'], ['Known moons', '16']] },
  // ── Earth & Mars ─────────────────────────────────────────────────────────
  { id: 'moon', name: 'Moon', kind: 'moon', parent: 'earth', radius: 1737.4, GM: 4902.800, albedo: 0.12, color: [0.62, 0.6, 0.57], tex: 'moon', texHi: true, normal: 'moon_n', rot: 'moon', terrain: 'moon', priority: 85,
    subtitle: 'Earth’s only natural satellite',
    desc: 'Born from debris when a Mars-sized body struck the young Earth, the Moon is tidally locked, always turning the same face toward us. Its dark maria are 3-billion-year-old lava plains; its tides slow Earth’s spin and steady its tilt.',
    facts: ['It recedes from Earth by 3.8 cm per year.', 'Artemis II will carry four astronauts around the Moon.', 'Libration lets us see 59% of its surface over time.'],
    stats: [['Mean distance', '384,400 km'], ['Sidereal month', '27.32 d'], ['Synodic month', '29.53 d'], ['Surface gravity', '1.62 m/s²']] },
  { id: 'phobos', name: 'Phobos', kind: 'moon', parent: 'mars', radius: 11.08, radii: [13.0, 11.4, 9.1], albedo: 0.071, color: [0.38, 0.34, 0.31], model: 'phobos', rot: 'phobos', priority: 60,
    subtitle: 'The doomed inner moon of Mars', desc: 'A lumpy, cratered rubble pile that races around Mars three times a day. Tides drag it inward about 1.8 m per century; in tens of millions of years it will break apart into a ring.', stats: [['Size', '26 × 23 × 18 km'], ['Orbital period', '7 h 39 min']] },
  { id: 'deimos', name: 'Deimos', kind: 'moon', parent: 'mars', radius: 6.2, radii: [7.8, 6.0, 5.1], albedo: 0.068, color: [0.42, 0.38, 0.34], model: 'deimos', rot: 'deimos', priority: 55,
    subtitle: 'The smaller Martian moon', desc: 'Smooth and dusty, Deimos is blanketed in regolith that softens its craters. From the Martian surface it looks like a bright star that takes 2.7 days to cross the sky.', stats: [['Size', '15 × 12 × 11 km'], ['Orbital period', '30 h 18 min']] },
  // ── Jupiter ──────────────────────────────────────────────────────────────
  { id: 'io', name: 'Io', kind: 'moon', parent: 'jupiter', radius: 1821.5, albedo: 0.63, color: [0.88, 0.8, 0.45], tex: 'io', texHi: true, rot: 'io', priority: 80,
    subtitle: 'The most volcanic world known', desc: 'Kneaded by Jupiter’s tides, Io hosts more than 400 active volcanoes whose sulfur plumes rise hundreds of kilometres. Its surface is constantly repaved in yellows, reds and blacks; Loki Patera is a lava lake 200 km across.', stats: [['Orbital period', '1.769 d'], ['Surface gravity', '1.80 m/s²']] },
  { id: 'europa', name: 'Europa', kind: 'moon', parent: 'jupiter', radius: 1560.8, albedo: 0.67, color: [0.85, 0.8, 0.72], tex: 'europa', texHi: true, rot: 'europa', priority: 80,
    subtitle: 'An ice shell over a hidden ocean', desc: 'A young, smooth ice crust criss-crossed by reddish fractures floats on a salty ocean holding about twice the water of Earth’s seas — one of the best places to look for life beyond Earth. Europa Clipper arrives in April 2030.', stats: [['Orbital period', '3.551 d'], ['Surface gravity', '1.31 m/s²']] },
  { id: 'ganymede', name: 'Ganymede', kind: 'moon', parent: 'jupiter', radius: 2631.2, albedo: 0.43, color: [0.6, 0.56, 0.5], tex: 'ganymede', texHi: true, rot: 'ganymede', priority: 80,
    subtitle: 'The largest moon in the Solar System', desc: 'Bigger than Mercury, Ganymede is the only moon with its own magnetic field, which drapes auroral ovals over its poles. Dark ancient terrain alternates with bright grooved ice; an ocean may lie 150 km down.', stats: [['Orbital period', '7.155 d'], ['Surface gravity', '1.43 m/s²']] },
  { id: 'callisto', name: 'Callisto', kind: 'moon', parent: 'jupiter', radius: 2410.3, albedo: 0.22, color: [0.38, 0.34, 0.3], tex: 'callisto', rot: 'callisto', priority: 78,
    subtitle: 'The most heavily cratered body known', desc: 'An ancient surface almost unchanged in four billion years. Bright crater rims of fresh ice speckle a dark crust; the Valhalla impact basin spans 3,800 km in concentric rings.', stats: [['Orbital period', '16.689 d'], ['Surface gravity', '1.24 m/s²']] },
  { id: 'amalthea', name: 'Amalthea', kind: 'moon', parent: 'jupiter', radius: 83.5, radii: [125, 73, 64], albedo: 0.09, color: [0.6, 0.32, 0.22], procedural: { seed: 11, craters: 0.7, rough: 0.5, tint: [0.62, 0.34, 0.24] }, priority: 40,
    subtitle: 'The reddest object in the Solar System', desc: 'A small, elongated inner moon painted red by sulfur from Io. It sheds the dust that forms Jupiter’s faint gossamer ring.' },
  // ── Saturn ───────────────────────────────────────────────────────────────
  { id: 'mimas', name: 'Mimas', kind: 'moon', parent: 'saturn', radius: 198.2, radii: [207.8, 196.7, 190.6], albedo: 0.96, color: [0.8, 0.8, 0.8], tex: 'mimas', texHi: true, rot: 'mimas', priority: 65,
    subtitle: 'The “Death Star” moon', desc: 'Dominated by Herschel crater, 139 km across — a third of the moon’s width. Its wobble hints at a young ocean only 20–30 km beneath the ice.' },
  { id: 'enceladus', name: 'Enceladus', kind: 'moon', parent: 'saturn', radius: 252.1, radii: [256.6, 251.4, 248.3], albedo: 1.375, color: [0.95, 0.96, 0.98], tex: 'enceladus', texHi: true, rot: 'enceladus', priority: 70,
    subtitle: 'Geysers from a buried sea', desc: 'The most reflective world in the Solar System. Jets from the “tiger stripe” fractures near its south pole spray ocean water into space, feeding Saturn’s E ring; Cassini tasted salts, silica and organics in them.' },
  { id: 'tethys', name: 'Tethys', kind: 'moon', parent: 'saturn', radius: 531.0, albedo: 1.229, color: [0.85, 0.84, 0.82], tex: 'tethys', rot: 'tethys', priority: 65,
    subtitle: 'An icy moon with a giant canyon', desc: 'Almost pure water ice. Ithaca Chasma, a rift 2,000 km long, wraps three-quarters of the way around it, and the Odysseus impact basin spans 450 km.' },
  { id: 'dione', name: 'Dione', kind: 'moon', parent: 'saturn', radius: 561.4, albedo: 0.998, color: [0.78, 0.77, 0.75], tex: 'dione', texHi: true, rot: 'dione', priority: 65,
    subtitle: 'A moon of bright ice cliffs', desc: 'Its trailing hemisphere is laced with bright “wispy” ice cliffs hundreds of metres high, scars of tectonic fracturing.' },
  { id: 'rhea', name: 'Rhea', kind: 'moon', parent: 'saturn', radius: 763.5, albedo: 0.949, color: [0.75, 0.74, 0.72], tex: 'rhea', texHi: true, rot: 'rhea', priority: 66,
    subtitle: 'Saturn’s second-largest moon', desc: 'A heavily cratered ball of ice and rock wrapped in a tenuous oxygen–carbon dioxide exosphere.' },
  { id: 'titan', name: 'Titan', kind: 'moon', parent: 'saturn', radius: 2574.7, albedo: 0.22, color: [0.85, 0.6, 0.3], tex: 'titan', rot: 'titan', priority: 82,
    // v3.6 Titan: optically thick orange haze (vertical τ ≈ 3 / 4.5 / 6.5 in R/G/B over H ≈ 65 km, ω₀ 0.95 / 0.88 / 0.72, g 0.65 —
    // APPROXIMATE, after the Huygens DISR aerosol model of Tomasko et al. 2008). v3.5's τ ≈ 0.5 haze let the surface map
    // show through as a blue-grey globe; from space Titan's surface is not visible at visible wavelengths.
    atmo: { height: 600, rayleigh: [1.2e-3, 2.4e-3, 4.5e-3], rayleighH: 40, mie: 0.072, mieH: 65, mieG: 0.65, mieColor: [0.607, 0.843, 1.0],
      phys: { mieAlbedo: [0.95, 0.88, 0.72], mieG: [0.65, 0.65, 0.65], groundAlbedo: [0.15, 0.12, 0.08], source: 'Tomasko et al. 2008 (PSS 56) — approximate' } },
    subtitle: 'A moon with rain, rivers and seas', desc: 'Wrapped in a nitrogen atmosphere 1.5 times Earth’s surface pressure, Titan has methane rain, rivers and seas — the only other world with stable surface liquids. NASA’s Dragonfly rotorcraft launches in 2028 to fly over its dunes.' },
  { id: 'hyperion', name: 'Hyperion', kind: 'moon', parent: 'saturn', radius: 135, radii: [180, 133, 103], albedo: 0.3, color: [0.6, 0.55, 0.48], procedural: { seed: 7, craters: 1.0, rough: 0.9, tint: [0.62, 0.55, 0.46] }, priority: 45,
    subtitle: 'The sponge moon', desc: 'A porous, chaotically tumbling body whose deep, sharp-rimmed craters give it a sponge-like look. Its rotation is genuinely chaotic, impossible to predict for long.' },
  { id: 'iapetus', name: 'Iapetus', kind: 'moon', parent: 'saturn', radius: 734.4, albedo: 0.6, color: [0.6, 0.55, 0.5], tex: 'iapetus', texHi: true, rot: 'iapetus', priority: 66,
    subtitle: 'The two-faced moon', desc: 'One hemisphere is dark as coal, the other bright as snow, and a ridge up to 20 km high runs along its equator like a walnut seam.' },
  { id: 'phoebe', name: 'Phoebe', kind: 'moon', parent: 'saturn', radius: 106.5, radii: [109.4, 108.5, 101.8], albedo: 0.081, color: [0.3, 0.29, 0.28], model: 'phoebe', modelFrame: 'body-fixed', rot: 'phoebe', procedural: { seed: 21, craters: 1, rough: 0.6, tint: [0.32, 0.31, 0.3] }, priority: 45,
    subtitle: 'A captured outer-Solar-System relic', desc: 'Dark, retrograde and probably a captured centaur. Dust knocked off it forms an enormous, tilted ring that coats Iapetus’s leading side.' },
  // ── Uranus ───────────────────────────────────────────────────────────────
  { id: 'miranda', name: 'Miranda', kind: 'moon', parent: 'uranus', radius: 235.8, albedo: 0.32, color: [0.66, 0.66, 0.66], procedural: { seed: 3, craters: 0.6, rough: 0.8, tint: [0.66, 0.66, 0.67] }, rot: 'miranda', priority: 60,
    subtitle: 'The patchwork moon', desc: 'Grooved coronae and Verona Rupes — a cliff about 20 km tall — make it look shattered and reassembled.' },
  { id: 'ariel', name: 'Ariel', kind: 'moon', parent: 'uranus', radius: 578.9, albedo: 0.53, color: [0.7, 0.7, 0.7], tex: 'ariel', rot: 'ariel', noData: { threshold: 0.006, fraction: 0.43, note: 'Voyager 2 (1986) imaged only the sunlit southern hemisphere; the black part of the source mosaic is UNOBSERVED and is shown here as a labelled procedural reconstruction.' }, procedural: { seed: 311, craters: 0.9, rough: 0.35 }, priority: 62, subtitle: 'The brightest Uranian moon', desc: 'A young, bright surface cut by long canyons with signs of past ice volcanism.' },
  { id: 'umbriel', name: 'Umbriel', kind: 'moon', parent: 'uranus', radius: 584.7, albedo: 0.26, color: [0.4, 0.4, 0.41], procedural: { seed: 5, craters: 1, rough: 0.4, tint: [0.38, 0.38, 0.39], spot: [0.75, 0.75, 0.75] }, rot: 'umbriel', priority: 60,
    subtitle: 'The darkest Uranian moon', desc: 'An old, dark, heavily cratered surface marked by a mysterious bright ring, Wunda, near its equator.' },
  { id: 'titania', name: 'Titania', kind: 'moon', parent: 'uranus', radius: 788.9, albedo: 0.35, color: [0.6, 0.58, 0.56], tex: 'titania', rot: 'titania', noData: { threshold: 0.006, fraction: 0.50, note: 'Voyager 2 (1986) imaged only the sunlit southern hemisphere; the black part of the source mosaic is UNOBSERVED and is shown here as a labelled procedural reconstruction.' }, procedural: { seed: 313, craters: 0.9, rough: 0.35 }, priority: 62, subtitle: 'The largest moon of Uranus', desc: 'Fault valleys up to 1,500 km long suggest its interior expanded as water froze.' },
  { id: 'oberon', name: 'Oberon', kind: 'moon', parent: 'uranus', radius: 761.4, albedo: 0.31, color: [0.52, 0.48, 0.46], tex: 'oberon', rot: 'oberon', noData: { threshold: 0.006, fraction: 0.58, note: 'Voyager 2 (1986) imaged only the sunlit southern hemisphere; the black part of the source mosaic is UNOBSERVED and is shown here as a labelled procedural reconstruction.' }, procedural: { seed: 317, craters: 0.9, rough: 0.35 }, priority: 62, subtitle: 'The outermost major Uranian moon', desc: 'Ancient, cratered and reddish, with dark material pooled on crater floors and a mountain rising 11 km.' },
  // ── Neptune ──────────────────────────────────────────────────────────────
  { id: 'triton', name: 'Triton', kind: 'moon', parent: 'neptune', radius: 1352.6, albedo: 0.72, color: [0.85, 0.8, 0.76], tex: 'triton', texHi: true, rot: 'triton', noData: { threshold: 0.0018, fraction: 0.33, note: 'Voyager 2 (1989) imaged mainly the southern hemisphere — the black part of the USGS source mosaic is UNOBSERVED and is shown as a labelled procedural reconstruction (v3.4: v3.3 used a third-party mosaic that silently painted invented terrain there).' }, procedural: { seed: 401, craters: 0.15, rough: 0.2 }, priority: 75,
    // v3.7 Triton: 14 µbar N₂ (Rayleigh negligible); thin haze τ ≈ 0.003–0.01 below ≈ 30 km (Voyager 2, Pollack et al. 1990)
    atmo: { height: 40, rayleigh: [0.2e-6, 0.5e-6, 1.2e-6], rayleighH: 14, mie: 0.6e-3, mieH: 8, mieG: 0.65, mieColor: [0.8, 0.9, 1.0], phys: { mieAlbedo: [0.95, 0.95, 0.95], source: 'Voyager 2 haze (Pollack et al. 1990) APPROXIMATE' } },
    subtitle: 'A captured Kuiper Belt world', desc: 'Orbiting backwards, Triton was almost certainly captured from the Kuiper Belt. Nitrogen geysers streak its pinkish “cantaloupe” terrain at −235 °C.' },
  { id: 'proteus', name: 'Proteus', kind: 'moon', parent: 'neptune', radius: 210, radii: [218, 208, 201], albedo: 0.096, color: [0.33, 0.32, 0.31], procedural: { seed: 9, craters: 0.9, rough: 0.5, tint: [0.33, 0.32, 0.31] }, priority: 45,
    subtitle: 'The box-shaped inner moon', desc: 'About as large as a body can be without gravity pulling it round, dark as soot and missed until Voyager 2 flew by.' },
  { id: 'nereid', name: 'Nereid', kind: 'moon', parent: 'neptune', radius: 170, albedo: 0.155, color: [0.45, 0.44, 0.43], procedural: { seed: 12, craters: 0.8, rough: 0.4 }, priority: 42,
    subtitle: 'The most eccentric moon', desc: 'Its wildly stretched orbit carries it from 1.4 to 9.6 million km from Neptune.' },
  // ── dwarf planets ────────────────────────────────────────────────────────
  { id: 'ceres', name: 'Ceres', kind: 'dwarf', radius: 469.7, radii: [482.1, 482.1, 445.9], GM: 62.6284, albedo: 0.090, color: [0.4, 0.39, 0.38], tex: 'ceres', texHi: true, rot: 'ceres', sbdb: '1', priority: 80,
    subtitle: 'Queen of the asteroid belt', desc: 'The largest object between Mars and Jupiter holds a third of the belt’s mass. Dawn found bright carbonate salts in Occator crater, residue of brine that welled up from a reservoir below.', stats: [['Day', '9 h 4 min'], ['Discovered', '1801, Piazzi']] },
  { id: 'pluto', name: 'Pluto', kind: 'dwarf', radius: 1188.3, GM: 869.3, albedo: 0.52, color: [0.85, 0.74, 0.62], tex: 'pluto', texHi: true, rot: 'pluto', sbdb: '134340', noData: { threshold: 0.0018, fraction: 0.23, note: 'New Horizons (2015) could not see the southern latitudes in polar night — the black part of the USGS source mosaic is UNOBSERVED and is shown as a labelled procedural reconstruction (v3.4: v3.3 used a third-party mosaic that silently painted invented terrain there).' }, procedural: { seed: 409, craters: 0.3, rough: 0.25 }, priority: 85,
    // v3.7 Pluto: ~10 µbar N₂; layered tholin haze to > 200 km, blue in forward scattering because the particles are small
    // (New Horizons, Gladstone et al. 2016; Cheng et al. 2017): vertical τ ≈ 0.01 at 0.5 µm, scale height ≈ 50 km — APPROXIMATE
    atmo: { height: 300, rayleigh: [0.2e-6, 0.5e-6, 1.2e-6], rayleighH: 50, mie: 0.2e-3, mieH: 50, mieG: 0.6, mieColor: [0.55, 0.75, 1.0], phys: { mieAlbedo: [0.9, 0.93, 0.96], mieG: [0.62, 0.6, 0.55], source: 'New Horizons (Gladstone 2016; Cheng 2017) APPROXIMATE' } },
    subtitle: 'The heart of the Kuiper Belt', desc: 'Reclassified in 2006 but more alive than anyone expected: New Horizons revealed nitrogen glaciers in heart-shaped Sputnik Planitia, water-ice mountains 3 km high and layered blue hazes.', stats: [['Day', '6.387 d (retrograde)'], ['Axial tilt', '122.5°'], ['Surface temperature', '−229 °C'], ['Moons', '5'], ['Discovered', '1930, Tombaugh']] },
  { id: 'charon', name: 'Charon', kind: 'moon', parent: 'pluto', radius: 606.0, GM: 105.88, albedo: 0.38, color: [0.56, 0.55, 0.54], tex: 'charon', texHi: true, rot: 'charon', noData: { threshold: 0.0018, fraction: 0.26, note: 'New Horizons (2015) could not see the southern latitudes in polar night — the black part of the USGS source mosaic is UNOBSERVED and is shown as a labelled procedural reconstruction (v3.4: v3.3 used a third-party mosaic that silently painted invented terrain there).' }, procedural: { seed: 419, craters: 0.7, rough: 0.3 }, priority: 70,
    subtitle: 'Pluto’s giant companion', desc: 'Half Pluto’s diameter: the pair orbit a point in empty space between them and are mutually tidally locked. A rusty cap, Mordor Macula, stains its north pole.' },
  { id: 'haumea', name: 'Haumea', kind: 'dwarf', radius: 798, radii: [1161, 852, 513], albedo: 0.51, color: [0.88, 0.88, 0.9], procedural: { seed: 31, craters: 0.3, rough: 0.2, tint: [0.88, 0.88, 0.9], spot: [0.55, 0.28, 0.22] }, periodH: 3.9155, pole: [285.1, -10.6], sbdb: '136108', priority: 75,
    subtitle: 'The spinning egg', desc: 'Spinning once every 3.9 hours, Haumea has stretched into an ellipsoid twice as long as it is thick. Crystalline water ice coats it, a dark red spot marks one face, and a ring circles it at 2,287 km.', stats: [['Dimensions', '2,322 × 1,704 × 1,026 km'], ['Moons', '2 (Hiʻiaka, Namaka)'], ['Discovered', '2004–05']] },
  { id: 'makemake', name: 'Makemake', kind: 'dwarf', radius: 715, radii: [717, 717, 710], albedo: 0.82, color: [0.83, 0.62, 0.48], procedural: { seed: 41, craters: 0.2, rough: 0.2, tint: [0.84, 0.64, 0.5] }, periodH: 22.83, pole: [0, 90], sbdb: '136472', priority: 72,
    subtitle: 'The bright, red Easter world', desc: 'Found shortly after Easter 2005, Makemake is coated in methane frost reddened by sunlight into tholins. It has one small dark moon, MK2.', stats: [['Moons', '1'], ['Surface temperature', '−239 °C']] },
  { id: 'eris', name: 'Eris', kind: 'dwarf', radius: 1163, GM: 1108, albedo: 0.96, color: [0.92, 0.91, 0.9], procedural: { seed: 51, craters: 0.2, rough: 0.15, tint: [0.92, 0.91, 0.9] }, periodH: 378.9, pole: [0, 90], sbdb: '136199', priority: 74,
    subtitle: 'The dwarf that demoted Pluto', desc: 'Nearly Pluto’s twin in size but 27% more massive, Eris follows a steeply tilted orbit out to 97 AU. Its discovery forced the IAU to define “planet” in 2006.', stats: [['Moons', '1 (Dysnomia)'], ['Aphelion', '97.5 AU']] },
  { id: 'gonggong', name: 'Gonggong', kind: 'dwarf', radius: 615, albedo: 0.14, color: [0.75, 0.42, 0.3], procedural: { seed: 61, craters: 0.4, rough: 0.3, tint: [0.72, 0.42, 0.3] }, periodH: 22.4, pole: [0, 90], sbdb: '225088', priority: 66,
    subtitle: 'A large, very red world', desc: 'One of the reddest large bodies known, with methane frost and a small moon, Xiangliu. Its slow 22-hour spin may be braked by that moon’s tides.' },
  // v3.7: Chariklo — first small body with confirmed rings (Braga-Ribas et al. 2014, Nature 508); tri-axial shape
  // 143.8 × 135.2 × 99.1 km (Morgado et al. 2021, A&A 652); pole taken = ring pole (rings assumed equatorial)
  { id: 'chariklo', name: 'Chariklo', kind: 'tno', radius: 124, radii: [143.8, 135.2, 99.1], albedo: 0.045, color: [0.42, 0.38, 0.34], procedural: { seed: 113, craters: 0.5, rough: 0.35, tint: [0.42, 0.38, 0.34] }, periodH: 7.004, pole: [151.30, 41.48], sbdb: '10199', priority: 40,
    subtitle: 'The smallest world known to have rings', desc: 'A 250-km Centaur orbiting between Saturn and Uranus. A 2013 stellar occultation revealed two narrow, dense rings 391 and 405 km from its centre — the first rings found around anything smaller than a giant planet.' },
  { id: 'quaoar', name: 'Quaoar', kind: 'dwarf', radius: 555, albedo: 0.12, color: [0.68, 0.52, 0.42], procedural: { seed: 71, craters: 0.5, rough: 0.3, tint: [0.66, 0.5, 0.4] }, periodH: 17.68, pole: [0, 90], sbdb: '50000', priority: 64,
    subtitle: 'The world with an impossible ring', desc: 'Quaoar’s dense ring orbits far outside the Roche limit, where theory said material should clump into a moon.' },
  { id: 'sedna', name: 'Sedna', kind: 'dwarf', radius: 500, albedo: 0.32, color: [0.8, 0.42, 0.3], procedural: { seed: 81, craters: 0.3, rough: 0.25, tint: [0.8, 0.42, 0.3] }, periodH: 10.27, pole: [0, 90], sbdb: '90377', priority: 64,
    subtitle: 'A detached world of the inner Oort cloud', desc: 'Its 11,400-year orbit never comes closer than 76 AU — far beyond Neptune’s reach. It is one of the reddest objects in the Solar System.' },
  { id: 'orcus', name: 'Orcus', kind: 'dwarf', radius: 455, albedo: 0.23, color: [0.6, 0.6, 0.62], procedural: { seed: 91, craters: 0.5, rough: 0.3, tint: [0.6, 0.6, 0.62] }, periodH: 13.19, pole: [0, 90], sbdb: '90482', priority: 62,
    subtitle: 'The “anti-Pluto”', desc: 'A plutino whose orbit mirrors Pluto’s: when one is at perihelion, the other is near aphelion. Water ice and its large moon Vanth make it a small binary.' },
  // ── notable asteroids ────────────────────────────────────────────────────
  { id: 'vesta', name: 'Vesta', kind: 'asteroid', radius: 262.7, radii: [286.3, 278.6, 223.2], GM: 17.288, albedo: 0.42, color: [0.65, 0.62, 0.58], model: 'vesta', tex: 'vesta', rot: 'vesta', sbdb: '4', priority: 70,
    subtitle: 'The brightest asteroid', desc: 'A protoplanet with an iron core. The Rheasilvia impact at its south pole blasted out a basin 505 km wide with a central peak nearly 20 km high.', stats: [['Day', '5.34 h'], ['Discovered', '1807, Olbers']] },
  { id: 'pallas', name: 'Pallas', kind: 'asteroid', radius: 256.5, radii: [284, 266, 224], albedo: 0.155, color: [0.5, 0.51, 0.53], procedural: { seed: 101, craters: 1.0, rough: 0.4, tint: [0.5, 0.51, 0.53] }, periodH: 7.8132, pole: [33, -3], sbdb: '2', priority: 60,
    subtitle: 'The steeply tilted giant', desc: 'Its orbit is tipped 35° to the ecliptic, making it hard to reach. Images show an unusually heavily cratered “golf ball” surface.' },
  { id: 'juno', name: 'Juno', kind: 'asteroid', radius: 123.3, radii: [145, 133, 100], albedo: 0.214, color: [0.62, 0.56, 0.5], procedural: { seed: 111, craters: 0.9, rough: 0.5 }, periodH: 7.21, pole: [103, 27], sbdb: '3', priority: 55,
    subtitle: 'A stony S-type asteroid', desc: 'One of the first four asteroids found; silicate-rich and noticeably elongated.' },
  { id: 'hygiea', name: 'Hygiea', kind: 'asteroid', radius: 203.6, albedo: 0.072, color: [0.36, 0.35, 0.34], procedural: { seed: 121, craters: 0.7, rough: 0.2 }, periodH: 13.828, pole: [0, 90], sbdb: '10', priority: 58,
    subtitle: 'Nearly round, perhaps a dwarf planet', desc: 'A dark carbonaceous body that VLT imaging in 2019 showed to be almost spherical.' },
  { id: 'psyche', name: 'Psyche', kind: 'asteroid', radius: 111, radii: [139, 119, 85], albedo: 0.12, color: [0.55, 0.54, 0.52], procedural: { seed: 131, craters: 0.6, rough: 0.5, tint: [0.56, 0.55, 0.53] }, periodH: 4.196, pole: [32, -7], sbdb: '16', priority: 58,
    subtitle: 'A metal-rich world', desc: 'Possibly the exposed core of a shattered protoplanet. NASA’s Psyche spacecraft, launched in 2023, arrives in 2029.' },
  { id: 'eros', name: 'Eros', kind: 'asteroid', radius: 8.42, radii: [17.2, 5.6, 5.6], albedo: 0.25, color: [0.66, 0.56, 0.45], model: 'eros', periodH: 5.27, pole: [11.37, 17.22], sbdb: '433', priority: 55,
    subtitle: 'The first asteroid ever orbited', desc: 'A peanut-shaped near-Earth asteroid. NEAR Shoemaker orbited it for a year and then landed on it in 2001.' },
  { id: 'bennu', name: 'Bennu', kind: 'asteroid', radius: 0.2423, radii: [0.2524, 0.2459, 0.2284], albedo: 0.044, color: [0.3, 0.3, 0.3], model: 'bennu', periodH: 4.296061, pole: [85.4522, -60.3678], sbdb: '101955', priority: 55,
    subtitle: 'The rubble pile OSIRIS-REx sampled', desc: 'A loose spinning top of boulders. OSIRIS-REx returned 121.6 g of it in 2023, containing amino acids, nucleobases and evaporite salts from the early Solar System.' },
  { id: 'apophis', name: 'Apophis', kind: 'asteroid', radius: 0.17, radii: [0.2, 0.16, 0.14], albedo: 0.35, color: [0.62, 0.56, 0.5], procedural: { seed: 141, craters: 0.3, rough: 1.0 }, periodH: 30.56, pole: [250, -75], sbdb: '99942', priority: 55,
    subtitle: 'The 2029 close-approach asteroid', desc: 'On 13 April 2029 it will pass 32,000 km above Earth’s surface — inside the ring of geostationary satellites — and shine at magnitude 3. OSIRIS-APEX will meet it there.' },
  { id: 'ryugu', name: 'Ryugu', kind: 'asteroid', radius: 0.448, radii: [0.502, 0.502, 0.438], albedo: 0.045, color: [0.27, 0.27, 0.27], procedural: { seed: 151, craters: 0.4, rough: 0.9 }, periodH: 7.63262, pole: [96.3956, -66.3937], sbdb: '162173', priority: 50,
    subtitle: 'The diamond-shaped asteroid', desc: 'Hayabusa2 fired a copper impactor into it and returned 5.4 g of pristine carbonaceous material in 2020.' },
  { id: 'didymos', name: 'Didymos', kind: 'asteroid', radius: 0.39, albedo: 0.15, color: [0.5, 0.48, 0.45], procedural: { seed: 161, craters: 0.3, rough: 0.7 }, periodH: 2.2593, pole: [78, -71], sbdb: '65803', priority: 50,
    subtitle: 'The binary nudged by DART', desc: 'In 2022 NASA’s DART slammed into its moonlet Dimorphos and shortened its orbit by 33 minutes — humanity’s first planetary-defence test. ESA’s Hera arrives in late 2026.' },
  { id: 'itokawa', name: 'Itokawa', kind: 'asteroid', radius: 0.165, radii: [0.268, 0.147, 0.105], albedo: 0.29, color: [0.6, 0.55, 0.48], model: 'itokawa', modelFrame: 'body-fixed', procedural: { seed: 171, craters: 0.1, rough: 1.0 }, periodH: 12.132, pole: [90.53, -66.3], sbdb: '25143', priority: 45,
    subtitle: 'The sea-otter-shaped rubble pile', desc: 'Hayabusa returned the first asteroid grains to Earth from this 535-metre contact binary in 2010.' },
  { id: 'toutatis', name: 'Toutatis', kind: 'asteroid', radius: 1.35, radii: [2.13, 1.02, 0.85], albedo: 0.405, color: [0.6, 0.56, 0.5], model: 'toutatis', periodH: 176, pole: [0, 90], sbdb: '4179', priority: 45,
    subtitle: 'The tumbling near-Earth asteroid', desc: 'A non-principal-axis rotator that tumbles irregularly; China’s Chang’e 2 photographed it from 3.2 km in 2012.' },
  // Shape models that shipped in the baseline but were never wired (README claimed them). Dimensions/albedo/periods: JPL SBDB.
  { id: 'geographos', name: 'Geographos', kind: 'asteroid', radius: 1.28, radii: [2.5, 1.0, 1.05], albedo: 0.29, color: [0.62, 0.57, 0.5], model: 'geographos', periodH: 5.22204, pole: [0, 90], sbdb: '1620', priority: 40,
    subtitle: 'The most elongated asteroid of its era', desc: 'A 5-km near-Earth asteroid shaped like a stretched cigar, imaged by Arecibo and Goldstone radar during its 1994 close approach; the shape model comes from that radar campaign.' },
  { id: 'golevka', name: 'Golevka', kind: 'asteroid', radius: 0.265, radii: [0.265, 0.265, 0.265], albedo: 0.151, color: [0.55, 0.53, 0.5], model: 'golevka', periodH: 6.026, pole: [0, 90], sbdb: '6489', priority: 35,
    subtitle: 'The asteroid whose orbit is nudged by sunlight', desc: 'A half-kilometre rock whose orbit drifts by the Yarkovsky effect — the thermal recoil of re-emitted sunlight — first measured directly for Golevka in 2003 by radar ranging. Shape model from radar.' },
  { id: 'mithra', name: 'Mithra', kind: 'asteroid', radius: 0.92, radii: [1.175, 0.825, 0.72], albedo: 0.297, color: [0.6, 0.57, 0.52], model: 'mithra', periodH: 67.5, pole: [0, 90], sbdb: '4486', priority: 35,
    subtitle: 'A radar-imaged contact binary candidate', desc: 'A slowly rotating near-Earth asteroid with a bifurcated shape seen in Arecibo radar images during its 2000 approach. Shape model from radar.' },
  { id: 'kleopatra', name: 'Kleopatra', kind: 'asteroid', radius: 61, radii: [138, 47, 39], albedo: 0.12, color: [0.5, 0.49, 0.47], model: 'kleopatra', periodH: 5.385, pole: [69, 42], sbdb: '216', priority: 50,
    subtitle: 'The dog-bone asteroid', desc: 'A metallic body shaped like a dog bone, 270 km long, with two small moons.' },
  { id: 'lutetia', name: 'Lutetia', kind: 'asteroid', radius: 49, radii: [60.5, 50.5, 37.5], albedo: 0.19, color: [0.55, 0.53, 0.5], procedural: { seed: 181, craters: 0.9, rough: 0.6 }, periodH: 8.1655, pole: [51.8, 10.8], sbdb: '21', priority: 48,
    subtitle: 'Visited by Rosetta', desc: 'A primitive, cratered body imaged by Rosetta in 2010 on its way to comet 67P.' },
  { id: 'ida', name: 'Ida', kind: 'asteroid', radius: 15.7, radii: [29.9, 12.7, 9.3], albedo: 0.262, color: [0.62, 0.58, 0.52], procedural: { seed: 191, craters: 1, rough: 0.7 }, periodH: 4.634, pole: [168.76, -2.88], sbdb: '243', priority: 45,
    subtitle: 'The first asteroid found to have a moon', desc: 'Galileo discovered tiny Dactyl orbiting it in 1993.' },
  { id: 'arrokoth', name: 'Arrokoth', kind: 'tno', radius: 9, radii: [18, 10, 5], albedo: 0.21, color: [0.7, 0.42, 0.32], model: 'arrokoth', periodH: 15.92, pole: [317.5, -24.9], sbdb: '486958', priority: 55,
    subtitle: 'The most distant world ever explored', desc: 'A pristine contact binary of two flattened lobes, imaged by New Horizons on 1 January 2019 at 43 AU. Its red colour comes from organic tholins.' },
  // ── comets (nucleus) ─────────────────────────────────────────────────────
  { id: 'halley', name: 'Halley’s Comet', kind: 'comet', radius: 5.5, radii: [7.5, 4.1, 4.1], albedo: 0.04, color: [0.3, 0.29, 0.28], procedural: { seed: 201, craters: 0.1, rough: 0.9 }, periodH: 52.8, pole: [0, 90], sbdb: '1P', priority: 70,
    subtitle: '1P/Halley · returns every ~76 years', desc: 'Recorded since 240 BC. It turned around at aphelion beyond Neptune in December 2023 and will next sweep through the inner Solar System in July 2061.' },
  { id: 'encke', name: 'Comet Encke', kind: 'comet', radius: 2.4, albedo: 0.046, color: [0.3, 0.29, 0.28], procedural: { seed: 211, craters: 0.1, rough: 0.8 }, periodH: 11.083, pole: [0, 90], sbdb: '2P', priority: 55,
    subtitle: '2P/Encke · the shortest-period comet', desc: 'Every 3.3 years it rounds the Sun; its debris stream produces the Taurid meteors.' },
  { id: 'cg67p', name: '67P/Churyumov–Gerasimenko', kind: 'comet', radius: 1.65, albedo: 0.065, color: [0.28, 0.27, 0.26], model: '67p', periodH: 12.76129, pole: [69.3, 64.1], sbdb: '67P', priority: 60,
    subtitle: 'The rubber-duck comet Rosetta orbited', desc: 'ESA’s Rosetta orbited this two-lobed nucleus for two years and set Philae down on it in 2014 — the first landing on a comet.' },
  { id: 'swifttuttle', name: 'Comet Swift–Tuttle', kind: 'comet', radius: 13, albedo: 0.04, color: [0.3, 0.29, 0.28], procedural: { seed: 221, craters: 0.1, rough: 0.8 }, periodH: 66, pole: [0, 90], sbdb: '109P', priority: 55,
    subtitle: '109P · parent of the Perseids', desc: 'A 26 km nucleus, the largest object that repeatedly passes near Earth. Each August we plough through its dust: the Perseid meteor shower.' },
  { id: 'tempeltuttle', name: 'Comet Tempel–Tuttle', kind: 'comet', radius: 1.8, albedo: 0.06, color: [0.3, 0.29, 0.28], procedural: { seed: 231, craters: 0.1, rough: 0.8 }, periodH: 15, pole: [0, 90], sbdb: '55P', priority: 45,
    subtitle: '55P · parent of the Leonids', desc: 'Its debris produces the Leonid meteor storms every 33 years.' },
  { id: 'ponsbrooks', name: 'Comet Pons–Brooks', kind: 'comet', radius: 15, albedo: 0.04, color: [0.3, 0.29, 0.28], procedural: { seed: 241, craters: 0.1, rough: 0.8 }, periodH: 57, pole: [0, 90], sbdb: '12P', priority: 45,
    subtitle: '12P · the “devil comet”', desc: 'A 71-year Halley-type comet whose outbursts gave it horns in 2023; perihelion was April 2024.' },
  { id: 'halebopp', name: 'Comet Hale–Bopp', kind: 'comet', radius: 30, albedo: 0.04, color: [0.3, 0.29, 0.28], procedural: { seed: 251, craters: 0.1, rough: 0.8 }, periodH: 11.4, pole: [0, 90], sbdb: 'C/1995 O1', priority: 55,
    subtitle: 'C/1995 O1 · the Great Comet of 1997', desc: 'Visible to the naked eye for a record 18 months, with a 60 km nucleus. It will not return for about 2,400 years.' },
  { id: 'neowise', name: 'Comet NEOWISE', kind: 'comet', radius: 2.5, albedo: 0.04, color: [0.3, 0.29, 0.28], procedural: { seed: 261, craters: 0.1, rough: 0.8 }, periodH: 7.6, pole: [0, 90], sbdb: 'C/2020 F3', priority: 45,
    subtitle: 'C/2020 F3 · the great comet of 2020', desc: 'The brightest northern-hemisphere comet since Hale–Bopp, with a striking curved dust tail in July 2020.' },
  { id: 'tsuchinshan', name: 'Comet Tsuchinshan–ATLAS', kind: 'comet', radius: 5, albedo: 0.04, color: [0.3, 0.29, 0.28], procedural: { seed: 271, craters: 0.1, rough: 0.8 }, periodH: 10, pole: [0, 90], sbdb: 'C/2023 A3', priority: 45,
    subtitle: 'C/2023 A3 · the comet of October 2024', desc: 'A dazzling evening comet in October 2024 that grew a rare anti-tail pointing toward the Sun.' },
  { id: 'atlas3i', name: '3I/ATLAS', kind: 'comet', radius: 2.8, albedo: 0.04, color: [0.3, 0.29, 0.28], procedural: { seed: 281, craters: 0.1, rough: 0.8 }, periodH: 16.8, pole: [0, 90], sbdb: '3I', priority: 65,
    subtitle: 'The third interstellar object ever found', desc: 'Discovered on 1 July 2025, this comet arrived from interstellar space on a hyperbolic orbit (e ≈ 6.1) at about 58 km/s. It passed perihelion at 1.36 AU on 29 October 2025 and is leaving the Solar System forever.' },
];
export const SATELLITE_EXTRA: Record<string, { name: string; parent: string; radius: number; albedo: number }> = {};
