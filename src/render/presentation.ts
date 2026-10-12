// SOL v3.5 — viewing modes and the exposure/visibility model (spec v3.5 §5–§9).
//
// Separation of concerns (spec §5). Nothing in this module touches positions, orbits, rotations, radii, terrain or the
// physical light sources. It only decides how the physically computed, scene-linear radiance is EXPOSED and PRESENTED:
//
//   1. physical illumination ......... planetMaterial / atmosphere / sun (unchanged by the mode)
//   2. camera exposure ............... `meterExposure` (scene) — highlight-protected, temporally adapted in engine.ts
//   3. tonal/colour presentation ..... tone mapping + `grade` (Cinematic only)
//   4. enhanced inspection ........... `inspect` — a LABELLED fill on unlit hemispheres; never called sunlight
//   5. starfield / Milky Way ......... `skyExposure` — the sky layers' own exposure domain (see below)
//   6. artistic presentation ......... bloom/glare weights, grade, vignette (Cinematic)
//
// Sky exposure domain. Diffuse and point-like sky light (Milky Way, stars, unresolved planets, airglow) spans ~10⁻⁸ of a
// sunlit surface. A single physical camera exposed for a sunlit world records none of it (NASA Earth Observatory,
// "Where are the stars?", 2011; Cassini FAQ) — this is exactly the v3.4 behaviour the owner reported ("the background
// becomes empty near planets"). Scientific mode keeps it. Exploration/Cinematic composite the sky with its own,
// dark-adapted exposure, weakly coupled to the scene exposure (`skyCoupling`) and fully re-coupled when a bright veil is
// physically in front of it (sunlit atmosphere around the camera, the Sun in the frame) — the same idea as a
// photographer's HDR night composite or the eye's local adaptation. Occlusion is unchanged: the sky is drawn at the far
// plane and every body/atmosphere is depth-tested and alpha-composited over it.
export type ViewMode = 'scientific' | 'exploration' | 'cinematic';
export const VIEW_MODES: ViewMode[] = ['scientific', 'exploration', 'cinematic'];

/** Approved presentation parameters. Every numeric field is interpolated during a mode change (no popping). */
export interface PresentationParams {
  /** 1 = sky exposed with the scene camera (physical); 0 = sky fully on its own dark-adapted exposure. */
  skyCoupling: number;
  /** sky-domain exposure offset in EV relative to SKY_REF_EXPOSURE (ignored when skyCoupling = 1). */
  skyEV: number;
  /** star PSF highlight compression: display peaks above `starKnee` are mapped peak' = knee·(peak/knee)^starGamma. */
  starKnee: number; starGamma: number;
  /** multiplier on the calibrated diffuse Milky Way radiance (1 = calibrated; presentation boost otherwise). */
  milkyWay: number;
  /** night-side inspection fill, as a fraction of the local solar irradiance (0 = off). LABELLED enhancement. */
  inspect: number;
  /** maximum EV the auto-exposure may open beyond a body's fully-lit metering when its night side faces the camera. */
  nightCapEV: number;
  /** airglow display gain relative to calibrated (airglow is rendered in the sky exposure domain when decoupled). */
  airglow: number;
  /** bloom / camera glare strength multipliers. */
  bloom: number; glare: number;
  /** display grade applied before tone mapping: contrast (log-space around mid-grey), saturation, vignette. */
  contrast: number; saturation: number; vignette: number;
  /** exposure key offset in EV. */
  keyEV: number;
}
export const MODE_INFO: Record<ViewMode, { label: string; short: string; note: string }> = {
  scientific: { label: 'Scientific', short: 'SCI', note: 'One physical camera for the whole scene. Unlit surfaces stay dark; faint stars and the Milky Way disappear when a sunlit world dominates the exposure, as in real spacecraft imagery. Exposure compensation never changes the simulation.' },
  exploration: { label: 'Exploration', short: 'EXP', note: 'Recommended. True positions, sizes, phases and sunlight. The night sky is shown with its own dark-adapted exposure, highlights are protected, and unlit hemispheres receive a faint, labelled inspection light (not sunlight) so the whole surface can be read.' },
  cinematic: { label: 'Cinematic', short: 'CIN', note: 'Art-directed presentation of the same physical scene: slightly richer contrast and sky, softer glare, a gentle vignette. Positions, sizes, phases and light directions are unchanged.' },
};
export const MODE_PARAMS: Record<ViewMode, PresentationParams> = {
  scientific: { skyCoupling: 1, skyEV: 0, starKnee: 1e9, starGamma: 1, milkyWay: 1, inspect: 0, nightCapEV: 40, airglow: 1, bloom: 1, glare: 1, contrast: 1, saturation: 1, vignette: 0, keyEV: 0 },
  exploration: { skyCoupling: 0.06, skyEV: 0, starKnee: 0.35, starGamma: 0.5, milkyWay: 0.8, inspect: 0.03, nightCapEV: 1.5, airglow: 0.12, bloom: 1, glare: 0.85, contrast: 1, saturation: 1, vignette: 0, keyEV: 0 },
  cinematic: { skyCoupling: 0.1, skyEV: 0.4, starKnee: 0.3, starGamma: 0.55, milkyWay: 1.05, inspect: 0.015, nightCapEV: 1.2, airglow: 0.15, bloom: 1.15, glare: 1.0, contrast: 1.08, saturation: 1.06, vignette: 0.16, keyEV: -0.15 },
};
/** Fields a mode may set — the test suite asserts the parameter set never grows into physics. */
export const PRESENTATION_KEYS = Object.keys(MODE_PARAMS.scientific) as (keyof PresentationParams)[];

/** Sky-domain reference exposure. Calibrated so the Galactic band (μ_V ≈ 21 mag/arcsec², SKY_CAL) lands at ≈0.03–0.04
 *  display-linear — the look of a ~20 s f/2.8 ISO-3200 astrophotograph, ≈21–22 stops above a sunlit-planet exposure. */
export const SKY_REF_EXPOSURE = 3.0e6;

/** Radiance unit of SOL: flux π ≡ the Sun at 1 AU; the mean solar disc radiance is (AU/R☉)² ≈ 46,200, i.e. −10.58 mag
 *  arcsec⁻² (V = −26.74 over π·959.6″²). Surface brightness μ (mag arcsec⁻²) → SOL radiance. */
export const SUN_SB = -26.74 + 2.5 * Math.log10(Math.PI * 959.63 * 959.63);
export function radianceFromSB(mu: number, sunMeanRadiance = (149597870.7 / 695700) ** 2) { return sunMeanRadiance * Math.pow(10, -0.4 * (mu - SUN_SB)); }
/** Diffuse Milky Way calibration (derived): band median ↔ μ_V ≈ 21.0, contrast exponent so that the Galactic poles
 *  (map median 160× fainter) land near μ ≈ 23.4, the integrated-starlight + zodiacal floor seen from 1 AU
 *  (Leinert et al. 1998, A&AS 127, 1 — "The 1997 reference of diffuse night sky brightness"). Labelled DERIVED. */
export const SKY_CAL = { bandMu: 21.0, contrastGamma: 0.45, floorMu: 23.6, peakMu: 19.8 };

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Interpolate between two parameter sets (mode transitions). */
export function mixParams(a: PresentationParams, b: PresentationParams, t: number): PresentationParams {
  const o = {} as PresentationParams;
  for (const k of PRESENTATION_KEYS) {
    // couplings/caps interpolate in log space where they act multiplicatively on exposure
    (o as any)[k] = k === 'starKnee' ? Math.exp(lerp(Math.log(a[k]), Math.log(b[k]), t)) : lerp(a[k] as number, b[k] as number, t);
  }
  return o;
}
/** Advance a presentation state toward a target with a time constant (s). Returns the new state. */
export function approachParams(cur: PresentationParams, target: PresentationParams, dt: number, tau = 0.45): PresentationParams {
  const t = 1 - Math.exp(-Math.max(0, dt) / tau);
  return mixParams(cur, target, t);
}

/**
 * Exposure of the sky layers (stars, Milky Way, unresolved planets, airglow).
 *   ln E_sky = ln E_ref + skyEV·ln2 + c·min(0, ln E_scene − ln E_ref)     (c = effective coupling)
 * c = 1 reproduces the physical camera (E_sky = E_scene when the scene is darker than the reference it is clamped to
 * E_scene as well). `veil` ∈ [0,1] is the physical glare veil (sunlit air around the camera, the Sun in the frame):
 * it raises c toward 1, so stars never shine through a daylit sky.
 */
export function skyExposure(sceneExposure: number, p: Pick<PresentationParams, 'skyCoupling' | 'skyEV'>, veil = 0, userSkyEV = 0) {
  const c = clamp(lerp(p.skyCoupling, 1, clamp(veil, 0, 1)), 0, 1);
  const user = Math.pow(2, userSkyEV);          // the user's night-sky offset is a clean multiplier in every mode
  if (c >= 0.999) return sceneExposure * user;
  const lnRef = Math.log(SKY_REF_EXPOSURE) + p.skyEV * Math.LN2, lnS = Math.log(Math.max(sceneExposure, 1e-30));
  // never expose the sky darker than the scene camera would (a decoupled sky is a *brighter* domain only)
  const ln = Math.max(lnS, lnRef + c * Math.min(0, lnS - lnRef));
  return Math.exp(ln) * user;
}
/** Star highlight compression (matches the WGSL in points.ts). Monotonic; identity below the knee. */
export function compressPeak(peak: number, knee: number, gamma: number) {
  if (!(peak > knee) || gamma >= 1) return peak;
  return knee * Math.pow(peak / knee, gamma);
}

// ── photometry used by the metering (mirrors shaderlib.ts so exposure and shading agree) ────────────────────────────
export function lunarLambert(mu0: number, mu: number, phaseDeg: number, lambertBias: number) {
  const a = phaseDeg;
  let L = 1 - 0.019 * a + 0.000242 * a * a - 0.00000146 * a * a * a;
  L = clamp(lerp(L, 0, lambertBias), 0, 1);
  const m0 = Math.max(mu0, 0), m = Math.max(mu, 0);
  const surge = 1 + 0.35 * Math.exp(-a / 4);
  return ((1 - L) * m0 + 2 * L * m0 / (m0 + m + 1e-4)) * surge;
}
export function minnaert(mu0: number, mu: number, k: number) { return Math.pow(Math.max(mu0, 0), k) * Math.pow(Math.max(mu, 0.02), k - 1); }
export type PhotometricKind = 'rocky' | 'icy' | 'gas' | 'earth';
/**
 * Brightest photometric factor over the VISIBLE, SUNLIT part of a sphere at phase angle α (deg), found by sampling the
 * great circle through the sub-solar and sub-observer points (the maximum of these photometric functions lies on it).
 * Points closer than `minMu` to the limb are ignored: they cover a sub-pixel sliver of the disc.
 */
export function photometricPeak(phaseDeg: number, kind: PhotometricKind, minnaertK = 0.9, minMu = 0.08) {
  const a = clamp(phaseDeg, 0, 180) * Math.PI / 180;
  let best = 0;
  for (let i = 0; i <= 96; i++) {
    const t = -Math.PI / 2 + Math.PI * i / 96;        // normal angle measured from the view direction, in the l–v plane
    const mu = Math.cos(t), mu0 = Math.cos(t - a);
    if (mu < minMu || mu0 <= 0) continue;
    const f = kind === 'gas' ? minnaert(mu0, mu, minnaertK) : kind === 'earth' ? mu0 : lunarLambert(mu0, mu, phaseDeg, kind === 'icy' ? 0.45 : 0);
    if (f > best) best = f;
  }
  return best;
}
/** Scene-linear value that the brightest 1 % of a resolved disc is metered to, per tone mapper: Khronos PBR Neutral
 *  maps 1.25 → 0.917 (sRGB ≈ 245/255) — in the soft shoulder, below clipping (QA tuning: 0.9 protected highlights but
 *  darkened cloud-bright Earth by 1.4 EV vs v3.4); AgX compresses earlier, so it gets more. */
export const HIGHLIGHT_TARGET = { neutral: 1.25, agx: 1.6 } as const;
/** Khronos PBR Neutral tone curve (reference implementation, KhronosGroup/ToneMapping), for tests and QA metrics. */
export function pbrNeutral(c: [number, number, number]): [number, number, number] {
  const start = 0.8 - 0.04, desat = 0.15;
  const x = Math.min(c[0], c[1], c[2]), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let r = c[0] - off, g = c[1] - off, b = c[2] - off;
  const peak = Math.max(r, g, b);
  if (peak < start) return [r, g, b];
  const d = 1 - start, np = 1 - d * d / (peak + d - start);
  r *= np / peak; g *= np / peak; b *= np / peak;
  const gg = 1 - 1 / (desat * (peak - np) + 1);
  return [lerp(r, np, gg), lerp(g, np, gg), lerp(b, np, gg)];
}

/** Inputs of one resolved body to the scene meter (all radiances UNEXPOSED, SOL units). */
export interface MeterBody {
  /** the v3.3/3.4 reference-grey luminance at full phase (partially albedo-compensated "subject" metric) */
  subjectFull: number;
  /** fraction of the visible disc that is sunlit, raised to the v3.4 metering exponent */
  litWeight: number;
  /** calibrated reflectance of the brightest 1 % of the map (per channel max), × peak photometric factor × irradiance */
  highlightRadiance: number;
  /** metering weight from apparent size (0 for sub-pixel discs) */
  weight: number;
}
/**
 * Scene metering (EXP-002 fix). Returns the luminance the key is divided by.
 *  • subject  = reference-grey metering of the lit part (unchanged v3.4 behaviour → same overall brightness)
 *  • night cap: the lit part may fall to zero when the night side faces the camera; the meter may then open at most
 *    `nightCapEV` beyond the fully-lit metering (Scientific: effectively unbounded = physical camera)
 *  • highlight protection: exposure never puts the brightest 1 % of a resolved, sunlit disc above HIGHLIGHT_TARGET —
 *    this is what removes the clipping of Io, Triton, Europa, Vesta… without darkening dark bodies (their highlights
 *    are far below the target, so the cap is inactive for them).
 */
export function meterLuminance(bodies: MeterBody[], key: number, highlightTarget: number, nightCapEV: number, ambient = 0) {
  let subject = 0, hi = 0;
  const cap = Math.pow(2, -Math.max(0, nightCapEV));
  for (const b of bodies) {
    if (!(b.weight > 0)) continue;
    const s = b.subjectFull * Math.max(b.litWeight, cap) * b.weight;
    if (s > subject) subject = s;
    const h = key * b.highlightRadiance / highlightTarget * smooth(0.25, 1, b.weight);
    if (h > hi) hi = h;
  }
  return { subject, highlight: hi, luminance: Math.max(subject, hi, ambient) };
}
