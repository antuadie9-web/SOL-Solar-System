// SOL v3.8 — selected deep-sky reference objects (spec §26). A deliberately SMALL, accurately located set that gives
// Galactic context: positions are ICRS (J2000) centres, distances are measured (cluster parallax, maser/VLBA parallax,
// stellar orbits) unless marked otherwise. They are drawn as LABELLED MARKERS only — no volumetric nebula or cluster model
// is rendered in v3.8 (that is v3.9/P9–P10 work); the marker never claims an appearance.
export type DsoKind = 'open-cluster' | 'emission-nebula' | 'dark-cloud' | 'molecular-cloud' | 'galactic-centre';
export interface DeepSkyObject { id: string; name: string; kind: DsoKind; raDeg: number; decDeg: number; distPc: number; distSigmaPc?: number; radiusPc: number;
  distanceKind: 'cluster parallax' | 'VLBA parallax' | 'stellar orbits' | 'Gaia stellar distances' | 'extinction-jump distance'; status: 'MEASURED' | 'APPROXIMATE'; source: string; note: string }
const GB18 = 'Gaia Collaboration, Babusiaux et al. 2018, A&A 616, A10 (Table 2 cluster parallaxes)';
export const DEEP_SKY: DeepSkyObject[] = [
  { id: 'dso:hyades', name: 'Hyades', kind: 'open-cluster', raDeg: 66.725, decDeg: 15.867, distPc: 1000 / 21.052, radiusPc: 10, distanceKind: 'cluster parallax', status: 'MEASURED', source: GB18 + ' — ϖ = 21.052 mas', note: 'Nearest open cluster; its members are inside SOL’s 100-pc Gaia catalogue, so travelling here shows the real cluster in 3-D.' },
  { id: 'dso:pleiades', name: 'Pleiades (M45)', kind: 'open-cluster', raDeg: 56.75, decDeg: 24.117, distPc: 1000 / 7.364, radiusPc: 8, distanceKind: 'cluster parallax', status: 'MEASURED', source: GB18 + ' — ϖ = 7.364 mas', note: 'Beyond the 100-pc catalogue limit: members are not yet streamed (v3.9 Gaia DR3 tiles).' },
  { id: 'dso:praesepe', name: 'Praesepe (M44)', kind: 'open-cluster', raDeg: 130.1, decDeg: 19.667, distPc: 1000 / 5.371, radiusPc: 7, distanceKind: 'cluster parallax', status: 'MEASURED', source: GB18 + ' — ϖ = 5.371 mas', note: 'Beyond the 100-pc catalogue limit.' },
  { id: 'dso:taurus-mc', name: 'Taurus Molecular Cloud', kind: 'molecular-cloud', raDeg: 68.0, decDeg: 25.0, distPc: 140, distSigmaPc: 10, radiusPc: 15, distanceKind: 'VLBA parallax', status: 'APPROXIMATE', source: 'Galli et al. 2018, ApJ 859, 33 (VLBA/Gaia: 126–162 pc for sub-clouds)', note: 'Extended complex; one representative centre and distance.' },
  { id: 'dso:coalsack', name: 'Coalsack', kind: 'dark-cloud', raDeg: 190.0, decDeg: -63.0, distPc: 180, distSigmaPc: 30, radiusPc: 7, distanceKind: 'extinction-jump distance', status: 'APPROXIMATE', source: 'Knude & Høg 1998, A&A 338, 897 (≈ 180 pc); dark region visible in SOL’s observed Gaia panorama', note: 'A dark nebula: its darkness in the sky map is real (observed); no 3-D model.' },
  { id: 'dso:orion-nebula', name: 'Orion Nebula (M42)', kind: 'emission-nebula', raDeg: 83.822, decDeg: -5.391, distPc: 388, distSigmaPc: 5, radiusPc: 4, distanceKind: 'VLBA parallax', status: 'MEASURED', source: 'Kounkel et al. 2017, ApJ 834, 142 (VLBA parallaxes, 388 ± 5 pc)', note: 'Nearest massive star-forming region.' },
  { id: 'dso:lagoon', name: 'Lagoon Nebula (M8)', kind: 'emission-nebula', raDeg: 270.92, decDeg: -24.38, distPc: 1250, distSigmaPc: 100, radiusPc: 15, distanceKind: 'Gaia stellar distances', status: 'APPROXIMATE', source: 'Kuhn et al. 2019, ApJ 870, 32 (Gaia DR2 young-star distances ≈ 1.3 kpc)', note: 'Sagittarius–Carina arm.' },
  { id: 'dso:carina', name: 'Carina Nebula', kind: 'emission-nebula', raDeg: 161.27, decDeg: -59.87, distPc: 2350, distSigmaPc: 50, radiusPc: 40, distanceKind: 'Gaia stellar distances', status: 'APPROXIMATE', source: 'Smith 2006, ApJ 644, 1151 (2.35 ± 0.05 kpc from η Car’s nebula); Gaia DR2 consistent', note: 'Sagittarius–Carina arm; home of η Carinae.' },
  { id: 'dso:sgr-a', name: 'Galactic Centre (Sgr A*)', kind: 'galactic-centre', raDeg: 266.41683708, decDeg: -29.00781056, distPc: 8178, distSigmaPc: 13, radiusPc: 1, distanceKind: 'stellar orbits', status: 'MEASURED', source: 'GRAVITY Collaboration 2019, A&A 625, L10 (S2 orbit: R0 = 8.178 ± 0.013 kpc); position Reid & Brunthaler 2004', note: 'The 4-million-solar-mass black hole at the centre of the Milky Way.' },
];
/** heliocentric ecliptic J2000 position (km) of an ICRS direction + distance */
export function dsoEclipticKm(o: DeepSkyObject): [number, number, number] {
  const PC = 3.0856775814913673e13, r = o.raDeg * Math.PI / 180, d = o.decDeg * Math.PI / 180, e = 23.4392911 * Math.PI / 180;
  const x = Math.cos(d) * Math.cos(r), y = Math.cos(d) * Math.sin(r), z = Math.sin(d), k = o.distPc * PC;
  return [x * k, (Math.cos(e) * y + Math.sin(e) * z) * k, (-Math.sin(e) * y + Math.cos(e) * z) * k];
}
/** navigable when its stars are inside SOL's streamed 3-D catalogue (GCNS ≤ 100 pc) */
export const dsoNavigable = (o: DeepSkyObject) => o.distPc + o.radiusPc <= 100;
