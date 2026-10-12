// @ts-nocheck — TSL node graphs are dynamically typed
// Point sources: stars, unresolved bodies and the asteroid swarm, drawn as energy-normalised PSF sprites.
// Flux unit = π × physical irradiance relative to the Sun at 1 AU (same unit as surface radiance in planetMaterial).
import * as THREE from 'three/webgpu';
import { Fn, uniform, attribute, positionGeometry, vec2, vec3, vec4, float, exp, max, min, sqrt, log, clamp, varying, cameraProjectionMatrix, cameraViewMatrix, length, smoothstep, pow, select, mix, sign } from 'three/tsl';

export const PX = { // shared per-frame uniforms
  exposure: uniform(1), pixelSA: uniform(1e-6), viewport: uniform(new THREE.Vector2(1920, 1080)), starGain: uniform(1), bodyGain: uniform(1),
  // v3.8.1 (STAR-P01): σ of the intrinsic optical PSF in DEVICE pixels (the drawing-buffer pixels the fragments run on) and the
  // device-pixel ratio. v3.4–3.8.0 used σ = 0.85 CSS px, point-sampled at fragment centres: on a 2× display that is a
  // 1.7-device-px blob (soft "generic dots"). Point sampling is only energy-safe for σ ≳ 0.6 px (42 % error at 0.35 px),
  // so the sharper device-pixel PSF is integrated over each pixel instead (psf381.test.ts).
  sigma: uniform(0.62), dpr: uniform(1), thresh: uniform(0.008),
  // v3.5 star highlight compression (presentation.ts compressPeak): display peaks above the knee are mapped
  // knee·(peak/knee)^γ. Scientific: γ = 1 (identity). Keeps magnitude ORDER, stops bright stars ballooning into discs
  // when the sky has its own dark-adapted exposure.
  starKnee: uniform(1e9), starGamma: uniform(1),
};
function quad() {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}
/** erf(x), Winitzki (2008) approximation, |error| < 1.3e-4 (TSL). */
const erfT = (x: any) => {
  const x2 = x.mul(x), a = float(0.147);
  return sign(x).mul(sqrt(float(1).sub(exp(x2.negate().mul(float(1.2732395).add(a.mul(x2))).div(float(1).add(a.mul(x2)))))));
};
/** CPU twin of the TSL erf (tests / QA). */
export function erfApprox(x: number) { const x2 = x * x, a = 0.147; return Math.sign(x) * Math.sqrt(1 - Math.exp(-x2 * (4 / Math.PI + a * x2) / (1 + a * x2))); }
/** Fraction of a 1-D Gaussian (σ px) that falls in the pixel [d − ½, d + ½] (d = pixel-centre offset from the star). */
export function pixelFraction1D(d: number, sigma: number) { const k = 1 / (Math.SQRT2 * sigma); return 0.5 * (erfApprox((d + 0.5) * k) - erfApprox((d - 0.5) * k)); }
/** Energy fraction of the PSF scattering wing (Moffat β = 1.5, core width a = 3σ) by role. */
export const PSF_WING = { star: 0.045, body: 0.035 } as const;
// Build the PSF material. `centerNode` gives the camera-relative position, `fluxNode` the rgb flux.
// v3.8.1 (STAR-P01) energy-conserving image formation: each fragment receives the EXACT integral of the PSF over its own
// device pixel (separable erf box integral of the Gaussian core) plus a normalised θ⁻³ scattering wing, so the summed
// energy of a star is the same at every sub-pixel position and every render scale (tests/render/psf381.test.ts). The
// sprite radius only bounds where the profile is below display visibility; it never adds light.
export function psfMaterial(centerNode: any, fluxNode: any, opts: { gain: any; maxSize?: number; minSize?: number; farPlane?: boolean; halo?: number; compress?: any; wing?: number }) {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const vI = varying(vec3(0), 'vI'), vR = varying(float(1), 'vR'), vCorner = varying(vec2(0), 'vC');
  const wingF = float(opts.wing ?? PSF_WING.star);
  m.vertexNode = Fn(() => {
    const c = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(centerNode, 1)));
    const flux0 = fluxNode.mul(opts.gain);
    const lum0 = max(max(flux0.x, flux0.y), flux0.z);
    // device-pixel solid angle and the effective (optics ⊗ pixel box) variance σ² + 1/12
    const pixSAdev = PX.pixelSA.div(PX.dpr.mul(PX.dpr));
    const s2eff = PX.sigma.mul(PX.sigma).add(0.0833333);
    const peak0 = lum0.mul(float(1).sub(wingF)).div(pixSAdev.mul(6.2831853).mul(s2eff)).mul(PX.exposure);
    // v3.5: optional highlight compression (per-instance weight `compress` ∈ [0,1]; 1 = compress)
    const cw = opts.compress ?? float(0);
    const knee = PX.starKnee, kneeHit = peak0.greaterThan(knee).and(PX.starGamma.lessThan(0.999));
    const ratio = select(kneeHit, knee.mul(pow(peak0.div(knee).max(1), PX.starGamma)).div(peak0.max(1e-30)), float(1));
    const scale = mix(float(1), ratio, cw);
    const flux = flux0.mul(scale), peak = peak0.mul(scale);
    // visible extent (device px): Gaussian core above `thresh`, and the wing (peak_w = wing·L/(2πa²)) above `thresh`
    const sEff = sqrt(s2eff), aW = PX.sigma.mul(3).max(1.2);
    const rCore = sEff.mul(sqrt(max(log(max(peak.div(PX.thresh), 1.0001)).mul(2.0), 0.0))).add(1.0);
    const peakW = peak.mul(s2eff).mul(wingF).div(aW.mul(aW).mul(float(1).sub(wingF)));
    const rWing = aW.mul(sqrt(max(pow(max(peakW.div(PX.thresh), 1.0), 0.6667).sub(1), 0.0)));
    const radDev = clamp(max(rCore, rWing), PX.dpr.mul(opts.minSize ?? 1.5), PX.dpr.mul(opts.maxSize ?? 48));
    vI.assign(flux.div(pixSAdev));                     // radiance × device-pixel SA = flux: profile integrates to 1
    vR.assign(radDev); vCorner.assign(positionGeometry.xy.mul(radDev));
    const off = positionGeometry.xy.mul(radDev.div(PX.dpr)).mul(2).div(PX.viewport).mul(c.w);
    // v3.5 fix: far-plane sprites sit EXACTLY on the reversed-depth far plane (z = 0). v3.4 used z = 1e-9·w, but with a
    // 1e-6 km near plane a body 20,000 km away has reversed depth ≈ 5e-11 < 1e-9, so stars passed the depth test and
    // were drawn ON TOP of night-side discs (invisible in v3.4 only because the stars themselves were exposed away).
    // v3.8 DEF-38-002: camera-relative body points beyond the 1e13-km far plane (≈ 66,800 AU) were clipped, so the
    // Sun vanished beyond ~1.06 ly (sunfar-1pc / sunfar-proxima-dist were empty in v3.7.0 and v3.8 wip). A point source
    // has no resolvable depth there: it is pinned to the reversed-depth far plane (z = 0) and still depth-tested, so a
    // nearer body still occludes it.
    const z = opts.farPlane ? c.w.mul(0) : max(c.z, 0);
    return vec4(c.x.add(off.x), c.y.add(off.y), z, c.w);
  })();
  m.fragmentNode = Fn(() => {
    const d = vCorner;                                  // device-pixel offset of this fragment's centre from the star
    const k = float(0.70710678).div(PX.sigma);
    const ex = erfT(d.x.add(0.5).mul(k)).sub(erfT(d.x.sub(0.5).mul(k))).mul(0.5);
    const ey = erfT(d.y.add(0.5).mul(k)).sub(erfT(d.y.sub(0.5).mul(k))).mul(0.5);
    const core = ex.mul(ey);
    // optical scattering wing, Moffat β = 1.5 (∝ θ⁻³ far out), normalised to unit integral: 1/(2πa²)·(1 + r²/a²)^−1.5
    const aW = PX.sigma.mul(3).max(1.2), r2 = d.dot(d);
    const wing = pow(float(1).add(r2.div(aW.mul(aW))), -1.5).div(aW.mul(aW).mul(6.2831853));
    const edge = smoothstep(vR, vR.mul(0.8), length(d));
    return vec4(vI.mul(core.mul(float(1).sub(wingF)).add(wing.mul(wingF).mul(edge))), 1);
  })();
  return m;
}
// CPU-fed point layer (bodies): positions & flux written every frame
export class PointLayer {
  mesh: THREE.Mesh; pos: Float32Array; flux: Float32Array; comp: Float32Array; count = 0;
  aPos: THREE.InstancedBufferAttribute; aFlux: THREE.InstancedBufferAttribute; aComp: THREE.InstancedBufferAttribute;
  constructor(capacity: number, gain: any) {
    const g = quad();
    this.pos = new Float32Array(capacity * 3); this.flux = new Float32Array(capacity * 3); this.comp = new Float32Array(capacity);
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3); this.aFlux = new THREE.InstancedBufferAttribute(this.flux, 3); this.aComp = new THREE.InstancedBufferAttribute(this.comp, 1);
    this.aPos.setUsage(THREE.DynamicDrawUsage); this.aFlux.setUsage(THREE.DynamicDrawUsage); this.aComp.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPos', this.aPos); g.setAttribute('aFlux', this.aFlux); g.setAttribute('aComp', this.aComp);
    g.instanceCount = 0;
    this.mesh = new THREE.Mesh(g, psfMaterial(attribute('aPos', 'vec3'), attribute('aFlux', 'vec3'), { gain, maxSize: 64, wing: PSF_WING.body, compress: attribute('aComp', 'float') }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
  }
  commit(n: number) { this.count = n; (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n; this.aPos.needsUpdate = true; this.aFlux.needsUpdate = true; this.aPos.clearUpdateRanges(); this.aFlux.clearUpdateRanges(); this.aPos.addUpdateRange(0, n * 3); this.aFlux.addUpdateRange(0, n * 3); this.aComp.needsUpdate = true; this.aComp.clearUpdateRanges(); this.aComp.addUpdateRange(0, n); }
}
// Static star field (directions only, drawn at infinity)
export function starField(dirs: Float32Array, flux: Float32Array, n: number, fade?: any) {
  const g = quad();
  g.setAttribute('aDir', new THREE.InstancedBufferAttribute(dirs, 3));
  g.setAttribute('aFlux', new THREE.InstancedBufferAttribute(flux, 3));
  g.instanceCount = n;
  const mat = psfMaterial(attribute('aDir', 'vec3').mul(1e9), attribute('aFlux', 'vec3'), { gain: fade ? PX.starGain.mul(fade) : PX.starGain, farPlane: true, maxSize: 72, wing: PSF_WING.star, compress: float(1) });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = -90;
  return mesh;
}
// Planck spectrum → linear sRGB (CIE 1931 analytic fit, Wyman et al. 2013), normalised to Y = 1
export function blackbodyRGB(T: number): [number, number, number] {
  let X = 0, Y = 0, Z = 0;
  for (let l = 380; l <= 780; l += 5) {
    const lm = l * 1e-9, B = 1 / (Math.pow(lm, 5) * (Math.exp(1.4387769e-2 / (lm * T)) - 1));
    const g = (x: number, m: number, s1: number, s2: number) => Math.exp(-0.5 * Math.pow((x - m) / (x < m ? s1 : s2), 2));
    const xb = 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
    const yb = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
    const zb = 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
    X += B * xb; Y += B * yb; Z += B * zb;
  }
  X /= Y; Z /= Y; Y = 1;
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, b = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  // white point: normalise to the Sun (5772 K) so sunlight is neutral
  return [Math.max(r, 0), Math.max(g, 0), Math.max(b, 0)];
}
export const bvToTemp = (bv: number) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
