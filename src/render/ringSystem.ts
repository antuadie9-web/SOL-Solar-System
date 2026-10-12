// @ts-nocheck — TSL node graphs are dynamically typed
// SOL v3.7 planetary ring systems (all four giants + Chariklo, Haumea, Quaoar) — src/data/rings.ts holds the science.
//
// One renderer, per-system physics:
//  • optical depth, never "opacity": the radial normal τ comes from (a) a MEASURED occultation profile (Saturn: Voyager PPS
//    δ Sco at 1 km) sampled at four manual LOD levels (1 km exact fetch → 9 → 69 → 550 km) chosen by the pixel footprint,
//    (b) narrow rings evaluated analytically with a pixel-footprint box filter (Uranus' 2-km rings stay sharp up close and
//    conserve their equivalent depth when sub-pixel), (c) broad diffuse components (box / Gaussian / triangular);
//  • two particle populations per radius: macroscopic (backscattering, opposition surge; lit-face single-scattering slab
//    reflection, unlit-face diffuse transmission) and dust (forward-scattering Henyey–Greenstein, optically thin — this is
//    what makes Jupiter's rings and Saturn's E/G rings appear when backlit);
//  • azimuthal arcs (Neptune's Adams arcs moving at their pattern speed; Quaoar's dense Q1R arc), planet shadow with solar
//    penumbra; per-pixel transmission for the background (rings occlude the planet and stars physically);
//  • presentation: an optional, LABELLED brightness gain for intrinsically faint systems outside Scientific mode — τ,
//    geometry and colours are never changed.
import * as THREE from 'three/webgpu';
import { Fn, uniform, texture, sampler, positionLocal, positionGeometry, vec2, vec3, vec4, float, normalize, dot, max, wgslFn, length, fwidth, clamp, atan, mix, smoothstep, If, Discard, varying, cameraProjectionMatrix, cameraViewMatrix } from 'three/tsl';
import { annulus } from './geometry';
import type { RingSystemDef } from '../data/rings';

export const FINE_W = 4096;
/** LOD pyramid (km per sample) of a measured profile; level 0 = the data itself. */
export interface ProfileLOD { r0: number; dr: number[]; data: Float32Array[] }
export function buildProfileLOD(tau: Float32Array, r0: number, dr = 1): ProfileLOD {
  const levels = [tau]; const steps = [dr];
  for (const k of [9, 69, 550]) {
    const n = Math.ceil(tau.length * dr / k), a = new Float32Array(n);
    for (let i = 0; i < n; i++) { const s = Math.floor(i * k / dr), e = Math.min(tau.length, Math.floor((i + 1) * k / dr)); let t = 0; for (let j = s; j < e; j++) t += tau[j]; a[i] = e > s ? t / (e - s) : 0; }
    levels.push(a); steps.push(k);
  }
  return { r0, dr: steps, data: levels };
}
/** Pixel-footprint coverage of a band [a, b] by a pixel spanning [r − fw/2, r + fw/2] (box filter). */
export function coverage(r: number, fw: number, a: number, b: number) { const h = Math.max(fw, 1e-6) / 2; return Math.max(0, Math.min(r + h, b) - Math.max(r - h, a)) / (2 * h); }
const HGn = (g: number, c: number) => (1 - g * g) / Math.pow(1 + g * g - 2 * g * c, 1.5);   // HG × 4π (sphere-normalised to 1 mean)
/** Normal optical depth (macro, dust) at radius r for a pixel footprint fw (km) — CPU twin of the shader (tests, shadows,
 *  ring-particle density). `arcF` multiplies arc-bearing narrow rings (azimuthal factor). */
export function ringTau(def: RingSystemDef, r: number, fw = 1, prof?: ProfileLOD | null, arcF = 1): [number, number] {
  let m = 0, d = 0;
  if (prof && def.profile && r >= def.profile.r0 && r <= def.profile.r0 + def.profile.n * def.profile.dr) {
    let L = 0; while (L < 3 && prof.dr[L + 1] <= fw) L++;
    const a = prof.data[L], x = (r - prof.r0) / prof.dr[L] - (L ? 0.5 : 0), i = Math.max(0, Math.min(a.length - 2, Math.floor(x))), t = Math.max(0, Math.min(1, x - i));
    m += a[i] * (1 - t) + a[i + 1] * t;
  }
  for (const b of def.broad) {
    let f = 0;
    if (b.shape === 'gauss') { const s = (b.rOut - b.rIn) / 4; f = Math.exp(-0.5 * ((r - (b.peak ?? (b.rIn + b.rOut) / 2)) / s) ** 2); }
    else if (b.shape === 'tri') { const pk = b.peak ?? (b.rIn + b.rOut) / 2; f = r < b.rIn || r > b.rOut ? 0 : r < pk ? (r - b.rIn) / (pk - b.rIn) : (b.rOut - r) / (b.rOut - pk); }
    else f = coverage(r, Math.max(fw, (b.rOut - b.rIn) * 0.02), b.rIn, b.rOut);
    m += b.tau * f * (1 - b.dust); d += b.tau * f * b.dust;
  }
  for (const n of def.narrow) { const c = coverage(r, fw, n.r - n.width / 2, n.r + n.width / 2), t = n.tau * (n.arcs ? arcF : 1); m += c * t * (1 - n.dust); d += c * t * n.dust; }
  return [m, d];
}
/** Lit-face I/F of a single-scattering slab (Chandrasekhar; Cuzzi et al. 1984 eq.): ϖ P/4 · μ0/(μ0+μ) · (1 − e^{−τ(1/μ0+1/μ)}). */
export function litIF(tau: number, mu0: number, mu: number, w: number, P: number) { return w * P / 4 * mu0 / (mu0 + mu) * (1 - Math.exp(-tau * (1 / mu0 + 1 / mu))); }
/** Unlit-face (diffusely transmitted) I/F: ϖ P/4 · μ0/(μ0−μ) · (e^{−τ/μ0} − e^{−τ/μ}). */
export function unlitIF(tau: number, mu0: number, mu: number, w: number, P: number) { if (Math.abs(mu0 - mu) < 1e-4) return w * P / 4 * tau / mu * Math.exp(-tau / mu); return w * P / 4 * mu0 / (mu0 - mu) * (Math.exp(-tau / mu0) - Math.exp(-tau / mu)); }
/** Peak I/F of the system in the most favourable geometry (sets the default labelled enhancement). */
export function peakIF(def: RingSystemDef, prof: ProfileLOD | null = null) {
  let best = 0; const span = def.outer - def.inner;
  for (let i = 0; i <= 400; i++) {
    const r = def.inner + span * i / 400, [m, d] = ringTau(def, r, Math.max(1, span / 400), prof);
    best = Math.max(best, litIF(m, 0.5, 0.5, def.macro.albedo, HGn(def.macro.g, -0.9)) + def.dustProps.albedo * HGn(def.dustProps.g, 0.95) / 4 * d / 0.5);
  }
  return best;
}

/** v3.7.1 (RING-007): CPU twin of the WGSL `ringShade` (macro + dust I/F) for one geometry. `l`, `v` are unit vectors in the
 *  ring frame (z = ring normal) from the ring point toward the Sun and the camera. */
export function ringShadeIF(tm: number, td: number, l: [number, number, number], v: [number, number, number], def: RingSystemDef): number {
  const mu0 = Math.max(Math.abs(l[2]), 1e-3), mu = Math.max(Math.abs(v[2]), 1e-3), lit = l[2] * v[2] > 0;
  const cpa = -(l[0] * v[0] + l[1] * v[1] + l[2] * v[2]), alpha = Math.acos(Math.max(-1, Math.min(1, -cpa)));
  const wM = def.macro.albedo, gM = def.macro.g, wD = def.dustProps.albedo, gD = def.dustProps.g;
  const PM = (1 - gM * gM) / Math.pow(1 + gM * gM - 2 * gM * cpa, 1.5) * (1 + def.macro.surge * Math.exp(-alpha / 0.035));
  const PD = (1 - gD * gD) / Math.pow(1 + gD * gD - 2 * gD * cpa, 1.5);
  const msF = 1 / (1 - 0.5 * wM * (1 - Math.exp(-tm)));
  let IFm: number;
  if (lit) IFm = msF * wM * PM * 0.25 * mu0 / (mu0 + mu) * (1 - Math.exp(-tm * (1 / mu0 + 1 / mu)));
  else if (Math.abs(mu0 - mu) < 1e-4) IFm = wM * PM * 0.25 * tm / mu * Math.exp(-tm / mu);
  else IFm = msF * wM * PM * 0.25 * mu0 / (mu0 - mu) * (Math.exp(-tm / mu0) - Math.exp(-tm / mu));
  const IFd = wD * PD * 0.25 * td / mu * Math.exp(-tm / mu0 * 0.5 - tm / mu * 0.5);
  return Math.max(IFm, 0) + IFd;
}
/** v3.7.1 (RING-007): brightest I/F of the system in the CURRENT Sun/camera geometry (ring frame, body-centred km). The
 *  v3.7 enhancement gain was derived once from a back-scattering geometry (`peakIF`), so the same ×200 drove the strongly
 *  forward-scattering Jovian dust far past display white when backlit. The gain is now chosen from this geometry-aware
 *  peak, so the brightest ring texel is mapped to the same display level whatever the phase angle. Sampled along the
 *  ring radius in the azimuths facing toward and away from the camera (where |μ| and the phase angle are extreme). */
export function peakIFAt(def: RingSystemDef, prof: ProfileLOD | null, sunLocal: [number, number, number], camLocal: [number, number, number]): number {
  let best = 0; const span = def.outer - def.inner, N = 160;
  const camR = Math.hypot(camLocal[0], camLocal[1]) || 1;
  const azs = [Math.atan2(camLocal[1], camLocal[0]), Math.atan2(camLocal[1], camLocal[0]) + Math.PI, Math.atan2(camLocal[1], camLocal[0]) + Math.PI / 2];
  void camR;
  for (const az of azs) {
    const ca = Math.cos(az), sa = Math.sin(az);
    for (let i = 0; i <= N; i++) {
      const r = def.inner + span * i / N, [m, d] = ringTau(def, r, Math.max(1, span / N), prof);
      if (m + d <= 0) continue;
      const p = [r * ca, r * sa, 0];
      const lv = [sunLocal[0] - p[0], sunLocal[1] - p[1], sunLocal[2] - p[2]], ll = Math.hypot(lv[0], lv[1], lv[2]);
      const vv = [camLocal[0] - p[0], camLocal[1] - p[1], camLocal[2] - p[2]], vl = Math.hypot(vv[0], vv[1], vv[2]);
      const f = ringShadeIF(m, d, [lv[0] / ll, lv[1] / ll, lv[2] / ll], [vv[0] / vl, vv[1] / vl, vv[2] / vl], def);
      if (f > best) best = f;
    }
  }
  return best;
}
// ── GPU ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Component table (float RGBA, 2 texels per component, row 0) and arc table (row 1):
//   c0 = (kind, a, b, tau)   kind 0 narrow (a = r, b = half width) · 1 box (rIn, rOut) · 2 gauss (peak, σ) · 3 tri (rIn, rOut)
//   c1 = (dustFraction, peak, arcFlag, outsideFactor)
//   arc = (lon rad, half-length rad, τ factor, 0)
const rowLerp = wgslFn(`
fn rowLerp(t: texture_2d<f32>, u: f32) -> f32 {
  let n = i32(textureDimensions(t).x); let x = clamp(u, 0.0, 1.0) * f32(n) - 0.5;
  let i0 = clamp(i32(floor(x)), 0, n - 1); let i1 = clamp(i0 + 1, 0, n - 1);
  return mix(textureLoad(t, vec2<i32>(i0, 0), 0).r, textureLoad(t, vec2<i32>(i1, 0), 0).r, clamp(x - floor(x), 0.0, 1.0));
}`);
const ringCore = wgslFn(`
fn ringCore(r: float32, fw: float32, phi: float32, comp: texture_2d<f32>, ncomp: i32, narcs: i32,
            pc: texture_2d<f32>, pcS: sampler, pm: texture_2d<f32>, pmS: sampler, pf: texture_2d<f32>, pfS: sampler, fine: texture_2d<f32>,
            prof: vec4<f32>, rbI: f32, rbF: f32, ecc: vec3<f32>) -> vec2<f32> {
  var tm = 0.0; var td = 0.0;
  // measured profile: prof = (r0, r1, enabled, fineCount)
  if (prof.z > 0.5 && r >= prof.x && r <= prof.y) {
    let u = (r - prof.x) / (prof.y - prof.x);
    // manual linear filtering (r16float is not guaranteed filterable through every path; nearest gave 9-km blocks)
    let tc = rowLerp(pc, u);     // 550 km
    let tmid = rowLerp(pm, u);   // 69 km
    let tf = rowLerp(pf, u);     // 9 km
    // exact 1 km samples (row-major 4096-wide), linear between neighbours
    // index split into an exact integer base + a small fraction (v3.7 near-field patch passes these from float64)
    let i0 = i32(rbI) + i32(floor(rbF)); let t = fract(rbF);
    let a0 = textureLoad(fine, vec2<i32>(i0 % 4096, i0 / 4096), 0).r;
    let i1 = min(i0 + 1, i32(prof.w) - 1);
    let a1 = textureLoad(fine, vec2<i32>(i1 % 4096, i1 / 4096), 0).r;
    let t1 = mix(a0, a1, t);
    // footprint-driven blend between levels (no aliasing far away, exact data close up)
    var v = mix(t1, tf, smoothstep(1.0, 9.0, fw));
    v = mix(v, tmid, smoothstep(9.0, 69.0, fw));
    v = mix(v, tc, smoothstep(69.0, 550.0, fw));
    tm += v;
  }
  for (var k = 0; k < ncomp; k++) {
    let c0 = textureLoad(comp, vec2<i32>(2 * k, 0), 0); let c1 = textureLoad(comp, vec2<i32>(2 * k + 1, 0), 0);
    let kind = i32(c0.x + 0.5); var f = 0.0;
    var ctr = c0.y; var hw = c0.z; var tauK = 1.0;
    if (kind == 0) {
      // v3.7.1 eccentric centre line r = a(1−e²)/(1 + e cos f), f = φ − ϖ(t); ecc = (days since epoch, azimuth of the
      // reference node in the body frame, sense: +1 if the orbital longitude increases with body azimuth, −1 if the planet's
      // spin vector is the body frame's −z, as for Uranus whose IAU north pole is opposite its spin). Width grows from periapse to apoapse with τ·w conserved.
      let eo = textureLoad(comp, vec2<i32>(k, 2), 0);
      if (eo.x > 0.0) {
        let f = phi - (ecc.y + ecc.z * (eo.y + eo.z * ecc.x));
        let cf = cos(f);
        ctr = c0.y * (1.0 - eo.x * eo.x) / (1.0 + eo.x * cf);
        let hw2 = max(c0.z - eo.w * cf, 0.25);
        tauK = c0.z / hw2; hw = hw2;
      }
    }
    if (kind == 0 || kind == 1) {
      var a = ctr - hw; var b = ctr + hw; var w = fw;
      if (kind == 1) { a = c0.y; b = c0.z; w = max(fw, (b - a) * 0.02); }
      let h = max(w, 1e-6) * 0.5;
      f = max(0.0, min(r + h, b) - max(r - h, a)) / (2.0 * h);
    } else if (kind == 2) { let z = (r - c0.y) / c0.z; f = exp(-0.5 * z * z); }
    else { let pk = c1.y; if (r >= c0.y && r <= c0.z) { f = select((c0.z - r) / max(c0.z - pk, 1e-3), (r - c0.y) / max(pk - c0.y, 1e-3), r < pk); } }
    var tau = c0.w * f * tauK;
    if (c1.z > 0.5) {
      // azimuthal arcs on this ring
      var af = c1.w;
      for (var j = 0; j < narcs; j++) {
        let ar = textureLoad(comp, vec2<i32>(j, 1), 0);
        var dp = phi - ar.x; dp = dp - 6.2831853 * round(dp / 6.2831853);
        af = af + ar.z * (1.0 - smoothstep(ar.y * 0.7, ar.y, abs(dp)));
      }
      tau = tau * af;
    }
    tm += tau * (1.0 - c1.x); td += tau * c1.x;
  }
  return vec2<f32>(tm, td);
}`.replace(/float32/g, 'f32'), [rowLerp]);
const ringShade = wgslFn(`
fn ringShade(tm: f32, td: f32, l: vec3<f32>, v: vec3<f32>, wM: f32, gM: f32, surge: f32, wD: f32, gD: f32) -> vec4<f32> {
  let mu0 = max(abs(l.z), 1e-3); let mu = max(abs(v.z), 1e-3);
  let lit = (l.z * v.z) > 0.0;
  let cpa = dot(-l, v);                        // cos of scattering angle (1 = forward)
  let alpha = acos(clamp(dot(l, v), -1.0, 1.0));   // phase angle
  let PM = (1.0 - gM * gM) / pow(1.0 + gM * gM - 2.0 * gM * cpa, 1.5) * (1.0 + surge * exp(-alpha / 0.035));
  let PD = (1.0 - gD * gD) / pow(1.0 + gD * gD - 2.0 * gD * cpa, 1.5);
  var IFm = 0.0;
  // multiple scattering between particles in optically thick rings: two-stream enhancement 1/(1 − ½ϖ(1 − e^{−τ}))
  // (APPROXIMATE; single scattering alone under-predicts the B-ring I/F)
  let msF = 1.0 / (1.0 - 0.5 * wM * (1.0 - exp(-tm)));
  if (lit) { IFm = msF * wM * PM * 0.25 * mu0 / (mu0 + mu) * (1.0 - exp(-tm * (1.0 / mu0 + 1.0 / mu))); }
  else {
    if (abs(mu0 - mu) < 1e-4) { IFm = wM * PM * 0.25 * tm / mu * exp(-tm / mu); }
    else { IFm = msF * wM * PM * 0.25 * mu0 / (mu0 - mu) * (exp(-tm / mu0) - exp(-tm / mu)); }
  }
  // dust: optically thin single scattering, attenuated by the macro particles along both paths
  let IFd = wD * PD * 0.25 * td / mu * exp(-tm / mu0 * 0.5 - tm / mu * 0.5);
  let T = exp(-(tm + td) / mu);
  return vec4<f32>(max(IFm, 0.0), IFd, 1.0 - T, 0.0);
}`);
const ringPlanetShadow = wgslFn(`
fn ringPlanetShadow(p: vec3<f32>, l: vec3<f32>, radii: vec3<f32>, sunAng: f32) -> f32 {
  let q = p / radii; let d = normalize(l / radii);
  let b = dot(q, d);
  if (b > 0.0) { return 1.0; }
  let dist = length(q - d * b);
  let ang = (dist - 1.0) / max(-b, 1e-3);
  return smoothstep(-sunAng, sunAng, ang);
}`);

function halfRedTex(a: Float32Array, w: number, h: number, filter: boolean) {
  const d = new Uint16Array(w * h); for (let i = 0; i < a.length && i < d.length; i++) d[i] = THREE.DataUtils.toHalfFloat(a[i]);
  const t = new THREE.DataTexture(d, w, h, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = t.minFilter = filter ? THREE.LinearFilter : THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t;
}
export function componentTexture(def: RingSystemDef) {
  const comps: number[][] = [];
  for (const n of def.narrow) comps.push([0, n.r, n.width / 2, n.tau], [n.dust, 0, n.arcs ? 1 : 0, def.body === 'quaoar' ? 0 : 1]);
  for (const b of def.broad) {
    if (b.shape === 'gauss') comps.push([2, b.peak ?? (b.rIn + b.rOut) / 2, (b.rOut - b.rIn) / 4, b.tau], [b.dust, 0, 0, 1]);
    else if (b.shape === 'tri') comps.push([3, b.rIn, b.rOut, b.tau], [b.dust, b.peak ?? (b.rIn + b.rOut) / 2, 0, 1]);
    else comps.push([1, b.rIn, b.rOut, b.tau], [b.dust, 0, 0, 1]);
  }
  const W = Math.max(16, comps.length), data = new Float32Array(W * 3 * 4);
  comps.forEach((c, i) => data.set(c, i * 4));
  // v3.7.1 row 2: eccentric narrow-ring orbits (e, ϖ0 rad, ϖ̇ rad/day, ½ width amplitude) indexed like the narrow components
  def.narrow.forEach((n, k) => { const o = n.orbit; if (!o || o.e <= 0) return; const dW = o.widthPeri !== undefined && o.widthApo !== undefined ? (o.widthApo - o.widthPeri) / 4 : 0;
    data.set([o.e, o.periDeg * Math.PI / 180, o.periDotDegPerDay * Math.PI / 180, dW], (2 * W + k) * 4); });
  const arcs = def.arcs?.list ?? [];
  arcs.forEach((a, j) => { const base = def.narrow.find(n => n.arcs)?.tau ?? 1; data.set([a.lon * Math.PI / 180 + a.len * Math.PI / 360, a.len * Math.PI / 360, a.tau / base, 0], (W + j) * 4); });
  const t = new THREE.DataTexture(data, W, 3, THREE.RGBAFormat, THREE.FloatType); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return { tex: t, ncomp: comps.length / 2, narcs: arcs.length };
}
/** 1-D total-τ texture over [inner, outer] (shadows on the planet; distant sanity) */
export function shadowTauTexture(def: RingSystemDef, prof: ProfileLOD | null, N = 8192) {
  const a = new Float32Array(N), span = def.outer - def.inner;
  for (let i = 0; i < N; i++) { const [m, d] = ringTau(def, def.inner + span * (i + 0.5) / N, span / N, prof); a[i] = m + d; }
  return halfRedTex(a, N, 1, true);
}
export function makeRingSystem(def: RingSystemDef, radii: [number, number, number], prof: ProfileLOD | null, colorTex?: THREE.Texture | null) {
  const U = {
    sunLocal: uniform(new THREE.Vector3(1, 0, 0)), cam: uniform(new THREE.Vector3()), irr: uniform(1), sunAng: uniform(0.001), radii: uniform(new THREE.Vector3(...radii)),
    gain: uniform(1), arcPhase: uniform(0), ecc: uniform(new THREE.Vector3(0, 0, 1)), ringIn: uniform(def.inner), ringOut: uniform(def.outer),
    // near-field patch (v3.7): centre (body-plane km), radius, exact r0 split for the profile index, camera-relative offset,
    // body axes in scene space, camera in patch coordinates
    patchOn: uniform(0), patchC: uniform(new THREE.Vector2()), patchR: uniform(100), patchR0: uniform(1e5), patchBi: uniform(0), patchBf: uniform(0),
    patchOff: uniform(new THREE.Vector3()), patchCam: uniform(new THREE.Vector3()), ax: uniform(new THREE.Vector3(1, 0, 0)), ay: uniform(new THREE.Vector3(0, 1, 0)), az: uniform(new THREE.Vector3(0, 0, 1)),
  };
  const C = componentTexture(def);
  const blank = halfRedTex(new Float32Array(4), 4, 1, true);
  const pf = prof ? halfRedTex(prof.data[1], prof.data[1].length, 1, true) : blank;
  const pm = prof ? halfRedTex(prof.data[2], prof.data[2].length, 1, true) : blank;
  const pc = prof ? halfRedTex(prof.data[3], prof.data[3].length, 1, true) : blank;
  const fineRows = prof ? Math.ceil(prof.data[0].length / FINE_W) : 1;
  const fine = prof ? halfRedTex(prof.data[0], FINE_W, fineRows, false) : halfRedTex(new Float32Array(4), 4, 1, false);
  const p0 = def.profile, profVec = prof && p0 ? [p0.r0, p0.r0 + (p0.n - 1) * p0.dr, 1, p0.n] : [0, 0, 0, 0];
  // geometry: annulus with radial resolution concentrated where structure is (≥ 2048 azimuthal segments for close views)
  const g = annulus(def.inner, def.outer, 2048, 16);
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  m.blending = THREE.CustomBlending; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
  const mc = def.macro, dp = def.dustProps;
  const shadeAt = (r: any, fw: any, phi: any, rbI: any, rbF: any, p: any, l: any, v: any) => {
    const t = ringCore({ r, fw, phi, comp: texture(C.tex), ncomp: C.ncomp, narcs: C.narcs, pc: texture(pc), pcS: sampler(pc), pm: texture(pm), pmS: sampler(pm), pf: texture(pf), pfS: sampler(pf), fine: texture(fine), prof: vec4(...profVec), rbI, rbF, ecc: U.ecc });
    const s = ringShade({ tm: t.x, td: t.y, l, v, wM: float(mc.albedo), gM: float(mc.g), surge: float(mc.surge), wD: float(dp.albedo), gD: float(dp.g) });
    const shadow = ringPlanetShadow({ p, l, radii: U.radii, sunAng: U.sunAng });
    let cm: any = vec3(...mc.color);
    if (colorTex) { const u = r.sub(69570).div(140240 - 69570); const ct = texture(colorTex, vec2(clamp(u, 0.001, 0.999), 0.5));
      const raw = ct.rgb.div(max(ct.a, 0.05)).min(vec3(1.4)); const lum = max(dot(raw, vec3(0.2126, 0.7152, 0.0722)), 0.02);
      cm = mix(vec3(1), raw.div(lum), smoothstep(0.04, 0.3, ct.a).mul(0.5)).mul(vec3(...mc.color)); }   // chroma only; low-alpha texels → neutral
    const col = cm.mul(s.x).add(vec3(...dp.color).mul(s.y)).mul(U.irr).mul(shadow).mul(U.gain);
    return vec4(col, s.z);       // premultiplied: radiance is already the visible fraction
  };
  const r0p = p0 ? p0.r0 : 0;
  m.fragmentNode = Fn(() => {
    const p = positionLocal;
    const r = length(p.xy);
    const fw = max(fwidth(r), 0.02);
    const phi = atan(p.y, p.x).add(U.arcPhase);
    // inside the near-field patch the precise local patch draws instead (float32 r at 1e5 km is only good to ≈ 8 m)
    If(U.patchOn.greaterThan(0.5).and(length(p.xy.sub(U.patchC)).lessThan(U.patchR.mul(0.985))), () => { Discard(); });
    const x = r.sub(r0p), xi = x.floor();
    return shadeAt(r, fw, phi, xi, x.sub(xi), p, normalize(U.sunLocal.sub(p)), normalize(U.cam.sub(p)));
  })();
  // v3.7 near-field ring patch (Saturn and any profile system): a camera-anchored disc in the ring plane whose geometry is
  // LOCAL (km from the patch centre), positioned camera-relative from float64 on the CPU, with r = r0 + Δr evaluated as a
  // series in the small local offset — no 8-m float32 quantisation of r, no vertex jitter near the plane.
  let patch: THREE.Mesh | null = null;
  if (prof) {
    const pg = new THREE.CircleGeometry(1, 128, 0, Math.PI * 2);
    const pmM = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    pmM.blending = m.blending; pmM.blendSrc = m.blendSrc; pmM.blendDst = m.blendDst; pmM.blendSrcAlpha = m.blendSrcAlpha; pmM.blendDstAlpha = m.blendDstAlpha;
    const vL = varying(vec2(0), 'rpL');
    pmM.vertexNode = Fn(() => {
      const pl = positionGeometry.xy.mul(U.patchR);
      vL.assign(pl);
      const c = U.ax.mul(U.patchOff.x.add(pl.x)).add(U.ay.mul(U.patchOff.y.add(pl.y))).add(U.az.mul(U.patchOff.z));
      return cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(c, 1)));
    })();
    pmM.fragmentNode = Fn(() => {
      const pl = vL, u = U.patchC.div(U.patchR0);                  // unit radial at the patch centre
      const a = dot(u, pl), q = dot(pl, pl);
      const dr = a.add(q.sub(a.mul(a)).div(U.patchR0.mul(2)));      // r − r0 to O(pl³/r0²)
      const fw = max(fwidth(dr), 0.002);
      const p = vec3(U.patchC.add(pl), 0);
      const phi = atan(p.y, p.x).add(U.arcPhase);
      const rf = U.patchBf.add(dr);
      return shadeAt(U.patchR0.add(dr), fw, phi, U.patchBi, rf, p, normalize(U.sunLocal.sub(p)), normalize(U.patchCam.sub(vec3(pl, 0))));
    })();
    patch = new THREE.Mesh(pg, pmM); patch.frustumCulled = false; patch.renderOrder = 2; patch.visible = false;
  }
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 2; mesh.frustumCulled = false;
  return { mesh, U, patch, shadowTex: shadowTauTexture(def, prof), comp: C };
}
/** v3.7: radial ring colour from the art map, box-smoothed over ≈ 300 km on the CPU (the map's per-texel compression noise
 *  turned into purple/green fringes in close views). Colour only — never optical depth. */
export function smoothRingColour(img: any, N = 1024, boxKm = 300) {
  try {
    const w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = 1;
    const g = c.getContext('2d')!; g.drawImage(img, 0, Math.floor(h / 2), w, 1, 0, 0, w, 1);
    const px = g.getImageData(0, 0, w, 1).data, kmPer = (140240 - 69570) / w, k = Math.max(1, Math.round(boxKm / kmPer / 2));
    const out = new Uint8Array(N * 4);
    for (let i = 0; i < N; i++) {
      const x = Math.floor((i + 0.5) / N * w); let r = 0, gg = 0, b = 0, a = 0;
      for (let j = Math.max(0, x - k); j <= Math.min(w - 1, x + k); j++) { const A = px[j * 4 + 3] / 255; r += px[j * 4] * A; gg += px[j * 4 + 1] * A; b += px[j * 4 + 2] * A; a += A; }
      const s = a > 1e-3 ? 1 / a : 0; out.set([r * s, gg * s, b * s, Math.min(255, a / (2 * k + 1) * 255)], i * 4);
    }
    const t = new THREE.DataTexture(out, N, 1, THREE.RGBAFormat); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  } catch { return null; }
}
export function decodeProfile(buf: ArrayBuffer): Float32Array { const q = new Uint16Array(buf), a = new Float32Array(q.length); for (let i = 0; i < q.length; i++) a[i] = q[i] / 1e4; return a; }
