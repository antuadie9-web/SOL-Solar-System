// BodyVisualProfile registry — spec §8 "Identity is more than a random seed", four-tier content policy.
//
// Every resolved body gets a stable profile: evidence tier, truth label, shape family, surface family, a seed derived
// from its canonical id (never from array order), and the reasoning/sources behind the family choice. Families are
// selected from published mission results or physical class, not by category label alone; where a body has no resolved
// imagery the profile says so and the renderer labels the result as a reconstruction.
import type { BodyDef } from '../data/catalog';

export type EvidenceTier = 'A' | 'B' | 'C' | 'D';
export const TIER_LABEL: Record<EvidenceTier, string> = {
  A: 'Observed / mapped', B: 'Observed + reconstructed', C: 'Modelled / inferred', D: 'Representative visualization',
};
export type ShapeFamily = 'ellipsoid' | 'cratered' | 'fragment' | 'rubble-top' | 'contact-binary' | 'sponge' | 'comet-nucleus' | 'model';
export type SurfaceFamily = 'mapped' | 'cratered-rock' | 'icy-tectonic' | 'dark-rubble' | 'comet-mantle' | 'volatile-dwarf' | 'metal-rich' | 'sponge-ice' | 'red-silicate' | 'mantled-ice' | 'cratered-ice';
/** Index used by the WGSL surface generator (keep in sync with planetMaterial.ts `familySurface`). */
export const SURFACE_INDEX: Record<SurfaceFamily, number> = {
  'mapped': 0, 'cratered-rock': 1, 'icy-tectonic': 2, 'dark-rubble': 3, 'comet-mantle': 4, 'volatile-dwarf': 5, 'metal-rich': 6, 'sponge-ice': 7, 'red-silicate': 8, 'mantled-ice': 9, 'cratered-ice': 10,
};
export interface BodyVisualProfile {
  id: string; tier: EvidenceTier; shape: ShapeFamily; surface: SurfaceFamily; seed: number;
  /** crater density 0..1.5 (age class), roughness of silhouette 0..1 */
  craterDensity: number; roughness: number;
  /** extra shape parameters per family: lobe ratio/neck for binaries, ridge height for spinning tops, facet count… */
  shapeParams?: Record<string, number>;
  /** v3.8: mean radius (km) — scales size-dependent geology (facets, resolved clasts); filled by visualProfile() */
  radiusKm?: number;
  basis: string;           // why this family (literature / mission), shown in the inspector
  sources: string[];       // citations (URLs or bibliographic references)
}
/** FNV-1a 32-bit hash of the canonical id → stable seed (same body, same look, on every load and device). */
export function stableSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 65521;
}
type P = Omit<BodyVisualProfile, 'id' | 'seed'>;
const NH = 'New Horizons LORRI/MVIC (Stern et al. 2019; Spencer et al. 2020, Science)';
// Curated profiles for bodies whose look is NOT fully determined by a global map. Mapped worlds default to tier A.
const CURATED: Record<string, P> = {
  sun: { tier: 'C', shape: 'ellipsoid', surface: 'mapped', craterDensity: 0, roughness: 0, basis: 'Radius, rotation and limb darkening are measured; the photosphere pattern (granules, spots, faculae) is a statistically simulated active Sun, not this date’s Sun.', sources: ['Neckel & Labs 1994, Solar Physics 153, 91', 'Snodgrass & Ulrich 1990, ApJ 351, 309', 'NASA SDO HMI continuum (reference imagery)'] },
  amalthea: { tier: 'C', shape: 'fragment', surface: 'red-silicate', craterDensity: 1.0, roughness: 0.55, basis: 'Irregular, very red (reddest object in the Solar System per Galileo SSI); shape from Voyager/Galileo limb fits (Thomas et al. 1998).', sources: ['Galileo SSI / Voyager imaging (Thomas et al. 1998)'] },
  hyperion: { tier: 'C', shape: 'sponge', surface: 'sponge-ice', craterDensity: 1.5, roughness: 0.75, shapeParams: { pits: 1 }, basis: 'Porous (ρ≈0.54 g/cm³) body with deep, sharp-rimmed overlapping craters and dark crater floors (Cassini ISS).', sources: ['Cassini ISS (Thomas et al. 2007, Nature)'] },
  phoebe: { tier: 'B', shape: 'model', surface: 'dark-rubble', craterDensity: 1.2, roughness: 0.35, basis: 'Shape OBSERVED: Gaskell (2012) Cassini stereophotoclinometry model (PDS SBN gaskell.phoebe.shape-model). Surface shading reconstructed: dark (pv≈0.08), heavily cratered, bright ice on crater walls (Cassini 2004 flyby).', sources: ['Gaskell, R.W. (2020), Gaskell Phoebe Shape Model V1.0, PDS, doi:10.26033/ehkj-xj95', 'Cassini ISS (Porco et al. 2005, Science)'] },
  miranda: { tier: 'C', shape: 'ellipsoid', surface: 'icy-tectonic', craterDensity: 0.6, roughness: 0.15, shapeParams: { coronae: 1 }, basis: 'Patchwork of grooved coronae, scarps up to ~20 km (Verona Rupes) and cratered terrain (Voyager 2, southern hemisphere only). Map not in SOL’s asset set → reconstruction.', sources: ['Voyager 2 ISS (Smith et al. 1986, Science)'] },
  umbriel: { tier: 'C', shape: 'ellipsoid', surface: 'cratered-rock', craterDensity: 1.25, roughness: 0.1, basis: 'Darkest major Uranian moon, ancient heavily cratered surface; bright ring on Wunda crater (Voyager 2).', sources: ['Voyager 2 ISS (Smith et al. 1986, Science)'] },
  proteus: { tier: 'C', shape: 'fragment', surface: 'dark-rubble', craterDensity: 1.1, roughness: 0.4, basis: 'Dark, box-like irregular moon near the limit of hydrostatic shape; large Pharos crater (Voyager 2).', sources: ['Voyager 2 ISS (1989)'] },
  nereid: { tier: 'D', shape: 'ellipsoid', surface: 'cratered-rock', craterDensity: 0.8, roughness: 0.2, basis: 'Never resolved (Voyager pixel scale ≈ 70 km); size from photometry only.', sources: ['Voyager 2 ISS (1989) photometry'] },
  haumea: { tier: 'C', shape: 'ellipsoid', surface: 'volatile-dwarf', craterDensity: 0.3, roughness: 0.05, basis: 'Triaxial (≈2,322 × 1,704 × 1,026 km) fast rotator with crystalline water-ice surface and a dark red region (light curves, occultation).', sources: ['Stellar occultation 2017 (Ortiz et al. 2017, Nature)'] },
  makemake: { tier: 'C', shape: 'ellipsoid', surface: 'volatile-dwarf', craterDensity: 0.2, roughness: 0.05, basis: 'Methane-ice dominated, reddish, high albedo; no resolved imagery.', sources: ['Stellar occultation 2011 (Ortiz et al. 2012, Nature)'] },
  eris: { tier: 'C', shape: 'ellipsoid', surface: 'volatile-dwarf', craterDensity: 0.15, roughness: 0.03, basis: 'Very high albedo (pv≈0.96) suggesting fresh N₂/CH₄ frost; size from 2010 occultation.', sources: ['Stellar occultation 2010 (Sicardy et al. 2011, Nature)'] },
  gonggong: { tier: 'C', shape: 'ellipsoid', surface: 'volatile-dwarf', craterDensity: 0.4, roughness: 0.05, basis: 'Very red, moderate albedo; methane and water ice detected spectroscopically.', sources: ['Herschel/Kepler K2 photometry; Keck spectroscopy (literature compiled by JPL SBDB)'] },
  quaoar: { tier: 'C', shape: 'ellipsoid', surface: 'volatile-dwarf', craterDensity: 0.5, roughness: 0.06, basis: 'Dark-red surface with crystalline ice; rings outside the Roche limit (occultations).', sources: ['Stellar occultations (Morgado et al. 2023, Nature)'] },
  sedna: { tier: 'C', shape: 'ellipsoid', surface: 'volatile-dwarf', craterDensity: 0.3, roughness: 0.05, basis: 'One of the reddest known bodies (tholins); no resolved imagery.', sources: ['Ground-based spectroscopy (literature)'] },
  orcus: { tier: 'C', shape: 'ellipsoid', surface: 'icy-tectonic', craterDensity: 0.6, roughness: 0.05, basis: 'Neutral/grey water-ice surface, possible cryovolcanic ammonia hydrates; no resolved imagery.', sources: ['Ground-based near-IR spectroscopy (literature)'] },
  pallas: { tier: 'C', shape: 'cratered', surface: 'cratered-rock', craterDensity: 1.3, roughness: 0.3, basis: 'Heavily cratered, "golf-ball" surface seen by VLT/SPHERE adaptive optics; B-type.', sources: ['VLT/SPHERE (Marsset et al. 2020, Nature Astronomy)'] },
  juno: { tier: 'C', shape: 'fragment', surface: 'cratered-rock', craterDensity: 0.9, roughness: 0.4, basis: 'S-type, irregular; a large excavation observed in AO images.', sources: ['ALMA / adaptive-optics imaging (literature)'] },
  hygiea: { tier: 'C', shape: 'ellipsoid', surface: 'dark-rubble', craterDensity: 0.6, roughness: 0.08, basis: 'Nearly spherical C-type (VLT/SPHERE): could qualify as a dwarf planet; only two large craters resolved.', sources: ['VLT/SPHERE (Vernazza et al. 2020, Nature Astronomy)'] },
  psyche: { tier: 'C', shape: 'fragment', surface: 'metal-rich', craterDensity: 0.8, roughness: 0.35, basis: 'M-type, high radar albedo: metal-rich; shape from radar+AO (NASA Psyche arrives 2029).', sources: ['Radar + adaptive optics (Shepard et al. 2021, PSJ)'] },
  apophis: { tier: 'C', shape: 'fragment', surface: 'cratered-rock', craterDensity: 0.3, roughness: 0.6, shapeParams: { bilobe: 0.35 }, basis: 'Elongated, possibly bilobed Sq-type (Goldstone/Arecibo radar 2012–2021).', sources: ['Goldstone/Arecibo radar (Brozović et al. 2018, Icarus)'] },
  ryugu: { tier: 'C', shape: 'rubble-top', surface: 'dark-rubble', craterDensity: 0.35, roughness: 0.3, shapeParams: { ridge: 0.11 }, basis: 'Spinning-top rubble pile with equatorial ridge, extremely dark (pv≈0.045) and boulder-strewn (Hayabusa2). Mission shape model not yet in SOL’s licensed asset set → family reconstruction.', sources: ['Hayabusa2 ONC (Watanabe et al. 2019, Science)'] },
  didymos: { tier: 'C', shape: 'rubble-top', surface: 'dark-rubble', craterDensity: 0.2, roughness: 0.25, shapeParams: { ridge: 0.08 }, basis: 'Top-shaped rubble pile (DART/LICIACube 2022); S-type, moderate albedo.', sources: ['DART / LICIACube (Daly et al. 2023, Nature)'] },
  itokawa: { tier: 'B', shape: 'model', surface: 'dark-rubble', craterDensity: 0.05, roughness: 0.2, shapeParams: { lobe: 0.62, neck: 0.42 }, basis: 'Shape OBSERVED: Gaskell et al. (2008) Hayabusa AMICA shape model (PDS HAY-A-AMICA-5-ITOKAWASHAPE-V1.0, 64q level). Surface shading reconstructed: rubble pile with smooth gravel seas, almost no craters.', sources: ['Gaskell et al. 2008, Gaskell Itokawa Shape Model V1.0, PDS (via JAXA DARTS)', 'Hayabusa AMICA (Fujiwara et al. 2006, Science)'] },
  lutetia: { tier: 'C', shape: 'fragment', surface: 'cratered-rock', craterDensity: 1.2, roughness: 0.45, basis: 'Large cratered fragment with a ~600 m regolith blanket and grooves (Rosetta OSIRIS 2010). No licensed map in SOL → reconstruction.', sources: ['Rosetta OSIRIS (Sierks et al. 2011, Science)'] },
  ida: { tier: 'C', shape: 'fragment', surface: 'cratered-rock', craterDensity: 1.4, roughness: 0.5, basis: 'Elongated, densely cratered S-type with moon Dactyl (Galileo 1993).', sources: ['Galileo SSI (Belton et al. 1994, Science)'] },
  halley: { tier: 'C', shape: 'comet-nucleus', surface: 'comet-mantle', craterDensity: 0.1, roughness: 0.55, shapeParams: { lobe: 0.5 }, basis: 'Peanut-shaped, very dark (pv≈0.04) nucleus ≈15 × 8 km imaged by Giotto/Vega in 1986.', sources: ['Giotto HMC (Keller et al. 1986, Nature)'] },
  encke: { tier: 'D', shape: 'comet-nucleus', surface: 'comet-mantle', craterDensity: 0.1, roughness: 0.4, basis: 'Never resolved by a spacecraft; radius ≈2.4 km from photometry/radar.', sources: ['Ground-based photometry/radar (literature)'] },
  swifttuttle: { tier: 'D', shape: 'comet-nucleus', surface: 'comet-mantle', craterDensity: 0.1, roughness: 0.4, basis: 'Unresolved nucleus, ≈26 km diameter estimate; parent of the Perseids.', sources: ['Ground-based photometry (literature)'] },
  tempeltuttle: { tier: 'D', shape: 'comet-nucleus', surface: 'comet-mantle', craterDensity: 0.1, roughness: 0.45, basis: 'Unresolved nucleus (≈3.6 km); parent of the Leonids.', sources: ['Ground-based photometry (literature)'] },
  ponsbrooks: { tier: 'D', shape: 'comet-nucleus', surface: 'comet-mantle', craterDensity: 0.1, roughness: 0.35, basis: 'Unresolved nucleus (≈30 km estimate); outbursting Halley-type comet.', sources: ['Ground-based photometry (literature)'] },
  halebopp: { tier: 'D', shape: 'comet-nucleus', surface: 'comet-mantle', craterDensity: 0.1, roughness: 0.3, basis: 'Unresolved, unusually large nucleus (≈60 km).', sources: ['HST imaging (Weaver & Lamy 1997)'] },
  neowise: { tier: 'D', shape: 'comet-nucleus', surface: 'comet-mantle', craterDensity: 0.1, roughness: 0.4, basis: 'Unresolved nucleus (≈5 km).', sources: ['NEOWISE thermal photometry (Bauer et al. 2021)'] },
  tsuchinshan: { tier: 'D', shape: 'comet-nucleus', surface: 'comet-mantle', craterDensity: 0.1, roughness: 0.45, basis: 'Unresolved nucleus; size uncertain.', sources: ['MPC / JPL SBDB'] },
  atlas3i: { tier: 'D', shape: 'comet-nucleus', surface: 'comet-mantle', craterDensity: 0.05, roughness: 0.5, basis: 'Interstellar comet; nucleus unresolved, radius poorly constrained (HST 2025 upper limits).', sources: ['HST imaging 2025 (published size limits)'] },
  // shape-model bodies: the model is OBSERVED geometry; the surface reflectance is a family reconstruction (models carry no maps)
  phobos: { tier: 'B', shape: 'model', surface: 'dark-rubble', craterDensity: 0.9, roughness: 0.2, basis: 'Shape: NASA 3D Resources model from Viking/MEX data (OBSERVED). Surface: dark D-type regolith with grooves — reconstructed shading, no albedo map.', sources: ['NASA 3D Resources (Viking / Mars Express data)'] },
  deimos: { tier: 'B', shape: 'model', surface: 'dark-rubble', craterDensity: 0.4, roughness: 0.1, basis: 'Shape OBSERVED (Thomas 1993); smooth, regolith-mantled surface — reconstructed shading.', sources: ['NASA 3D Resources (Viking data)'] },
  eros: { tier: 'B', shape: 'model', surface: 'cratered-rock', craterDensity: 1.0, roughness: 0.3, basis: 'Shape OBSERVED (NEAR Shoemaker laser altimetry); S-type cratered surface with boulders — reconstructed shading.', sources: ['NEAR Shoemaker NLR (Zuber et al. 2000, Science)'] },
  bennu: { tier: 'B', shape: 'model', surface: 'dark-rubble', craterDensity: 0.3, roughness: 0.4, basis: 'Shape OBSERVED (OSIRIS-REx); boulder-strewn B-type rubble pile, pv≈0.044 — reconstructed shading.', sources: ['OSIRIS-REx OCAMS/OLA (Lauretta et al. 2019, Nature)'] },
  toutatis: { tier: 'B', shape: 'model', surface: 'cratered-rock', craterDensity: 0.4, roughness: 0.3, basis: 'Shape from radar (Hudson & Ostro 1995) refined by Chang’e-2 flyby; S-type.', sources: ['Radar shape model (Hudson & Ostro 1995, Science)'] },
  geographos: { tier: 'B', shape: 'model', surface: 'cratered-rock', craterDensity: 0.3, roughness: 0.3, basis: 'Radar-derived elongated shape (Hudson & Ostro 1999); surface unresolved.', sources: ['Arecibo/Goldstone radar shape model (NASA 3D Resources)'] },
  golevka: { tier: 'B', shape: 'model', surface: 'cratered-rock', craterDensity: 0.3, roughness: 0.3, basis: 'Radar shape (Hudson et al. 2000); angular, facetted.', sources: ['Radar shape model (NASA 3D Resources)'] },
  mithra: { tier: 'B', shape: 'model', surface: 'cratered-rock', craterDensity: 0.3, roughness: 0.3, basis: 'Radar shape (Brozović et al. 2010), contact-binary-like.', sources: ['Radar shape model (NASA 3D Resources)'] },
  kleopatra: { tier: 'B', shape: 'model', surface: 'metal-rich', craterDensity: 0.4, roughness: 0.3, basis: '"Dog-bone" radar/AO shape (Shepard et al. 2018); M-type.', sources: ['Radar/AO shape model (NASA 3D Resources)'] },
  arrokoth: { tier: 'B', shape: 'model', surface: 'red-silicate', craterDensity: 0.2, roughness: 0.1, basis: 'Contact-binary shape OBSERVED by New Horizons (2019); very red, smooth, few craters.', sources: [NH] },
  cg67p: { tier: 'B', shape: 'model', surface: 'comet-mantle', craterDensity: 0.05, roughness: 0.3, basis: 'Shape OBSERVED (Rosetta OSIRIS); dark dusty mantle, cliffs, pits — reconstructed shading.', sources: ['ESA/Rosetta/MPS OSIRIS shape model'] },
  vesta: { tier: 'A', shape: 'model', surface: 'mapped', craterDensity: 0.4, roughness: 0.2, basis: 'Dawn shape model and global mosaic (OBSERVED).', sources: ['NASA Dawn FC (Russell et al. 2012, Science)'] },
};
/** Build (or derive) the profile for a body definition. Deterministic for a given id and definition. */
export function visualProfile(def: BodyDef): BodyVisualProfile {
  const pr = visualProfile0(def); if (pr.radiusKm === undefined) pr.radiusKm = def.radius; return pr;
}
function visualProfile0(def: BodyDef): BodyVisualProfile {
  const seed = stableSeed(def.id);
  const c = CURATED[def.id];
  if (c) return { id: def.id, seed, ...c };
  // v3.7.1: data-driven profile supplied with the definition (minor moons, src/data/smallMoons.ts)
  if ((def as any).identity) return { id: def.id, seed, ...(def as any).identity };
  if (def.tex && !def.noData) return { id: def.id, seed, tier: 'A', shape: def.model ? 'model' : 'ellipsoid', surface: 'mapped', craterDensity: 0, roughness: 0, basis: 'Global map from spacecraft or telescope imagery (see asset manifest for provenance and coverage).', sources: [] };
  if (def.tex && def.noData) return { id: def.id, seed, tier: 'B', shape: 'ellipsoid', surface: 'mapped', craterDensity: 0.8, roughness: 0.1, basis: def.noData.note, sources: [] };
  // promoted catalogue minor planets and anything else without imagery: tier D, family from size
  const r = def.radius;
  const shape: ShapeFamily = def.kind === 'comet' ? 'comet-nucleus' : r < 2 ? 'rubble-top' : r < 150 ? 'fragment' : 'ellipsoid';
  const surface: SurfaceFamily = def.kind === 'comet' ? 'comet-mantle' : def.kind === 'tno' ? 'volatile-dwarf' : def.albedo < 0.09 ? 'dark-rubble' : 'cratered-rock';
  return { id: def.id, seed, tier: 'D', shape, surface, craterDensity: 0.9, roughness: shape === 'ellipsoid' ? 0.1 : 0.45, basis: 'No resolved observations: a representative shape/surface family chosen from size, albedo and dynamical class. Not an image of this object.', sources: ['JPL SBDB (orbit, H, albedo where measured)'] };
}
export const CURATED_IDS = Object.keys(CURATED);
