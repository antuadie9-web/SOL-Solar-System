// @ts-nocheck — TSL node graphs are dynamically typed
// Anti-aliased screen-space guide lines (orbits, trajectories, axes, constellations, grids): each segment is an
// instanced quad.
//
// v3.3 precision fix (owner defect "orbit/axis lines vibrate"): vertex positions are uploaded as float32 hi/lo pairs of
// float64 coordinates relative to an anchor (the orbit's parent body), and the anchor-to-camera offset arrives as a
// hi/lo uniform pair. The shader reconstructs the camera-relative position as (pHi + oHi) + (pLo + oLo), so a point
// 4.5·10⁹ km from the Sun keeps sub-metre precision next to the camera. v3.2 multiplied float32 vertices by a float32
// translation of the same magnitude (≈256–512 km quantisation, changing every frame as the camera moved).
// See src/contracts/precision.ts and tests/render/precision.test.ts.
import * as THREE from 'three/webgpu';
import { Fn, uniform, attribute, positionGeometry, vec2, vec3, vec4, float, cameraProjectionMatrix, cameraViewMatrix, varying, smoothstep, abs, mix, fract, pow, max, length, select, clamp } from 'three/tsl';
import { splitArray, splitDouble } from '../contracts/precision';

export const LINE_GLOBAL = { focus: uniform(0), invExp: uniform(1) };
export interface LineOpts { color: THREE.Color; width?: number; opacity?: number; trail?: boolean; far?: boolean; additive?: boolean; dash?: number }
export class LineSet {
  mesh: THREE.Mesh; U: any; readonly segments: number;
  /** @param segs float64 (or float32) segment endpoints [ax,ay,az,bx,by,bz]*, in km relative to the anchor, scene axes. */
  constructor(segs: ArrayLike<number>, phases: Float32Array | null, o: LineOpts) {
    const n = segs.length / 6; this.segments = n;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const A = new Float64Array(n * 3), B = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { A[i * 3 + k] = segs[i * 6 + k]; B[i * 3 + k] = segs[i * 6 + 3 + k]; }
    const a = splitArray(A), b = splitArray(B);
    g.setAttribute('aAh', new THREE.InstancedBufferAttribute(a.hi, 3)); g.setAttribute('aAl', new THREE.InstancedBufferAttribute(a.lo, 3));
    g.setAttribute('aBh', new THREE.InstancedBufferAttribute(b.hi, 3)); g.setAttribute('aBl', new THREE.InstancedBufferAttribute(b.lo, 3));
    const ph = phases ?? new Float32Array(n * 2);
    g.setAttribute('aT', new THREE.InstancedBufferAttribute(ph, 2));
    g.instanceCount = n;
    this.U = {
      color: uniform(o.color.clone()), opacity: uniform(o.opacity ?? 1), width: uniform(o.width ?? 1.5), viewport: uniform(new THREE.Vector2(1920, 1080)),
      phase: uniform(0), trail: uniform(o.trail ? 1 : 0), body: uniform(new THREE.Vector3()), bodyR: uniform(0), fadeNear: uniform(0), highlight: uniform(0),
      originH: uniform(new THREE.Vector3()), originL: uniform(new THREE.Vector3()), dash: uniform(o.dash ?? 0), basis: uniform(new THREE.Matrix3()),
    };
    const U = this.U;
    const vWD = varying(float(0), 'lWD'), vEdge = varying(float(0), 'lEdge'), vT = varying(float(0), 'lT'), vP = varying(vec3(0), 'lP'), vW = varying(float(1), 'lW');
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending });
    m.vertexNode = Fn(() => {
      const ah = attribute('aAh', 'vec3'), al = attribute('aAl', 'vec3'), bh = attribute('aBh', 'vec3'), bl = attribute('aBl', 'vec3'), t = attribute('aT', 'vec2');
      // relative-to-eye reconstruction (camera sits at the scene origin; the view matrix is a pure rotation)
      // `basis` (identity for orbits) lets small local guides such as a spin axis rotate/scale with their body
      const ra = U.basis.mul(ah).add(U.originH).add(U.basis.mul(al).add(U.originL));
      const rb = U.basis.mul(bh).add(U.originH).add(U.basis.mul(bl).add(U.originL));
      const ca0 = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(ra, 1)));
      const cb0 = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(rb, 1)));
      // clip the segment against the near plane (w > ε) so lines passing behind the camera stay sane
      const eps = float(1e-4);
      const ta = clamp(eps.sub(ca0.w).div(cb0.w.sub(ca0.w)), 0, 1), tb = clamp(eps.sub(cb0.w).div(ca0.w.sub(cb0.w)), 0, 1);
      const ca = select(ca0.w.lessThan(eps), mix(ca0, cb0, ta), ca0);
      const cb = select(cb0.w.lessThan(eps), mix(cb0, ca0, tb), cb0);
      const isB = positionGeometry.x;
      const wa = max(ca.w, 1e-6), wb = max(cb.w, 1e-6);
      const sa = ca.xy.div(wa).mul(U.viewport), sb = cb.xy.div(wb).mul(U.viewport);
      const dir = sb.sub(sa); const dl = max(length(dir), 1e-6);
      const nrm = vec2(dir.y.negate(), dir.x).div(dl);
      const c = mix(ca, cb, isB);
      const w = U.width.add(U.highlight.mul(1.0));
      vW.assign(w);
      // +1 px of feather on each side so the analytic AA in the fragment shader has coverage to work with
      const off = nrm.mul(positionGeometry.y).mul(w.add(1.0)).mul(2).div(U.viewport).mul(c.w);
      vEdge.assign(positionGeometry.y.mul(w.add(1.0)));
      vT.assign(mix(t.x, t.y, isB));
      vP.assign(U.basis.mul(mix(ah.add(al), bh.add(bl), isB)));
      vWD.assign(length(mix(ra, rb, isB)));
      const z = o.far ? c.w.mul(0) : c.z;   // v3.5: exactly on the reversed-depth far plane (see points.ts)
      const behind = ca0.w.lessThan(eps).and(cb0.w.lessThan(eps));
      return select(behind, vec4(0, 0, -10, 1), vec4(c.x.add(off.x), c.y.add(off.y), z, c.w));
    })();
    m.fragmentNode = Fn(() => {
      // analytic coverage of a w-px stroke (box filter over one pixel): stable sub-pixel lines without flicker
      const aa = smoothstep(vW.mul(0.5).add(0.75), vW.mul(0.5).sub(0.25), abs(vEdge));
      // sub-pixel strokes keep their energy as reduced opacity instead of strobing between 0 and 1 px
      const thin = clamp(vW, 0.35, 1.0);
      const behind = fract(U.phase.sub(vT));
      const trail = mix(float(1), pow(float(1).sub(behind), 1.6).mul(0.8).add(0.2), U.trail);
      const dash = mix(float(1), smoothstep(0.35, 0.5, abs(fract(vT.mul(U.dash.max(1))).sub(0.5)).mul(2)), select(U.dash.greaterThan(0), float(1), float(0)));
      // never draw through the body itself
      const near = smoothstep(U.bodyR.mul(1.05), U.bodyR.mul(3.0), length(vP.sub(U.body)));
      const fade = mix(float(1), near, U.fadeNear);
      // fade parts of the line that pass close to the camera (relative to what we are looking at)
      const camFade = select(LINE_GLOBAL.focus.greaterThan(0), smoothstep(LINE_GLOBAL.focus.mul(0.12), LINE_GLOBAL.focus.mul(0.6), vWD), float(1));
      const a = aa.mul(thin).mul(trail).mul(dash).mul(U.opacity).mul(fade).mul(camFade);
      // overlays are display-referred: cancel the scene exposure so lines keep a constant brightness
      return o.additive === false ? vec4(U.color.mul(LINE_GLOBAL.invExp), a) : vec4(U.color.mul(a).mul(LINE_GLOBAL.invExp), 1);
    })();
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.matrixAutoUpdate = false;
  }
  /** Set the float64 anchor-minus-camera offset (km, scene axes). */
  setOrigin(x: number, y: number, z: number) {
    const [xh, xl] = splitDouble(x), [yh, yl] = splitDouble(y), [zh, zl] = splitDouble(z);
    this.U.originH.value.set(xh, yh, zh); this.U.originL.value.set(xl, yl, zl);
  }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
// orbit polyline → segment buffer (+phase per vertex for the trail); stays float64 until LineSet splits it
export function orbitSegments(pts: Float64Array, closed = true, phase?: Float32Array) {
  const n = pts.length / 3, segN = closed ? n : n - 1;
  const segs = new Float64Array(segN * 6), ph = new Float32Array(segN * 2);
  for (let i = 0; i < segN; i++) {
    const j = (i + 1) % n;
    segs[i * 6] = pts[i * 3]; segs[i * 6 + 1] = pts[i * 3 + 1]; segs[i * 6 + 2] = pts[i * 3 + 2];
    segs[i * 6 + 3] = pts[j * 3]; segs[i * 6 + 4] = pts[j * 3 + 1]; segs[i * 6 + 5] = pts[j * 3 + 2];
    if (phase) { ph[i * 2] = phase[i]; ph[i * 2 + 1] = phase[j] < phase[i] ? phase[j] + 1 : phase[j]; }
    else { ph[i * 2] = i / n; ph[i * 2 + 1] = j === 0 ? 1 : j / n; }
  }
  return { segs, ph };
}
