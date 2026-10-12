// @ts-nocheck — TSL node graphs are dynamically typed
// 3D star layer (Phase 7/8, milestone S1): Gaia DR3 + Hipparcos stars at their measured 3D positions (parsecs),
// moved linearly by their space motion, rendered as photometric PSF points whose apparent magnitude is recomputed
// for the CURRENT camera position: m = M + 5·log10(d / 10 pc). Flying away from the Sun therefore produces real
// parallax, brightening of approached stars and dimming of receding ones. Distances are 1/parallax (derived).
//
// Precision: star positions are float32 parsecs relative to the Sun; the camera offset is subtracted on the GPU, so the
// relative position error is ~1e-7 of the star's heliocentric distance (≈3·10⁶ km at Proxima — sub-milliarcsecond
// in direction). The resolved-star close-up (photosphere disc) is NOT part of this layer.
import * as THREE from 'three/webgpu';
import { Fn, uniform, attribute, vec3, float, pow, length, max, log, instanceIndex, select } from 'three/tsl';
import { psfMaterial, PX, blackbodyRGB } from '../render/points';
import { rowMV } from './photometry';

export const PC_KM = 3.0856775814913673e13;
export interface Star3DCatalog { data: Float32Array; count: number; named: { name: string; index: number; distPc: number }[] }
export class Stars3D {
  mesh: THREE.Mesh;
  // v3.8.1 STAR-J01: camera position split into float32 hi + lo parts (see starPrecision.ts); camPc kept for diagnostics
  // v3.8.1 STAR-381-D: one catalogue row can be faded out while its resolved disc is drawn (flux handed over, not doubled)
  U = { hideIndex: uniform(-1), hideKeep: uniform(1), camPc: uniform(new THREE.Vector3()), camHi: uniform(new THREE.Vector3()), camLo: uniform(new THREE.Vector3()), years: uniform(0), fade: uniform(0) };
  /** Set the camera (heliocentric, scene axes, parsecs, float64) — splits it into hi/lo float32 uniforms. */
  setCamera(x: number, y: number, z: number) {
    const f = Math.fround, hx = f(x), hy = f(y), hz = f(z);
    this.U.camPc.value.set(x, y, z); this.U.camHi.value.set(hx, hy, hz); this.U.camLo.value.set(f(x - hx), f(y - hy), f(z - hz));
  }
  private attrs: THREE.InstancedBufferAttribute[] = [];
  private dirty = false; private lastFlush = 0;
  /** rows streamed in so far (v3.4 sector shards; rows not yet loaded are drawn at M = 99, i.e. invisible) */
  loadedRows = 0;
  constructor(public cat: Star3DCatalog, streamed = false) {
    const n = cat.count;
    const P = new Float32Array(n * 3), V = new Float32Array(n * 3), C = new Float32Array(n * 4);
    if (streamed) for (let i = 0; i < n; i++) C[i * 4 + 3] = 99;
    this.P = P; this.V = V; this.C = C;
    if (!streamed) this.fillRows(0, n);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const aP = new THREE.InstancedBufferAttribute(P, 3), aV = new THREE.InstancedBufferAttribute(V, 3), aC = new THREE.InstancedBufferAttribute(C, 4);
    this.attrs = [aP, aV, aC];
    g.setAttribute('sP', aP); g.setAttribute('sV', aV); g.setAttribute('sC', aC);
    g.instanceCount = n;
    const U = this.U;
    // v3.8.1 STAR-J01: rel = ((sP − camHi) + sV·years) − camLo. v3.4–3.8.0 computed (sP + sV·years) − camPc with one
    // float32 camera: near another star (|cam| ≈ 1.3 pc, ulp 0.0245 AU) the drawn star snapped by up to 3.7 million km per
    // frame — measured 38.9 px RMS frame-to-frame jitter zooming 50 → 0.05 AU to Proxima (tools/qa/star-stability.ts).
    const relPc = Fn(() => attribute('sP', 'vec3').sub(U.camHi).add(attribute('sV', 'vec3').mul(U.years)).sub(U.camLo))();
    // draw on a 1e9-km sphere in the camera's direction (far-plane points), like the directional catalogue
    const center = Fn(() => relPc.div(max(length(relPc), 1e-9)).mul(1e9))();
    const flux = Fn(() => {
      const c = attribute('sC', 'vec4');
      const d = max(length(relPc), 1e-7);
      const m = c.w.add(log(d).mul(2.1714724)).sub(5);                  // 5·log10(d) = 2.1714724·ln(d)
      const F = float(3.14159265).mul(pow(10, m.add(26.74).mul(-0.4))).mul(1e10).mul(U.fade);
      const keep = select(instanceIndex.toFloat().equal(U.hideIndex), U.hideKeep, float(1));
      return c.xyz.mul(F).mul(keep);
    })();
    this.mesh = new THREE.Mesh(g, psfMaterial(center, flux, { gain: PX.starGain, farPlane: true, maxSize: 72, wing: 0.045, compress: float(1) }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -89;
  }
  private P: Float32Array; private V: Float32Array; private C: Float32Array;
  /** Convert catalogue rows [first, first+count) of cat.data into instance attributes. */
  fillRows(first: number, count: number) {
    const D = this.cat.data, P = this.P, V = this.V, C = this.C, sun = blackbodyRGB(5772);
    for (let i = first; i < first + count; i++) {
      const r = D.subarray(i * 10, i * 10 + 10);
      // ecliptic (x,y,z) → scene axes (x, z, −y)
      P[i * 3] = r[0]; P[i * 3 + 1] = r[2]; P[i * 3 + 2] = -r[1]; V[i * 3] = r[3]; V[i * 3 + 1] = r[5]; V[i * 3 + 2] = -r[4];
      const c = blackbodyRGB(Math.max(2300, Math.min(40000, r[7]))), cr = c[0] / sun[0], cg = c[1] / sun[1], cb = c[2] / sun[2], cy = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
      C[i * 4] = cr / cy; C[i * 4 + 1] = cg / cy; C[i * 4 + 2] = cb / cy; C[i * 4 + 3] = rowMV(r[6], r[7], r[8]);   // v3.8 DEF-38-013: V-band flux (rows are G or Hp)
    }
    this.loadedRows += count; this.dirty = true;
  }
  /** v3.5 (AUD-03): release rows of an evicted shard (drawn at M = 99, i.e. invisible) */
  clearRows(first: number, count: number) {
    for (let i = first; i < first + count; i++) this.C[i * 4 + 3] = 99;
    this.loadedRows = Math.max(0, this.loadedRows - count); this.dirty = true;
  }
  /** Upload streamed rows at most every 300 ms (one buffer re-upload per flush instead of per shard). */
  flush(now = performance.now()) {
    if (!this.dirty || now - this.lastFlush < 300) return;
    for (const a of this.attrs) a.needsUpdate = true;
    this.dirty = false; this.lastFlush = now;
  }
  /** Heliocentric ecliptic position (km) of catalogue star i at a TT Julian date (linear space motion from J2016.0). */
  posKm(i: number, jd: number): [number, number, number] {
    const r = this.cat.data.subarray(i * 10, i * 10 + 10), y = (jd - 2457389.0) / 365.25;
    return [(r[0] + r[3] * y) * PC_KM, (r[1] + r[4] * y) * PC_KM, (r[2] + r[5] * y) * PC_KM];
  }
}
