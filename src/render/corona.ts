// @ts-nocheck — TSL node graphs are dynamically typed
// Solar corona + chromosphere rim (Phase 1b, ISSUE SUN-003).
//
// Brightness is PHYSICAL, not art-directed: the K+F corona radial profile is Baumbach's (1937) empirical fit,
//   I(r)/Ī☉ = 1e-6 · (0.0532 r^-2.5 + 1.425 r^-7 + 2.565 r^-17),   r in solar radii,
// expressed relative to the mean disc radiance (Allen's Astrophysical Quantities, §14.3). The corona is therefore
// ~10⁻⁶ of the disc and becomes visible by itself only when the disc is occluded and the exposure rises — exactly the
// behaviour of a real camera during a total eclipse. The angular structure (equatorial streamers, polar plumes, ray
// texture) is a SIMULATED approximation keyed to the Sun's rotation axis — it is not a reconstruction of any date's
// corona. The chromosphere is a thin (≈0.015 R☉) H-alpha-tinted rim at ~2·10⁻⁴ of disc radiance, likewise only
// noticeable in eclipse. Both are drawn as one camera-facing quad, depth-tested so the Moon/planets occlude them.
import * as THREE from 'three/webgpu';
import { Fn, uniform, vec2, vec3, vec4, float, length, atan, pow, exp, smoothstep, cos, sin, abs, max, positionGeometry, cameraProjectionMatrix, cameraViewMatrix, varying, Discard, If } from 'three/tsl';
import { fbm } from './shaderlib';

export const CORONA_EXTENT = 8; // solar radii drawn
export function makeCorona() {
  const U = {
    center: uniform(new THREE.Vector3()), radius: uniform(695700), meanL: uniform(1), right: uniform(new THREE.Vector3(1, 0, 0)), up: uniform(new THREE.Vector3(0, 1, 0)),
    poleAngle: uniform(0), activity: uniform(0.7), time: uniform(0), enabled: uniform(1), aureole: uniform(0), prominence: uniform(1), days: uniform(0),
  };
  const vUv = varying(vec2(0), 'cUv');
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  m.vertexNode = Fn(() => {
    vUv.assign(positionGeometry.xy.mul(CORONA_EXTENT));
    const w = U.center.add(U.right.mul(positionGeometry.x.mul(U.radius.mul(CORONA_EXTENT)))).add(U.up.mul(positionGeometry.y.mul(U.radius.mul(CORONA_EXTENT))));
    return cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(w, 1)));
  })();
  m.fragmentNode = Fn(() => {
    const r = length(vUv);
    If(r.lessThan(0.999), () => { Discard(); });
    // Baumbach K+F profile (relative to mean disc radiance)
    const baum = float(0.0532).mul(pow(r, -2.5)).add(float(1.425).mul(pow(r, -7))).add(float(2.565).mul(pow(r, -17))).mul(1e-6);
    // simulated structure: position angle measured from the projected solar north pole
    const pa = atan(vUv.y, vUv.x).sub(U.poleAngle);
    const lat = abs(cos(pa));                                  // 1 at the poles, 0 at the equator (projected)
    const streamers = float(1).add(float(1.6).mul(exp(lat.mul(lat).mul(-14))).mul(float(1).sub(U.activity.mul(0.5))));
    const polar = float(1).sub(lat.mul(lat).mul(0.55).mul(float(1).sub(U.activity)));
    const rays = fbm({ p: vec3(cos(pa).mul(9), sin(pa).mul(9), r.mul(0.35).add(U.time.mul(1e-6))), oct: 4 }).mul(0.9).add(0.55);
    const corona = baum.mul(streamers).mul(polar).mul(rays);
    // chromosphere rim (H-alpha dominated), only within ~0.015 R☉ of the limb
    const chromo = smoothstep(1.018, 1.0, r).mul(2e-4);
    // ART-DIRECTED aureole (labelled in the UI): a soft warm halo starting at ≈5 % of the mean disc radiance at the limb
    // and falling e-fold every 0.22 R☉ — the scattered-light glow a camera records around the disc, which the physical
    // corona (≈10⁻⁶) cannot provide. Strength: cinematic 1, natural 0.5, scientific 0 (physical corona only).
    const aure = exp(r.sub(1).mul(-4.5)).mul(0.05).mul(U.aureole);
    // v3.4 (SUN-006) prominences: cool dense plasma (≈10⁴ K) suspended above the limb, H-alpha red. SIMULATED population:
    // ~10 seeded features whose position angle drifts with solar rotation, each an arch/hedgerow of fibrous threads
    // 0.02–0.12 R☉ high. Physical brightness ≈4·10⁻⁶ of the mean disc in broadband light → visible only in eclipse,
    // like the real thing in the Scientific look. Natural ×2500 (≈1 % of the disc: what an Hα-sensitive camera shows as a faint
    // pink fringe) and Cinematic ×10⁴ (Hα-filter-like) are PERCEPTUAL presentations, labelled in the UI.
    const prom = float(0).toVar();
    for (let k = 0; k < 10; k++) {
      const h1 = Math.sin(k * 12.9898 + 78.233) * 43758.5453, hk = h1 - Math.floor(h1);
      const h2 = Math.sin(k * 39.346 + 11.135) * 24634.6345, gk = h2 - Math.floor(h2);
      const pa0 = (k / 10) * 6.2831853 + hk * 0.55;
      const height = 0.025 + 0.09 * gk, halfW = 0.035 + 0.09 * hk;
      // drift: ~13°/day apparent rotation projected onto the limb → features rotate off over ~a week and are replaced
      const paK = atan(vUv.y, vUv.x).sub(float(pa0).add(U.days.mul(0.0065 * (0.6 + gk))));
      const dpa = atan(sin(paK), cos(paK));                         // wrapped −π..π
      const u = dpa.div(halfW);                                     // −1..1 across the feature
      const arch = float(1).sub(u.mul(u)).max(0).sqrt().mul(height); // arch profile height above the limb
      const hgt = r.sub(1.0);
      const body = smoothstep(arch.add(0.012), arch.mul(0.85), hgt).mul(smoothstep(-0.004, 0.006, hgt)).mul(smoothstep(1.05, 0.8, abs(u)));
      const threads = fbm({ p: vec3(dpa.mul(60), hgt.mul(90), float(k * 7.1).add(U.time.mul(2e-5))), oct: 3 }).mul(1.6).sub(0.35).max(0);
      prom.addAssign(body.mul(threads).mul(0.6 + 0.4 * gk));
    }
    const promL = prom.mul(4e-6).mul(U.prominence).mul(U.activity.mul(0.6).add(0.4));
    const col = vec3(1.0, 0.97, 0.92).mul(corona).add(vec3(1.0, 0.28, 0.32).mul(promL)).add(vec3(1.0, 0.32, 0.36).mul(chromo)).add(vec3(1.0, 0.78, 0.5).mul(aure));
    const fade = smoothstep(CORONA_EXTENT, CORONA_EXTENT * 0.8, r);
    return vec4(col.mul(U.meanL).mul(fade).mul(U.enabled), 1);
  })();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  return { mesh, U };
}
export { baumbach } from '../astro/solar';
