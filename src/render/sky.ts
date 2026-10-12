// @ts-nocheck — TSL node graphs are dynamically typed
// Celestial background: ESA Gaia all-sky map (galactic equirectangular) as the diffuse Milky Way,
// plus constellation figures and coordinate grids drawn on the celestial sphere.
import * as THREE from 'three/webgpu';
import { Fn, uniform, texture, positionLocal, vec2, vec3, vec4, float, normalize, mat3, atan, asin, clamp, pow, max, dot, mix, fract, sin, sqrt, log2, exp } from 'three/tsl';
import { radianceFromSB, SKY_CAL } from './presentation';
import { PX } from './points';
import { EQ2GAL, ECL2EQ } from '../astro/frames';
import { mulMM } from '../astro/vec';

export interface SkyV381Meta { luma: { lnMin: number; lnMax: number; width: number }; bandMedianY: number }
export function makeSky(tex: THREE.Texture, cal?: { bandMedianY: number }) {
  // v3.5: the panorama is the STAR-REMOVED diffuse layer (tools/ingest/sky_diffuse.py) so catalogue stars are not
  // double-counted, converted to physical radiance in SOL units with a DERIVED calibration (presentation.ts SKY_CAL):
  //   L = L(μ_band) · (Y / Y_band)^γ   clamped to [L(μ_floor), L(μ_peak)]
  // `gain` is the sky-domain exposure × user/mode multipliers (see presentation.ts skyExposure).
  // v3.8.1 SKY-381-04: once streamed, the luminance comes from the Gaia EDR3 8192×4096 log-encoded layer (lumaTex, compact
  // sources removed, no blur) and the colour from its 2048×1024 chroma map; until then (and if it fails) the v3.5 4k diffuse
  // map is used unchanged. Both paths share the same calibration, so the swap changes detail, not exposure.
  const U = { gain: uniform(1), Lband: uniform(radianceFromSB(SKY_CAL.bandMu)), Yband: uniform(cal?.bandMedianY ?? 0.229),
    Lfloor: uniform(radianceFromSB(SKY_CAL.floorMu)), Lpeak: uniform(radianceFromSB(SKY_CAL.peakMu)), gamma: uniform(SKY_CAL.contrastGamma), frame: uniform(0),
    hi: uniform(0), lnMin: uniform(-9), lnMax: uniform(0), YbandHi: uniform(0.229), lumaW: uniform(8192), chromaSat: uniform(0.55) };
  // scene → ecliptic → equatorial → galactic
  const SCENE2ECL = [1, 0, 0, 0, 0, -1, 0, 1, 0]; // (x,y,z)_ecl = (xs, -zs, ys)
  const M = mulMM(EQ2GAL, mulMM(ECL2EQ, SCENE2ECL));
  const m3 = new THREE.Matrix3().set(M[0], M[1], M[2], M[3], M[4], M[5], M[6], M[7], M[8]);
  const uM = uniform(m3);
  const placeholder = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType); placeholder.needsUpdate = true;
  const baseNode = texture(tex), lumaNode = texture(placeholder);
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false });
  m.colorNode = Fn(() => {
    const d = normalize(uM.mul(normalize(positionLocal)));
    const l = atan(d.y, d.x), b = asin(clamp(d.z, -1, 1));
    const uvc = vec2(float(0.5).sub(l.mul(0.15915494)), b.mul(0.31830989).add(0.5));
    // v3.8.1 SKY-381-02: explicit mip level from the pixel's angular size. With implicit derivatives the atan() wrap at
    // l = ±180° (the Galactic ANTICENTRE) produced a 1-px seam sampled from the coarsest mip, and mip selection shimmered
    // with the equirectangular stretch. Texel = 2π/width rad; device pixel = √(pixelSA)/dpr rad.
    const pxDev = sqrt(PX.pixelSA).div(PX.dpr);
    const texW = float((tex.image as any)?.width ?? 4096);
    const c = baseNode.sample(uvc).level(max(log2(pxDev.mul(texW).div(6.2831853)), 0)).rgb;
    const Ylo = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
    // hi-res luminance (log-encoded r8) → linear map luminance, renormalised to the v3.5 band median so SKY_CAL holds
    const v = lumaNode.sample(uvc).level(max(log2(pxDev.mul(U.lumaW).div(6.2831853)), 0)).r;
    const Yhi = exp(mix(U.lnMin, U.lnMax, v)).mul(U.Yband.div(U.YbandHi));
    const Y = max(mix(Ylo, Yhi, U.hi), 1e-6);
    const L = clamp(U.Lband.mul(pow(Y.div(U.Yband), U.gamma)), U.Lfloor, U.Lpeak);
    // colour: the map's chroma (Gaia BP/RP display rendition), partially desaturated — diffuse integrated starlight is
    // less saturated than the stretched map suggests (v3.5 used 0.5; v3.8.1 0.65 with the cleaner EDR3 chroma)
    // v3.8.1 SKY-381-05: saturation also follows the band's own relative brightness — faint, dusty regions of the map are
    // the most strongly tinted in the stretched source and rendered as dim orange read as brown "mud"; integrated
    // starlight at low surface brightness is close to neutral to the eye. Bright band/bulge keeps its warm chroma.
    const satHi = mix(float(0.22), U.chromaSat, clamp(log2(Y.div(U.Yband)).add(3).div(4), 0, 1));
    const chroma = mix(vec3(1, 1, 1), c.div(Ylo), mix(float(0.5), satHi, U.hi));
    // v3.8.1 SKY-381-03: the dither is fixed to the sky. v3.5–3.8.0 added the frame number (mod 64) to the hash, so the
    // whole Milky Way re-noised every frame — a ±1 % temporal boil visible as crawling texture during slow pans.
    const n = fract(sin(dot(uvc.mul(vec2(4096, 2048)).floor(), vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5);
    return vec4(chroma.mul(L).mul(U.gain).mul(float(1).add(n.mul(0.02))), 1);
  })();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1e10, 128, 64), m);
  mesh.renderOrder = -100; mesh.frustumCulled = false;
  /** Switch to the v3.8.1 Gaia EDR3 layer (luma r8 log + 2k chroma). */
  const setHiRes = (luma: THREE.Texture, chroma: THREE.Texture, meta: SkyV381Meta) => {
    lumaNode.value = luma; baseNode.value = chroma;
    U.lnMin.value = meta.luma.lnMin; U.lnMax.value = meta.luma.lnMax; U.lumaW.value = meta.luma.width; U.YbandHi.value = meta.bandMedianY; U.hi.value = 1;
  };
  return { mesh, U, setHiRes };
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
