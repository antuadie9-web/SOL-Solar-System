// @ts-nocheck — TSL node graphs are dynamically typed
// Comet comae and tails: GPU particles placed analytically every frame.
// Dust: grains with radiation-pressure parameter β drift outward under reduced solar gravity (curved, lagging tail).
// Ion: CO⁺/H₂O⁺ plasma swept straight downwind by the solar wind (≈ 400 km/s), with aberration from the comet's motion.
import * as THREE from 'three/webgpu';
import { Fn, uniform, attribute, positionGeometry, vec2, vec3, vec4, float, cameraProjectionMatrix, cameraViewMatrix, varying, length, normalize, exp, max, clamp, mix, sqrt, cross, pow, smoothstep } from 'three/tsl';
import { PX } from './points';
import { mulberry } from './geometry';

export class CometTail {
  mesh: THREE.Mesh;
  U = { nucleus: uniform(new THREE.Vector3()), sunDir: uniform(new THREE.Vector3(1, 0, 0)), vel: uniform(new THREE.Vector3()), r: uniform(1), rKm: uniform(1.5e8), g: uniform(0),
    dustFlux: uniform(0), ionFlux: uniform(0), ageMax: uniform(25), size: uniform(1) };
  constructor(n = 24000, seed = 1) {
    const rnd = mulberry(seed);
    const attr = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const ion = i % 4 === 0 ? 1 : 0;
      attr[i * 4] = Math.pow(rnd(), 1.4);            // age fraction
      attr[i * 4 + 1] = ion ? rnd() : 0.05 + Math.pow(rnd(), 2.2) * 1.6; // β (dust) or lateral jitter (ion)
      attr[i * 4 + 2] = rnd() * Math.PI * 2;         // azimuth of ejection
      attr[i * 4 + 3] = ion;
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(attr, 4));
    g.instanceCount = n;
    const U = this.U, N = float(n);
    const vI = varying(vec3(0), 'cI'), vC = varying(vec2(0), 'cC');
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    m.vertexNode = Fn(() => {
      const a = attribute('aP', 'vec4');
      const ion = a.w;
      const ageD = a.x.mul(U.ageMax).mul(mix(float(1), float(0.35), ion));
      const age = ageD.mul(86400);               // s
      const rhat = U.sunDir.negate();            // anti-sunward
      // a perpendicular basis for ejection cones
      const t1 = normalize(cross(rhat, vec3(0.31, 0.95, 0.07)));
      const t2 = cross(rhat, t1);
      const az = a.z, ej = t1.mul(az.cos()).add(t2.mul(az.sin()));
      // dust: relative acceleration β·g outward, direction evaluated at mid-age along the nucleus path (curvature)
      const rmid = normalize(rhat.mul(U.rKm).sub(U.vel.mul(age.mul(0.5))));
      const dust = rmid.mul(a.y.mul(U.g).mul(age).mul(age).mul(0.5))
        .add(ej.mul(age.mul(mix(float(0.6), float(0.25), clamp(a.y, 0, 1)))));   // ejection ≈ 0.3–0.6 km/s
      // ion: straight downwind of the aberrated solar wind, narrow streamers
      const wind = normalize(rhat.mul(400).sub(U.vel));
      const ionp = wind.mul(age.mul(180)).add(ej.mul(age.mul(4)).mul(a.y));
      const rel = mix(dust, ionp, ion);
      const p = U.nucleus.add(rel);
      const c = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(p, 1)));
      const dist = length(p).max(1);
      // grains spread with age: blob size grows (km), projected to pixels
      const worldR = float(2500).add(length(rel).mul(0.045)).mul(U.size);
      const pxAng = sqrt(PX.pixelSA);
      const rpx = clamp(worldR.div(dist).div(pxAng), 1.5, 220);
      const f = mix(U.dustFlux, U.ionFlux, ion).div(N.mul(mix(float(0.75), float(0.25), ion)));
      const fade = smoothstep(1.0, 0.6, a.x).mul(smoothstep(0.0, 0.02, a.x));
      const col = mix(vec3(1.0, 0.92, 0.78), vec3(0.45, 0.68, 1.0), ion);
      const sig = rpx.mul(0.42);
      vI.assign(col.mul(f).mul(fade).div(PX.pixelSA.mul(6.2831853).mul(sig).mul(sig)));
      vC.assign(positionGeometry.xy.mul(2.4));
      const off = positionGeometry.xy.mul(rpx).mul(2).div(PX.viewport).mul(c.w);
      return vec4(c.x.add(off.x), c.y.add(off.y), c.z, c.w);
    })();
    m.fragmentNode = Fn(() => vec4(vI.mul(exp(length(vC).mul(length(vC)).mul(-0.5))), 1))();
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
  }
}
