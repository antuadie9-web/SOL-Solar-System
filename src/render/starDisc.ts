// @ts-nocheck — TSL node graphs are dynamically typed
// SOL v3.8.1 (STAR-381-D) — resolved disc of a nearby catalogue star when the camera is close enough to resolve it.
// Physically constrained representation, LABELLED as such in the inspector: measured (or estimated) radius, V-band mean
// surface brightness from the star's own absolute magnitude and radius (S = 10^(−0.4(M_V−4.83))/(R/R☉)² relative to the
// Sun), Planck colour from Teff, and a REPRESENTATIVE linear limb-darkening law by Teff. No surface structure is invented:
// no observed maps of these photospheres exist (the Sun's granulation shader is deliberately NOT reused).
// Drawn as a camera-facing impostor of an exact sphere (ray–sphere per fragment, correct depth), so it is crisp at any size.
import * as THREE from 'three/webgpu';
import { Fn, uniform, vec2, vec3, vec4, float, positionGeometry, cameraProjectionMatrix, cameraViewMatrix, varying, length, sqrt, max, Discard, If, mix, smoothstep } from 'three/tsl';
export function makeStarDisc() {
  const U = { center: uniform(new THREE.Vector3()), radius: uniform(1e5), right: uniform(new THREE.Vector3(1, 0, 0)), up: uniform(new THREE.Vector3(0, 1, 0)),
    L: uniform(new THREE.Vector3(1, 1, 1)), u: uniform(0.6), weight: uniform(0) };
  const vUv = varying(vec2(0), 'sdUv');
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  m.vertexNode = Fn(() => {
    vUv.assign(positionGeometry.xy.mul(1.02));
    const w = U.center.add(U.right.mul(positionGeometry.x.mul(U.radius.mul(1.02)))).add(U.up.mul(positionGeometry.y.mul(U.radius.mul(1.02))));
    return cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(w, 1)));
  })();
  m.fragmentNode = Fn(() => {
    const r = length(vUv);
    If(r.greaterThan(1.0), () => { Discard(); });
    const mu = sqrt(max(float(1).sub(r.mul(r)), 0));
    const I = float(1).sub(U.u.mul(float(1).sub(mu))).div(float(1).sub(U.u.div(3)));   // linear law, normalised to the mean
    const edge = smoothstep(1.0, 0.985, r);
    return vec4(U.L.mul(I).mul(edge).mul(U.weight), 1);
  })();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.visible = false;
  return { mesh, U };
}
