// Contract 1 — hierarchical frames, units and origin rebasing (spec D1.1, F4 "Canonical units and frame table").
//
// Scientific positions are float64 on the CPU and are ALWAYS stored relative to a parent anchor, never as one absolute
// universe coordinate. A Galactocentric position of a lunar crater is ≈2.6·10¹⁷ km; its float64 ulp is 32 km, so an
// absolute round-trip cannot keep metre locality. The hierarchy below keeps every hop small: relative vectors between
// two anchors are formed by walking to their lowest common ancestor and summing only the hops below it, so a 1 m offset
// near the Moon stays 1 m whatever the observer's galaxy-scale address is. (tests/contracts/frames.test.ts measures both.)
//
// Domains (unit of storage → unit of rendering is always "km relative to the current camera anchor", split hi/lo):
//   cosmic-cell → galaxy (Galactocentric, kpc) → star-system barycentre (ICRS, pc) → planet-system barycentre (km)
//   → body centre (km) → body-fixed (rotating, km) → ground patch (local tangent, m)
import { LENGTH_UNITS_KM, splitDouble } from './precision';

export type FrameKind = 'cosmic-cell' | 'galactocentric' | 'icrs-ssb' | 'ecliptic-j2000' | 'system-barycentric' | 'body-centred' | 'body-fixed' | 'ground-patch';
export type V3d = [number, number, number];
export type M3 = [number, number, number, number, number, number, number, number, number]; // row-major, child → parent

export interface Anchor {
  id: string;
  kind: FrameKind;
  parent: Anchor | null;
  /** Origin of this anchor expressed in the PARENT frame, km (float64). */
  offset: V3d;
  /** Rotation from this anchor's axes into the parent's axes (row-major). Identity when omitted. */
  rot?: M3;
  /** Valid epoch (JD TDB) of the offset; moving anchors are re-evaluated by their owner each frame. */
  epoch?: number;
}

export const IDENTITY: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mulMV = (m: M3, v: V3d): V3d => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mulMtV = (m: M3, v: V3d): V3d => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const addV = (a: V3d, b: V3d): V3d => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subV = (a: V3d, b: V3d): V3d => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export function anchor(id: string, kind: FrameKind, parent: Anchor | null, offset: V3d, rot?: M3, epoch?: number): Anchor {
  for (const x of offset) if (!Number.isFinite(x)) throw new Error(`anchor ${id}: non-finite offset`);
  return { id, kind, parent, offset, rot, epoch };
}
export function chain(a: Anchor): Anchor[] { const out: Anchor[] = []; for (let x: Anchor | null = a; x; x = x.parent) out.push(x); return out; }
export function commonAncestor(a: Anchor, b: Anchor): Anchor | null {
  const s = new Set(chain(a)); for (let x: Anchor | null = b; x; x = x.parent) if (s.has(x)) return x; return null;
}
/** Express point p (in anchor `from`'s frame) in ancestor `to`'s frame. */
export function toAncestor(p: V3d, from: Anchor, to: Anchor): V3d {
  let v = p;
  for (let x: Anchor | null = from; x && x !== to; x = x.parent) { v = addV(x.rot ? mulMV(x.rot, v) : v, x.offset); if (!x.parent && to) throw new Error(`${to.id} is not an ancestor of ${from.id}`); }
  return v;
}
/** Express point p (in ancestor `from`'s frame) in descendant `to`'s frame. */
export function fromAncestor(p: V3d, from: Anchor, to: Anchor): V3d {
  const path: Anchor[] = []; for (let x: Anchor | null = to; x && x !== from; x = x.parent) path.push(x);
  let v = p; for (let i = path.length - 1; i >= 0; i--) { const x = path[i]; const d = subV(v, x.offset); v = x.rot ? mulMtV(x.rot, d) : d; }
  return v;
}
/**
 * Position of point p (given in anchor `src`) relative to the origin of anchor `dst`, expressed in dst's axes.
 * Only hops BELOW the common ancestor are summed, so magnitudes stay local (this is the rebasing primitive).
 */
export function relative(p: V3d, src: Anchor, dst: Anchor): V3d {
  const ca = commonAncestor(src, dst); if (!ca) throw new Error(`anchors ${src.id} and ${dst.id} share no root`);
  return fromAncestor(toAncestor(p, src, ca), ca, dst);
}
/** Camera-relative GPU payload: float64 → float32 hi/lo per component (precision contract). */
export function gpuRelative(p: V3d, src: Anchor, camera: Anchor): { hi: V3d; lo: V3d } {
  const r = relative(p, src, camera); const s = r.map(splitDouble);
  return { hi: [s[0][0], s[1][0], s[2][0]], lo: [s[0][1], s[1][1], s[2][1]] };
}

// ── Fixed frame rotations ─────────────────────────────────────────────────────────────────────────────────────────
/** ICRS (equatorial) → Galactic, Hipparcos definition (ESA 1997, Vol. 1 §1.5.3; as used by Astropy). Rows = Galactic axes. */
export const ICRS_TO_GAL: M3 = [
  -0.0548755604162154, -0.8734370902348850, -0.4838350155487132,
  +0.4941094278755837, -0.4448296299600112, +0.7469822444972189,
  -0.8676661490190047, -0.1980763734312015, +0.4559837761750669,
];
export const GAL_TO_ICRS: M3 = [ICRS_TO_GAL[0], ICRS_TO_GAL[3], ICRS_TO_GAL[6], ICRS_TO_GAL[1], ICRS_TO_GAL[4], ICRS_TO_GAL[7], ICRS_TO_GAL[2], ICRS_TO_GAL[5], ICRS_TO_GAL[8]];
const EPS = 23.4392794444 * Math.PI / 180;
/** Ecliptic J2000 → ICRS/equatorial (rotation about x by +ε). SOL's Solar System state is ecliptic J2000, km. */
export const ECL_TO_ICRS: M3 = [1, 0, 0, 0, Math.cos(EPS), -Math.sin(EPS), 0, Math.sin(EPS), Math.cos(EPS)];

/**
 * Galactocentric convention (documented, versioned): Astropy v4.0 defaults — R☉ = 8.122 kpc (GRAVITY 2018),
 * z☉ = 20.8 pc (Bennett & Bovy 2019), with x pointing from the Galactic centre AWAY from the Sun's direction reversed
 * as in Astropy (Sun at x ≈ −8.122 kpc). We implement the frame without the small Sgr A* roll for clarity; the residual
 * (≈1·10⁻⁴ rad) is far below Galactic-model uncertainties and documented in docs/science/frames.md.
 */
export const GALACTOCENTRIC = { R0_kpc: 8.122, zSun_pc: 20.8, version: 'astropy-v4.0-like (no roll)' } as const;
export function sunInGalactocentricKm(): V3d {
  const R0 = GALACTOCENTRIC.R0_kpc * LENGTH_UNITS_KM.kpc, z = GALACTOCENTRIC.zSun_pc * LENGTH_UNITS_KM.pc;
  const th = Math.asin(z / R0);
  return [-R0 * Math.cos(th), 0, R0 * Math.sin(th)];
}
/** Galactic-axes → Galactocentric-axes rotation: flip x/y so +x points toward the Galactic centre from the Sun, then tilt by z☉. */
export function galToGalactocentricRot(): M3 {
  const R0 = GALACTOCENTRIC.R0_kpc * LENGTH_UNITS_KM.kpc, z = GALACTOCENTRIC.zSun_pc * LENGTH_UNITS_KM.pc, th = Math.asin(z / R0);
  const c = Math.cos(th), s = Math.sin(th);
  // Galactic (x→GC, y→l=90°, z→NGP) is already GC-pointing; tilt about y by θ so the GC lies on the midplane.
  return [c, 0, -s, 0, 1, 0, s, 0, c];
}

/** Build the standard SOL anchor tree. Positions supplied by the ephemeris owner (km, float64). */
export function standardTree() {
  const universe = anchor('universe', 'cosmic-cell', null, [0, 0, 0]);
  const milkyWay = anchor('milky-way', 'galactocentric', universe, [0, 0, 0]);
  // ICRS axes at the Solar System barycentre, placed in the Galactocentric frame
  const rot = mul(galToGalactocentricRot(), ICRS_TO_GAL);
  const ssb = anchor('ssb', 'icrs-ssb', milkyWay, sunInGalactocentricKm(), rot);
  const ecl = anchor('ssb-ecliptic', 'ecliptic-j2000', ssb, [0, 0, 0], ECL_TO_ICRS);
  return { universe, milkyWay, ssb, ecl };
}
export function mul(a: M3, b: M3): M3 {
  const r = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

// ── Distance semantics (cosmology is a different domain: never a bare "distance") ───────────────────────────────────
export type DistanceKind = 'radar/ephemeris' | 'parallax' | 'photometric' | 'kinematic' | 'luminosity' | 'comoving' | 'angular-diameter' | 'light-travel' | 'redshift-only';
export interface Distance { value: number; unit: keyof typeof LENGTH_UNITS_KM; kind: DistanceKind; sigma?: number; model?: string }
/** A cosmological distance must name its model; a local one must not pretend to be cosmological. */
export function validDistance(d: Distance): boolean {
  const cosmo = d.kind === 'luminosity' || d.kind === 'comoving' || d.kind === 'angular-diameter' || d.kind === 'light-travel' || d.kind === 'redshift-only';
  if (cosmo && !d.model) return false;
  return Number.isFinite(d.value) && d.value >= 0 && (d.sigma === undefined || d.sigma >= 0);
}
