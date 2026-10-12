// @ts-nocheck — TSL node graphs are dynamically typed
// v3.4 Saturn ring NEAR-FIELD slice (spec D5: "start the architecture and a verified close fly-through slice").
//
// Far away the rings stay the textured photometric annulus (rings.ts). Within a few km of the ring plane, inside the
// main rings, a camera-anchored field of individual particles fades in:
//  • local Hill frame at the camera's ring radius: x radial, y prograde, z ring normal;
//  • a periodic box of side L = 120 m that wraps around the camera (positions are deterministic hashes of the
//    instance id, so the field is stable when the camera moves and never "pops"); the box period is hidden by a
//    distance fade at ≈0.45 L;
//  • particle radii follow the classic n(a) ∝ a⁻³ power law (Zebker et al. 1985; Cuzzi et al.), drawn between 0.2 m
//    (smaller ones are sub-pixel at the fade distance) and 5 m;
//  • number density from the local normal optical depth τ (τ = N·π⟨a²⟩/L²) using a coarse published radial τ profile
//    (C ring ≈ 0.1, B ≈ 1.5–2.5, Cassini Division ≈ 0.1, A ≈ 0.5, Encke gap ≈ 0) — capped by the instance budget;
//  • vertical thickness ≈ ±10 m (local ring thickness ~10 m: Cassini UVIS/VIMS occultations);
//  • relative motion: Keplerian shear in the Hill frame, ẏ = −(3/2)·Ω·x, accumulated from the moment the field turns on;
//  • shading: Lambert-like icy spheres (Bond albedo ≈ 0.5), lit by the Sun, dimmed inside Saturn's shadow.
// What it is NOT: no self-gravity wakes, no collisions, no particle-to-particle shadowing, no regolith texture — those
// are documented as later work. Particles are shaded impostor spheres (one quad each), never meshes.
import * as THREE from 'three/webgpu';
import { vnoise } from './shaderlib';
import { Fn, uniform, attribute, positionGeometry, vec2, vec3, vec4, float, fract, length, max, sqrt, dot, smoothstep, varying, cameraProjectionMatrix, cameraViewMatrix, Discard, If, mix, normalize } from 'three/tsl';

// v3.7: maxCount 24,000 → 65,536. The B-ring core (τ ≈ 2–2.5) needs N = τL²/(π⟨a²⟩) ≈ 44,000 particles in the 120-m box
// for n(a) ∝ a⁻³ on 0.2–5 m; v3.4–3.6 capped it at 24,000, i.e. ≈ 55 % of the intended optical depth (issue RING-001/B-ring τ).
export const RING_FIELD = { L: 0.12 /* km */, maxCount: 65536, aMin: 0.0002, aMax: 0.005, halfThick: 0.01, fadeAlt: 3.0 /* km above plane */ };
/** Coarse normal optical depth of Saturn's main rings vs radius (km). Values are representative of Voyager/Cassini
 *  occultation profiles at the 10³-km scale; fine structure lives in the far-field texture. */
export function saturnTau(r: number): number {
  if (r < 74658 || r > 136775) return 0;
  if (r < 92000) return 0.1;                       // C ring
  if (r < 99000) return 1.2;                       // inner B
  if (r < 104500) return 2.5;                      // B core (very opaque)
  if (r < 117580) return 1.8;                      // outer B
  if (r < 122170) return 0.12;                     // Cassini Division
  if (r > 133423 && r < 133745) return 0;          // Encke gap
  if (r > 136487 && r < 136522) return 0;          // Keeler gap
  return 0.5;                                      // A ring
}
const meanA2 = () => { const { aMin: a, aMax: b } = RING_FIELD; return Math.log(b / a) / ((1 / (a * a) - 1 / (b * b)) / 2); }; // ⟨a²⟩ for n ∝ a⁻³
export function particleCountForTau(tau: number) { const L = RING_FIELD.L; return Math.min(RING_FIELD.maxCount, Math.round(tau * L * L / (Math.PI * meanA2()))); }

export function makeRingField() {
  const N = RING_FIELD.maxCount;
  const seed = new Float32Array(N * 4);
  // deterministic low-discrepancy-ish hashes; radius by inverse-CDF of n(a) ∝ a⁻³ between aMin and aMax
  let h = 2166136261;
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000003) / 1000003; };
  const { aMin, aMax } = RING_FIELD;
  for (let i = 0; i < N; i++) {
    const u = rnd(); const a = 1 / Math.sqrt(1 / (aMin * aMin) - u * (1 / (aMin * aMin) - 1 / (aMax * aMax)));
    seed.set([rnd(), rnd(), rnd() * 2 - 1, a], i * 4);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute('pSeed', new THREE.InstancedBufferAttribute(seed, 4));
  g.instanceCount = 0;
  const U = {
    ex: uniform(new THREE.Vector3(1, 0, 0)), ey: uniform(new THREE.Vector3(0, 1, 0)), ez: uniform(new THREE.Vector3(0, 0, 1)), // Hill axes in scene
    camOff: uniform(new THREE.Vector3()),      // camera position in the Hill box, wrapped to [0, L) (CPU float64)
    shear: uniform(0),                         // −1.5·Ω·t (rad·s/s → km per km of radial offset)
    sunDir: uniform(new THREE.Vector3(1, 0, 0)), irr: uniform(1), shadow: uniform(1), fade: uniform(0), L: uniform(RING_FIELD.L), halfThick: uniform(RING_FIELD.halfThick),
  };
  const vN = varying(vec2(0), 'rpN'), vF = varying(float(0), 'rpF'), vH = varying(float(0), 'rpH');
  const m = new THREE.MeshBasicNodeMaterial({ transparent: false, depthWrite: true });
  m.vertexNode = Fn(() => {
    const s = attribute('pSeed', 'vec4');
    // box coordinates relative to the camera, wrapped to [−L/2, L/2)
    const x0 = s.x.mul(U.L), z0 = s.z.mul(U.halfThick);
    const y0 = s.y.mul(U.L).add(x0.sub(U.L.mul(0.5)).mul(U.shear));            // Keplerian shear about the box centre
    const rx = fract(x0.sub(U.camOff.x).div(U.L).add(0.5)).sub(0.5).mul(U.L);
    const ry = fract(y0.sub(U.camOff.y).div(U.L).add(0.5)).sub(0.5).mul(U.L);
    const rz = z0.sub(U.camOff.z);
    const c = U.ex.mul(rx).add(U.ey.mul(ry)).add(U.ez.mul(rz));
    const d = length(c);
    vF.assign(smoothstep(U.L.mul(0.47), U.L.mul(0.3), d).mul(U.fade));
    // camera-facing quad of the particle's radius
    const view = cameraViewMatrix.mul(vec4(c, 1));
    vN.assign(positionGeometry.xy); vH.assign(fract(s.y.mul(7919.0).add(s.x.mul(104729.0))));
    return cameraProjectionMatrix.mul(view.add(vec4(positionGeometry.xy.mul(s.w), 0, 0)));
  })();
  m.colorNode = Fn(() => {
    const r2 = dot(vN, vN);
    // dithered (stochastic) fade: opaque particles disappear one by one instead of darkening into the bright ring plane
    If(r2.greaterThan(1).or(vH.greaterThan(vF)), () => { Discard(); });
    // impostor sphere normal in view space → approximate with view-aligned hemisphere; light in view space
    const nz = sqrt(max(float(1).sub(r2), 0));
    // lumpy regolith-coated ice aggregate rather than a billiard ball: low-order noise perturbs the impostor normal and
    // albedo (deterministic per particle via vH); still a single quad
    // v3.7: smooth icy aggregate. The v3.4 noise bump/albedo modulation read as cratered rock in close views, so the normal is
    // the plain impostor sphere; per-particle albedo varies ±20 % (deterministic) and a soft forward-scatter rim stands in for
    // the frost/regolith coating (Hapke-like brightening toward the limb at low phase). Still one quad per particle.
    const nView = vec3(vN.x, vN.y, nz);
    const lView = normalize(cameraViewMatrix.mul(vec4(U.sunDir, 0)).xyz);
    // + approximate ringshine: diffuse fill from the sunlit ring sheet below/above (I/F ≈ 0.1–0.3 of the direct light)
    const lam = max(dot(nView, lView), 0).mul(0.6).add(0.07);
    const alb = float(0.8).add(vH.mul(0.4));
    const col = vec3(0.95, 0.91, 0.84).mul(alb).mul(lam).mul(U.irr).mul(U.shadow);   // v3.7: icier, brighter (water-ice dominated, Cuzzi et al. 2009)
    return vec4(col, 1);
  })();
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.visible = false;
  return { mesh, U, geo: g };
}
