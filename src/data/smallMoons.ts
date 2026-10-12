// SOL v3.7.1 — physical properties of the "minor" moons (the ~430 JPL-table satellites that are not curated catalogue
// bodies). v3.3–3.7 drew every one of them as the same body: albedo 0.08, colour (0.50, 0.48, 0.46), crater 0.8 / rough
// 0.7, a sphere of its mean radius — so bright, smooth Saturnian ring moons (pv ≈ 0.8–1.3) looked like dark Jovian
// irregulars (pv ≈ 0.04). This module supplies, in order of preference:
//   1. MEASURED triaxial dimensions, geometric albedo and colour for the moons where they are published (table below);
//   2. otherwise a DYNAMICAL-GROUP PRIOR (inner/irregular, prograde/retrograde, host planet) for albedo, colour class and
//      surface character, from population studies — clearly labelled REPRESENTATIVE (never presented as observed).
// Colour: reflectance ratios from Johnson colour indices relative to the Sun (B−V☉ = 0.65, V−R☉ = 0.36):
//   R_B/R_V = 10^(−0.4((B−V) − 0.65)),  R_R/R_V = 10^(0.4((V−R) − 0.36))  → linear tint (R, V, B), luminance-normalised.
// Geometric albedos above 1 (opposition-surge-dominated values for the E-ring-coated Trojans) are capped at 1.0 for the
// renderer's reflectance scale; the measured value stays in the metadata.
// Sources were checked 2026-10-10 against the Wikipedia infobox citations of the primary literature listed per entry.

export type MoonClass = 'icy-ring' | 'icy-coorbital' | 'icy-trojan' | 'icy-smooth' | 'inner-red' | 'inner-dark' | 'irregular-C' | 'irregular-P' | 'irregular-D' | 'kbo-ice';
export interface SmallMoonProps {
  /** triaxial DIAMETERS (km) as published (a ≥ b ≥ c) */
  dims?: [number, number, number];
  /** geometric albedo pV */
  albedo?: number;
  /** Johnson colour indices */
  bv?: number; vr?: number;
  cls: MoonClass;
  /** measured (light-curve) rotation period, hours; absent = synchronous for regular moons / unknown for irregulars */
  periodH?: number;
  status: 'MEASURED' | 'PARTLY MEASURED';
  sources: string[];
}
const TB98 = 'Thomas, Burns et al. 1998, Icarus 135, 360 (Galileo SSI shapes)';
const SR00 = 'Simonelli, Rossier et al. 2000, Icarus 147, 353 (albedos)';
const TH20 = 'Thomas & Helfenstein 2020, Icarus 344, 113355 (Cassini ISS shapes)';
const V18 = 'Verbiscer, Helfenstein, Buratti & Royer 2018, in Enceladus and the Icy Moons of Saturn, p. 325 (geometric albedos)';
const G15 = 'Grav et al. 2015, ApJ 809, 3 (NEOWISE irregular satellites)';
const K01 = 'Karkoschka 2001, Icarus 151, 69 / 2003 Icarus 162, 400 (Uranian & Neptunian inner moons)';
const W16 = 'Weaver et al. 2016, Science 351, aae0030 (Pluto small satellites)';
export const SMALL_MOONS: Record<string, SmallMoonProps> = {
  // Jupiter inner (red, dark; Galileo SSI)
  Metis: { dims: [60, 40, 34], albedo: 0.061, bv: 1.0, vr: 0.6, cls: 'inner-red', status: 'MEASURED', sources: [TB98, SR00, 'colour: red like Amalthea/Thebe (Galileo SSI) — index REPRESENTATIVE'] },
  Adrastea: { dims: [20, 16, 14], albedo: 0.10, bv: 1.0, vr: 0.6, cls: 'inner-red', status: 'MEASURED', sources: [TB98, 'colour REPRESENTATIVE (Galileo: red inner moons)'] },
  Thebe: { dims: [116, 98, 84], albedo: 0.047, bv: 1.0, vr: 0.6, cls: 'inner-red', status: 'MEASURED', sources: [TB98, SR00, 'colour: very red (Galileo SSI) — index REPRESENTATIVE'] },
  // Jupiter irregulars (NEOWISE)
  Himalia: { periodH: 7.7819, dims: [150, 150, 120], albedo: 0.057, cls: 'irregular-C', status: 'PARTLY MEASURED', sources: [G15, 'Porco et al. 2003, Science 299, 1541 (Cassini 150 × 120 km)'] },
  Elara: { periodH: 9.596, albedo: 0.046, cls: 'irregular-C', status: 'PARTLY MEASURED', sources: [G15] },
  Pasiphae: { albedo: 0.044, cls: 'irregular-C', status: 'PARTLY MEASURED', sources: [G15] },
  Sinope: { periodH: 13.16, albedo: 0.042, cls: 'irregular-D', status: 'PARTLY MEASURED', sources: [G15] },
  Carme: { periodH: 10.4, albedo: 0.035, cls: 'irregular-D', status: 'PARTLY MEASURED', sources: [G15] },
  Ananke: { periodH: 8.31, albedo: 0.038, cls: 'irregular-P', status: 'PARTLY MEASURED', sources: [G15] },
  Lysithea: { periodH: 12.78, albedo: 0.036, cls: 'irregular-C', status: 'PARTLY MEASURED', sources: [G15] },
  Leda: { albedo: 0.034, cls: 'irregular-C', status: 'PARTLY MEASURED', sources: [G15] },
  // Saturn ring and inner moons (Cassini ISS)
  Pan: { dims: [34.6, 28.2, 21.0], albedo: 0.86, bv: 0.75, vr: 0.42, cls: 'icy-ring', status: 'MEASURED', sources: [TH20, V18, 'equatorial ridge: Charnoz et al. 2007, Science 318, 1622; reddish ring-moon colour: Buratti et al. 2019, Science 364 (index REPRESENTATIVE)'] },
  Daphnis: { dims: [9.8, 8.4, 5.6], albedo: 0.91, bv: 0.75, vr: 0.42, cls: 'icy-ring', status: 'MEASURED', sources: [TH20, V18, 'Buratti et al. 2019 (colour REPRESENTATIVE)'] },
  Atlas: { dims: [40.8, 35.4, 18.6], albedo: 0.82, bv: 0.75, vr: 0.42, cls: 'icy-ring', status: 'MEASURED', sources: [TH20, V18, 'equatorial ridge: Charnoz et al. 2007; Buratti et al. 2019 (colour REPRESENTATIVE)'] },
  Prometheus: { dims: [137.0, 81.0, 56.2], albedo: 1.05, bv: 0.72, vr: 0.40, cls: 'icy-coorbital', status: 'MEASURED', sources: [TH20, V18] },
  Pandora: { dims: [103.0, 79.0, 63.0], albedo: 0.99, bv: 0.72, vr: 0.40, cls: 'icy-coorbital', status: 'MEASURED', sources: [TH20, V18] },
  Janus: { dims: [203.4, 185.8, 149.0], albedo: 0.71, cls: 'icy-coorbital', status: 'MEASURED', sources: [TH20, V18] },
  Epimetheus: { dims: [129.6, 116.2, 107.0], albedo: 0.73, cls: 'icy-coorbital', status: 'MEASURED', sources: [TH20, V18] },
  Methone: { dims: [3.88, 2.58, 2.42], albedo: 0.57, cls: 'icy-smooth', status: 'MEASURED', sources: [TH20, V18, 'smooth, crater-free egg shape: Thomas et al. 2013, Icarus 226, 999'] },
  Telesto: { dims: [33.2, 23.4, 19.2], albedo: 0.97, cls: 'icy-trojan', status: 'MEASURED', sources: [TH20, V18, 'smooth, mantled surface: Thomas et al. 2013'] },
  Calypso: { dims: [29.4, 18.6, 12.8], albedo: 1.34, cls: 'icy-trojan', status: 'MEASURED', sources: [TH20, V18] },
  Helene: { dims: [45.2, 39.2, 26.6], albedo: 1.67, cls: 'icy-trojan', status: 'MEASURED', sources: [TH20, V18, 'dust-mantled "gullied" terrain (Cassini ISS 2011)'] },
  // Saturn irregulars
  Kiviuq: { periodH: 21.97, bv: 0.87, vr: 0.66, cls: 'irregular-D', status: 'PARTLY MEASURED', sources: ['colour: Grav et al. 2003, Icarus 166, 33; albedo ASSUMED 0.06'] },
  Paaliaq: { periodH: 18.79, bv: 0.86, vr: 0.40, cls: 'irregular-D', status: 'PARTLY MEASURED', sources: ['colour: Grav et al. 2003; albedo ASSUMED 0.06'] },
  Siarnaq: { periodH: 10.18785, albedo: 0.050, bv: 0.87, vr: 0.48, cls: 'irregular-D', status: 'PARTLY MEASURED', sources: [G15, 'colour: Grav et al. 2003'] },
  Albiorix: { periodH: 13.33, albedo: 0.062, cls: 'irregular-D', status: 'PARTLY MEASURED', sources: [G15] },
  Ymir: { periodH: 11.9222, cls: 'irregular-P', status: 'PARTLY MEASURED', sources: ['Denk et al. 2018 (light curve); albedo ASSUMED 0.06'] },
  // Uranus
  Puck: { dims: [162, 162, 162], albedo: 0.104, cls: 'inner-dark', status: 'MEASURED', sources: [K01, 'Voyager 2 ISS (only resolved small Uranian moon)'] },
  Portia: { dims: [156, 126, 126], albedo: 0.069, cls: 'inner-dark', status: 'MEASURED', sources: [K01] },
  Sycorax: { periodH: 6.9162, albedo: 0.065, bv: 0.839, vr: 0.531, cls: 'irregular-D', status: 'PARTLY MEASURED', sources: ['Lellouch et al. 2013 (Herschel albedo); Grav et al. 2004 (colour)'] },
  // Neptune inner (Voyager 2; Karkoschka 2003)
  Proteus: { dims: [424, 390, 396], albedo: 0.096, cls: 'inner-dark', status: 'MEASURED', sources: [K01, 'Stooke 1994'] },
  Larissa: { dims: [216, 204, 168], albedo: 0.091, cls: 'inner-dark', status: 'MEASURED', sources: [K01] },
  Galatea: { dims: [204, 184, 144], albedo: 0.079, cls: 'inner-dark', status: 'MEASURED', sources: [K01] },
  Despina: { dims: [180, 148, 128], albedo: 0.090, cls: 'inner-dark', status: 'MEASURED', sources: [K01] },
  // Pluto small satellites (New Horizons)
  Nix: { periodH: 43.896, dims: [49.8, 33.2, 31.1], albedo: 0.56, cls: 'kbo-ice', status: 'MEASURED', sources: [W16, 'Porter et al. 2023 (shape)'] },
  Hydra: { periodH: 10.31, dims: [50.9, 36.1, 30.9], albedo: 0.83, cls: 'kbo-ice', status: 'MEASURED', sources: [W16] },
};

/** Class priors (REPRESENTATIVE): default albedo, colour indices, procedural surface character and identity families. */
export const CLASS_PRIORS: Record<MoonClass, { albedo: number; bv: number; vr: number; craters: number; rough: number; surface: string; shape: string; basis: string; source: string }> = {
  'icy-ring': { albedo: 0.85, bv: 0.75, vr: 0.42, craters: 0.15, rough: 0.12, surface: 'mantled-ice', shape: 'ridged', basis: 'Ring-embedded moon: bright, reddish like the main rings, low-density accreted ring material; equatorial ridge (Pan, Atlas).', source: 'Charnoz et al. 2007; Buratti et al. 2019; Thomas & Helfenstein 2020' },
  'icy-coorbital': { albedo: 0.75, bv: 0.70, vr: 0.38, craters: 0.85, rough: 0.35, surface: 'cratered-ice', shape: 'fragment', basis: 'Bright, cratered icy moon inside the E ring (Cassini ISS).', source: 'Thomas & Helfenstein 2020; Verbiscer et al. 2018' },
  'icy-trojan': { albedo: 1.0, bv: 0.68, vr: 0.37, craters: 0.25, rough: 0.2, surface: 'mantled-ice', shape: 'fragment', basis: 'Tethys/Dione Trojan: very bright, E-ring-dust-mantled, smooth with subdued craters (Cassini ISS).', source: 'Thomas et al. 2013; Verbiscer et al. 2018' },
  'icy-smooth': { albedo: 0.6, bv: 0.70, vr: 0.38, craters: 0.0, rough: 0.03, surface: 'mantled-ice', shape: 'ellipsoid', basis: 'Alkyonide moonlet (Methone/Pallene/Anthe class): crater-free smooth egg in hydrostatic-like equilibrium with fine ice (Cassini 2012).', source: 'Thomas et al. 2013, Icarus 226, 999' },
  'inner-red': { albedo: 0.07, bv: 1.0, vr: 0.6, craters: 0.9, rough: 0.5, surface: 'red-silicate', shape: 'fragment', basis: 'Jovian inner moon: dark, very red (sulphur/silicate contamination from Io), source of the gossamer rings.', source: 'Thomas et al. 1998; Simonelli et al. 2000' },
  'inner-dark': { albedo: 0.08, bv: 0.70, vr: 0.38, craters: 0.9, rough: 0.4, surface: 'dark-rubble', shape: 'fragment', basis: 'Uranian/Neptunian inner moon: dark, nearly neutral (radiation-darkened ice/carbon).', source: 'Karkoschka 2001, 2003' },
  'irregular-C': { albedo: 0.05, bv: 0.70, vr: 0.38, craters: 1.0, rough: 0.6, surface: 'dark-rubble', shape: 'fragment', basis: 'Captured irregular satellite, grey C-type collisional fragment (NEOWISE/ground-based colours).', source: 'Grav et al. 2003, 2015' },
  'irregular-P': { albedo: 0.05, bv: 0.76, vr: 0.43, craters: 1.0, rough: 0.6, surface: 'dark-rubble', shape: 'fragment', basis: 'Captured irregular satellite, slightly red P-type (population colours).', source: 'Grav et al. 2003, 2015' },
  'irregular-D': { albedo: 0.06, bv: 0.85, vr: 0.50, craters: 1.0, rough: 0.6, surface: 'red-silicate', shape: 'fragment', basis: 'Captured irregular satellite, red D-type (Saturn Gallic/Inuit groups, Uranian irregulars).', source: 'Grav et al. 2003, 2004, 2015' },
  'kbo-ice': { albedo: 0.6, bv: 0.68, vr: 0.37, craters: 0.6, rough: 0.35, surface: 'cratered-ice', shape: 'fragment', basis: 'Pluto small satellite: neutral, bright crystalline water ice (New Horizons).', source: 'Weaver et al. 2016' },
};

/** Linear reflectance tint (R, G, B ≈ R, V, B bands) from Johnson colour indices, luminance-normalised to 1. */
export function tintFromIndices(bv: number, vr: number): [number, number, number] {
  const rB = Math.pow(10, -0.4 * (bv - 0.65)), rR = Math.pow(10, 0.4 * (vr - 0.36));
  const t: [number, number, number] = [rR, 1, rB];
  const L = 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
  return [t[0] / L, t[1] / L, t[2] / L];
}
/** Dynamical-group class for a moon without a table entry. `aKm` semi-major axis, `iDeg` inclination to the ecliptic or
 *  Laplace plane as tabulated (retrograde if > 90°). */
export function classifyMoon(planet: string, aKm: number, iDeg: number): MoonClass {
  const retro = iDeg > 90;
  const irr = (planet === 'Jupiter' && aKm > 5e6) || (planet === 'Saturn' && aKm > 5e6) || (planet === 'Uranus' && aKm > 3e6) || (planet === 'Neptune' && aKm > 5e6);
  if (irr) {
    if (planet === 'Jupiter') return retro ? 'irregular-P' : 'irregular-C';
    if (planet === 'Saturn') return retro ? 'irregular-P' : 'irregular-D';   // Norse (retrograde) greyer; Gallic/Inuit red (Grav et al. 2003)
    if (planet === 'Uranus') return 'irregular-D';
    return 'irregular-C';
  }
  if (planet === 'Jupiter') return 'inner-red';
  if (planet === 'Saturn') return aKm < 140500 ? 'icy-ring' : aKm < 160000 ? 'icy-coorbital' : 'icy-smooth';
  if (planet === 'Pluto') return 'kbo-ice';
  return 'inner-dark';
}
export interface ResolvedMoon { periodH?: number; irregular: boolean; radius: number; radii?: [number, number, number]; albedo: number; tint: [number, number, number]; cls: MoonClass; status: string; sources: string[]; craters: number; rough: number; surface: string; shape: string; basis: string }
/** Resolve the rendering properties of a minor moon (measured where possible, class prior otherwise). */
export function resolveSmallMoon(name: string, planet: string, aKm: number, iDeg: number, radiusKm: number): ResolvedMoon {
  const m = SMALL_MOONS[name];
  const cls = m?.cls ?? classifyMoon(planet, aKm, iDeg);
  const P = CLASS_PRIORS[cls];
  const dims = m?.dims;
  const radius = dims ? Math.cbrt(dims[0] * dims[1] * dims[2]) / 2 : radiusKm;
  const albedo = Math.min(1, m?.albedo ?? P.albedo);
  const tint = tintFromIndices(m?.bv ?? P.bv, m?.vr ?? P.vr);
  const status = m ? m.status + (m.albedo === undefined ? ' (albedo: class prior)' : '') : 'REPRESENTATIVE (dynamical-group prior)';
  const irregular = cls.startsWith('irregular');
  return { periodH: m?.periodH, irregular, radius, radii: dims ? [dims[0] / 2, dims[1] / 2, dims[2] / 2] : undefined, albedo, tint, cls, status, sources: m ? [...m.sources, P.source] : [P.source],
    craters: P.craters, rough: P.rough, surface: P.surface, shape: P.shape, basis: P.basis };
}
