import { lunarLambert as lunarLambertF, minnaert as minnaertF } from './presentation';
// SOL v3.6 physical atmosphere model + precomputed look-up tables (pure TypeScript: no GPU, runs in node tests).
//
// The v3.5 shell shader marched the sunlight path with 6 samples per view sample, used the Rayleigh density profile for
// every absorber (so Earth's ozone sat at the ground instead of in a layer at 15–35 km), one grey Mie phase g for all
// colours and single scattering only (twilight and the inner limb too dark, Mars' blue-forward sunset impossible).
// v3.6 follows the production technique of Hillaire 2020 ("A Scalable and Production Ready Sky and Atmosphere Rendering
// Technique", EGSR / CGF 39(4)) with the parameterisation of Bruneton 2017 ("Precomputed atmospheric scattering: a new
// implementation"):
//   • transmittance LUT T(r, μ) to the top of the atmosphere (exact spherical geometry, all absorbers with their own
//     density profiles), used for the sunlight path of every view sample AND for sunlight reaching the ground;
//   • multiple-scattering LUT Ψms(r, μs): Hillaire's infinite-order isotropic approximation (2nd order × 1/(1 − f_ms)),
//     including light reflected by the ground (Lambert albedo);
//   • per-channel Mie single-scattering albedo and asymmetry g (Cornette–Shanks phase), so dust/haze absorb and
//     forward-scatter differently per colour.
// Units: km, 1/km. Radiance is relative to the incident solar irradiance (the shader multiplies by `irr`).
export type V3 = [number, number, number];
export type Profile = { kind: 'exp'; H: number } | { kind: 'tent'; center: number; halfWidth: number };
export interface AtmoPhysical {
  Rg: number; Rt: number;
  rayleigh: { scat: V3; H: number };
  mie: { scat: V3; ext: V3; H: number; g: V3 };
  absorber?: { ext: V3; profile: Profile };
  groundAlbedo: V3;
  /** v3.8.1 WP-E: additional aerosol populations with their own vertical profile, spectrum, single-scattering albedo and
   *  phase asymmetry (Titan: upper tholin haze, lower haze, detached layer). At most AERO_MAX; the legacy `mie` term stays. */
  aerosols?: Aerosol[];
}
export const AERO_MAX = 3;
/** Vertical profile of an aerosol population (relative density, 1 at the reference level):
 *  exp   — 1 below `base` (or 0 when below = 0, soft 4-km edge), above it exp-like with a scale height varying linearly with
 *          altitude, H(h) = H0 + k·(h − base) (closed form ((H/H0))^(−1/k)); optional Gaussian depletion `gap` (d ∈ [0,1]).
 *  band  — 1 between h0 and h1 (soft edges), relative density `lowRel` below `step`.
 *  gauss — exp(−((h − c)/w)²). */
export type AeroProfile =
  | { kind: 'exp'; base: number; H0: number; k: number; below: 0 | 1; gap?: { c: number; w: number; d: number } }
  | { kind: 'band'; h0: number; h1: number; soft: number; step: number; lowRel: number }
  | { kind: 'gauss'; c: number; w: number };
export interface Aerosol { scat: V3; ext: V3; g: V3; prof: AeroProfile; label?: string }
export function aeroPhase(a: Aerosol, k: number, nu: number) { return cornetteShanks(a.g[k], nu); }
const sstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Relative density of an aerosol population at altitude h (CPU twin of WGSL aeroD). */
export function aeroDensity(p: AeroProfile, h: number): number {
  if (p.kind === 'exp') {
    const z = Math.max(0, h - p.base), Hh = Math.max(1e-3, p.H0 + p.k * z);
    let d = Math.abs(p.k) < 1e-6 ? Math.exp(-z / p.H0) : Math.pow(Hh / p.H0, -1 / p.k);
    if (!p.below) d *= sstep(p.base - 4, p.base + 4, h);
    if (p.gap) { const q = (h - p.gap.c) / p.gap.w; d *= 1 - p.gap.d * Math.exp(-q * q); }
    return d;
  }
  if (p.kind === 'band') return sstep(p.h0 - p.soft, p.h0 + p.soft, h) * (1 - sstep(p.h1 - p.soft, p.h1 + p.soft, h)) * (h < p.step ? p.lowRel + (1 - p.lowRel) * sstep(p.step - 3, p.step + 3, h) : 1);
  const q = (h - p.c) / p.w; return Math.exp(-q * q);
}
/** Packed shader parameters of a profile: two vec4 (kind, a, b, c), (d, e, f, g). kind 0 = none. */
export function aeroPack(p?: AeroProfile): [number[], number[]] {
  if (!p) return [[0, 0, 0, 0], [0, 0, 0, 0]];
  if (p.kind === 'exp') return [[1, p.base, p.H0, p.k], [p.below, p.gap?.c ?? 0, p.gap?.w ?? 1, p.gap?.d ?? 0]];
  if (p.kind === 'band') return [[2, p.h0, p.h1, p.soft], [p.step, p.lowRel, 0, 0]];
  return [[3, p.c, p.w, 0], [0, 0, 0, 0]];
}
/** Total aerosol scattering per channel at h, legacy Mie included (isotropic part used by the multiple-scattering LUT). */
export function aeroScatter(A: AtmoPhysical, h: number): V3 {
  const m = Math.exp(-h / A.mie.H), o: V3 = [A.mie.scat[0] * m, A.mie.scat[1] * m, A.mie.scat[2] * m];
  for (const a of A.aerosols ?? []) { const d = aeroDensity(a.prof, h); for (let k = 0; k < 3; k++) o[k] += a.scat[k] * d; }
  return o;
}
/** Similarity-scaled aerosol scattering Σ σs,i(1 − g_i) — the multiplier of the (scaled-medium) multiple-scattering LUT. */
export function aeroScatterMS(A: AtmoPhysical, h: number): V3 {
  const m = Math.exp(-h / A.mie.H), o: V3 = [0, 1, 2].map(k => A.mie.scat[k] * (1 - A.mie.g[k]) * m) as V3;
  for (const a of A.aerosols ?? []) { const d = aeroDensity(a.prof, h); for (let k = 0; k < 3; k++) o[k] += a.scat[k] * (1 - a.g[k]) * d; }
  return o;
}
/** Phase-weighted aerosol scattering Σ σs,i(h)·P_i(ν) per channel, given each population's phase values PM[i][k]. */
function aeroScatterPhase(A: AtmoPhysical, h: number, PMleg: number[], PMa: number[][]): V3 {
  const m = Math.exp(-h / A.mie.H), o: V3 = [A.mie.scat[0] * m * PMleg[0], A.mie.scat[1] * m * PMleg[1], A.mie.scat[2] * m * PMleg[2]];
  (A.aerosols ?? []).forEach((a, i) => { const d = aeroDensity(a.prof, h); for (let k = 0; k < 3; k++) o[k] += a.scat[k] * d * PMa[i][k]; });
  return o;
}
const aeroPhases = (A: AtmoPhysical, nu: number) => (A.aerosols ?? []).map(a => [0, 1, 2].map(k => aeroPhase(a, k, nu)));
/** Optional v3.6 preset extension (catalog AtmoPreset.phys). Absent fields are derived from the v3.5 preset. */
export interface AtmoPhysPreset {
  mieAlbedo?: V3;                // single-scattering albedo per channel (R, G, B)
  mieG?: V3;                     // asymmetry per channel
  ozone?: { ext: V3; center: number; halfWidth: number };
  groundAlbedo?: V3;
  source?: string;
  /** gas giants: coefficients evaluated this many scale heights above the reference (1-bar) level — the cloud map already
   *  contains the integrated colour of the deeper atmosphere */
  densityShiftH?: number;
  /** v3.8.1 WP-E: explicit aerosol populations (see Aerosol); the legacy single Mie term may then be set to 0 */
  aerosols?: Aerosol[];
}
export interface LegacyPreset { height: number; rayleigh: V3; rayleighH: number; mie: number; mieH: number; mieG: number; mieColor?: V3; absorb?: V3; ground?: number; phys?: AtmoPhysPreset }

export function physicalFrom(a: LegacyPreset, radiusKm: number): AtmoPhysical {
  const mc = a.mieColor ?? [1, 1, 1], ph = a.phys ?? {}, k = Math.exp(-(ph.densityShiftH ?? 0));
  // v3.5 multiplied the Mie coefficient by 1.11 for extinction (ω0 ≈ 0.9); keep that as the default single-scattering albedo
  const alb = ph.mieAlbedo ?? [0.9, 0.9, 0.9];
  const scat: V3 = [a.mie * mc[0] * k, a.mie * mc[1] * k, a.mie * mc[2] * k];
  const ext: V3 = [scat[0] / alb[0], scat[1] / alb[1], scat[2] / alb[2]];
  const Rg = radiusKm + (a.ground ?? 0);
  const absorber = ph.ozone ? { ext: ph.ozone.ext, profile: { kind: 'tent', center: ph.ozone.center, halfWidth: ph.ozone.halfWidth } as Profile }
    : a.absorb ? { ext: a.absorb.map(x => x * k) as V3, profile: { kind: 'exp', H: a.rayleighH } as Profile } : undefined;
  return { Rg, Rt: radiusKm + a.height, rayleigh: { scat: a.rayleigh.map(x => x * k) as V3, H: a.rayleighH }, mie: { scat, ext, H: a.mieH, g: ph.mieG ?? [a.mieG, a.mieG, a.mieG] }, absorber, groundAlbedo: ph.groundAlbedo ?? [0.1, 0.1, 0.1], aerosols: ph.aerosols };
}
export function profile(p: Profile, h: number) { return p.kind === 'exp' ? Math.exp(-h / p.H) : Math.max(0, 1 - Math.abs(h - p.center) / p.halfWidth); }
/** Extinction (1/km) per channel at altitude h. */
export function extinction(A: AtmoPhysical, h: number): V3 {
  const r = Math.exp(-h / A.rayleigh.H), m = Math.exp(-h / A.mie.H), o = A.absorber ? profile(A.absorber.profile, h) : 0;
  const e = (k: number) => A.rayleigh.scat[k] * r + A.mie.ext[k] * m + (A.absorber ? A.absorber.ext[k] * o : 0);
  const out: V3 = [e(0), e(1), e(2)];
  for (const a of A.aerosols ?? []) { const d = aeroDensity(a.prof, h); for (let k = 0; k < 3; k++) out[k] += a.ext[k] * d; }
  return out;
}
export function verticalOpticalDepth(A: AtmoPhysical, steps = 4000): V3 {
  const out: V3 = [0, 0, 0], H = A.Rt - A.Rg, dh = H / steps;
  for (let i = 0; i < steps; i++) { const e = extinction(A, (i + 0.5) * dh); for (let k = 0; k < 3; k++) out[k] += e[k] * dh; }
  return out;
}
/** Distance from radius r along direction cosine μ to the top of the atmosphere (Bruneton 2017 eq. 2). */
export function distTop(A: AtmoPhysical, r: number, mu: number) { const d = r * r * (mu * mu - 1) + A.Rt * A.Rt; return Math.max(0, -r * mu + Math.sqrt(Math.max(0, d))); }
export function hitsGround(A: AtmoPhysical, r: number, mu: number) { return mu < 0 && r * r * (mu * mu - 1) + A.Rg * A.Rg >= 0; }
/** Optical depth along a ray from (r, μ) to the top (numerical, 64 samples — used to fill the LUT). */
export function opticalDepthToTop(A: AtmoPhysical, r: number, mu: number, n = 64): V3 {
  const L = distTop(A, r, mu), ds = L / n, out: V3 = [0, 0, 0];
  if (A.aerosols?.some(a => a.prof.kind === 'gauss')) {   // v3.8.1 WP-E: thin layer → segmented integration (focus shell)
    const T = rayTransmittance(A, [0, 0, r], [Math.sqrt(Math.max(0, 1 - mu * mu)), 0, mu], 0, L, n);
    return [-Math.log(Math.max(T[0], 1e-30)), -Math.log(Math.max(T[1], 1e-30)), -Math.log(Math.max(T[2], 1e-30))];
  }
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * ds, ri = Math.sqrt(r * r + t * t + 2 * r * mu * t), e = extinction(A, Math.max(0, ri - A.Rg));
    for (let k = 0; k < 3; k++) out[k] += e[k] * ds;
  }
  return out;
}
// ── transmittance LUT: Bruneton 2017 §2.3 (x_mu, x_r) ↔ (r, μ) ─────────────────────────────────────────────────────
export const T_W = 256, T_H = 64, MS_N = 32;
export function transmittanceUV(A: AtmoPhysical, r: number, mu: number): [number, number] {
  const H = Math.sqrt(A.Rt * A.Rt - A.Rg * A.Rg), rho = Math.sqrt(Math.max(0, r * r - A.Rg * A.Rg));
  const d = distTop(A, r, mu), dMin = A.Rt - r, dMax = rho + H;
  const xm = (d - dMin) / Math.max(1e-9, dMax - dMin), xr = rho / H;
  // texel-centre remap so the LUT edges are sampled exactly
  return [0.5 / T_W + xm * (1 - 1 / T_W), 0.5 / T_H + xr * (1 - 1 / T_H)];
}
function rMuFromUV(A: AtmoPhysical, xm: number, xr: number): [number, number] {
  const H = Math.sqrt(A.Rt * A.Rt - A.Rg * A.Rg), rho = H * xr, r = Math.sqrt(rho * rho + A.Rg * A.Rg);
  const dMin = A.Rt - r, dMax = rho + H, d = dMin + xm * (dMax - dMin);
  const mu = d === 0 ? 1 : Math.max(-1, Math.min(1, (H * H - rho * rho - d * d) / (2 * r * d)));
  return [r, mu];
}
export interface AtmoLUTs { T: Float32Array; MS: Float32Array; A: AtmoPhysical }
export function buildTransmittance(A: AtmoPhysical): Float32Array {
  const out = new Float32Array(T_W * T_H * 4);
  for (let j = 0; j < T_H; j++) for (let i = 0; i < T_W; i++) {
    const xm = Math.max(0, Math.min(1, (i + 0.5 - 0.5) / (T_W - 1))), xr = Math.max(0, Math.min(1, (j + 0.5 - 0.5) / (T_H - 1)));
    const [r, mu] = rMuFromUV(A, xm, xr), od = opticalDepthToTop(A, r, mu), k = (j * T_W + i) * 4;
    out[k] = Math.exp(-od[0]); out[k + 1] = Math.exp(-od[1]); out[k + 2] = Math.exp(-od[2]); out[k + 3] = 1;
  }
  return out;
}
/** Bilinear lookup of the transmittance LUT (CPU twin of the WGSL lookup; also used for the ground sunlight). */
export function sampleT(A: AtmoPhysical, T: Float32Array, r: number, mu: number): V3 {
  const [u, v] = transmittanceUV(A, Math.max(A.Rg, Math.min(A.Rt, r)), mu);
  const x = u * T_W - 0.5, y = v * T_H - 0.5, x0 = Math.max(0, Math.min(T_W - 2, Math.floor(x))), y0 = Math.max(0, Math.min(T_H - 2, Math.floor(y)));
  const fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0));
  const o: V3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const a = T[(y0 * T_W + x0) * 4 + k], b = T[(y0 * T_W + x0 + 1) * 4 + k], c = T[((y0 + 1) * T_W + x0) * 4 + k], d = T[((y0 + 1) * T_W + x0 + 1) * 4 + k];
    o[k] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  return o;
}
// ── multiple scattering LUT (Hillaire 2020 §5.5) ─────────────────────────────────────────────────────────────────────
// For a point at altitude h with the Sun at zenith cosine μs, integrate over all directions (isotropic phase, as in the
// paper) the second-order radiance L2 (sunlight scattered once along the ray, with ground bounce) and the transfer f_ms
// (fraction re-scattered); the infinite series is L2/(1 − f_ms). Ψms is stored per unit scattering coefficient and the
// shader adds  σs(x)·Ψms(h, μs)·E_sun  at every view sample.
export function buildMultiScatter(A: AtmoPhysical, T: Float32Array, dirs = 64, steps = 20): Float32Array {
  const out = new Float32Array(MS_N * MS_N * 4), iso = 1 / (4 * Math.PI);
  // stratified directions on the sphere (spherical Fibonacci)
  const D: V3[] = []; for (let i = 0; i < dirs; i++) { const z = 1 - 2 * (i + 0.5) / dirs, s = Math.sqrt(1 - z * z), ph = i * Math.PI * (3 - Math.sqrt(5)); D.push([s * Math.cos(ph), s * Math.sin(ph), z]); }
  for (let j = 0; j < MS_N; j++) for (let i = 0; i < MS_N; i++) {
    const mus = -1 + 2 * (i + 0.5) / MS_N, h = (A.Rt - A.Rg) * (j + 0.5) / MS_N, r = A.Rg + h;
    const sun: V3 = [Math.sqrt(1 - mus * mus), 0, mus];
    const L2: V3 = [0, 0, 0], F: V3 = [0, 0, 0];
    for (const w of D) {
      const mu = w[2], gnd = hitsGround(A, r, mu);
      const tMax = gnd ? (-r * mu - Math.sqrt(Math.max(0, r * r * (mu * mu - 1) + A.Rg * A.Rg))) : distTop(A, r, mu);
      const dt = tMax / steps; const Tv: V3 = [1, 1, 1];
      for (let s = 0; s < steps; s++) {
        const t = (s + 0.5) * dt, px = r * 0 + t * w[0], pz = r + t * w[2], py = t * w[1];
        const rx = Math.hypot(px, py, pz), hx = Math.max(0, rx - A.Rg), upx: V3 = [px / rx, py / rx, pz / rx];
        const musx = upx[0] * sun[0] + upx[2] * sun[2];
        const e = extinction(A, hx), sr = Math.exp(-hx / A.rayleigh.H), sa = aeroScatter(A, hx);
        const shadow = hitsGround(A, rx, musx) ? 0 : 1, Ts = sampleT(A, T, rx, musx);
        for (let k = 0; k < 3; k++) {
          const ss = A.rayleigh.scat[k] * sr + sa[k], Ts1 = Math.exp(-e[k] * dt);
          // analytic integration over the step (Hillaire eq. 6)
          const Sint = (1 - Ts1) / Math.max(e[k], 1e-12);
          L2[k] += Tv[k] * ss * iso * Ts[k] * shadow * Sint;
          F[k] += Tv[k] * ss * Sint;
          Tv[k] *= Ts1;
        }
      }
      if (gnd) {
        // ground bounce of direct sunlight (Lambert), seen through the view transmittance
        const gx = tMax * w[0], gz = r + tMax * w[2], gy = tMax * w[1], gr = Math.hypot(gx, gy, gz), gmu = (gx * sun[0] + gz * sun[2]) / gr;
        const Tg = sampleT(A, T, A.Rg, gmu);
        for (let k = 0; k < 3; k++) L2[k] += Tv[k] * Tg[k] * Math.max(0, gmu) * A.groundAlbedo[k] / Math.PI;
      }
    }
    const k4 = (j * MS_N + i) * 4, dw = 4 * Math.PI / dirs;
    for (let k = 0; k < 3; k++) { const l2 = L2[k] * dw * iso, fms = F[k] * dw * iso; out[k4 + k] = l2 / Math.max(1e-6, 1 - fms); }
    out[k4 + 3] = 1;
  }
  return out;
}
/** v3.8.1 WPE-TI-01: similarity (transport) scaling σs' = σs(1 − g), σe' = σe − σs·g for the aerosols. Hillaire's
 *  multiple-scattering LUT assumes isotropic scattering; in a thick, forward-scattering haze (Titan: τ ≈ 9, g ≈ 0.73) that
 *  assumption throws the forward-scattered light out of the beam and the diffuse field collapses (surface irradiance 24×
 *  below a plane-parallel Monte Carlo reference with the same profile and phase functions). With the similarity transform
 *  the isotropic approximation is the classic transport approximation, exact in the diffusive limit. Used ONLY for the
 *  orders ≥ 2 (MS LUT and its σs' multiplier); single scattering and view transmittance keep the true medium. */
export function similarityScaled(A: AtmoPhysical): AtmoPhysical {
  const sm = A.mie.scat.map((x, k) => x * (1 - A.mie.g[k])) as V3, em = A.mie.ext.map((x, k) => x - A.mie.scat[k] * A.mie.g[k]) as V3;
  return { ...A, mie: { ...A.mie, scat: sm, ext: em }, aerosols: A.aerosols?.map(a => ({ ...a, scat: a.scat.map((x, k) => x * (1 - a.g[k])) as V3, ext: a.ext.map((x, k) => x - a.scat[k] * a.g[k]) as V3 })) };
}
export function buildLUTs(A: AtmoPhysical): AtmoLUTs {
  const T = buildTransmittance(A), As = similarityScaled(A), Ts = buildTransmittance(As);
  return { A, T, MS: buildMultiScatter(As, Ts) };
}
/** Cornette–Shanks phase (normalised over the sphere), used for Mie with a per-channel g. */
export function cornetteShanks(g: number, mu: number) { const g2 = g * g; return 3 / (8 * Math.PI) * ((1 - g2) * (1 + mu * mu)) / ((2 + g2) * Math.pow(Math.max(1e-4, 1 + g2 - 2 * g * mu), 1.5)); }
/** CPU twin of the shader march: radiance (per unit solar irradiance) reaching a point at radius r (on the +z axis)
 *  from direction `w` (unit, pointing away from the observer), Sun direction `sun`. Used for the ground skylight table
 *  and for physical tests (Earth's blue zenith, Mars' red sky / blue sunset aureole). */
export function skyRadiance(A: AtmoPhysical, L: AtmoLUTs, r: number, w: V3, sun: V3, steps = 48): V3 {
  const mu = w[2], gnd = hitsGround(A, r, mu);
  const tMax = gnd ? (-r * mu - Math.sqrt(Math.max(0, r * r * (mu * mu - 1) + A.Rg * A.Rg))) : distTop(A, r, mu);
  const nu = w[0] * sun[0] + w[1] * sun[1] + w[2] * sun[2];
  const PR = 3 / (16 * Math.PI) * (1 + nu * nu), PM = [0, 1, 2].map(k => cornetteShanks(A.mie.g[k], nu)), PA = aeroPhases(A, nu);
  const dt = tMax / steps, Tv: V3 = [1, 1, 1], Tv2: V3 = [1, 1, 1], out: V3 = [0, 0, 0];
  for (let s = 0; s < steps; s++) {
    const t = (s + 0.5) * dt, px = t * w[0], py = t * w[1], pz = r + t * w[2], rx = Math.hypot(px, py, pz), hx = Math.max(0, rx - A.Rg);
    const musx = (px * sun[0] + py * sun[1] + pz * sun[2]) / rx;
    const e = extinction(A, hx), sr = Math.exp(-hx / A.rayleigh.H), sa = aeroScatter(A, hx), sx = aeroScatterMS(A, hx), sp = aeroScatterPhase(A, hx, PM, PA);
    const sh = hitsGround(A, rx, musx) ? 0 : 1, Ts = sampleT(A, L.T, rx, musx), ms = sampleMS(A, L.MS, hx, musx);
    for (let k = 0; k < 3; k++) {
      const scR = A.rayleigh.scat[k] * sr, T1 = Math.exp(-e[k] * dt), Sint = (1 - T1) / Math.max(e[k], 1e-12);
      const e2 = Math.max(1e-12, e[k] - (sa[k] - sx[k])), T2 = Math.exp(-e2 * dt), S2 = (1 - T2) / e2;   // scaled medium for orders ≥ 2
      out[k] += Tv[k] * (scR * PR + sp[k]) * Ts[k] * sh * Sint + Tv2[k] * (scR + sx[k]) * ms[k] * S2;
      Tv[k] *= T1; Tv2[k] *= T2;
    }
  }
  return out;
}
export function sampleMS(A: AtmoPhysical, MS: Float32Array, h: number, mus: number): V3 {
  const x = (mus * 0.5 + 0.5) * MS_N - 0.5, y = Math.max(0, Math.min(1, h / (A.Rt - A.Rg))) * MS_N - 0.5;
  const x0 = Math.max(0, Math.min(MS_N - 2, Math.floor(x))), y0 = Math.max(0, Math.min(MS_N - 2, Math.floor(y))), fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0));
  const o: V3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) { const g = (i: number, j: number) => MS[(j * MS_N + i) * 4 + k]; o[k] = (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy; }
  return o;
}
export const SKY_N = 32;
/** Diffuse skylight irradiance on a horizontal ground element vs solar zenith cosine (per unit solar irradiance, RGBA
 *  rows of SKY_N, μs from −0.2 to 1): E(μs) = ∫ L_sky(ω) cos θ dω over the upper hemisphere. */
export function buildSkyIrradiance(A: AtmoPhysical, L: AtmoLUTs, dirs = 96): Float32Array {
  const out = new Float32Array(SKY_N * 4), D: V3[] = [];
  for (let i = 0; i < dirs; i++) { const z = 1 - (i + 0.5) / dirs, s = Math.sqrt(1 - z * z), ph = i * Math.PI * (3 - Math.sqrt(5)); D.push([s * Math.cos(ph), s * Math.sin(ph), z]); }
  const dw = 2 * Math.PI / dirs;
  for (let i = 0; i < SKY_N; i++) {
    const mus = skyMu(i), sun: V3 = [Math.sqrt(Math.max(0, 1 - mus * mus)), 0, mus], E: V3 = [0, 0, 0];
    for (const w of D) { const Ls = skyRadiance(A, L, A.Rg + 0.01, w, sun, 24); for (let k = 0; k < 3; k++) E[k] += Ls[k] * w[2] * dw; }
    out.set([E[0], E[1], E[2], 1], i * 4);
  }
  return out;
}
export const skyMu = (i: number) => -0.2 + 1.2 * i / (SKY_N - 1);
/** Radiance (per unit solar irradiance, rgb) along an arbitrary ray from `o` (body-centred km, may be outside the
 *  atmosphere) in unit direction `w`, Sun unit direction `sun`. Same integrand as the shader (single + multiple). */
/** v3.8.1 WP-E: focus shell of a thin layer (gauss aerosols): radii [Rg + c − 3w, Rg + c + 3w] (widest of them), or null. */
export function focusShell(A: AtmoPhysical): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (const a of A.aerosols ?? []) if (a.prof.kind === 'gauss') { lo = Math.min(lo, A.Rg + a.prof.c - 3 * a.prof.w); hi = Math.max(hi, A.Rg + a.prof.c + 3 * a.prof.w); }
  return isFinite(lo) ? [Math.max(A.Rg, lo), Math.min(A.Rt, hi)] : null;
}
const sphT = (o: V3, w: V3, R: number): [number, number] | null => { const b = o[0] * w[0] + o[1] * w[1] + o[2] * w[2], c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - R * R, d = b * b - c; if (d <= 0) return null; const q = Math.sqrt(d); return [-b - q, -b + q]; };
/** Segments [ta, tb, focus] of a ray clipped to [t0, t1]: the parts inside the focus shell are marched with their own
 *  sample budget so a 20-km layer is resolved on 2,000-km limb paths (CPU twin of the WGSL march). */
export function raySegments(A: AtmoPhysical, o: V3, w: V3, t0: number, t1: number): [number, number, boolean][] {
  const F = focusShell(A); if (!F) return [[t0, t1, false]];
  const hi = sphT(o, w, F[1]); if (!hi) return [[t0, t1, false]];
  const lo = sphT(o, w, F[0]);
  const foc: [number, number][] = lo ? [[hi[0], lo[0]], [lo[1], hi[1]]] : [[hi[0], hi[1]]];
  const out: [number, number, boolean][] = []; let t = t0;
  for (const [a0, b0] of foc) { const a = Math.max(t0, Math.min(t1, a0)), b = Math.max(t0, Math.min(t1, b0)); if (b <= a) continue; if (a > t) out.push([t, a, false]); out.push([a, b, true]); t = b; }
  if (t < t1) out.push([t, t1, false]);
  return out;
}
/** Radiance (per unit solar irradiance, rgb) along an arbitrary ray from `o` (body-centred km, may be outside the
 *  atmosphere) in unit direction `w`, Sun unit direction `sun`. Same integrand as the shader (single + multiple). */
export function rayRadiance(A: AtmoPhysical, L: AtmoLUTs, o: V3, w: V3, sun: V3, steps = 40, focusSteps = 12): V3 {
  const b = o[0] * w[0] + o[1] * w[1] + o[2] * w[2], c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - A.Rt * A.Rt, disc = b * b - c;
  if (disc <= 0) return [0, 0, 0];
  const t0 = Math.max(0, -b - Math.sqrt(disc)); let t1 = -b + Math.sqrt(disc); if (t1 <= 0) return [0, 0, 0];
  const cg = c + A.Rt * A.Rt - A.Rg * A.Rg, dg = b * b - cg; if (dg > 0) { const tg = -b - Math.sqrt(dg); if (tg > 0) t1 = Math.min(t1, tg); }
  const nu = w[0] * sun[0] + w[1] * sun[1] + w[2] * sun[2], PR = 3 / (16 * Math.PI) * (1 + nu * nu), PM = [0, 1, 2].map(k => cornetteShanks(A.mie.g[k], nu)), PA = aeroPhases(A, nu);
  const Tv: V3 = [1, 1, 1], Tv2: V3 = [1, 1, 1], out: V3 = [0, 0, 0], segs = raySegments(A, o, w, t0, t1);
  const mainLen = segs.reduce((s, [a, bb, f]) => s + (f ? 0 : bb - a), 0);
  for (const [ta, tb, foc] of segs) {
    const n = foc ? focusSteps : Math.max(2, Math.round(steps * (tb - ta) / Math.max(mainLen, 1e-9))), dt = (tb - ta) / n;
    for (let s = 0; s < n; s++) {
      const t = ta + (s + 0.5) * dt, p: V3 = [o[0] + w[0] * t, o[1] + w[1] * t, o[2] + w[2] * t], r = Math.hypot(p[0], p[1], p[2]), h = Math.max(0, r - A.Rg);
      const mus = (p[0] * sun[0] + p[1] * sun[1] + p[2] * sun[2]) / r, e = extinction(A, h), sr = Math.exp(-h / A.rayleigh.H), sa = aeroScatter(A, h), sx = aeroScatterMS(A, h), sp = aeroScatterPhase(A, h, PM, PA);
      const sh = hitsGround(A, r, mus) ? 0 : 1, Ts = sampleT(A, L.T, r, mus), ms = sampleMS(A, L.MS, h, mus);
      for (let k = 0; k < 3; k++) {
        const scR = A.rayleigh.scat[k] * sr, T1 = Math.exp(-e[k] * dt), Si = (1 - T1) / Math.max(e[k], 1e-12);
        const e2 = Math.max(1e-12, e[k] - (sa[k] - sx[k])), T2 = Math.exp(-e2 * dt), S2 = (1 - T2) / e2;
        out[k] += Tv[k] * (scR * PR + sp[k]) * Ts[k] * sh * Si + Tv2[k] * (scR + sx[k]) * ms[k] * S2; Tv[k] *= T1; Tv2[k] *= T2;
      }
    }
  }
  return out;
}
/** Transmittance along the same ray (per channel), for the surface term of the disc integral. */
export function rayTransmittance(A: AtmoPhysical, o: V3, w: V3, t0: number, t1: number, steps = 48): V3 {
  const od: V3 = [0, 0, 0];
  for (const [ta, tb, foc] of raySegments(A, o, w, t0, t1)) {
    const n = foc ? 12 : Math.max(2, Math.round(steps * (tb - ta) / Math.max(t1 - t0, 1e-9))), dt = (tb - ta) / n;
    for (let s = 0; s < n; s++) { const t = ta + (s + 0.5) * dt, r = Math.hypot(o[0] + w[0] * t, o[1] + w[1] * t, o[2] + w[2] * t), e = extinction(A, Math.max(0, r - A.Rg)); for (let k = 0; k < 3; k++) od[k] += e[k] * dt; }
  }
  return [Math.exp(-od[0]), Math.exp(-od[1]), Math.exp(-od[2])];
}
/** Brightest limb radiance (luminance, per unit irradiance) seen from `cam` (body-centred km) on the sunward limb:
 *  tangent rays at a few altitudes — used by the exposure meter so a backlit haze crescent is highlight-protected. */
/** `steps`/`focusSteps`: the GPU march's budget, so the estimate is the twin of what is drawn (v3.8.1). */
export function limbLuminance(A: AtmoPhysical, L: AtmoLUTs, cam: V3, sun: V3, steps = 32, focusSteps = 12): number {
  const d = Math.hypot(cam[0], cam[1], cam[2]); if (d < A.Rt) return 0;
  const u: V3 = [cam[0] / d, cam[1] / d, cam[2] / d];
  // limb point direction: Sun direction made perpendicular to the line of sight (bright side of the crescent/limb)
  const sd = sun[0] * u[0] + sun[1] * u[1] + sun[2] * u[2]; let q: V3 = [sun[0] - sd * u[0], sun[1] - sd * u[1], sun[2] - sd * u[2]];
  // v3.8.1: Sun exactly behind (or in front of) the body → the bright limb is a uniform ring; any perpendicular will do
  // (was `return 0`: a perfectly backlit Titan metered as night and the ring clipped — titan-backlit, WP-E L2a)
  let ql = Math.hypot(q[0], q[1], q[2]);
  if (ql < 1e-6) { q = Math.abs(u[0]) < 0.9 ? [0, -u[2], u[1]] : [-u[1], u[0], 0]; ql = Math.hypot(q[0], q[1], q[2]); }
  q = [q[0] / ql, q[1] / ql, q[2] / ql];
  let best = 0;
  // v3.8.1 TI-03: tangent heights up to 0.95 of the shell (was ≤ 0.35: Titan's backlit ring peaks at 300–550 km where the
  // tangent optical depth falls through ~1, above every old sample — the meter missed the ring by > 5× and bloom filled the disc)
  for (let i = 0; i < 20; i++) {
    const f = 0.002 + (0.95 - 0.002) * Math.pow(i / 19, 2);
    const rt = A.Rg + f * (A.Rt - A.Rg), ang = Math.asin(Math.min(1, rt / d));   // tangent ray angle from the centre direction
    const w: V3 = [-u[0] * Math.cos(ang) + q[0] * Math.sin(ang), -u[1] * Math.cos(ang) + q[1] * Math.sin(ang), -u[2] * Math.cos(ang) + q[2] * Math.sin(ang)];
    const Lr = rayRadiance(A, L, cam, w, sun, steps, focusSteps); best = Math.max(best, 0.2126 * Lr[0] + 0.7152 * Lr[1] + 0.0722 * Lr[2]);
  }
  return best;
}

// ── v3.8.1 CONT-14d: disc-integrated flux of an atmospheric body (shell + surface), CPU twin of what the GPU draws ────────
export const DISC_STEP = 6, DISC_N = 31;   // phase angle 0…180° every 6°
export interface DiscSurface { refl: V3; f: (mu0: number, mu: number, phaseDeg: number) => number; dm?: number }
/** Surface BRDF of the disc integral from a cloneable description (the same functions the surface shader evaluates). */
export function discSurface(d: { refl: V3; kind: 'rocky' | 'icy' | 'gas' | 'earth'; k: number; dm: number }): DiscSurface {
  const f = d.kind === 'gas' ? (m0: number, m: number) => minnaertF(m0, m, d.k) : d.kind === 'earth' ? (m0: number) => Math.max(m0, 0)
    : (m0: number, m: number, a: number) => lunarLambertF(m0, m, a, d.kind === 'icy' ? 0.45 : 0);
  return { refl: d.refl, f, dm: d.dm };
}
/** Disc-integrated flux per unit solar term `irr` and per (Rg/d)² in engine units (radiance code = shell π·irr·L, surface
 *  refl·f·irr·T☉·T_view), at phase angle α. Polar grid on the impact plane, dense across the atmosphere annulus. */
export function discFlux(A: AtmoPhysical, L: AtmoLUTs, alphaDeg: number, S: DiscSurface, nB = 44, nPhi = 24): V3 {
  const a = alphaDeg * Math.PI / 180, sun: V3 = [Math.sin(a), 0, Math.cos(a)], w: V3 = [0, 0, -1], Z = A.Rt * 4, out: V3 = [0, 0, 0];
  // radial nodes: 12 across the solid disc (area-weighted), the rest across the annulus [Rg, Rt] (denser low down)
  const nIn = 12, nOut = nB - nIn, nodes: [number, number][] = [];
  for (let i = 0; i < nIn; i++) { const u0 = i / nIn, u1 = (i + 1) / nIn; nodes.push([A.Rg * Math.sqrt((u0 + u1) / 2), A.Rg * A.Rg * (u1 - u0) / 2]); }
  for (let i = 0; i < nOut; i++) { const q0 = Math.pow(i / nOut, 1.6), q1 = Math.pow((i + 1) / nOut, 1.6), b0 = A.Rg + (A.Rt - A.Rg) * q0, b1 = A.Rg + (A.Rt - A.Rg) * q1; nodes.push([(b0 + b1) / 2, (b1 * b1 - b0 * b0) / 2]); }
  const dphi = Math.PI / nPhi;
  for (const [bb, wA] of nodes) for (let j = 0; j < nPhi; j++) {
    const ph = (j + 0.5) * dphi, x = bb * Math.cos(ph), y = bb * Math.sin(ph), o: V3 = [x, y, Z];
    const Ls = rayRadiance(A, L, o, w, sun, 40, 12);
    let r0 = Math.PI * Ls[0], r1 = Math.PI * Ls[1], r2 = Math.PI * Ls[2];
    if (bb < A.Rg) {
      const z = Math.sqrt(A.Rg * A.Rg - bb * bb), n: V3 = [x / A.Rg, y / A.Rg, z / A.Rg], mu0 = n[0] * sun[0] + n[2] * sun[2], mu = n[2];
      if (mu0 > 0) { const dm = S.dm ?? 1, Ts0 = sampleT(A, L.T, A.Rg, mu0), Tv0 = sampleT(A, L.T, A.Rg, mu), f = S.f(mu0, mu, alphaDeg);
        const Tsun = Ts0.map(x => Math.pow(x, dm)), Tv = Tv0.map(x => Math.pow(x, dm));   // Venus' delta-M scaled deck transmittance (planetMaterial DM)
        r0 += S.refl[0] * f * Tsun[0] * Tv[0]; r1 += S.refl[1] * f * Tsun[1] * Tv[1]; r2 += S.refl[2] * f * Tsun[2] * Tv[2]; }
    }
    const k = 2 * wA * dphi / (A.Rg * A.Rg);   // ×2: the y < 0 half by symmetry; wA·dφ = area element
    out[0] += r0 * k; out[1] += r1 * k; out[2] += r2 * k;
  }
  return out;
}
export function discTable(A: AtmoPhysical, L: AtmoLUTs, S: DiscSurface): Float32Array {
  const t = new Float32Array(DISC_N * 3);
  for (let i = 0; i < DISC_N; i++) { const v = discFlux(A, L, Math.min(178, i * DISC_STEP), S, 36, 18); t.set(v, i * 3); }
  return t;
}
export function sampleDisc(t: Float32Array, alphaDeg: number): V3 {
  const x = Math.max(0, Math.min(180, alphaDeg)) / DISC_STEP, i = Math.min(DISC_N - 2, Math.floor(x)), f = x - i;
  return [t[i * 3] * (1 - f) + t[i * 3 + 3] * f, t[i * 3 + 1] * (1 - f) + t[i * 3 + 4] * f, t[i * 3 + 2] * (1 - f) + t[i * 3 + 5] * f];
}
