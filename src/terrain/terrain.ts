// Planetary terrain: view-dependent cube-sphere quadtree over a streamed DEM tile pyramid (v3.6, src/terrain/tiles.ts).
//
// Six cube faces are subdivided around the camera; each node is a 33×33 vertex patch plus skirts (crack hiding).
// v3.6 changes against the v3.4/v3.5 single-grid version:
//  • Data: heights come from the tile pyramid (global 4–16 ppd + regional 32–256 ppd OBSERVED tiles). A patch asks for
//    the data level matching its own vertex spacing; while those tiles stream it is built from the finest resident
//    ancestor and marked provisional, then rebuilt when finer data lands (no holes, no invented relief).
//  • Refinement: screen-space error (contracts/lod.ts `screenError`) of the patch's vertex spacing, capped where the
//    data stops — the quadtree subdivides only as far as the DEM under that patch actually resolves.
//  • Precision (contracts/frames.ts): vertices are stored relative to the PATCH CENTRE (body-fixed km, float32 ⇒
//    sub-millimetre inside a 3 km patch) and every patch gets its own camera-relative transform built in float64
//    through the anchor hierarchy (camera → body-fixed → ground-patch). v3.5 stored body-centred float32 vertices
//    (≈0.1 m Moon / 0.2 m Mars quantisation) under a body transform that was itself float32 at 10³ km.
//  A `bodyPos` attribute (body-fixed position in units of the reference radius) feeds the unchanged surface shading.
import * as THREE from 'three/webgpu';
import { TilePyramid, levelForPatch } from './tiles';
import { screenError } from '../contracts/lod';
import { anchor, toAncestor, type Anchor, type M3, type V3d } from '../contracts/frames';

const N = 32;                       // quads per patch edge
const BUILD_MS = 5;                 // default CPU budget per frame for patch builds (≥ 2 builds always)
const CACHE_BYTES = 192 * 2 ** 20;  // GPU geometry budget for cached patches
const MAX_LEVEL = 14;
type Face = 0 | 1 | 2 | 3 | 4 | 5;
const FACES: [number[], number[], number[]][] = [
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, -1, 0], [0, 0, 1]],
  [[0, 1, 0], [-1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
];
const faceDir = (f: Face, u: number, v: number): [number, number, number] => {
  const [c, a, b] = FACES[f]; const x = c[0] + u * a[0] + v * b[0], y = c[1] + u * a[1] + v * b[1], z = c[2] + u * a[2] + v * b[2];
  const l = Math.hypot(x, y, z); return [x / l, y / l, z / l];
};
interface Node { key: string; face: Face; level: number; u0: number; v0: number; size: number; center: [number, number, number]; radius: number; deg: number }
interface Patch { mesh: THREE.Mesh; used: number; level: number; want: number; got: number; version: number; bytes: number; centerKm: V3d }

export class TerrainBody {
  group = new THREE.Group();
  private cache = new Map<string, Patch>();
  private frame = 0; private coarseReady = false; private bytes = 0;
  stats: any = { patches: 0, built: 0, rebuilt: 0, cached: 0, provisional: 0, maxLevel: 0, finestData: 0, geomMiB: 0, tiles: {} as any };
  /** per-frame build budget (ms); QA raises it so slow software frames converge in a bounded number of frames */
  buildMs = BUILD_MS;
  constructor(public tiles: TilePyramid, private material: THREE.Material) { this.group.matrixAutoUpdate = false; }
  get refRadiusKm() { return this.tiles.refRadiusKm; }
  /** Height (km) under a body-fixed direction from the finest resident tile (requests finer data). */
  heightKm(dir: [number, number, number]) { return this.tiles.heightDir(dir).h; }
  private node(face: Face, level: number, u0: number, v0: number): Node {
    const size = 2 / (1 << level), c = faceDir(face, u0 + size / 2, v0 + size / 2);
    const corner = faceDir(face, u0, v0);
    // bounding radius over ALL four corners: cube-face projection makes a patch's corners unequally distant from its centre
    // (v3.5 used one corner — harmless for its distance LOD, but the v3.6 cone culling then rejected the patch containing
    // the camera near cube-face edges, e.g. Gale crater; found in v3.6 QA)
    let radius = 0;
    for (const [cu, cv] of [[u0, v0], [u0 + size, v0], [u0, v0 + size], [u0 + size, v0 + size]]) { const q = faceDir(face, cu, cv); radius = Math.max(radius, Math.hypot(c[0] - q[0], c[1] - q[1], c[2] - q[2])); }
    radius *= 1.1;
    // angular size (deg) of the patch edge, measured along its diagonal / √2 (cube-face distortion included)
    const deg = Math.acos(Math.max(-1, Math.min(1, c[0] * corner[0] + c[1] * corner[1] + c[2] * corner[2]))) * 2 / Math.SQRT2 * 180 / Math.PI;
    return { key: `${face}/${level}/${u0.toFixed(7)}/${v0.toFixed(7)}`, face, level, u0, v0, size, center: c, radius, deg };
  }
  /** data level a patch should be meshed from: matched to its vertex spacing, capped by what exists under it */
  private wantLevel(n: Node) {
    const lat = Math.asin(n.center[2]) * 180 / Math.PI, lon = Math.atan2(n.center[1], n.center[0]) * 180 / Math.PI;
    return Math.min(levelForPatch(n.deg, N), this.tiles.dataLevelAt(lat, lon));
  }
  private build(n: Node, want: number): Patch {
    const R = this.refRadiusKm, S = N + 1, verts = S * S, skirt = 4 * S;
    const body = new Float64Array(verts * 3);
    let got = 99;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const d = faceDir(n.face, n.u0 + n.size * i / N, n.v0 + n.size * j / N), q = this.tiles.heightDir(d, want), r = R + q.h, k = (j * S + i) * 3;
      got = Math.min(got, q.level); body[k] = d[0] * r; body[k + 1] = d[1] * r; body[k + 2] = d[2] * r;
    }
    // patch-local origin = displaced centre vertex (float64), vertices stored relative to it (float32-safe)
    const ck = ((N / 2) * S + N / 2) * 3, C: V3d = [body[ck], body[ck + 1], body[ck + 2]];
    const pos = new Float32Array((verts + skirt) * 3), nor = new Float32Array((verts + skirt) * 3), bp = new Float32Array((verts + skirt) * 3);
    for (let k = 0; k < verts; k++) for (let a = 0; a < 3; a++) { pos[k * 3 + a] = body[k * 3 + a] - C[a]; bp[k * 3 + a] = body[k * 3 + a] / R; }
    const p = (i: number, j: number) => { const k = (Math.max(0, Math.min(N, j)) * S + Math.max(0, Math.min(N, i))) * 3; return [body[k], body[k + 1], body[k + 2]]; };
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const a = p(i + 1, j), b = p(i - 1, j), c = p(i, j + 1), e = p(i, j - 1);
      const tu = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], tv = [c[0] - e[0], c[1] - e[1], c[2] - e[2]];
      let nx = tu[1] * tv[2] - tu[2] * tv[1], ny = tu[2] * tv[0] - tu[0] * tv[2], nz = tu[0] * tv[1] - tu[1] * tv[0];
      const k = (j * S + i) * 3; if (nx * body[k] + ny * body[k + 1] + nz * body[k + 2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1; nor[k] = nx / l; nor[k + 1] = ny / l; nor[k + 2] = nz / l;
    }
    // v3.6 horizon map (Max 1988 "Horizon mapping"): per-vertex horizon elevation in 8 azimuths from the DEM itself, so
    // terrain casts real shadows at any Sun position without re-meshing (the Sun moves; the horizon does not)
    const hz = n.level >= 3 ? this.horizons(n, body, S, want) : null;
    // skirts: the border ring dropped radially by ~1.2 % of the patch size (hides T-junction cracks between levels)
    const drop = 1 - n.size * 0.012;
    const ring: number[] = []; for (let i = 0; i < S; i++) ring.push(i); for (let j = 1; j < S; j++) ring.push(j * S + N); for (let i = N - 1; i >= 0; i--) ring.push(N * S + i); for (let j = N - 1; j > 0; j--) ring.push(j * S);
    ring.forEach((src, t) => { const k = (verts + t) * 3; for (let a = 0; a < 3; a++) { pos[k + a] = body[src * 3 + a] * drop - C[a]; nor[k + a] = nor[src * 3 + a]; bp[k + a] = body[src * 3 + a] * drop / R; } });
    const idx = new Uint32Array(N * N * 6 + ring.length * 12); let o = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * S + i, b = a + 1, c = a + S, d = c + 1; idx.set([a, b, d, a, d, c], o); o += 6; }
    for (let t = 0; t < ring.length; t++) { const a = ring[t], b = ring[(t + 1) % ring.length], A = verts + t, B = verts + (t + 1) % ring.length; idx.set([a, A, b, b, A, B, a, b, A, b, B, A], o); o += 12; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('bodyPos', new THREE.BufferAttribute(bp, 3));
    const h0 = new Float32Array((verts + skirt) * 4), h1 = new Float32Array((verts + skirt) * 4);
    const hv = (k: number, a: number) => hz ? hz[k * 8 + a] : -1.5;
    for (let k = 0; k < verts; k++) for (let a = 0; a < 4; a++) { h0[k * 4 + a] = hv(k, a); h1[k * 4 + a] = hv(k, a + 4); }
    ring.forEach((src, t) => { const k = verts + t; for (let a = 0; a < 4; a++) { h0[k * 4 + a] = h0[src * 4 + a]; h1[k * 4 + a] = h1[src * 4 + a]; } });
    g.setAttribute('hz0', new THREE.BufferAttribute(h0, 4)); g.setAttribute('hz1', new THREE.BufferAttribute(h1, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.material); m.frustumCulled = false; m.matrixAutoUpdate = false;
    const bytes = pos.byteLength * 3 + h0.byteLength * 2 + idx.byteLength;
    return { mesh: m, used: this.frame, level: n.level, want, got, version: this.tiles.version, bytes, centerKm: C };
  }
  /** Horizon elevation (rad) in 8 azimuths (N, NE, E, … from the local north) for every vertex, computed on a coarser
   *  grid (17² near, 9² far) and bilinearly upsampled. Marches great circles with geometrically growing steps out to
   *  ≈ 400 vertex spacings, sampling coarser pyramid levels with distance (no tile requests for the far field). */
  private horizons(n: Node, body: Float64Array, S: number, want: number) {
    const R = this.refRadiusKm, G = n.level >= 9 ? 13 : 9, sp = n.deg * Math.PI / 180 * R / N;
    const grid = new Float32Array(G * G * 8);
    for (let gj = 0; gj < G; gj++) for (let gi = 0; gi < G; gi++) {
      const i = Math.round(gi * N / (G - 1)), j = Math.round(gj * N / (G - 1)), k = (j * S + i) * 3;
      const x = body[k], y = body[k + 1], z = body[k + 2], r1 = Math.hypot(x, y, z), up = [x / r1, y / r1, z / r1];
      const h1: number[] = [];
      const el = Math.hypot(up[0], up[1]) || 1e-9, east = [-up[1] / el, up[0] / el, 0], north = [up[1] * east[2] - up[2] * east[1], up[2] * east[0] - up[0] * east[2], up[0] * east[1] - up[1] * east[0]];
      for (let a = 0; a < 8; a++) {
        const ca = Math.cos(a * Math.PI / 4), sa = Math.sin(a * Math.PI / 4), t = [ca * north[0] + sa * east[0], ca * north[1] + sa * east[1], ca * north[2] + sa * east[2]];
        let best = -1e9;
        for (let st = 0, s = sp; st < 18; st++, s *= 1.4) {
          const ang = s / R, c = Math.cos(ang), sn = Math.sin(ang);
          const d: [number, number, number] = [up[0] * c + t[0] * sn, up[1] * c + t[1] * sn, up[2] * c + t[2] * sn];
          const L = Math.max(0, want - Math.floor(Math.log2(s / sp)));
          const q = this.tiles.heightDir(d, L, false), r2 = R + q.h;
          // compare like with like: the vertex's own height at the SAME level the far sample came from (a coarse sample
          // against a fine vertex height put whole basins — Gale — in a false shadow; v3.6 QA)
          let rv = h1[q.level]; if (rv === undefined) rv = h1[q.level] = q.level >= 0 ? R + this.tiles.heightDir(up as [number, number, number], q.level, false).h : r1;
          const tn = (r2 * c - rv) / (r2 * sn); if (tn > best) best = tn;
        }
        grid[(gj * G + gi) * 8 + a] = Math.atan(best);
      }
    }
    const out = new Float32Array(S * S * 8);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const fx = i * (G - 1) / N, fy = j * (G - 1) / N, x0 = Math.min(G - 2, Math.floor(fx)), y0 = Math.min(G - 2, Math.floor(fy)), tx = fx - x0, ty = fy - y0;
      for (let a = 0; a < 8; a++) {
        const g = (xx: number, yy: number) => grid[(yy * G + xx) * 8 + a];
        out[(j * S + i) * 8 + a] = (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
      }
    }
    return out;
  }
  private put(key: string, pt: Patch) { const old = this.cache.get(key); if (old) { old.mesh.geometry.dispose(); this.bytes -= old.bytes; } this.cache.set(key, pt); this.bytes += pt.bytes; }
  /**
   * Select and (re)build the visible patch set for a camera at `camLocal` (km, body-fixed).
   * `errPx` = allowed screen-space size of one vertex spacing (smaller → finer), `fovY` rad, `H` device px.
   */
  update(camLocal: THREE.Vector3, errPx = 6, fovY = 0.87, H = 1080, view?: { dir: THREE.Vector3; aspect: number }) {
    // v3.6 view-frustum cone culling (body-fixed): patches entirely outside the camera cone are not refined or drawn
    const coneCos = view ? Math.cos(Math.min(Math.PI * 0.499, Math.atan(Math.tan(fovY / 2) * Math.hypot(1, view.aspect)))) : -2;
    this.frame++;
    const R = this.refRadiusKm, cam = camLocal.clone().divideScalar(R), camLen = cam.length();
    const want: Node[] = []; const t0 = performance.now(); let builds = 0;
    let maxL = 0;
    const visit = (n: Node) => {
      const cn = n.center, dot = cn[0] * cam.x + cn[1] * cam.y + cn[2] * cam.z;
      const horizon = 1 / Math.max(camLen, 1.0001);
      if (dot / camLen < horizon - n.radius * 1.2 - 0.02) return;      // beyond the limb
      if (view && n.level > 0) {
        const dx = cn[0] - cam.x, dy = cn[1] - cam.y, dz = cn[2] - cam.z, dl = Math.hypot(dx, dy, dz);
        if (dl > n.radius) {
          const c = (dx * view.dir.x + dy * view.dir.y + dz * view.dir.z) / dl, marg = Math.asin(Math.min(1, n.radius / dl));
          if (Math.acos(Math.max(-1, Math.min(1, c))) > Math.acos(coneCos) + marg) return;
        }
      }
      const distKm = Math.max(1e-3, (Math.hypot(cn[0] - cam.x, cn[1] - cam.y, cn[2] - cam.z) - n.radius * 0.5) * R);
      const spacingKm = n.deg * Math.PI / 180 * R / N;
      const fine = screenError(spacingKm, distKm, fovY, H) > errPx;
      // stop where the data stops: a child would be meshed finer than the DEM under it resolves
      const child = levelForPatch(n.deg / 2, N), lat = Math.asin(cn[2]) * 180 / Math.PI, lon = Math.atan2(cn[1], cn[0]) * 180 / Math.PI;
      const dataOk = child <= this.tiles.dataLevelAt(lat, lon) + 1;
      if (n.level < MAX_LEVEL && fine && dataOk) {
        const h = n.size / 2; for (const [du, dv] of [[0, 0], [h, 0], [0, h], [h, h]]) visit(this.node(n.face, n.level + 1, n.u0 + du, n.v0 + dv));
      } else { want.push(n); maxL = Math.max(maxL, n.level); }
    };
    for (let f = 0; f < 6; f++) visit(this.node(f as Face, 0, -1, -1));
    // guaranteed coverage: levels 0–2 are built once, unthrottled, so a patch waiting for its build always has an ancestor
    if (!this.coarseReady) {
      const all = (f: Face, L: number, u0: number, v0: number) => { const n = this.node(f, L, u0, v0); if (!this.cache.has(n.key)) this.put(n.key, this.build(n, this.wantLevel(n))); if (L < 2) { const h = n.size / 2; for (const [du, dv] of [[0, 0], [h, 0], [0, h], [h, h]]) all(f, L + 1, u0 + du, v0 + dv); } };
      for (let f = 0; f < 6; f++) all(f as Face, 0, -1, -1);
      this.coarseReady = true;
    }
    const shown = new Set<Patch>(); let prov = 0;
    // nearest first, so the build budget goes where the camera is
    want.sort((a, b) => b.level - a.level);
    const canBuild = () => builds < 2 || performance.now() - t0 < this.buildMs;
    for (const n of want) {
      let e = this.cache.get(n.key);
      const wl = e ? e.want : this.wantLevel(n);
      if (!e && canBuild()) { e = this.build(n, wl); this.put(n.key, e); builds++; this.stats.built++; }
      else if (e && e.got < e.want && e.version !== this.tiles.version && canBuild()) {
        // provisional patch and new tiles have landed since it was built → rebuild from the finer data
        const nb = this.build(n, e.want); if (nb.got > e.got) { this.put(n.key, nb); e = nb; this.stats.rebuilt++; builds++; } else { e.version = this.tiles.version; nb.mesh.geometry.dispose(); }
      }
      if (e) { e.used = this.frame; if (e.got < e.want) { prov++; if (this.frame % 20 === 0) this.tiles.heightDir(n.center, e.want); } shown.add(e); continue; }
      for (let L = n.level - 1, u0 = n.u0, v0 = n.v0; L >= 0; L--) {
        const sz = 2 / (1 << L); u0 = -1 + Math.floor((u0 + 1) / sz + 1e-9) * sz; v0 = -1 + Math.floor((v0 + 1) / sz + 1e-9) * sz;
        const anc = this.cache.get(this.node(n.face, L, u0, v0).key); if (anc) { anc.used = this.frame; shown.add(anc); break; }
      }
    }
    const meshes = new Set([...shown].map(s => s.mesh));
    for (const c of this.group.children.slice()) if (!meshes.has(c as THREE.Mesh)) this.group.remove(c);
    for (const s of shown) if (s.mesh.parent !== this.group) this.group.add(s.mesh);
    if (this.bytes > CACHE_BYTES) {
      const old = [...this.cache.entries()].filter(([, v]) => v.used < this.frame - 2 && v.level > 2).sort((a, b) => a[1].used - b[1].used);
      for (const [k, v] of old) { if (this.bytes <= CACHE_BYTES * 0.85) break; v.mesh.geometry.dispose(); this.bytes -= v.bytes; this.cache.delete(k); }
    }
    this.visible = shown;
    this.stats.patches = shown.size; this.stats.cached = this.cache.size; this.stats.provisional = prov; this.stats.maxLevel = maxL;
    this.stats.finestData = Math.max(...[...shown].map(s => s.got)); this.stats.geomMiB = +(this.bytes / 2 ** 20).toFixed(1); this.stats.tiles = this.tiles.counts();
    return shown.size;
  }
  private visible = new Set<Patch>();
  /**
   * Per-frame float64 placement through the frame hierarchy: camera (scene origin, ecliptic axes) → body-fixed anchor
   * (offset = body centre − camera, rotation = body → ecliptic) → ground-patch anchor (offset = patch centre). The
   * resulting camera-relative patch origin is small near the camera, so its float32 copy keeps metre-scale (and finer)
   * precision. `toScene` maps ecliptic → scene axes and builds the mesh matrix.
   */
  place(bodyRelCam: V3d, rot: M3, toMatrix: (posEcl: V3d, out: THREE.Matrix4) => void) {
    const camA: Anchor = anchor('camera', 'ecliptic-j2000', null, [0, 0, 0]);
    const bf = anchor('body-fixed', 'body-fixed', camA, bodyRelCam, rot);
    let near = Infinity; const hist: Record<string, number> = {};
    for (const s of this.visible) {
      const gp = anchor('patch', 'ground-patch', bf, s.centerKm);
      const o = toAncestor([0, 0, 0], gp, camA); toMatrix(o, s.mesh.matrix);
      s.mesh.matrixWorld.copy(s.mesh.matrix); s.mesh.matrixWorldNeedsUpdate = false;
      near = Math.min(near, Math.hypot(o[0], o[1], o[2]));
      const k = `L${s.level}/d${s.got}`; hist[k] = (hist[k] ?? 0) + 1;
    }
    this.stats.placement = { nearestPatchKm: +near.toFixed(3), hist };
  }
  dispose() { for (const v of this.cache.values()) v.mesh.geometry.dispose(); this.cache.clear(); this.bytes = 0; this.group.clear(); }
}
