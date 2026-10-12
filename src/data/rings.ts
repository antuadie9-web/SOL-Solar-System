// SOL v3.7 ring-system catalogue. Every ring-bearing body known in 2026 with observational support.
// Distances: km from the body centre in its equatorial plane (rings assumed equatorial unless stated).
// τ = NORMAL optical depth. ϖ = particle single-scattering albedo (Saturn: NSSDC "albedo" ranges; others NSSDC ≈ 0.015).
// Status: MEASURED (published value) · PROFILE (radial occultation profile used directly) · REPRESENTATIVE (structure
// known only statistically / time-variable; placed plausibly, labelled) · INFERRED (no measurement located).
export type RingStatus = 'MEASURED' | 'PROFILE' | 'REPRESENTATIVE' | 'INFERRED';
/** A narrow ring evaluated analytically in the shader (pixel-footprint box filter: sharp at any distance). */
/** v3.7.1 (RING-003): Keplerian centre-line orbit of an eccentric narrow ring. Longitudes are measured in the planet's
 *  equatorial plane from `refNode` (the ascending node of the planet's equator on the stated reference equator), at
 *  `epochJd` (TDB), with apsidal precession `periDotDegPerDay`. Width varies from `widthPeri` to `widthApo`
 *  (equivalent width conserved: τ·w ≈ const). Inclinations (≤ 0.06°, ≤ 46 km out of plane) are NOT drawn. */
export interface RingOrbit { a: number; e: number; periDeg: number; periDotDegPerDay: number; epochJd: number; refNode: 'uranus-equator-B1950'; widthPeri?: number; widthApo?: number; incDeg?: number; source: string }
export interface NarrowRing { name: string; r: number; width: number; tau: number; dust: number; status: RingStatus; source: string; arcs?: boolean; ecc?: number; orbit?: RingOrbit }
/** A broad component baked into the radial texture: box (rIn..rOut) with soft edges, or a Gaussian (r, width = FWHM). */
export interface BroadRing { name: string; rIn: number; rOut: number; tau: number; dust: number; shape?: 'box' | 'gauss' | 'tri'; peak?: number; status: RingStatus; source: string; vertical?: number }
export interface Arc { name: string; lon: number; len: number; tau: number }
export interface RingSystemDef {
  body: string; inner: number; outer: number;
  /** measured radial profile asset (normal τ, 1 km samples) — overrides broad components inside its span */
  profile?: { file: string; r0: number; dr: number; n: number; source: string; tauCap: number };
  narrow: NarrowRing[]; broad: BroadRing[];
  arcs?: { list: Arc[]; patternDegPerDay: number; epochJd: number; note: string };
  /** macroscopic-particle and dust optical properties */
  macro: { albedo: number; color: [number, number, number]; g: number; surge: number };
  dustProps: { albedo: number; color: [number, number, number]; g: number };
  /** colour map (radial RGB) used for Saturn only — colour, NOT optical depth */
  colorTex?: string;
  /** default visibility enhancement allowed outside Scientific mode (labelled in the UI) */
  enhanceMax: number;
  notes: string[];
}
const F88 = 'French et al. (1988) Icarus 73, 349, Table XIV via PDS Ring-Moon Systems Node uranus_ringframes_french_et_al_1988_v1 (epoch 1977-03-10 20:00 UTC; ϖ̇ from the J2–J4 field)';
const NSSDC = (p: string) => `NASA NSSDCA ${p} Rings Fact Sheet (D. R. Williams; Saturn upd. 2022-04-19, others 2015-10-14)`;
export const RING_SYSTEMS: Record<string, RingSystemDef> = {
  saturn: {
    body: 'saturn', inner: 66900, outer: 483000,
    profile: { file: 'rings/saturn_tau_pps_1km.u16', r0: 72000, dr: 1, n: 70500, tauCap: 4.5,
      source: 'Voyager 2 PPS δ Sco occultation (1981-08-26), PDS Ring-Moon Systems Node VG_2801 EASYDATA/KM001 PS1P0107–0114 (normal optical depth, 1 km)' },
    narrow: [],
    broad: [
      { name: 'D ring', rIn: 66900, rOut: 74510, tau: 1e-5, dust: 1, status: 'MEASURED', source: NSSDC('Saturnian') },
      { name: 'G ring', rIn: 166000, rOut: 173000, tau: 1e-6, dust: 1, shape: 'tri', peak: 167500, status: 'MEASURED', source: NSSDC('Saturnian') },
      // E ring: τ ~1e-6 peaking at Enceladus' orbit (238,040 km), ~1 µm ice grains from the south-polar plumes
      { name: 'E ring', rIn: 180000, rOut: 480000, tau: 1e-6, dust: 1, shape: 'tri', peak: 238040, status: 'MEASURED', source: NSSDC('Saturnian') + '; peak at Enceladus (Cassini CDA/ISS)' },
    ],
    // ring particles: strongly backscattering, opposition surge (Cuzzi et al.; Cassini VIMS/ISS); dust: forward
    macro: { albedo: 0.6, color: [1, 0.93, 0.82], g: -0.35, surge: 0.6 },   // ϖ: NSSDC A/B 'albedo' 0.4–0.6 (upper end; Cuzzi et al. 2009 Bond 0.5–0.6)
    dustProps: { albedo: 0.7, color: [0.92, 0.94, 1.0], g: 0.7 },
    colorTex: 'saturn_ring', enhanceMax: 1,
    notes: ['τ inside 72,000–142,500 km is the measured Voyager PPS profile (incl. C, B, Cassini Division, A, Encke/Keeler gaps, F ring core). PPS saturates in the densest B ring (τ ≳ 2.5–4): capped at 4.5 there.',
      'Ring colour (not τ) from the Solar System Scope ring map (CC BY 4.0) — art-level colour, labelled.', 'No self-gravity wakes, spokes or propeller structures (OPEN).'],
  },
  jupiter: {
    body: 'jupiter', inner: 89400, outer: 280000,
    narrow: [],
    broad: [
      { name: 'Halo', rIn: 89400, rOut: 123000, tau: 3e-6, dust: 1, status: 'MEASURED', source: NSSDC('Jupiter'), vertical: 10000 },
      { name: 'Main ring', rIn: 123000, rOut: 128940, tau: 5e-6, dust: 0.6, status: 'MEASURED', source: NSSDC('Jupiter') + '; dust fraction ≈ ½ (Throop et al. 2004) — APPROXIMATE' },
      { name: 'Amalthea gossamer ring', rIn: 128940, rOut: 181350, tau: 1e-7, dust: 1, status: 'MEASURED', source: NSSDC('Jupiter'), vertical: 2600 },
      { name: 'Thebe gossamer ring', rIn: 181350, rOut: 221900, tau: 1e-7, dust: 1, status: 'MEASURED', source: NSSDC('Jupiter'), vertical: 8800 },
      { name: 'Thebe extension', rIn: 221900, rOut: 280000, tau: 3e-8, dust: 1, status: 'MEASURED', source: NSSDC('Jupiter') + ' (τ for the extension: ≈ ⅓ of the Thebe ring, INFERRED from its faintness)' },
    ],
    macro: { albedo: 0.015, color: [0.9, 0.75, 0.62], g: -0.2, surge: 0.2 },
    dustProps: { albedo: 0.4, color: [1.0, 0.82, 0.66], g: 0.7 },
    enhanceMax: 200,   // v3.7 QA: ×1000 made the forward-scattering (backlit) rings blinding — gain is set at backscatter geometry
    notes: ['Rings are dust-dominated (Galileo: dust blasted off Metis/Adrastea/Amalthea/Thebe) and are brightest in forward scattering (backlit). Vertical thickness of the halo/gossamer rings is NOT rendered (flat sheet) — OPEN.'],
  },
  uranus: {
    body: 'uranus', inner: 37000, outer: 107000,
    narrow: [
      { name: '6', r: 41837, width: 1.5, tau: 0.3, dust: 0, status: 'MEASURED', source: NSSDC('Uranus'), orbit: { a: 41837.15, e: 0.001103, periDeg: 242.8, periDotDegPerDay: 2.76187, epochJd: 2443213.334458, refNode: 'uranus-equator-B1950', incDeg: 0.0616, source: F88 } },
      { name: '5', r: 42234, width: 2, tau: 0.5, dust: 0, status: 'MEASURED', source: NSSDC('Uranus'), orbit: { a: 42234.82, e: 0.001899, periDeg: 170.31, periDotDegPerDay: 2.67151, epochJd: 2443213.334458, refNode: 'uranus-equator-B1950', incDeg: 0.0536, source: F88 } },
      { name: '4', r: 42571, width: 2, tau: 0.3, dust: 0, status: 'MEASURED', source: NSSDC('Uranus'), orbit: { a: 42570.91, e: 0.001059, periDeg: 127.28, periDotDegPerDay: 2.59807, epochJd: 2443213.334458, refNode: 'uranus-equator-B1950', incDeg: 0.0323, source: F88 } },
      { name: 'α', r: 44718, width: 7, tau: 0.4, dust: 0, status: 'MEASURED', source: NSSDC('Uranus') + ' (width 4–10 km, mean used)', orbit: { a: 44718.45, e: 0.000761, periDeg: 333.24, periDotDegPerDay: 2.1853, epochJd: 2443213.334458, refNode: 'uranus-equator-B1950', incDeg: 0.0152, source: F88 } },
      { name: 'β', r: 45661, width: 8, tau: 0.3, dust: 0, status: 'MEASURED', source: NSSDC('Uranus') + ' (width 5–11 km, mean used)', orbit: { a: 45661.03, e: 0.000442, periDeg: 224.88, periDotDegPerDay: 2.03084, epochJd: 2443213.334458, refNode: 'uranus-equator-B1950', incDeg: 0.0051, source: F88 } },
      { name: 'η', r: 47176, width: 1.6, tau: 0.4, dust: 0, status: 'MEASURED', source: NSSDC('Uranus'), orbit: { a: 47175.91, e: 4e-06, periDeg: 228.1, periDotDegPerDay: 1.8108, epochJd: 2443213.334458, refNode: 'uranus-equator-B1950', incDeg: 0.0011, source: F88 } },
      { name: 'γ', r: 47627, width: 2.5, tau: 0.3, dust: 0, status: 'MEASURED', source: NSSDC('Uranus') + ' (width 1–4 km)', orbit: { a: 47626.87, e: 0.000109, periDeg: 132.1, periDotDegPerDay: 1.75128, epochJd: 2443213.334458, refNode: 'uranus-equator-B1950', incDeg: 0.0015, source: F88 } },
      { name: 'δ', r: 48300, width: 5, tau: 0.5, dust: 0.1, status: 'MEASURED', source: NSSDC('Uranus') + ' (width 3–7 km); PPS σ Sgr peak τ 0.57', orbit: { a: 48300.12, e: 4e-06, periDeg: 216.7, periDotDegPerDay: 1.66702, epochJd: 2443213.334458, refNode: 'uranus-equator-B1950', incDeg: 0.0011, source: F88 } },
      { name: 'λ', r: 50024, width: 2, tau: 0.1, dust: 0.8, status: 'MEASURED', source: NSSDC('Uranus') + ' (dusty: bright in forward scattering, Voyager high-phase image)' },
      { name: 'ε', r: 51149, width: 58, tau: 1.4, dust: 0, status: 'MEASURED', source: NSSDC('Uranus') + ' (width 20–96 km, τ 0.5–2.3: mean values; PPS ingress cut peak τ 2.7)', orbit: { a: 51149.32, e: 0.007936, periDeg: 214.97, periDotDegPerDay: 1.36325, epochJd: 2443213.334458, refNode: 'uranus-equator-B1950', incDeg: 0.0002, widthPeri: 19.7, widthApo: 96.4, source: F88 } },
    ],
    broad: [
      { name: 'ζ (1986U2R)', rIn: 37850, rOut: 41350, tau: 1e-4, dust: 1, status: 'REPRESENTATIVE', source: 'Voyager 2 1986U2R / Keck 2003–07 (de Pater et al. 2006, Icarus 180) — inner dusty sheet, τ order of magnitude' },
      { name: 'ν (R/2003 U 2)', rIn: 65400, rOut: 69200, tau: 1e-5, dust: 1, shape: 'gauss', peak: 67300, status: 'MEASURED', source: NSSDC('Uranus') + ' (τ ≪ 0.01; Showalter & Lissauer 2006)' },
      { name: 'μ (R/2003 U 1)', rIn: 89200, rOut: 106200, tau: 8.5e-6, dust: 1, shape: 'gauss', peak: 97700, status: 'MEASURED', source: NSSDC('Uranus') + ' (blue dust ring at Mab, de Pater et al. 2006)' },
    ],
    macro: { albedo: 0.015, color: [0.80, 0.80, 0.82], g: -0.3, surge: 0.3 },
    dustProps: { albedo: 0.5, color: [0.85, 0.9, 1.0], g: 0.6 },
    enhanceMax: 100,
    notes: ['13 rings: 6, 5, 4, α, β, η, γ, δ, λ, ε (narrow), ζ, ν, μ (dusty). Circular, mean radius/width/τ (NSSDC). The Voyager PPS σ Sgr profile was extracted (tools/ingest/rings_profiles.py) but NOT used radially: its equatorial-geometry cut places the eccentric ε ring at 50,870 km instead of a = 51,149 km. v3.7.1: eccentric centre lines with apsidal precession for 6, 5, 4, α, β, η, γ, δ, ε (French et al. 1988 elements; ε width 19.7 km at periapse → 96.4 km at apoapse, French et al. 1991); normal modes (γ m=0, δ m=2) and inclinations not drawn; λ circular.',
      'Rings lie in Uranus\' equatorial plane; the planet\'s 97.8° obliquity comes from the IAU rotation model already in SOL.'],
  },
  neptune: {
    body: 'neptune', inner: 39000, outer: 64000,
    narrow: [
      { name: 'Le Verrier', r: 53200, width: 113, tau: 0.01, dust: 0.5, status: 'MEASURED', source: NSSDC('Neptunian') + ' (width < 100 km; 113 km after Porco et al. 1995)' },
      { name: 'Arago', r: 57200, width: 100, tau: 1e-4, dust: 0.7, status: 'MEASURED', source: NSSDC('Neptunian') + ' (width < 100 km; τ not tabulated — Lassell-like value INFERRED)' },
      { name: 'Adams', r: 62933, width: 15, tau: 0.01, dust: 0.5, status: 'MEASURED', source: NSSDC('Neptunian') + ' (τ 0.01–0.1 outside the arcs)', arcs: true },
    ],
    broad: [
      { name: 'Galle', rIn: 40900, rOut: 42900, tau: 1e-4, dust: 0.7, status: 'MEASURED', source: NSSDC('Neptunian') },
      { name: 'Lassell', rIn: 53200, rOut: 57200, tau: 1e-4, dust: 0.7, status: 'MEASURED', source: NSSDC('Neptunian') },
      { name: 'Unnamed (Galatea orbit)', rIn: 61500, rOut: 62400, tau: 3e-5, dust: 1, status: 'REPRESENTATIVE', source: NSSDC('Neptunian') + ' (61,953 km, indistinct; τ INFERRED)' },
    ],
    arcs: {
      // arc pattern speed 820.1194 °/day (Dumas et al. 1999 Nature 400; Sicardy et al. 1999). Absolute longitude at the
      // SOL epoch is NOT anchored to an observation: relative layout ≈ Voyager/2003 (de Pater et al. 2005, Icarus 174),
      // with Liberté and Courage faded as reported by de Pater et al. 2018 (Icarus 300, Keck/HST 2016–17).
      list: [
        { name: 'Fraternité', lon: 0, len: 9.6, tau: 0.12 }, { name: 'Égalité 2', lon: 11.0, len: 1.5, tau: 0.12 }, { name: 'Égalité 1', lon: 13.5, len: 3.0, tau: 0.12 },
        { name: 'Liberté', lon: 25.0, len: 3.5, tau: 0.03 }, { name: 'Courage', lon: 33.0, len: 1.0, tau: 0.01 },
      ], patternDegPerDay: 820.1194, epochJd: 2451545.0, note: 'REPRESENTATIVE longitudes (relative layout only)',
    },
    macro: { albedo: 0.015, color: [0.95, 0.80, 0.72], g: -0.3, surge: 0.3 },
    dustProps: { albedo: 0.5, color: [1.0, 0.85, 0.75], g: 0.65 },
    enhanceMax: 1000,
    notes: ['Neptune\'s rings are reddish and dust-rich (Smith et al. 1989: 20–70 % dust by area). Arcs are confined in the Adams ring; their structure changes on decade scales — shown at a labelled representative state.'],
  },
  chariklo: {
    body: 'chariklo', inner: 380, outer: 415,
    narrow: [
      { name: 'C1R', r: 390.6, width: 6.5, tau: 0.38, dust: 0, status: 'MEASURED', source: 'Braga-Ribas et al. 2014 (Nature 508) radius/τ; width mean 6.5 km (Morgado et al. 2021, A&A 652)' },
      { name: 'C2R', r: 404.8, width: 3.5, tau: 0.06, dust: 0, status: 'MEASURED', source: 'Braga-Ribas et al. 2014' },
    ],
    broad: [], macro: { albedo: 0.08, color: [0.85, 0.85, 0.85], g: -0.3, surge: 0.3 }, dustProps: { albedo: 0.3, color: [1, 1, 1], g: 0.6 }, enhanceMax: 1,
    notes: ['Ring particle albedo unknown — 0.08 INFERRED (water-ice signature, Duffard et al. 2014). Rings assumed in Chariklo\'s equatorial plane; pole = ring pole (Braga-Ribas 2014, α 151.30°, δ 41.48°).'],
  },
  haumea: {
    body: 'haumea', inner: 2200, outer: 2380,
    narrow: [{ name: 'Haumea ring', r: 2287, width: 70, tau: 0.5, dust: 0, status: 'MEASURED', source: 'Ortiz et al. 2017 (Nature 550): radius 2287 (+75/−45) km, width ≈ 70 km, normal τ ≈ 0.5, equatorial (coplanar with Hiʻiaka)' }],
    broad: [], macro: { albedo: 0.1, color: [0.9, 0.9, 0.9], g: -0.3, surge: 0.3 }, dustProps: { albedo: 0.3, color: [1, 1, 1], g: 0.6 }, enhanceMax: 1,
    notes: ['Particle albedo unknown — 0.1 INFERRED. Ring at the 3:1 spin–orbit resonance.'],
  },
  quaoar: {
    body: 'quaoar', inner: 2450, outer: 4200,
    narrow: [
      { name: 'Q2R', r: 2520, width: 10, tau: 0.004, dust: 0, status: 'MEASURED', source: 'Pereira et al. 2023 (A&A 673, L4): 2520 ± 20 km, width ≈ 10 km, τ ≈ 0.004' },
      { name: 'Q1R dense part', r: 4057, width: 5, tau: 0.4, dust: 0, status: 'REPRESENTATIVE', source: 'Pereira et al. 2023: Lorentzian FWHM 5 km, peak τ 0.4, seen over arcs ≥ several hundred km (azimuthal extent REPRESENTATIVE)', arcs: true },
    ],
    broad: [{ name: 'Q1R tenuous', rIn: 4010, rOut: 4100, tau: 0.003, dust: 0, status: 'MEASURED', source: 'Pereira et al. 2023: continuous part, width 80–100 km, τ ≈ 0.003' }],
    arcs: { list: [{ name: 'Q1R dense arc', lon: 0, len: 40, tau: 1 }], patternDegPerDay: 0, epochJd: 2459800.5, note: 'dense-arc azimuth REPRESENTATIVE (τ factor relative to the dense part)' },
    macro: { albedo: 0.1, color: [0.88, 0.82, 0.78], g: -0.3, surge: 0.3 }, dustProps: { albedo: 0.3, color: [1, 1, 1], g: 0.6 }, enhanceMax: 20,
    notes: ['Both rings lie far outside Quaoar\'s Roche limit; pole α 259.82°, δ 53.45° (Pereira et al. 2023; JWST 2025: 259.5°, 55.0°), Quaoar assumed aligned with its rings.'],
  },
};
/** Which catalogue bodies carry rings (inventory for the coverage matrix). */
/** Region labels for the scientific overlay (radius km). Saturn's main-ring regions are inside the measured profile. */
export function ringLabels(def: RingSystemDef): { name: string; r: number }[] {
  if (def.body === 'saturn') return [['D', 70700], ['C', 83300], ['B', 104700], ['Cassini Div.', 119900], ['A', 129500], ['Encke gap', 133590], ['Keeler gap', 136505], ['F', 140180], ['G', 167500], ['E', 238040]].map(([name, r]) => ({ name: name as string, r: r as number }));
  return [...def.narrow.map(n => ({ name: n.name, r: n.r })), ...def.broad.map(b => ({ name: b.name, r: b.peak ?? (b.rIn + b.rOut) / 2 }))];
}
export const RINGED_BODIES = Object.keys(RING_SYSTEMS);
/** Equivalent depth A_τ = ∫τ dr (km) of a narrow ring — the conserved quantity when a ring is narrower than a pixel. */
export const equivalentDepth = (n: NarrowRing) => n.tau * n.width;
