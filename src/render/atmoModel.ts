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
}
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
  return { Rg, Rt: radiusKm + a.height, rayleigh: { scat: a.rayleigh.map(x => x * k) as V3, H: a.rayleighH }, mie: { scat, ext, H: a.mieH, g: ph.mieG ?? [a.mieG, a.mieG, a.mieG] }, absorber, groundAlbedo: ph.groundAlbedo ?? [0.1, 0.1, 0.1] };
}
export function profile(p: Profile, h: number) { return p.kind === 'exp' ? Math.exp(-h / p.H) : Math.max(0, 1 - Math.abs(h - p.center) / p.halfWidth); }
/** Extinction (1/km) per channel at altitude h. */
export function extinction(A: AtmoPhysical, h: number): V3 {
  const r = Math.exp(-h / A.rayleigh.H), m = Math.exp(-h / A.mie.H), o = A.absorber ? profile(A.absorber.profile, h) : 0;
  const e = (k: number) => A.rayleigh.scat[k] * r + A.mie.ext[k] * m + (A.absorber ? A.absorber.ext[k] * o : 0);
  return [e(0), e(1), e(2)];
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
        const e = extinction(A, hx), sr = Math.exp(-hx / A.rayleigh.H), sm = Math.exp(-hx / A.mie.H);
        const shadow = hitsGround(A, rx, musx) ? 0 : 1, Ts = sampleT(A, T, rx, musx);
        for (let k = 0; k < 3; k++) {
          const ss = A.rayleigh.scat[k] * sr + A.mie.scat[k] * sm, Ts1 = Math.exp(-e[k] * dt);
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
export function buildLUTs(A: AtmoPhysical): AtmoLUTs { const T = buildTransmittance(A); return { A, T, MS: buildMultiScatter(A, T) }; }
/** Cornette–Shanks phase (normalised over the sphere), used for Mie with a per-channel g. */
export function cornetteShanks(g: number, mu: number) { const g2 = g * g; return 3 / (8 * Math.PI) * ((1 - g2) * (1 + mu * mu)) / ((2 + g2) * Math.pow(Math.max(1e-4, 1 + g2 - 2 * g * mu), 1.5)); }
/** CPU twin of the shader march: radiance (per unit solar irradiance) reaching a point at radius r (on the +z axis)
 *  from direction `w` (unit, pointing away from the observer), Sun direction `sun`. Used for the ground skylight table
 *  and for physical tests (Earth's blue zenith, Mars' red sky / blue sunset aureole). */
export function skyRadiance(A: AtmoPhysical, L: AtmoLUTs, r: number, w: V3, sun: V3, steps = 48): V3 {
  const mu = w[2], gnd = hitsGround(A, r, mu);
  const tMax = gnd ? (-r * mu - Math.sqrt(Math.max(0, r * r * (mu * mu - 1) + A.Rg * A.Rg))) : distTop(A, r, mu);
  const nu = w[0] * sun[0] + w[1] * sun[1] + w[2] * sun[2];
  const PR = 3 / (16 * Math.PI) * (1 + nu * nu), PM = [0, 1, 2].map(k => cornetteShanks(A.mie.g[k], nu));
  const dt = tMax / steps, Tv: V3 = [1, 1, 1], out: V3 = [0, 0, 0];
  for (let s = 0; s < steps; s++) {
    const t = (s + 0.5) * dt, px = t * w[0], py = t * w[1], pz = r + t * w[2], rx = Math.hypot(px, py, pz), hx = Math.max(0, rx - A.Rg);
    const musx = (px * sun[0] + py * sun[1] + pz * sun[2]) / rx;
    const e = extinction(A, hx), sr = Math.exp(-hx / A.rayleigh.H), sm = Math.exp(-hx / A.mie.H);
    const sh = hitsGround(A, rx, musx) ? 0 : 1, Ts = sampleT(A, L.T, rx, musx), ms = sampleMS(A, L.MS, hx, musx);
    for (let k = 0; k < 3; k++) {
      const scR = A.rayleigh.scat[k] * sr, scM = A.mie.scat[k] * sm, T1 = Math.exp(-e[k] * dt), Sint = (1 - T1) / Math.max(e[k], 1e-12);
      out[k] += Tv[k] * ((scR * PR + scM * PM[k]) * Ts[k] * sh + (scR + scM) * ms[k]) * Sint;
      Tv[k] *= T1;
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
export function rayRadiance(A: AtmoPhysical, L: AtmoLUTs, o: V3, w: V3, sun: V3, steps = 40): V3 {
  const b = o[0] * w[0] + o[1] * w[1] + o[2] * w[2], c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - A.Rt * A.Rt, disc = b * b - c;
  if (disc <= 0) return [0, 0, 0];
  const t0 = Math.max(0, -b - Math.sqrt(disc)); let t1 = -b + Math.sqrt(disc); if (t1 <= 0) return [0, 0, 0];
  const cg = c + A.Rt * A.Rt - A.Rg * A.Rg, dg = b * b - cg; if (dg > 0) { const tg = -b - Math.sqrt(dg); if (tg > 0) t1 = Math.min(t1, tg); }
  const nu = w[0] * sun[0] + w[1] * sun[1] + w[2] * sun[2], PR = 3 / (16 * Math.PI) * (1 + nu * nu), PM = [0, 1, 2].map(k => cornetteShanks(A.mie.g[k], nu));
  const dt = (t1 - t0) / steps, Tv: V3 = [1, 1, 1], out: V3 = [0, 0, 0];
  for (let s = 0; s < steps; s++) {
    const t = t0 + (s + 0.5) * dt, p: V3 = [o[0] + w[0] * t, o[1] + w[1] * t, o[2] + w[2] * t], r = Math.hypot(p[0], p[1], p[2]), h = Math.max(0, r - A.Rg);
    const mus = (p[0] * sun[0] + p[1] * sun[1] + p[2] * sun[2]) / r, e = extinction(A, h), sr = Math.exp(-h / A.rayleigh.H), sm = Math.exp(-h / A.mie.H);
    const sh = hitsGround(A, r, mus) ? 0 : 1, Ts = sampleT(A, L.T, r, mus), ms = sampleMS(A, L.MS, h, mus);
    for (let k = 0; k < 3; k++) { const scR = A.rayleigh.scat[k] * sr, scM = A.mie.scat[k] * sm, T1 = Math.exp(-e[k] * dt), Si = (1 - T1) / Math.max(e[k], 1e-12); out[k] += Tv[k] * ((scR * PR + scM * PM[k]) * Ts[k] * sh + (scR + scM) * ms[k]) * Si; Tv[k] *= T1; }
  }
  return out;
}
/** Brightest limb radiance (luminance, per unit irradiance) seen from `cam` (body-centred km) on the sunward limb:
 *  tangent rays at a few altitudes — used by the exposure meter so a backlit haze crescent is highlight-protected. */
export function limbLuminance(A: AtmoPhysical, L: AtmoLUTs, cam: V3, sun: V3): number {
  const d = Math.hypot(cam[0], cam[1], cam[2]); if (d < A.Rt) return 0;
  const u: V3 = [cam[0] / d, cam[1] / d, cam[2] / d];
  // limb point direction: Sun direction made perpendicular to the line of sight (bright side of the crescent/limb)
  const sd = sun[0] * u[0] + sun[1] * u[1] + sun[2] * u[2]; let q: V3 = [sun[0] - sd * u[0], sun[1] - sd * u[1], sun[2] - sd * u[2]];
  const ql = Math.hypot(q[0], q[1], q[2]); if (ql < 1e-6) return 0; q = [q[0] / ql, q[1] / ql, q[2] / ql];
  let best = 0;
  for (const f of [0.005, 0.02, 0.06, 0.15, 0.35]) {
    const rt = A.Rg + f * (A.Rt - A.Rg), ang = Math.asin(Math.min(1, rt / d));   // tangent ray angle from the centre direction
    const w: V3 = [-u[0] * Math.cos(ang) + q[0] * Math.sin(ang), -u[1] * Math.cos(ang) + q[1] * Math.sin(ang), -u[2] * Math.cos(ang) + q[2] * Math.sin(ang)];
    const Lr = rayRadiance(A, L, cam, w, sun, 32); best = Math.max(best, 0.2126 * Lr[0] + 0.7152 * Lr[1] + 0.0722 * Lr[2]);
  }
  return best;
}
