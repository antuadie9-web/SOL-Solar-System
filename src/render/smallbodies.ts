// @ts-nocheck — TSL node graphs are dynamically typed
// ~95,000 real asteroids, centaurs & trans-Neptunian objects (JPL SBDB), propagated on the GPU every frame.
import * as THREE from 'three/webgpu';
import { Fn, uniform, instancedArray, instanceIndex, vec3, vec4, float, sin, cos, sqrt, Loop, abs, length, log, exp, pow, tan, acos, clamp, dot, normalize, max, select, mix, int } from 'three/tsl';
import { psfMaterial, PX } from './points';
import { AU, DEG, GAUSS_K } from '../astro/constants';

export const CLASS_NAMES = ['Main belt', 'Outer main belt', 'Mars-crosser', 'Near-Earth', 'Jupiter Trojan', 'Centaur', 'Trans-Neptunian'];
export const CLASS_COLORS: [number, number, number][] = [[0.75, 0.82, 1.0], [0.6, 0.75, 1.0], [1.0, 0.75, 0.5], [1.0, 0.55, 0.35], [0.55, 1.0, 0.65], [0.4, 0.95, 0.95], [0.85, 0.65, 1.0]];
export class SmallBodies {
  n: number; mesh: THREE.Mesh; compute: any; raw: Float32Array; P: any;
  U = { days: uniform(0), cam: uniform(new THREE.Vector3()), gain: uniform(300), colorMode: uniform(0), classMask: uniform(new THREE.Vector4(1, 1, 1, 1)), classMask2: uniform(new THREE.Vector4(1, 1, 1, 1)) };
  constructor(raw: Float32Array) {
    const n = this.n = raw.length / 10; this.raw = raw;
    const e0 = new Float32Array(n * 4), e1 = new Float32Array(n * 4), e2 = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      const r = raw.subarray(k * 10, k * 10 + 10);
      e0.set([r[0], r[1], r[2] * DEG, r[3] * DEG], k * 4);
      e1.set([r[4] * DEG, r[5] * DEG, GAUSS_K / Math.pow(r[0], 1.5), r[6]], k * 4);
      e2.set([r[7], r[8], r[9], 0], k * 4);
    }
    const E0 = instancedArray(e0, 'vec4'), E1 = instancedArray(e1, 'vec4'), E2 = instancedArray(e2, 'vec4');
    const P = instancedArray(n, 'vec4'); this.P = P;
    const U = this.U;
    this.compute = Fn(() => {
      const a0 = E0.element(instanceIndex), a1 = E1.element(instanceIndex);
      const a = a0.x, e = a0.y, inc = a0.z, Om = a0.w, w = a1.x;
      // mean anomaly in f32: reduce the elapsed revolutions first to keep precision
      const dt = U.days.sub(a1.w);
      const revs = dt.mul(a1.z).div(6.2831853);
      const M = revs.fract().mul(6.2831853).add(a1.y);
      const E = M.toVar();
      Loop(10, () => { E.assign(E.sub(E.sub(e.mul(sin(E))).sub(M).div(float(1).sub(e.mul(cos(E)))))); });
      const xo = a.mul(cos(E).sub(e)), yo = a.mul(sqrt(float(1).sub(e.mul(e)))).mul(sin(E));
      const cO = cos(Om), sO = sin(Om), cw = cos(w), sw = sin(w), ci = cos(inc), si = sin(inc);
      const x1 = cw.mul(xo).sub(sw.mul(yo)), y1 = sw.mul(xo).add(cw.mul(yo));
      const X = cO.mul(x1).sub(sO.mul(ci).mul(y1)), Y = sO.mul(x1).add(cO.mul(ci).mul(y1)), Z = si.mul(y1);
      P.element(instanceIndex).assign(vec4(X, Z, Y.negate(), length(vec3(X, Y, Z))));   // scene axes, AU
    })().compute(n);
    // vertex stage may not bind writable storage: read the GPU-computed positions as instanced vertex attributes
    const PA = P.toAttribute(), QA = E2.toAttribute();
    const center = Fn(() => PA.xyz.mul(AU).sub(U.cam))();
    const flux = Fn(() => {
      const p = PA; const q = QA;
      const rel = p.xyz.mul(AU).sub(U.cam);
      const delta = length(rel).div(AU).max(1e-6), r = p.w.max(1e-3);
      const cosA = dot(normalize(p.xyz).negate(), normalize(rel).negate());
      const alpha = acos(clamp(cosA, -1, 1));
      const ta = tan(alpha.mul(0.5)).max(0);
      const phi = float(0.85).mul(exp(pow(ta, 0.63).mul(-3.33))).add(float(0.15).mul(exp(pow(ta, 1.22).mul(-1.87))));
      const mag = q.x.add(log(r.mul(delta)).mul(2.1714724)).sub(log(phi.max(1e-6)).mul(1.0857362));
      const F = float(3.14159265).mul(pow(10, mag.add(26.74).mul(-0.4)));
      const cls = int(q.z);
      const tint = select(cls.equal(0), vec3(0.75, 0.82, 1.0), select(cls.equal(1), vec3(0.6, 0.75, 1.0), select(cls.equal(2), vec3(1.0, 0.75, 0.5), select(cls.equal(3), vec3(1.0, 0.55, 0.35),
        select(cls.equal(4), vec3(0.55, 1.0, 0.65), select(cls.equal(5), vec3(0.4, 0.95, 0.95), vec3(0.85, 0.65, 1.0)))))));
      const natural = vec3(1.0, 0.93, 0.85);
      const mask = select(cls.lessThan(4), select(cls.equal(0), U.classMask.x, select(cls.equal(1), U.classMask.y, select(cls.equal(2), U.classMask.z, U.classMask.w))),
        select(cls.equal(4), U.classMask2.x, select(cls.equal(5), U.classMask2.y, U.classMask2.z)));
      // enhanced visibility saturates gracefully instead of blowing out nearby objects
      const vis = F.mul(U.gain);
      const capped = vis.div(vis.div(PX.pixelSA.mul(4.5).mul(0.9)).add(1));
      return mix(natural, tint, U.colorMode).mul(capped).mul(mask);
    })();
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.instanceCount = n;
    this.mesh = new THREE.Mesh(g, psfMaterial(center, flux, { gain: float(1), maxSize: 6, minSize: 1.2, wing: 0 }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
  }
  record(k: number) { const r = this.raw.subarray(k * 10, k * 10 + 10); return { a: r[0], e: r[1], i: r[2], om: r[3], w: r[4], ma: r[5], epoch: r[6] + 2451545, H: r[7], diam: r[8], cls: r[9] }; }
}
