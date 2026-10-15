// @ts-nocheck — TSL node graphs are dynamically typed
// Physically based atmosphere (Rayleigh + Mie + absorber), ray-marched per pixel on a shell; v3.6: LUT transmittance,
// Hillaire multiple scattering, per-channel Mie albedo/asymmetry (src/render/atmoModel.ts).
import * as THREE from 'three/webgpu';
import { Fn, uniform, positionLocal, vec3, vec4, normalize, wgslFn, float, texture, sampler } from 'three/tsl';
import type { AtmoPreset } from '../data/catalog';
import { buildLUTs, physicalFrom, verticalOpticalDepth, buildSkyIrradiance, T_W, T_H, MS_N, SKY_N, type AtmoLUTs, type AtmoPhysical, aeroPack, focusShell, AERO_MAX, discTable, discSurface } from './atmoModel';
/** shader arguments of the extra aerosol populations (zeros for unused slots) */
function aeroArgs(A: AtmoPhysical) {
  const o: Record<string, any> = {}, names = [['s0', 'e0', 'g0', 'p0a', 'p0b'], ['s1', 'e1', 'g1', 'p1a', 'p1b'], ['s2', 'e2', 'g2a', 'p2a', 'p2b']];
  for (let i = 0; i < AERO_MAX; i++) {
    const a = A.aerosols?.[i], [pa, pb] = aeroPack(a?.prof), n = names[i];
    o[n[0]] = vec3(...(a?.scat ?? [0, 0, 0])); o[n[1]] = vec3(...(a?.ext ?? [0, 0, 0])); o[n[2]] = vec3(...(a?.g ?? [0, 0, 0]));
    o[n[3]] = vec4(pa[0], pa[1], pa[2], pa[3]); o[n[4]] = vec4(pb[0], pb[1], pb[2], pb[3]);
  }
  return o;
}

/** WGSL twin of atmoModel.transmittanceUV (Bruneton 2017 parameterisation, texel-centre remap for a 256×64 LUT). */
export const transmittanceUVw = wgslFn(`
fn transmittanceUVw(r: f32, mu: f32, Rg: f32, Rt: f32) -> vec2<f32> {
  let H = sqrt(max(Rt * Rt - Rg * Rg, 1e-6)); let rho = sqrt(max(r * r - Rg * Rg, 0.0));
  let disc = r * r * (mu * mu - 1.0) + Rt * Rt;
  let d = max(0.0, -r * mu + sqrt(max(disc, 0.0)));
  let dMin = Rt - r; let dMax = rho + H;
  let xm = clamp((d - dMin) / max(dMax - dMin, 1e-6), 0.0, 1.0); let xr = clamp(rho / H, 0.0, 1.0);
  return vec2<f32>(0.5 / 256.0 + xm * (1.0 - 1.0 / 256.0), 0.5 / 64.0 + xr * (1.0 - 1.0 / 64.0));
}`);
// v3.6 march: transmittance LUT for every sunlight path (v3.5: a 6-sample secondary march), Hillaire 2020 multiple
// scattering LUT, per-channel Mie albedo/asymmetry (Cornette–Shanks), an absorber with its own (tent) profile, analytic
// per-step integration (energy-conserving for optically thick steps: Titan's haze, Mars' dust near the limb).
/** v3.8.1 WP-E: relative density of an aerosol population (WGSL twin of atmoModel.aeroDensity; packed by aeroPack). */
const aeroD = wgslFn(`
fn aeroD(h: f32, a: vec4<f32>, b: vec4<f32>) -> f32 {
  if (a.x < 0.5) { return 0.0; }
  if (a.x < 1.5) {
    let z = max(h - a.y, 0.0);
    var d = 0.0;
    if (abs(a.w) < 1e-6) { d = exp(-z / a.z); } else { d = pow(max(a.z + a.w * z, 1e-3) / a.z, -1.0 / a.w); }
    if (b.x < 0.5) { d *= smoothstep(a.y - 4.0, a.y + 4.0, h); }
    let q = (h - b.y) / max(b.z, 1e-3);
    return d * (1.0 - b.w * exp(-q * q));
  }
  if (a.x < 2.5) {
    var d = smoothstep(a.y - a.w, a.y + a.w, h) * (1.0 - smoothstep(a.z - a.w, a.z + a.w, h));
    if (h < b.x) { d *= b.y + (1.0 - b.y) * smoothstep(b.x - 3.0, b.x + 3.0, h); }
    return d;
  }
  let q = (h - a.y) / max(a.z, 1e-3);
  return exp(-q * q);
}`);
// v3.6 march: transmittance LUT for every sunlight path (v3.5: a 6-sample secondary march), Hillaire 2020 multiple
// scattering LUT, per-channel Mie albedo/asymmetry (Cornette–Shanks), an absorber with its own (tent) profile, analytic
// per-step integration (energy-conserving for optically thick steps: Titan's haze, Mars' dust near the limb).
// v3.8.1 WP-E: up to three extra aerosol populations (own profile, spectrum, ω0 and phase), and a FOCUS SHELL — the ray is
// split at the radii bounding a thin layer (Titan's detached haze, ~20 km thick on ~2,000-km limb paths) and the parts
// inside it get their own sample budget, so the layer is resolved without raising the step count everywhere.
const csPhase = wgslFn(`
fn csPhase(g: vec3<f32>, mu: f32) -> vec3<f32> {
  let g2 = g * g;
  return 0.1193662 * ((vec3<f32>(1.0) - g2) * (1.0 + mu * mu)) / ((vec3<f32>(2.0) + g2) * pow(max(vec3<f32>(1.0) + g2 - 2.0 * g * mu, vec3<f32>(1e-4)), vec3<f32>(1.5)));
}`);
const sphHit = wgslFn(`
fn sphHit(ro: vec3<f32>, rd: vec3<f32>, R: f32) -> vec2<f32> {
  let b = dot(ro, rd); let c = dot(ro, ro) - R * R; let d = b * b - c;
  if (d <= 0.0) { return vec2<f32>(1e30, -1e30); }
  let q = sqrt(d); return vec2<f32>(-b - q, -b + q);
}`);
const atmoMarch = wgslFn(`
fn atmoMarch(ro: vec3<f32>, rd: vec3<f32>, R: f32, Ra: f32, l: vec3<f32>, bR: vec3<f32>, HR: f32, bMs: vec3<f32>, bMe: vec3<f32>, HM: f32, gM: vec3<f32>, bA: vec3<f32>, ozC: f32, ozW: f32, irr: f32, steps: i32, agL: vec3<f32>, agH: f32, agW: f32,
             tT: texture_2d<f32>, tS: sampler, mT: texture_2d<f32>, mS: sampler, msOn: f32,
             s0: vec3<f32>, e0: vec3<f32>, g0: vec3<f32>, p0a: vec4<f32>, p0b: vec4<f32>,
             s1: vec3<f32>, e1: vec3<f32>, g1: vec3<f32>, p1a: vec4<f32>, p1b: vec4<f32>,
             s2: vec3<f32>, e2: vec3<f32>, g2a: vec3<f32>, p2a: vec4<f32>, p2b: vec4<f32>, focus: vec3<f32>) -> vec4<f32> {
  let b = dot(ro, rd); let c = dot(ro, ro) - Ra * Ra; let disc = b * b - c;
  if (disc <= 0.0) { return vec4<f32>(0.0); }
  let sq = sqrt(disc);
  let t0 = max(-b - sq, 0.0); var t1 = -b + sq;
  if (t1 <= 0.0) { return vec4<f32>(0.0); }
  let cg = dot(ro, ro) - R * R; let dg = b * b - cg;
  var hitG = 0.0;
  if (dg > 0.0) { let tg = -b - sqrt(dg); if (tg > 0.0 && tg < t1) { t1 = tg; hitG = 1.0; } }
  let mu = dot(rd, l);
  let PR = 0.0596831 * (1.0 + mu * mu);
  let PM = csPhase(gM, mu); let P0 = csPhase(g0, mu); let P1 = csPhase(g1, mu); let P2 = csPhase(g2a, mu);
  // segment boundaries: [t0, f0a] main, [f0a, f0b] focus, [f0b, f1a] main, [f1a, f1b] focus, [f1b, t1] main
  var f0a = t1; var f0b = t1; var f1a = t1; var f1b = t1;
  if (focus.z > 0.5) {
    let hi = sphHit(ro, rd, focus.y); let lo = sphHit(ro, rd, focus.x);
    if (hi.y > hi.x) {
      if (lo.y > lo.x) { f0a = hi.x; f0b = lo.x; f1a = lo.y; f1b = hi.y; } else { f0a = hi.x; f0b = hi.y; f1a = hi.y; f1b = hi.y; }
    }
    f0a = clamp(f0a, t0, t1); f0b = clamp(f0b, t0, t1); f1a = clamp(f1a, t0, t1); f1b = clamp(f1b, t0, t1);
  }
  let mainLen = max((f0a - t0) + (f1a - f0b) + (t1 - f1b), 1e-6);
  var Tv = vec3<f32>(1.0); var L = vec3<f32>(0.0); var em = vec3<f32>(0.0);
  for (var sg = 0; sg < 5; sg++) {
    var ta = t0; var tb = f0a; var foc = false;
    if (sg == 1) { ta = f0a; tb = f0b; foc = true; } else if (sg == 2) { ta = f0b; tb = f1a; } else if (sg == 3) { ta = f1a; tb = f1b; foc = true; } else if (sg == 4) { ta = f1b; tb = t1; }
    let segLen = tb - ta;
    if (segLen <= 1e-4) { continue; }
    var N = max(2, i32(round(f32(steps) * segLen / mainLen)));
    if (foc) { N = i32(focus.z); }
    let ds = segLen / f32(N);
    for (var i = 0; i < N; i++) {
      let x = ro + rd * (ta + (f32(i) + 0.5) * ds);
      let r = length(x); let h = max(r - R, 0.0); let up = x / r;
      let dR = exp(-h / HR); let dM = exp(-h / HM);
      var dO = dR; if (ozW > 0.0) { dO = max(0.0, 1.0 - abs(h - ozC) / ozW); }
      let d0 = aeroD(h, p0a, p0b); let d1 = aeroD(h, p1a, p1b); let d2 = aeroD(h, p2a, p2b);
      let ext = bR * dR + bMe * dM + bA * dO + e0 * d0 + e1 * d1 + e2 * d2;
      let Ts1 = exp(-ext * ds);
      let Sint = (vec3<f32>(1.0) - Ts1) / max(ext, vec3<f32>(1e-9));
      let mus = dot(up, l);
      // planet shadow on the sunlight path, softened over the solar disc (≈ ±0.25° → ±0.004 in μ)
      let hor = -sqrt(max(0.0, 1.0 - (R / r) * (R / r)));
      let sh = smoothstep(hor - 0.004, hor + 0.004, mus);
      let Ts = textureSampleLevel(tT, tS, transmittanceUVw(r, mus, R, Ra), 0.0).rgb * sh;
      let scR = bR * dR; let scM = bMs * dM;
      let sA = s0 * d0 + s1 * d1 + s2 * d2;
      let ms = textureSampleLevel(mT, mS, vec2<f32>(mus * 0.5 + 0.5, clamp(h / (Ra - R), 0.0, 1.0)), 0.0).rgb * msOn;
      L += Tv * ((scR * PR + scM * PM + s0 * d0 * P0 + s1 * d1 * P1 + s2 * d2 * P2) * Ts + (scR + scM + sA) * ms) * Sint;
      // v3.5 airglow (Earth OI 557.7 nm-dominated ≈ 95 km layer), night only, attenuated toward the camera
      if (agW > 0.0) {
        let zq = (h - agH) / agW;
        em += agL * exp(-zq * zq) * ds * smoothstep(0.05, -0.12, mus) * Tv;
      }
      Tv *= Ts1;
    }
  }
  // v3.7 (ATM-005): over the planet's disc the surface shader applies the per-channel view transmittance itself
  // (viewTransmittance), so the shell only ADDS in-scattered light there (alpha 0). Off the disc (limb, sky) the grey alpha
  // still dims what lies behind (stars, rings, other bodies).
  return vec4<f32>(3.14159265 * irr * L + em, (1.0 - hitG) * (1.0 - (Tv.x + Tv.y + Tv.z) / 3.0));
}`, [transmittanceUVw, aeroD, csPhase, sphHit]);
/** v3.7 per-channel transmittance between a surface point p and the camera c (both in the atmosphere's sphere frame), from
 *  the transmittance LUT (Bruneton 2017 §2.3): camera above the atmosphere → T(p, μ_p); inside → T(lower)/T(upper) along
 *  the upward-pointing direction of the segment. */
export const viewTransmittance = wgslFn(`
fn viewTransmittance(p: vec3<f32>, c: vec3<f32>, Rg: f32, Rt: f32, tT: texture_2d<f32>, tS: sampler) -> vec3<f32> {
  let rp = max(length(p), Rg + 0.01); let rc = length(c);
  let d = normalize(c - p);
  let mup = dot(p / length(p), d);
  if (rc >= Rt) { return textureSampleLevel(tT, tS, transmittanceUVw(rp, mup, Rg, Rt), 0.0).rgb; }
  let muc = dot(c / rc, d);
  // segment pointing upward from p (camera higher): T(p→top)/T(c→top); otherwise use the reversed direction from c
  if (mup >= 0.0) {
    let a = textureSampleLevel(tT, tS, transmittanceUVw(rp, mup, Rg, Rt), 0.0).rgb;
    let b = textureSampleLevel(tT, tS, transmittanceUVw(max(rc, Rg + 0.01), muc, Rg, Rt), 0.0).rgb;
    return clamp(a / max(b, vec3<f32>(1e-6)), vec3<f32>(0.0), vec3<f32>(1.0));
  }
  let a2 = textureSampleLevel(tT, tS, transmittanceUVw(max(rc, Rg + 0.01), -muc, Rg, Rt), 0.0).rgb;
  let b2 = textureSampleLevel(tT, tS, transmittanceUVw(rp, -mup, Rg, Rt), 0.0).rgb;
  return clamp(a2 / max(b2, vec3<f32>(1e-6)), vec3<f32>(0.0), vec3<f32>(1.0));
}`, [transmittanceUVw]);

/** Airglow column calibration: zenith nightglow ≈ V 22.0 mag arcsec⁻² (Leinert et al. 1998, A&AS 127, 1, §6), emitted by a
 *  Gaussian layer of 1/e half-width `width` km → peak volume radiance per km = L(22.0) / (width·√π). DERIVED. */
export function airglowPeakPerKm(a: AtmoPreset, Lzenith: number) { return a.airglow ? Lzenith / (a.airglow.width * Math.sqrt(Math.PI)) : 0; }
/** Half-float RGBA DataTexture from a Float32 RGBA LUT (rgba16float is filterable on every WebGPU adapter). */
export function lutTexture(data: Float32Array, w: number, h: number) {
  const hf = new Uint16Array(data.length); for (let i = 0; i < data.length; i++) hf[i] = THREE.DataUtils.toHalfFloat(Math.min(65000, data[i]));
  const t = new THREE.DataTexture(hf, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
/** v3.8.1 CONT-14d: description of the body's surface for the CPU disc integral (what the surface shader draws). */
export interface DiscSurfaceDesc { refl: [number, number, number]; kind: 'rocky' | 'icy' | 'gas' | 'earth'; k: number; dm: number }
type LutEntry = { luts: AtmoLUTs & { ready?: boolean }; T: THREE.DataTexture; MS: THREE.DataTexture; sky: THREE.DataTexture; ms: number; ready: Promise<void>; pending: boolean;
  /** disc-integrated flux table (DISC_N × rgb, per unit irr and (Rg/d)²) — null until built */ disc: Float32Array | null };
const lutCache = new Map<string, LutEntry>();
let worker: Worker | null | undefined;
const waiters = new Map<string, (d: any) => void>();
function lutWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === 'undefined' || (typeof location !== 'undefined' && /[?&]qa-sync-luts=1/.test(location.search))) return (worker = null);
    worker = new Worker(new URL('./atmoWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => { const w = waiters.get(ev.data.key); if (w) { waiters.delete(ev.data.key); w(ev.data); } };
    worker.onerror = (e) => { console.warn('atmosphere LUT worker failed — building on the main thread', e); worker = null; for (const [k, w] of waiters) w({ key: k, fallback: true }); waiters.clear(); };
  } catch { worker = null; }
  return worker;
}
/** Physical description + LUTs for a body's preset, cached per body. v3.8: returns AT ONCE; the tables are built in a Web
 *  Worker and copied into the same textures when they arrive (`ready`). Until then T = 1 / no multiple scattering /
 *  no skylight (a few hundred ms; the engine also hides the shell and skips limb metering while `pending`). Without
 *  Worker support (node tests, ?qa-sync-luts=1) the v3.6 synchronous build is used. */
export function atmosphereLUTs(key: string, a: AtmoPreset, radiusEq: number, surf?: DiscSurfaceDesc): LutEntry {
  let e = lutCache.get(key);
  if (e) return e;
  const t0 = performance.now(), A = physicalFrom(a as any, radiusEq), W = lutWorker();
  if (!W) {
    const luts = buildLUTs(A);
    e = { luts: Object.assign(luts, { ready: true }), T: lutTexture(luts.T, T_W, T_H), MS: lutTexture(luts.MS, MS_N, MS_N), sky: lutTexture(buildSkyIrradiance(luts.A, luts, 48), SKY_N, 1), ms: performance.now() - t0, ready: Promise.resolve(), pending: false,
      disc: surf ? discTable(A, luts, discSurface(surf)) : null };
    lutCache.set(key, e); return e;
  }
  const one = (n: number) => { const f = new Float32Array(n * 4); for (let i = 0; i < f.length; i++) f[i] = (i % 4 === 3) ? 1 : 1; return f; };
  const luts: any = { A, T: one(T_W * T_H), MS: new Float32Array(MS_N * MS_N * 4), ready: false };
  const E: LutEntry = { luts, T: lutTexture(luts.T, T_W, T_H), MS: lutTexture(luts.MS, MS_N, MS_N), sky: lutTexture(new Float32Array(SKY_N * 4), SKY_N, 1), ms: 0, pending: true, ready: Promise.resolve(), disc: null };
  E.ready = new Promise<void>(res => {
    waiters.set(key, (d) => {
      if (d.fallback) { const L = buildLUTs(A); d = { T: L.T, MS: L.MS, T16: null, MS16: null, S16: null, sky: buildSkyIrradiance(A, L, 48), disc: surf ? discTable(A, L, discSurface(surf)) : null }; }
      luts.T = d.T; luts.MS = d.MS;
      const fill = (tex: THREE.DataTexture, h16: Uint16Array | null, f32: Float32Array) => { const dst = tex.image.data as Uint16Array; if (h16) dst.set(h16); else for (let i = 0; i < f32.length; i++) dst[i] = THREE.DataUtils.toHalfFloat(Math.min(65000, f32[i])); tex.needsUpdate = true; };
      fill(E.T, d.T16, d.T); fill(E.MS, d.MS16, d.MS); fill(E.sky, d.S16, d.sky ?? new Float32Array(SKY_N * 4));
      if (d.disc) E.disc = d.disc; luts.ready = true; E.pending = false; E.ms = d.ms ?? performance.now() - t0; res();
    });
    if (surf) waiters.set(key + ':disc', (d) => { E.disc = d.fallback ? discTable(A, luts as any, discSurface(surf)) : d.disc; });
    W.postMessage({ key, A, surf });
  });
  lutCache.set(key, E);
  return E;
}
export function makeAtmosphere(a: AtmoPreset, radiusEq: number, key = 'atmo') {
  const U = {
    cam: uniform(new THREE.Vector3()), sunDir: uniform(new THREE.Vector3(1, 0, 0)), irr: uniform(1),
    norm: uniform(new THREE.Vector3(1, 1, 1)), // ellipsoid → sphere scaling
    shell: uniform(new THREE.Vector3(1, 1, 1)), // shell radii (km)
    steps: uniform(16, 'int'), boost: uniform(1),
    /** v3.5 airglow radiance per km at the layer peak (rgb, pre-exposed); 0 disables */
    airglow: uniform(new THREE.Vector3(0, 0, 0)),
    /** v3.6 multiple scattering on/off (Settings → Graphics) */
    ms: uniform(1),
    /** v3.8.1 WP-E: samples per crossing of the focus shell (thin layer) */
    focusSteps: uniform(10),
  };
  const L = atmosphereLUTs(key, a, radiusEq), A = L.luts.A;
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.FrontSide });
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
  const oz = A.absorber?.profile.kind === 'tent' ? A.absorber.profile : null;
  m.fragmentNode = Fn(() => {
    const p = positionLocal.mul(U.shell).mul(U.norm);
    const ro = U.cam.mul(U.norm);
    const rd = normalize(p.sub(ro));
    const res = atmoMarch({
      ro, rd, R: float(A.Rg), Ra: float(A.Rt), l: U.sunDir,
      bR: vec3(...A.rayleigh.scat), HR: float(A.rayleigh.H), bMs: vec3(...A.mie.scat), bMe: vec3(...A.mie.ext), HM: float(A.mie.H), gM: vec3(...A.mie.g),
      bA: vec3(...(A.absorber?.ext ?? [0, 0, 0])), ozC: float(oz ? oz.center : 0), ozW: float(oz ? oz.halfWidth : 0), irr: U.irr, steps: U.steps,
      agL: U.airglow, agH: float(a.airglow?.height ?? 95), agW: float(a.airglow ? a.airglow.width : 0),
      tT: texture(L.T), tS: sampler(L.T), mT: texture(L.MS), mS: sampler(L.MS), msOn: U.ms,
      ...aeroArgs(A), focus: vec3(...(focusShell(A) ?? [0, 0]), focusShell(A) ? U.focusSteps : 0),
    });
    return vec4(res.rgb.mul(U.boost), res.a);
  })();
  return { material: m, U, R: A.Rg, Ra: A.Rt, luts: L };
}
// vertical optical depth per channel (v3.6: from the physical model, absorber profile included)
export function verticalTau(a: AtmoPreset, radiusEq = 1000): [number, number, number] { return verticalOpticalDepth(physicalFrom(a as any, radiusEq)); }
