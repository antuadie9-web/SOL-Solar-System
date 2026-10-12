// @ts-nocheck — TSL node graphs are dynamically typed
// Celestial background: ESA Gaia all-sky map (galactic equirectangular) as the diffuse Milky Way,
// plus constellation figures and coordinate grids drawn on the celestial sphere.
import * as THREE from 'three/webgpu';
import { Fn, uniform, texture, positionLocal, vec2, vec3, vec4, float, normalize, mat3, atan, asin, clamp, pow, max, dot, mix, fract, sin } from 'three/tsl';
import { radianceFromSB, SKY_CAL } from './presentation';
import { EQ2GAL, ECL2EQ } from '../astro/frames';
import { mulMM } from '../astro/vec';

export function makeSky(tex: THREE.Texture, cal?: { bandMedianY: number }) {
  // v3.5: the panorama is the STAR-REMOVED diffuse layer (tools/ingest/sky_diffuse.py) so catalogue stars are not
  // double-counted, converted to physical radiance in SOL units with a DERIVED calibration (presentation.ts SKY_CAL):
  //   L = L(μ_band) · (Y / Y_band)^γ   clamped to [L(μ_floor), L(μ_peak)]
  // `gain` is the sky-domain exposure × user/mode multipliers (see presentation.ts skyExposure).
  const U = { gain: uniform(1), Lband: uniform(radianceFromSB(SKY_CAL.bandMu)), Yband: uniform(cal?.bandMedianY ?? 0.229),
    Lfloor: uniform(radianceFromSB(SKY_CAL.floorMu)), Lpeak: uniform(radianceFromSB(SKY_CAL.peakMu)), gamma: uniform(SKY_CAL.contrastGamma), frame: uniform(0) };
  // scene → ecliptic → equatorial → galactic
  const SCENE2ECL = [1, 0, 0, 0, 0, -1, 0, 1, 0]; // (x,y,z)_ecl = (xs, -zs, ys)
  const M = mulMM(EQ2GAL, mulMM(ECL2EQ, SCENE2ECL));
  const m3 = new THREE.Matrix3().set(M[0], M[1], M[2], M[3], M[4], M[5], M[6], M[7], M[8]);
  const uM = uniform(m3);
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false });
  m.colorNode = Fn(() => {
    const d = normalize(uM.mul(normalize(positionLocal)));
    const l = atan(d.y, d.x), b = asin(clamp(d.z, -1, 1));
    const uvc = vec2(float(0.5).sub(l.mul(0.15915494)), b.mul(0.31830989).add(0.5));
    const c = texture(tex, uvc).rgb;
    const Y = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
    const L = clamp(U.Lband.mul(pow(Y.div(U.Yband), U.gamma)), U.Lfloor, U.Lpeak);
    // keep the map's colour (Gaia BP/RP-like), slightly desaturated: diffuse starlight is less saturated than the
    // stretched map suggests
    const chroma = mix(vec3(1, 1, 1), c.div(Y), 0.5);
    // ±½ LSB dither (display domain ≈ 1/255 of the band's displayed value) against banding in the 8-bit source
    const n = fract(sin(dot(uvc.mul(vec2(4096, 2048)).floor().add(U.frame), vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5);
    return vec4(chroma.mul(L).mul(U.gain).mul(float(1).add(n.mul(0.02))), 1);
  })();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1e10, 128, 64), m);
  mesh.renderOrder = -100; mesh.frustumCulled = false;
  return { mesh, U };
}
// Constellation lines (great-circle segments) on the celestial sphere
export function constellationLines(data: { lines: number[][][] }, toScene: (ra: number, dec: number) => [number, number, number]) {
  const pos: number[] = [];
  for (const ln of data.lines) for (let k = 0; k < ln.length - 1; k++) {
    const a = toScene(ln[k][0], ln[k][1]), b = toScene(ln[k + 1][0], ln[k + 1][1]);
    // subdivide so lines follow the sphere
    const N = 8;
    for (let j = 0; j < N; j++) {
      const t0 = j / N, t1 = (j + 1) / N;
      const p0 = slerp(a, b, t0), p1 = slerp(a, b, t1);
      pos.push(...p0.map(x => x * 9e9), ...p1.map(x => x * 9e9));
    }
  }
  return new Float32Array(pos);
}
function slerp(a: number[], b: number[], t: number) {
  const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t, l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}
