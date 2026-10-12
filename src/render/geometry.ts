// @ts-nocheck — TSL node graphs are dynamically typed
// Geometry helpers: spherified cube (uniform triangles, no polar pinching) and shell/annulus meshes.
import * as THREE from 'three/webgpu';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const cache = new Map<number, THREE.BufferGeometry>();
export function cubeSphere(seg: number): THREE.BufferGeometry {
  if (cache.has(seg)) return cache.get(seg)!;
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, -1, 0], [0, 0, 1]], [[0, 1, 0], [-1, 0, 0], [0, 0, 1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  const n1 = seg + 1, pos = new Float32Array(6 * n1 * n1 * 3), idx: number[] = [];
  let o = 0;
  for (let f = 0; f < 6; f++) {
    const [N, U, V] = faces[f], base = f * n1 * n1;
    for (let j = 0; j <= seg; j++) for (let i = 0; i <= seg; i++) {
      // equal-angle cube mapping for even vertex density
      const a = Math.tan((i / seg * 2 - 1) * Math.PI / 4), b = Math.tan((j / seg * 2 - 1) * Math.PI / 4);
      let x = N[0] + a * U[0] + b * V[0], y = N[1] + a * U[1] + b * V[1], z = N[2] + a * U[2] + b * V[2];
      const l = Math.hypot(x, y, z); pos[o++] = x / l; pos[o++] = y / l; pos[o++] = z / l;
    }
    for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) {
      const a = base + j * n1 + i, b = a + 1, c = a + n1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(pos.slice(), 3));
  g.setIndex(idx);
  // fix winding so front faces point outward
  const p = g.attributes.position.array as Float32Array, I = g.index!.array as any;
  for (let t = 0; t < I.length; t += 3) {
    const A = I[t] * 3, B = I[t + 1] * 3, C = I[t + 2] * 3;
    const ux = p[B] - p[A], uy = p[B + 1] - p[A + 1], uz = p[B + 2] - p[A + 2], vx = p[C] - p[A], vy = p[C + 1] - p[A + 1], vz = p[C + 2] - p[A + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * p[A] + ny * p[A + 1] + nz * p[A + 2] < 0) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
  }
  g.computeBoundingSphere();
  cache.set(seg, g);
  return g;
}
// Ring annulus in the local XY plane (equatorial), radii in km; uv.x = radial fraction
export function annulus(rin: number, rout: number, seg = 512, rings = 6) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, r = rin + (rout - rin) * t;
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pos.push(r * Math.cos(a), r * Math.sin(a), 0); uv.push(t, i / seg); }
  }
  const n = seg + 1;
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, b, d, a, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeBoundingSphere();
  return g;
}
// Displaced irregular body (for asteroids/comets/small moons without a shape model)
export function irregularGeometry(seed: number, rough: number, seg = 48) {
  const g0 = cubeSphere(seg).clone(); g0.deleteAttribute('normal');
  const base = mergeVertices(g0, 1e-5);
  const p = base.attributes.position.array as Float32Array;
  const rnd = mulberry(seed);
  const lobes = Array.from({ length: 7 }, () => ({ d: normalize3([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]), a: (rnd() * 0.5 + 0.2) * rough, w: 1.5 + rnd() * 3 }));
  const craters = Array.from({ length: 26 }, () => ({ d: normalize3([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]), r: 0.08 + rnd() * 0.3, h: 0.04 + rnd() * 0.06 }));
  for (let k = 0; k < p.length; k += 3) {
    const x = p[k], y = p[k + 1], z = p[k + 2];
    let s = 1;
    for (const L of lobes) { const c = x * L.d[0] + y * L.d[1] + z * L.d[2]; s += L.a * Math.pow(Math.max(c, 0), L.w) * 0.6 - L.a * 0.08; }
    for (const C of craters) {
      const c = x * C.d[0] + y * C.d[1] + z * C.d[2], ang = Math.acos(Math.min(1, Math.max(-1, c))), d = ang / C.r;
      if (d < 1.4) s += (d < 1 ? (d * d - 1) * C.h : 0.25 * C.h * Math.exp(-(((d - 1) * 6) ** 2))) * rough;
    }
    p[k] = x * s; p[k + 1] = y * s; p[k + 2] = z * s;
  }
  base.computeVertexNormals(); base.computeBoundingSphere();
  return base;
}
function normalize3(v: number[]) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
export function mulberry(a: number) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ── v3.3 shape families (spec §8 "Replace the one-size-fits-all generator with distinct families") ─────────────────
// Each family is a deterministic radial function r(dir) on a cube-sphere, built in three scales: low-frequency silhouette
// first, then mesoscale geology (craters drawn from a power-law size–frequency distribution, facets, boulders, terraces),
// leaving micro-detail to the shader. Output is normalised so the largest extent is 1 along +x; the engine then scales
// by the body's measured semi-axes (a, b, c), so measured dimensions are honoured and never double-applied.
import type { BodyVisualProfile } from './identity';
export interface FamilyGeometryStats { family: string; vertices: number; craters: number; facets: number; boulders: number }
type Dir = [number, number, number];
const dot3 = (a: Dir, b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function randDir(rnd: () => number): Dir { const z = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z); return [s * Math.cos(t), s * Math.sin(t), z]; }
/** Craters with cumulative SFD N(>D) ∝ D^−slope between rMin and rMax (angular radius, rad). */
function craterPopulation(rnd: () => number, n: number, rMin: number, rMax: number, slope = 2) {
  const out: { d: Dir; r: number; depth: number; fresh: number }[] = [];
  const a = Math.pow(rMin, -slope), b = Math.pow(rMax, -slope);
  for (let i = 0; i < n; i++) {
    const r = Math.pow(a + (b - a) * rnd(), -1 / slope);
    out.push({ d: randDir(rnd), r, depth: 0.12 + 0.1 * rnd(), fresh: rnd() });
  }
  return out;
}
/** Crater profile at normalised distance x = angle / radius: bowl, raised rim, ejecta falloff; degraded craters are shallower. */
function craterProfile(x: number, depth: number, fresh: number, r: number) {
  const deg = 0.35 + 0.65 * fresh;
  if (x < 1) {
    let h = (x * x - 1) * depth * deg;
    if (r > 0.18 && x < 0.22) h += depth * deg * 0.35 * (1 - x / 0.22);   // central peak on large craters
    return h * r;
  }
  if (x < 2.2) return 0.18 * depth * deg * r * Math.exp(-(((x - 1) * 4.2) ** 2)) + 0.02 * depth * r * (2.2 - x) / 1.2;
  return 0;
}
export function familyGeometry(p: BodyVisualProfile, seg = 64): { geo: THREE.BufferGeometry; stats: FamilyGeometryStats } {
  const g0 = cubeSphere(seg).clone(); g0.deleteAttribute('normal');
  const base = mergeVertices(g0, 1e-5);
  const pos = base.attributes.position.array as Float32Array;
  const rnd = mulberry(p.seed * 7919 + 17);
  const rough = p.roughness, sp = p.shapeParams ?? {};
  // silhouette: a few low-order harmonics (smooth "potato" only for fragments; near-zero for ellipsoids)
  const lobes = Array.from({ length: 4 }, () => ({ d: randDir(rnd), a: (rnd() * 0.6 + 0.2) * rough * 0.5, w: 1.2 + rnd() * 2 }));
  // facets for angular fragments: planes that truncate the body (soft-min), producing flat faces and sharp edges
  const nFacets = p.shape === 'fragment' ? 5 + Math.floor(rnd() * 5) : p.shape === 'comet-nucleus' ? 3 : 0;
  const facets = Array.from({ length: nFacets }, () => ({ d: randDir(rnd), h: 0.78 + rnd() * 0.14 }));
  // v3.8 DEF-38-007: planar facets are the look of small collisional shards (≲ 15 km: Itokawa-, Eros-class blocks). Bodies of
  // ~100 km (Janus, Epimetheus, Proteus, Himalia) are rounded by self-gravity and impact erosion (Thomas 1989; Thomas &
  // Helfenstein 2020 shape fits are smooth ellipsoids + large craters), but v3.7.1 cut them with the same 5–9 planes, giving
  // straight 'sawn-off' limbs. Facet strength now fades between 15 and 80 km mean radius; unknown size keeps full facets.
  const Rk = p.radiusKm ?? 1, facetW = 1 - smoothstep01(15, 80, Rk);
  // craters: count scales with crater density; sponge = saturated deep pits
  const nCr = Math.round((p.shape === 'sponge' ? 420 : p.shape === 'rubble-top' ? 24 : p.shape === 'comet-nucleus' ? 14 : 160) * p.craterDensity);
  const craters = craterPopulation(rnd, nCr, p.shape === 'sponge' ? 0.05 : 0.025, p.shape === 'sponge' ? 0.35 : 0.5, p.shape === 'sponge' ? 1.4 : 2.0);
  if (p.shape === 'sponge') for (const c of craters) { c.depth *= 2.2; c.fresh = 0.8 + 0.2 * c.fresh; }
  // boulders for rubble piles: many small Gaussian bumps with a steep size distribution
  const nB = p.shape === 'rubble-top' ? 260 : p.shape === 'contact-binary' ? 140 : 0;
  const boulders = Array.from({ length: nB }, () => { const r = 0.012 + 0.06 * Math.pow(rnd(), 3); return { d: randDir(rnd), r, h: r * (0.5 + rnd() * 0.5) }; });
  const ridge = sp.ridge ?? 0;
  const lobeR = sp.lobe ?? 0.6, neck = sp.neck ?? 0.4;
  const terraces = p.shape === 'comet-nucleus' ? 5 + Math.floor(rnd() * 4) : 0;
  const radial = (d: Dir) => {
    let s = 1;
    if (p.shape === 'contact-binary' || (p.shape === 'comet-nucleus' && (sp.lobe ?? 0) > 0.1) || (sp.bilobe ?? 0) > 0) {
      // two ellipsoidal lobes along x with a smooth neck: ray-march the smooth union (bisection on the radial ray)
      const L = p.shape === 'contact-binary' ? lobeR : p.shape === 'comet-nucleus' ? 0.55 : 0.68;
      // two overlapping lobes whose union contains the origin (required by the radial bisection below); the waist width
      // follows from the overlap, softened by `neck`
      const r1 = 0.3 + 0.4 * L, r2 = 0.3 + 0.4 * (1 - L), c1 = r1 * 0.85, c2 = -r2 * 0.95;
      const k = p.shape === 'contact-binary' ? neck * 0.3 : 0.16;
      const sdf = (t: number) => {
        const x = d[0] * t, y = d[1] * t, z = d[2] * t;
        const e1 = Math.hypot((x - c1) / 1.05, y / 0.95, z / 0.9) - r1, e2 = Math.hypot((x - c2) / 1.0, y / 0.9, z / 0.85) - r2;
        const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (e2 - e1) / k));
        return e2 * (1 - h) + e1 * h - k * h * (1 - h);
      };
      let lo = 0.02, hi = 2.5; for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (sdf(m) < 0) lo = m; else hi = m; }
      s = lo;
    }
    for (const L of lobes) { const c = dot3(d, L.d); s += L.a * Math.pow(Math.max(c, 0), L.w) * 0.5 - L.a * 0.06; }
    if (ridge > 0) { const z = d[2]; s *= 1 + ridge * Math.exp(-((z / 0.22) ** 2)) - ridge * 0.6 * Math.abs(z); }   // spinning-top equatorial ridge
    for (const F of facets) { const c = dot3(d, F.d); if (c > 0) { const lim = F.h / c; if (lim < s) s = s + (lim - s) * 0.85 * facetW; } }
    let h = 0;
    for (const C of craters) { const c = dot3(d, C.d); if (c < 0.6) continue; const ang = Math.acos(Math.min(1, c)), x = ang / C.r; if (x < 2.2) h += craterProfile(x, C.depth, C.fresh, C.r); }
    for (const B of boulders) { const c = dot3(d, B.d); if (c < 0.95) continue; const ang = Math.acos(Math.min(1, c)); if (ang < B.r * 2) h += B.h * Math.exp(-((ang / B.r) ** 2) * 2.2); }
    s *= 1 + h;
    if (terraces) { const q = s * terraces; s = (Math.floor(q) + smoothstep01(0.25, 0.75, q - Math.floor(q))) / terraces * 0.4 + s * 0.6; }   // mesas & cliffs
    return s;
  };
  let mx = 0;
  for (let k = 0; k < pos.length; k += 3) {
    const d: Dir = [pos[k], pos[k + 1], pos[k + 2]], s = radial(d);
    pos[k] = d[0] * s; pos[k + 1] = d[1] * s; pos[k + 2] = d[2] * s;
    mx = Math.max(mx, Math.abs(pos[k]), Math.abs(pos[k + 1]), Math.abs(pos[k + 2]));
  }
  // normalise each axis to unit extent so the engine's measured (a, b, c) scaling sets the true dimensions
  const ext = [0, 0, 0];
  for (let k = 0; k < pos.length; k += 3) for (let i = 0; i < 3; i++) ext[i] = Math.max(ext[i], Math.abs(pos[k + i]));
  for (let k = 0; k < pos.length; k += 3) for (let i = 0; i < 3; i++) pos[k + i] /= ext[i] || 1;
  void mx;
  base.computeVertexNormals(); base.computeBoundingSphere();
  return { geo: base, stats: { family: p.shape, vertices: pos.length / 3, craters: craters.length, facets: facets.length, boulders: boulders.length } };
}
function smoothstep01(a: number, b: number, x: number) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
