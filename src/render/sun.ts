// @ts-nocheck — TSL node graphs are dynamically typed
// SOL v3.3 hero Sun — photosphere (spec §7 "Sun — first-class rendering subsystem", §9 "Hero Sun").
//
// What is physical, what is art-directed (also shown in the inspector):
//   • Limb darkening: per-channel quadratic law fitted to Neckel & Labs (1994) at ≈650/550/450 nm — MEASURED profile.
//   • Differential rotation: Snodgrass & Ulrich (1990) photospheric rate Ω(φ) = 14.713 − 2.396 sin²φ − 1.787 sin⁴φ °/day,
//     applied relative to the Carrington frame the body already rotates in — MODEL from measurements.
//   • Granulation (≈1–2 Mm cells, 5–10 min lifetimes), mesogranulation and the supergranular network (≈30 Mm) — SIMULATED
//     statistically: scales and contrasts follow HMI-continuum/DKIST-era literature (granule rms contrast ≈ 10–15 % at
//     disc centre in the visible, falling toward the limb), but no specific observed granule is reproduced.
//   • Active regions: bipolar sunspot groups in the activity belts (±5–35°), umbra/penumbra radius ratio ≈ 0.42,
//     umbral continuum ≈ 0.2–0.3 and penumbral ≈ 0.75 of the quiet Sun, radial penumbral filaments, and faculae/plage that
//     brighten toward the limb (μ-dependent contrast) — SIMULATED population with slow growth/decay; NOT the Sun of any
//     specific date. A dated HMI-informed layer is future work (docs/issues.md SUN-005).
//   • The "look" uniform only changes display grading (tint/contrast), never radiometry used for exposure or lighting.
//
// Stability (owner defect "unattractive/immature close and middle Sun"): every stochastic layer is band-limited by its
// projected pixel footprint (fwidth), so granules fade to their mean before they alias instead of crawling/shimmering
// at middle distances, and the expensive Worley evaluation is skipped entirely when sub-pixel.
import * as THREE from 'three/webgpu';
import { Fn, uniform, positionLocal, vec2, vec3, vec4, float, normalize, dot, max, pow, mix, smoothstep, exp, wgslFn, length, positionGeometry, cameraProjectionMatrix, cameraViewMatrix, varying, atan, fwidth, If } from 'three/tsl';
import { fbm, noiseLib, vnoise } from './shaderlib';
import { AU, R_SUN } from '../astro/constants';

// ── WGSL building blocks ────────────────────────────────────────────────────────────────────────────────────────────
// Worley F1/F2 with temporally evolving feature points; returns (F2−F1, F1).
// v3.5: PCG3D integer hash (Jarzynski & Olano 2020, "Hash Functions for GPU Rendering", JCGT 9(3)). v3.4 hashed
// granule cells with the shared fract(p·0.1031) hash, which is PERIODIC (≈9.7 cells per axis): at the limb close-up the
// granulation showed regular diagonal bands of darker cells — the "tiled / woven" look the owner and the v3.4 QA noted.
const pcg3 = wgslFn(`
fn pcg3(c: vec3<f32>) -> vec3<f32> {
  var v = vec3<u32>(vec3<i32>(floor(c)) + vec3<i32>(1048576));
  v = v * 1664525u + vec3<u32>(1013904223u);
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v = v ^ (v >> vec3<u32>(16u));
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return vec3<f32>(v) * (1.0 / 4294967296.0);
}`);
// value noise on the PCG lattice (aperiodic over the whole photosphere)
const pnoise = wgslFn(`
fn pnoise(p: vec3<f32>) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  let a = pcg3(i).x; let b = pcg3(i + vec3<f32>(1.0, 0.0, 0.0)).x; let c = pcg3(i + vec3<f32>(0.0, 1.0, 0.0)).x; let d = pcg3(i + vec3<f32>(1.0, 1.0, 0.0)).x;
  let e = pcg3(i + vec3<f32>(0.0, 0.0, 1.0)).x; let g = pcg3(i + vec3<f32>(1.0, 0.0, 1.0)).x; let h = pcg3(i + vec3<f32>(0.0, 1.0, 1.0)).x; let k = pcg3(i + vec3<f32>(1.0, 1.0, 1.0)).x;
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}`, [pcg3]);
// Worley F1/F2 with temporally evolving feature points; returns (F2−F1, F1, cell id).
const worley2 = wgslFn(`
fn worley2(q: vec3<f32>, t: f32) -> vec3<f32> {
  let i = floor(q); let f = fract(q);
  var d1 = 9.0; var d2 = 9.0; var id = 0.0;
  for (var z = -1; z <= 1; z++) { for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let o = vec3<f32>(f32(x), f32(y), f32(z));
    let c = i + o;
    let h = pcg3(c);
    let wob = 0.18 * sin(vec3<f32>(t) * (0.6 + h) + 6.2831 * h);
    let d = length(o + 0.12 + h * 0.76 + wob - f);
    if (d < d1) { d2 = d1; d1 = d; id = h.x; } else if (d < d2) { d2 = d; }
  }}}
  return vec3<f32>(d2 - d1, d1, id);
}`, [pcg3]);

// Granulation with cell evolution: two Worley fields in different "generations" cross-faded over a granule lifetime.
// Bright, slightly domed granule interiors; narrow dark intergranular lanes. Output ≈ mean 0, rms ≈ 0.35.
const granules = wgslFn(`
fn granules(p: vec3<f32>, freq: f32, t: f32) -> f32 {
  let gen = floor(t); let ph = t - gen;
  // v3.3 QA: a single-scale Worley field read as a regular woven tile at the limb. Domain-warp it (≈0.35 cell) and
  // (A global ±18 % rescale of p was tried and removed: scaling about the Sun's centre shifts the field by tens of cells
  // across the gradient and produced swirl moiré in the limb close-up.)
  let wq = p * freq * 0.23;
  let warp = vec3<f32>(pnoise(wq), pnoise(wq + vec3<f32>(5.2, 1.3, 2.8)), pnoise(wq + vec3<f32>(1.7, 9.2, 4.1))) - vec3<f32>(0.5);
  // v3.5: second, finer warp octave (≈1.1 cells) so cell outlines are irregular rather than uniformly polygonal
  let wq2 = p * freq * 0.61;
  let warp2 = vec3<f32>(pnoise(wq2 + vec3<f32>(3.3, 7.7, 0.4)), pnoise(wq2 + vec3<f32>(8.1, 2.2, 6.6)), pnoise(wq2 + vec3<f32>(4.4, 0.9, 9.9))) - vec3<f32>(0.5);
  let pw = p + warp * (0.9 / freq) + warp2 * (0.7 / freq);
  let a = worley2(pw * freq + vec3<f32>(gen * 7.31, gen * 3.17, 0.0), ph * 6.2831);
  let b = worley2(pw * freq + vec3<f32>((gen + 1.0) * 7.31, (gen + 1.0) * 3.17, 0.0), (ph - 1.0) * 6.2831);
  let w = smoothstep(0.0, 1.0, ph);
  let edge = mix(a.x, b.x, w);
  let inner = mix(a.y, b.y, w);
  // v3.4: per-granule brightness (real granules differ by ±20 %: young/expanding ones are bright, decaying ones dim and
  // fragment) and rounded rather than polygonal shapes — the v3.3 field read as uniform "cracked mud" in the limb view
  let gid = mix(a.z, b.z, w);
  var bright = 0.72 + 0.5 * gid;
  // v3.6 exploding granules: the largest/brightest ≈ 12 % develop a dark centre before fragmenting (observed in
  // high-resolution granulation, e.g. SST/DKIST; centre intensity ≈ lane level)
  bright = bright * (1.0 - 0.55 * smoothstep(0.86, 0.97, gid) * exp(-inner * inner / 0.05));
  // v3.6: lanes widened and softened (observed lane widths ≈ 0.2–0.4 Mm with gradual shoulders; v3.5's crisp F2−F1
  // threshold gave hairline polygon outlines at close range), plus a faint internal texture of each granule
  let lane = smoothstep(0.02, 0.6, edge + 0.08 * inner);
  let tex = 1.0 + 0.14 * (pnoise(pw * freq * 4.3 + vec3<f32>(gen * 1.7)) - 0.5);
  // v3.6: granule interiors peak at the up-flow centre and fall off smoothly toward the lanes (observed intensity
  // profiles are dome-like, not flat-topped); v3.5's near-flat interiors with crisp bisector edges read as "crackle glaze"
  let dome = 0.25 + 0.75 * exp(-inner * inner / 0.16);
  return (lane * (0.3 + 0.7 * dome) * bright * tex) - 0.52;
}`, [worley2, pnoise]);

// v3.6 granulation with a size distribution and network bright points. v3.5 drew one granule scale everywhere, which
// read as a regular "woven" tile in the limb close-up even after the PCG hash fix. Observed granules range ≈ 0.5–3 Mm
// (log-normal-like), with mosaics of small granules in magnetic/network areas: two Worley scales (×1 and ×1.75) are
// selected by a smooth cellular mask, and magnetic bright points (≈ 100–300 km, +20–50 % continuum contrast near disc
// centre) sit in the intergranular lanes of the supergranular network. SIMULATED statistics, no observed field.
const granules2 = wgslFn(`
fn granules2(p: vec3<f32>, freq: f32, t: f32, net: f32) -> f32 {
  let m = smoothstep(0.42, 0.58, pnoise(p * freq * 0.07 + vec3<f32>(11.0, 3.0, 7.0)));
  let gA = granules(p, freq, t);
  var g = gA;
  if (m > 0.02) { let gB = granules(p * 1.0 + vec3<f32>(0.37, 0.11, 0.53), freq * 1.75, t * 1.3); g = mix(gA, gB, m * 0.85); }
  // bright points: small dots in lanes (low granule value) where the network mask is on
  let bp = smoothstep(0.82, 0.93, pnoise(p * freq * 3.1 + vec3<f32>(5.0, 1.0, 9.0))) * smoothstep(-0.25, -0.55, g) * net;
  return g + bp * 1.1;
}`, [granules, pnoise]);

// v3.4 active regions. v3.3 drew one bipolar pair per cell, which read as "two dots" at medium range. Real white-light
// groups (HMI continuum, McIntosh classes C–F) are a large leader spot with a well-formed penumbra, a more fragmented
// follower, and a scatter of small pores between them, embedded in an extended facular/plage field that is invisible at
// disc centre and bright toward the limb. Group sizes follow the observed log-normal spread (≈2–20 Mm spots, groups up
// to ≈150 Mm long). Life cycles are days–weeks; nothing here reproduces a specific date (labelled SIMULATED).
// Returns vec4(spotDarkening, penumbraMask, plageField, umbraMask).
const activeRegions = wgslFn(`
fn activeRegions(p: vec3<f32>, t: f32, activity: f32) -> vec4<f32> {
  let lat = asin(clamp(p.z, -1.0, 1.0));
  let lon = atan2(p.y, p.x);
  var dark = 0.0; var pen = 0.0; var plage = 0.0; var umb = 0.0;
  let cl = 6.2831853 / 20.0;
  let ci = floor(lon / cl);
  for (var dl = -1; dl <= 1; dl++) {
    for (var band = 0; band < 4; band++) {
      let cell = vec3<f32>(ci + f32(dl), f32(band), 3.0);
      let r0 = hash31(cell);
      if (r0 > 0.42 * activity + 0.06) { continue; }
      let hemi = select(-1.0, 1.0, (band & 1) == 0);
      // Spörer belts: ±8–30° late in a cycle
      let latC = hemi * (0.14 + 0.36 * hash31(cell + 1.3));
      let lonC = (ci + f32(dl) + 0.15 + 0.7 * hash31(cell + 4.1)) * cl;
      let life = 6.0 + 30.0 * hash31(cell + 8.8);
      let age = fract((t + hash31(cell + 2.2) * 400.0) / (life * 2.4));
      let grow = smoothstep(0.0, 0.15, age) * (1.0 - smoothstep(0.5, 0.92, age));
      // plage outlives the spots (decaying active regions leave faculae behind)
      let plageLife = smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.8, 1.0, age));
      if (plageLife <= 0.001) { continue; }
      let size = (0.006 + 0.022 * pow(hash31(cell + 5.5), 2.0));
      let tilt = hemi * (0.08 + 0.12 * hash31(cell + 9.1));   // Joy's law
      let sep = size * (3.0 + 2.5 * hash31(cell + 6.6));
      let cdirC = vec3<f32>(cos(latC) * cos(lonC), cos(latC) * sin(lonC), sin(latC));
      let angC = acos(clamp(dot(p, cdirC), -1.0, 1.0));
      if (angC > sep * 2.2 + size * 6.0) { continue; }
      plage = max(plage, (1.0 - smoothstep(sep * 0.4, sep * 1.6 + size * 4.0, angC)) * plageLife);
      if (grow <= 0.001) { continue; }
      for (var k = 0; k < 6; k++) {
        let fk = f32(k);
        // k=0 leader, k=1 follower, k≥2 pores along the axis with jitter
        var along = select(-0.5, 0.5, k == 0);
        if (k >= 2) { along = hash31(cell + fk * 3.7) - 0.5; }
        let jit = select(0.0, (hash31(cell + fk * 5.3) - 0.5) * sep * 0.5, k >= 2);
        let cLat = latC - along * sep * tilt + jit;
        let cLon = lonC + along * sep / max(cos(latC), 0.3);
        let cdir = vec3<f32>(cos(cLat) * cos(cLon), cos(cLat) * sin(cLon), sin(cLat));
        let ang = acos(clamp(dot(p, cdir), -1.0, 1.0));
        var rs = size * grow;
        if (k == 1) { rs = rs * (0.55 + 0.25 * hash31(cell + 2.9)); }
        if (k >= 2) { rs = rs * (0.12 + 0.2 * hash31(cell + fk * 1.9)); }
        if (ang > rs * 1.4) { continue; }
        let ru = rs * select(0.42, 0.55, k >= 2);
        let east = normalize(vec3<f32>(-cdir.y, cdir.x, 0.0) + vec3<f32>(1e-5, 0.0, 0.0));
        let north = cross(cdir, east);
        let az = atan2(dot(p, north), dot(p, east));
        // radial penumbral filaments (≈0.2–0.4 Mm wide → many per circumference) and an irregular outer edge
        let fil = 0.5 + 0.5 * vnoise(vec3<f32>(az * 14.0, ang / max(rs, 1e-5) * 2.2, cell.x * 3.0 + fk));
        let edge = 1.0 + 0.18 * (vnoise(vec3<f32>(az * 3.0, cell.y + fk, cell.x)) - 0.5);
        let penM = (1.0 - smoothstep(rs * 0.86 * edge, rs * 1.04 * edge, ang)) * select(1.0, 0.0, k >= 2 && rs < size * 0.08);
        let umbM = 1.0 - smoothstep(ru * 0.8, ru * 1.08, ang);
        pen = max(pen, penM);
        umb = max(umb, umbM);
        // continuum contrast: penumbra ≈ 0.75–0.8 of quiet Sun, umbra ≈ 0.2–0.3 (darker in larger spots)
        dark = max(dark, penM * (0.18 + 0.1 * fil) + umbM * (0.42 + 0.25 * min(1.0, rs / 0.02)));
      }
    }
  }
  return vec4<f32>(min(dark, 0.86), pen, plage, umb);
}`, [noiseLib, vnoise]);

export type SunLook = 'natural' | 'cinematic' | 'scientific';
// v3.8.1 (SUN-381-03): SOL's scene white balance is "sunlight = white" (planet lighting and the 3-D star colours are
// normalised to the 5,772 K photosphere), so the physically consistent disc colour is NEUTRAL, reddened only by the
// measured per-channel limb darkening. v3.3–3.8.0 tinted the default "natural" disc (1, 0.74, 0.46) — a strongly orange
// lamp. The Sun's colour relative to a D65 display white is ≈ (1, 0.93, 0.83) (Planck 5,772 K vs 6,504 K through the CIE
// 1931 fit in points.ts); "natural" now applies HALF of that offset as a gentle, labelled warm grade.
export const SUN_LOOKS: Record<SunLook, { tint: [number, number, number]; contrast: number; limbGrade: number; prominence: number; label: string; note: string }> = {
  natural: { tint: [1.0, 0.965, 0.915], contrast: 1.0, limbGrade: 0.35, prominence: 2500, label: 'Natural (gentle warm grade)', note: 'Display grade only: half of the photosphere\'s offset from a D65 display white (5,772 K vs 6,504 K). In space the Sun is essentially white; limb reddening is the measured limb darkening. Default.' },
  cinematic: { tint: [1.0, 0.86, 0.70], contrast: 1.2, limbGrade: 0.8, prominence: 10000, label: 'Cinematic gold', note: 'Art-directed warm grade with more contrast and a soft aureole. Not a measured colour.' },
  scientific: { tint: [1.0, 1.0, 1.0], contrast: 1.0, limbGrade: 0, prominence: 1, label: 'Scientific neutral', note: 'Neutral white-light rendering (sunlight = white balance), comparable to HMI continuum (6173 Å) greyscale imagery.' },
};
/** v3.8.1 (SUN-381-02) local disc presentation: fraction of the physical disc radiance shown so the disc centre lands at
 *  `target` display-linear once the disc is resolved enough to show structure (3 → 12 px radius). Scientific: 1 (the
 *  physical camera clips). Pure presentation (labelled HDR compression); exposure, lighting and irradiance unchanged. */
export function sunDiscScale(centreDisplay: number, rpx: number, mode: 'scientific' | 'exploration' | 'cinematic', target = 2.4) {
  if (mode === 'scientific' || !(centreDisplay > target)) return 1;
  // v3.8.1 REV2-01 (SUN-381-07): full local presentation from ≈5 px radius (was 12 px). Between the resolution threshold and
  // the full metering size (≈40 px) the auto-exposure is still far above the disc's own level, so a disc compressed only
  // partially was displayed at 10–100× white: a bloom/glare blob that made the Mars-distance Sun at 20° FOV the largest.
  // SUN-381-08 (shared solar display transfer): compression is full whenever the disc is drawn at all (≥ 1 px, i.e. through
  // the whole disc→point cross-fade 1.2–3.5 px), so no representation of the Sun is ever shown above the presented
  // photosphere level; the unresolved point obeys the same cap (PX.sunPeakCap) and the glare law below meets it at 3.5 px
  const t = Math.max(0, Math.min(1, (rpx - 0.6) / 0.4)), w = t * t * (3 - 2 * t);
  return Math.exp(w * Math.log(target / centreDisplay));
}
/** v3.8.1 (SUN-381-01) glare amplitude (display-linear) from the Sun's display flux x = F·E. Logarithmic in brightness,
 *  so the visible glare radius grows and shrinks smoothly with distance and exposure and never saturates into a disc. */
export function glareAmplitudes(x: number) {
  const xs = Math.max(x, 0);
  return { halo: Math.min(0.8, 0.07 * Math.pow(xs, 0.3)), veil: Math.min(0.06, 0.005 * Math.pow(xs, 0.22)) };   // REV2-01: ×0.32 (cap 4 → 0.8) so the unresolved-Sun glare (sky exposure) never exceeds the resolved-disc glare at the 3.5–8 px handover — audit: 2.8k vs 0.78k px-units before
}
/** v3.8.1 cp2 (SUN-381-06) glare of a RESOLVED disc. Scattered light from a disc of radiance L and solid angle Ω at angle θ is
 *  L·Ω·P(θ); the glare profile is scaled in angle by th1 ∝ the disc's angular radius, so the amplitude at th1 is ∝ L — a
 *  fixed fraction of the displayed disc radiance — while the glare FOOTPRINT grows with the disc (∝ angR²). v3.8.0–cp1
 *  derived it from F·E with the disc-metered exposure, so the moment the Sun became resolved (≈ 3.5 px, between 1 AU and
 *  Mercury at 50°) its glare collapsed and a Mercury-distance Sun read smaller and flatter than at Earth. */
export function resolvedGlare(discDisplay: number, mode: 'scientific' | 'exploration' | 'cinematic') {
  const k = mode === 'scientific' ? 0.35 : mode === 'cinematic' ? 0.8 : 0.6;
  // display-referred and bounded: the glare is that of the disc AS SHOWN (≤ 4× display white), never of an unbounded HDR value
  const D = Math.min(discDisplay, 4);
  return { halo: k * D, veil: (mode === 'scientific' ? 0.05 : 0.12) * D };
}
/** Smooth hand-over between point-like and resolved glare (sun radius in device px). */
/** v3.8.1 SUN-381-08: glare of the UNRESOLVED Sun outside Scientific — the resolved-disc glare at the hand-over (disc shown at
 *  the presented level D = 2.4, radius 3.5 px) continued with the physical flux, F/F_h = (r/3.5)² at fixed FOV, through the
 *  shared transfer amplitude ∝ (F/F_h)^0.25. One law for all distances, continuous at the hand-over and monotone in F
 *  (replaces the cp2 F·E law, whose exposure swing of ≈20 EV across the hand-over made the point out-glow the disc). */
export function pointGlareFromHandover(rpx: number, mode: 'scientific' | 'exploration' | 'cinematic') {
  const h = resolvedGlare(2.4, mode), f = Math.pow(Math.max(rpx, 0) / 3.5, 0.5);
  return { halo: h.halo * f, veil: h.veil * f };
}
export function resolvedGlareWeight(rpx: number) { const t = Math.max(0, Math.min(1, (rpx - 3.5) / 4.5)); return t * t * (3 - 2 * t); }
/** Angular radius (rad) beyond which the glare profile is below `thr` display-linear (sizes the glare quad). */
export function glareExtentRad(halo: number, veil: number, th1: number, th0: number, thr = 0.002) {
  const rH = th1 * Math.sqrt(Math.max(0, Math.pow(Math.max(halo / thr, 1), 2 / 3) - 1));
  const rV = th0 * Math.max(0, Math.sqrt(Math.max(veil / thr, 1)) - 1);
  return Math.max(rH, rV, th1 * 2);
}
export function makeSun() {
  const U = {
    cam: uniform(new THREE.Vector3()), time: uniform(0), granT: uniform(0), days: uniform(0), L0: uniform(1), activity: uniform(0.75),
    tint: uniform(new THREE.Vector3(1, 0.82, 0.6)), contrast: uniform(1), detail: uniform(1), limbGrade: uniform(0.6),
    discScale: uniform(1),   // v3.8.1 SUN-381-02 local HDR presentation of the resolved disc (sunDiscScale)
  };
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = Fn(() => {
    const p0 = normalize(positionLocal);
    const v = normalize(U.cam.sub(positionLocal.mul(R_SUN)));
    const mu = max(dot(p0, v), 0.0);
    // differential rotation (Snodgrass & Ulrich 1990) relative to Carrington (14.1844 °/d). Only long-lived structure is
    // carried by it (active regions live days–weeks), and only over a bounded window (one 27-day Carrington rotation) —
    // applying years of shear wound the pattern into latitude streaks. Granules (minutes) and the supergranular network
    // (~1 day) are regenerated faster than shear matters, so they use the Carrington frame directly.
    const s2 = p0.z.mul(p0.z);
    const dOmega = float(14.713).sub(s2.mul(2.396)).sub(s2.mul(s2).mul(1.787)).sub(14.1844).mul(0.017453293);
    const ang = dOmega.mul(U.days.mod(27.2753));
    const ca = ang.cos(), sa = ang.sin();
    const pAR = vec3(p0.x.mul(ca).sub(p0.y.mul(sa)), p0.x.mul(sa).add(p0.y.mul(ca)), p0.z);
    const p = p0;
    // Neckel & Labs limb darkening (unchanged radiometry)
    const om = float(1).sub(mu), om2 = float(1).sub(mu.mul(mu));
    const ld = vec3(
      float(1).sub(om.mul(0.48)).sub(om2.mul(0.18)),
      float(1).sub(om.mul(0.58)).sub(om2.mul(0.20)),
      float(1).sub(om.mul(0.70)).sub(om2.mul(0.20))).max(0.05);
    // pixel footprint on the unit sphere → band-limit each layer (anti-shimmer)
    const fp = length(fwidth(p0)).max(1e-7);
    const GF = 330.0;                                     // granule frequency (cell ≈ 2.1 Mm)
    const gVis = smoothstep(0.55, 0.18, fp.mul(GF)).mul(U.detail);
    const gran = float(0).toVar();
    // network mask (supergranule boundaries ≈ 30 Mm) — computed first so bright points can follow it
    const sgN0 = vnoise({ p: p.mul(23) }).mul(0.6).add(vnoise({ p: p.mul(47).add(3.3) }).mul(0.4));
    const netMask = smoothstep(0.45, 0.62, sgN0);
    If(gVis.greaterThan(0.002), () => { gran.assign(granules2({ p, freq: float(GF), t: U.granT.div(480), net: netMask.mul(smoothstep(0.5, 0.15, fp.mul(GF * 3.1))) })); });
    // mesogranulation & supergranular network (≈ 5 and 30 Mm)
    const meso = fbm({ p: p.mul(70).add(U.granT.mul(2e-5)), oct: 3 }).sub(0.5).mul(smoothstep(0.6, 0.2, fp.mul(70)));
    const sgN = vnoise({ p: p.mul(23) }).mul(0.6).add(vnoise({ p: p.mul(47).add(3.3) }).mul(0.4));
    const network = smoothstep(0.45, 0.62, sgN).mul(pow(om, 1.5)).mul(smoothstep(0.7, 0.25, fp.mul(23)));
    // granule contrast falls toward the limb (foreshortening + corrugation); ≈ 12 % rms at centre
    const gContrast = float(0.42).mul(mu.mul(0.6).add(0.4)).mul(gVis).mul(U.contrast);
    let I: any = ld.mul(float(1).add(gran.mul(gContrast)).add(meso.mul(0.06)).add(network.mul(0.05)));
    // active regions (umbra redder: cooler ≈ 4,000 K; penumbra ≈ 5,500 K)
    const ar = activeRegions({ p: pAR, t: U.days, activity: U.activity });
    const spotT = vec3(1.0, 0.86, 0.72);
    const darkening = ar.x.mul(U.detail.mul(0.25).add(0.75));
    I = mix(I, I.mul(spotT).mul(float(1).sub(darkening)), smoothstep(0.0, 0.05, ar.x));
    // faculae / plage: bright toward the limb where they are seen side-on (contrast ∝ (1−μ)); mottled at the
    // supergranular-network scale, as in HMI continuum near the limb
    const mott = smoothstep(0.35, 0.75, vnoise({ p: p.mul(160) }).mul(0.6).add(vnoise({ p: p.mul(410).add(7.1) }).mul(0.4)));
    const fac = ar.z.mul(pow(om, 1.1)).mul(0.26).mul(mott.mul(0.7).add(0.3)).mul(float(1).sub(ar.y));
    I = I.add(ld.mul(fac));
    // display grading (perception only): warm the limb a little more than radiometry does so the disc reads as a sphere
    // after AgX, and keep the centre a touch below white so granulation/spot contrast survives the tone curve
    const limbWarm = mix(vec3(1, 1, 1), vec3(1.0, 0.86, 0.66), pow(om, 1.6).mul(U.limbGrade));
    const graded = I.mul(U.tint).mul(limbWarm);
    return vec4(graded.mul(U.L0).mul(U.discScale), 1);
  })();
  return { material: m, U };
}

// Camera glare around very bright sources: wide PSF halo + soft starburst, drawn as a screen-facing quad. This is the
// CAMERA's response (scattering in optics), separate from solar emission; it fades as the disc becomes a resolved
// extended source that fills the frame, so a close Sun no longer turns the whole screen into haze.
// v3.8.1 (SUN-381-01) — glare reconstructed in ANGLE space. v3.3–3.8.0 drew a quad of fixed size (0.9 NDC, i.e. 45 % of
// the frame height at every distance and FOV) whose profile was measured in units of the solar radius plus a constant
// exp(−10 r) "fog" term and 6-fold spikes at fixed screen size, so from 1 to 300 AU the same warm blob filled the frame.
// Now the profile is a function of the angle θ from the Sun's centre (radians), the same at every FOV:
//   G(θ) = halo · (1 + (θ/θ1)²)^−1.5      near-field scattering (θ1 ≈ 2.2 solar radii, ≥ 2.5 px)
//        + veil · (θ0 / (θ + θ0))²          long-range veiling glare ∝ θ⁻² (Stiles–Holladay-like), θ0 = 0.5°
//        + spikes (optional, diffraction-like, length ∝ halo)
// with amplitudes logarithmic in the Sun's display flux (glareAmplitudes), so the glare shrinks continuously with
// distance. The glare never brightens the disc itself (it starts at the limb), and its colour is the mode's grade.
export function makeGlare() {
  const U = { center: uniform(new THREE.Vector3()), halo: uniform(0), veil: uniform(0), pxAng: uniform(1e-3), extentPx: uniform(100), viewport: uniform(new THREE.Vector2(1920, 1080)),
    angRad: uniform(0.0046), th1: uniform(0.01), rot: uniform(0), spikes: uniform(0), tint: uniform(new THREE.Vector3(1.0, 0.97, 0.93)),
    // legacy fields kept for diagnostics compatibility
    flux: uniform(0), exposure: uniform(1), aspect: uniform(1) };
  const g = new THREE.PlaneGeometry(2, 2);
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const vPx = varying(vec2(0), 'gPx');
  m.vertexNode = Fn(() => {
    const c = cameraProjectionMatrix.mul(cameraViewMatrix.mul(vec4(U.center, 1)));
    vPx.assign(positionGeometry.xy.mul(U.extentPx));
    const off = positionGeometry.xy.mul(U.extentPx).mul(2).div(U.viewport);
    return vec4(c.x.div(c.w).add(off.x), c.y.div(c.w).add(off.y), 0.0001, 1);
  })();
  m.fragmentNode = Fn(() => {
    const th = length(vPx).mul(U.pxAng).max(1e-7);           // angle from the Sun's centre (small-angle, rad)
    const outside = smoothstep(U.angRad.mul(0.98), U.angRad.mul(1.25), th);   // glare starts at the limb
    const x1 = th.div(U.th1);
    const halo = pow(float(1).add(x1.mul(x1)), -1.5).mul(U.halo);
    const th0 = float(0.0087);
    const veil = th0.div(th.add(th0)).pow(2).mul(U.veil);
    // diffraction-like spikes (4 + 4 at 45°, thin, length ∝ halo amplitude) — optional "lens spikes" setting
    const ang = atan(vPx.y, vPx.x).add(U.rot);
    const sp = pow(ang.mul(2).cos().abs(), 260).add(pow(ang.mul(2).add(0.785398).cos().abs(), 400).mul(0.35));
    const spike = sp.mul(U.halo).mul(0.02).mul(exp(th.div(U.th1.mul(6)).negate())).mul(U.spikes);
    const fade = smoothstep(1, 0.75, length(vPx).div(U.extentPx));
    return vec4(U.tint.mul(halo.add(veil).add(spike)).mul(outside).mul(fade), 1);
  })();
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 100;
  return { mesh, U };
}
export const SUN_L_MEAN = (AU / R_SUN) ** 2;           // mean disc radiance in our units (flux π at 1 AU)
export const SUN_L0 = SUN_L_MEAN / 0.79;               // centre radiance given the limb-darkening law above
/** Fraction of the exposure "key" the resolved disc's mean radiance is metered at, by disc size in pixels: discs under
 *  ~4 px are exposed for the sky (disc clips, glare reads); from ~40 px the disc centre lands ≈0.96× display white (v3.3 final QA: at 1.35× AgX
 *  compressed the limb-darkening gradient and desaturated the disc to flat beige; now the disc stays luminous while
 *  granulation, spots, faculae and limb darkening stay legible and warm after AgX). v3.2 metered the centre at ≈4× white
 *  up to 420 px — the owner-reported "white ball". */
export function sunMeterWeight(rpx: number) {
  const s = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // v3.4: 0.21 → 0.25 (disc centre ≈0.81 of display white instead of ≈0.96) together with Neutral tone mapping: AgX desaturated the v3.3
  // disc to flat beige; the luminous impression now comes from the aureole/bloom, not from clipping the photosphere.
  return s(4, 40, rpx) * 0.25;
}
/** Glare (camera PSF) weight vs disc size: full for a point/small disc, gone once the disc fills a large part of the view. */
export function glareWeight(rpx: number, viewH: number) {
  const s = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return 1 - 0.92 * s(viewH * 0.06, viewH * 0.45, rpx);
}
