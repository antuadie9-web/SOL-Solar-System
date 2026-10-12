// Contract 2 — universal astronomical object record with per-property evidence (spec D1.2, F5 "AstroObject").
// A catalogue row is NOT automatically a navigable 3D object: `placement()` decides, from the data, whether a source is
// a 3D point (reliable distance), a 2D sky source (direction only) or unknown. Nothing here invents missing values.
import type { FrameKind } from './frames';

export type Evidence = 'observed' | 'inferred' | 'reconstructed' | 'procedural' | 'unknown';
/** Taxonomy spanning the full roadmap; most classes have no data in v3.4 (see docs/requirements-matrix-v3.4.md). */
export type AstroClass =
  | 'star' | 'planet' | 'dwarf-planet' | 'moon' | 'asteroid' | 'comet' | 'tno' | 'ring' | 'heliosphere'
  | 'brown-dwarf' | 'white-dwarf' | 'neutron-star' | 'pulsar' | 'magnetar' | 'stellar-black-hole' | 'binary-system' | 'multiple-system'
  | 'exoplanet' | 'protoplanetary-disk'
  | 'emission-nebula' | 'reflection-nebula' | 'dark-nebula' | 'planetary-nebula' | 'supernova-remnant' | 'molecular-cloud'
  | 'open-cluster' | 'globular-cluster' | 'stellar-association' | 'stellar-stream'
  | 'galactic-component' | 'supermassive-black-hole'
  | 'galaxy' | 'dwarf-galaxy' | 'galaxy-group' | 'galaxy-cluster' | 'agn' | 'quasar' | 'cosmic-structure'
  | 'unresolved-source';

export interface Measured<T = number> {
  value: T;
  unit?: string;
  sigma?: number;              // 1σ, same unit
  evidence: Evidence;
  source?: string;             // citation or catalogue + release
  epoch?: number;              // JD TDB when it matters
}
export interface SourceId { catalog: string; release?: string; id: string }

export type Position =
  | { kind: 'ephemeris'; frame: FrameKind; provider: string }                                     // Solar System bodies
  | { kind: 'astrometric'; raDeg: number; decDeg: number; parallaxMas?: number; parallaxSigmaMas?: number; pmRaMasYr?: number; pmDecMasYr?: number; rvKms?: number; epochJyr: number; frame: 'icrs' }
  | { kind: 'sky-only'; raDeg: number; decDeg: number; frame: 'icrs' }
  | { kind: 'unknown' };

export interface AstroObject {
  canonicalId: string;         // stable SOL id, never re-used: 'sol:earth', 'gaia-dr3:4472832130942575872', ...
  name: string;
  aliases: string[];
  sourceIds: SourceId[];
  cls: AstroClass;
  subtype?: string;
  parent?: string;             // canonical id of host/primary (moon → planet, exoplanet → host star)
  component?: string;          // 'A', 'B', 'Ab' … for multiple systems — never merged by crossmatch
  position: Position;
  radiusKm?: Measured;
  massKg?: Measured;
  teffK?: Measured;
  appearance?: { surface: Evidence; shape: Evidence; note?: string };
}

/** Parallax quality cut for 3D placement: positive parallax with ϖ/σϖ ≥ 5 (≈ ≤20 % distance error; Bailer-Jones 2015). */
export const PLACEMENT_MIN_SNR = 5;
export type Placement = { mode: '3d'; distancePc: number; relErr: number } | { mode: 'sky'; reason: string } | { mode: 'ephemeris' } | { mode: 'none'; reason: string };
export function placement(o: AstroObject): Placement {
  const p = o.position;
  if (p.kind === 'ephemeris') return { mode: 'ephemeris' };
  if (p.kind === 'unknown') return { mode: 'none', reason: 'no position' };
  if (p.kind === 'sky-only') return { mode: 'sky', reason: 'no distance measurement' };
  const w = p.parallaxMas, s = p.parallaxSigmaMas;
  if (w === undefined || s === undefined) return { mode: 'sky', reason: 'no parallax' };
  if (!(w > 0)) return { mode: 'sky', reason: `non-positive parallax (${w} mas) kept as a measurement, not inverted` };
  if (w / s < PLACEMENT_MIN_SNR) return { mode: 'sky', reason: `parallax S/N ${(w / s).toFixed(1)} < ${PLACEMENT_MIN_SNR}: distance would need a prior (not applied)` };
  return { mode: '3d', distancePc: 1000 / w, relErr: s / w };
}

// ── crossmatch ───────────────────────────────────────────────────────────────────────────────────────────────────
export type MatchResult = { match: true; by: 'identifier' | 'position'; sepArcsec?: number } | { match: false; reason: string } | { match: 'ambiguous'; reason: string };
const angSepArcsec = (ra1: number, de1: number, ra2: number, de2: number) => {
  const d = Math.PI / 180, a = Math.sin((de2 - de1) * d / 2) ** 2 + Math.cos(de1 * d) * Math.cos(de2 * d) * Math.sin((ra2 - ra1) * d / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(a))) * 180 / Math.PI * 3600;
};
/**
 * Crossmatch two catalogue records. Order of trust: (1) shared stable source identifier; (2) distinct component
 * designations or distinct identifiers in the SAME catalogue → never merged (binaries stay two objects);
 * (3) positional match within `radiusArcsec` (epoch-propagated by the caller) and, when both have parallaxes,
 * consistent within 3σ; otherwise ambiguous rather than merged.
 */
export function crossmatch(a: AstroObject, b: AstroObject, radiusArcsec = 1.0): MatchResult {
  for (const x of a.sourceIds) for (const y of b.sourceIds) {
    if (x.catalog === y.catalog && (x.release ?? '') === (y.release ?? '')) {
      if (x.id === y.id) return { match: true, by: 'identifier' };
      return { match: false, reason: `distinct ${x.catalog} identifiers` };
    }
  }
  if (a.component && b.component && a.component !== b.component) return { match: false, reason: `different components ${a.component}/${b.component}` };
  const pa = a.position, pb = b.position;
  if ((pa.kind !== 'astrometric' && pa.kind !== 'sky-only') || (pb.kind !== 'astrometric' && pb.kind !== 'sky-only')) return { match: false, reason: 'no comparable positions' };
  const sep = angSepArcsec(pa.raDeg, pa.decDeg, pb.raDeg, pb.decDeg);
  if (sep > radiusArcsec) return { match: false, reason: `separation ${sep.toFixed(2)}″ > ${radiusArcsec}″` };
  if (pa.kind === 'astrometric' && pb.kind === 'astrometric' && pa.parallaxMas !== undefined && pb.parallaxMas !== undefined) {
    const s = Math.hypot(pa.parallaxSigmaMas ?? 1, pb.parallaxSigmaMas ?? 1);
    if (Math.abs(pa.parallaxMas - pb.parallaxMas) > 3 * s) return { match: 'ambiguous', reason: 'positions agree but parallaxes differ > 3σ (possible chance alignment)' };
  }
  return { match: true, by: 'position', sepArcsec: sep };
}

/** Adapter: SOL v3.3 catalog body definition → AstroObject (Solar System bodies are ephemeris-placed). */
export function fromBodyDef(d: { id: string; name: string; kind: string; parent?: string; radius: number; model?: string; procedural?: unknown; noData?: unknown; sbdb?: string; tex?: string }): AstroObject {
  const cls: AstroClass = d.kind === 'star' ? 'star' : d.kind === 'planet' ? 'planet' : d.kind === 'dwarf' ? 'dwarf-planet' : d.kind === 'moon' ? 'moon' : d.kind === 'comet' ? 'comet' : 'asteroid';
  return {
    canonicalId: 'sol:' + d.id, name: d.name, aliases: [], cls, parent: d.parent ? 'sol:' + d.parent : (d.kind === 'star' ? undefined : 'sol:sun'),
    sourceIds: d.sbdb ? [{ catalog: 'JPL-SBDB', id: d.sbdb }] : [],
    position: { kind: 'ephemeris', frame: 'ecliptic-j2000', provider: 'SOL ephemeris tiers (docs/science/ephemeris-tiers.md)' },
    radiusKm: { value: d.radius, unit: 'km', evidence: 'observed', source: 'IAU WGCCRE 2015 / JPL' },
    appearance: { surface: d.tex ? (d.noData ? 'observed' : 'observed') : d.procedural ? 'procedural' : 'unknown', shape: d.model ? 'observed' : 'inferred', note: d.noData ? 'partial map coverage; unobserved parts reconstructed and labelled' : undefined },
  };
}
