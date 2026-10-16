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
  /** multiplier on the calibrated diffuse Milky Way radiance (1 = calibrated; presentation boost otherwise).
   *  v3.8.1 SKY-381-06: Exploration 0.8 → 1.4, Cinematic 1.05 → 1.6 (labelled presentation gain; with the unblurred EDR3 layer
   *  the band's structure reads instead of a dim brown wash). Scientific stays 1 (calibrated). */
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
  /** v3.8.1 (EXP-381-01): the most the Sun's glare may darken the decoupled sky, in EV (bounded local adaptation).
   *  Ignored when the sky is physically coupled (Scientific). */
  sunVeilEV: number;
}
export const MODE_INFO: Record<ViewMode, { label: string; short: string; note: string }> = {
  scientific: { label: 'Scientific', short: 'SCI', note: 'One physical camera for the whole scene. Unlit surfaces stay dark; faint stars and the Milky Way disappear when a sunlit world dominates the exposure, as in real spacecraft imagery. Unresolved planets, moons, asteroids and comets are drawn at their true brightness (no findability floor or visibility boosts — use labels to find them). Exposure compensation never changes the simulation.' },
  exploration: { label: 'Exploration', short: 'EXP', note: 'Recommended. True positions, sizes, phases and sunlight. The night sky is shown with its own dark-adapted exposure, highlights are protected, and unlit hemispheres receive a faint, labelled inspection light (not sunlight) so the whole surface can be read.' },
  cinematic: { label: 'Cinematic', short: 'CIN', note: 'Art-directed presentation of the same physical scene: slightly richer contrast and sky, softer glare, a gentle vignette. Positions, sizes, phases and light directions are unchanged.' },
};
export const MODE_PARAMS: Record<ViewMode, PresentationParams> = {
  scientific: { skyCoupling: 1, skyEV: 0, starKnee: 1e9, starGamma: 1, milkyWay: 1, inspect: 0, nightCapEV: 40, airglow: 1, bloom: 1, glare: 1, contrast: 1, saturation: 1, vignette: 0, keyEV: 0, sunVeilEV: 0 },
  exploration: { skyCoupling: 0.06, skyEV: 0, starKnee: 0.35, starGamma: 0.5, milkyWay: 1.4, inspect: 0.03, nightCapEV: 1.5, airglow: 0.12, bloom: 1, glare: 0.85, contrast: 1, saturation: 1, vignette: 0, keyEV: 0, sunVeilEV: 2.0 },
  cinematic: { skyCoupling: 0.1, skyEV: 0.4, starKnee: 0.3, starGamma: 0.55, milkyWay: 1.6, inspect: 0.015, nightCapEV: 1.2, airglow: 0.15, bloom: 1.15, glare: 1.0, contrast: 1.08, saturation: 1.06, vignette: 0.16, keyEV: -0.15, sunVeilEV: 1.6 },
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
/**
 * v3.8.1 (EXP-381-01) — the Sun's glare veil over the sky, as a CONTINUOUS function of geometry.
 *
 * Root cause of the owner's "the Milky Way and stars go black when the Sun enters the view": v3.5–3.8.0 set
 * veil = 0.45 × [Sun centre within ±1.1 NDC] — a binary step on the frame edge, independent of how bright the Sun
 * appears — and fed it into the sky COUPLING (c = 0.06 → 0.48). With the scene metered for a sunlit disc 15–25 EV below
 * the sky reference, the whole sky dropped 7–12 EV the instant the Sun's centre crossed the edge, at 1 AU and at
 * 1,000 AU alike, and recovered the instant it left.
 *
 * Now: veil ∈ [0, 1] = visibility × apparent-brightness weight × angular proximity to the frame. Inside the frame it is
 * 1; outside it falls smoothly to 0 over `marginDeg` of angular distance from the nearest frame edge (stray light from a
 * source just outside the field). Brightness weight: full while the Sun is brighter than V ≈ −16 (≲ 2,000 AU), none
 * once it is a mere bright star (V > −8, ≳ 0.35 ly). The veil then darkens the decoupled sky by at most `sunVeilEV`
 * (bounded, labelled local adaptation) instead of re-coupling it to the scene camera. Faint stars right next to the Sun
 * are still lost in its glare PSF (sun.ts glare), which is where a real optical system loses them.
 */
export function sunGlareVeil(o: { ndcX: number; ndcY: number; inFront: boolean; halfFovX: number; halfFovY: number; sunVis: number; sunMagV: number; marginDeg?: number }) {
  const margin = (o.marginDeg ?? 12) * Math.PI / 180;
  let outside = 0;
  if (!o.inFront) outside = Math.PI;
  else {
    // angular distance outside the frame along each axis (tan-space → angle), combined as a Euclidean distance
    const ax = Math.max(0, Math.atan(Math.abs(o.ndcX) * Math.tan(o.halfFovX)) - o.halfFovX);
    const ay = Math.max(0, Math.atan(Math.abs(o.ndcY) * Math.tan(o.halfFovY)) - o.halfFovY);
    outside = Math.hypot(ax, ay);
  }
  const prox = 1 - smooth(0, margin, outside);
  const bright = smooth(-8, -16, o.sunMagV);
  return clamp(prox * bright * clamp(o.sunVis, 0, 1), 0, 1);
}
/** v3.8.1 sky exposure: atmospheric veil re-couples physically (no stars through a daylit sky); the Sun's glare veil
 *  applies a bounded EV reduction to the decoupled sky. Never darker than the scene camera. */
export function skyExposureV381(sceneExposure: number, p: Pick<PresentationParams, 'skyCoupling' | 'skyEV' | 'sunVeilEV'>, atmoVeil = 0, sunVeil = 0, userSkyEV = 0) {
  const e = skyExposure(sceneExposure, p, atmoVeil, userSkyEV);
  const c = clamp(lerp(p.skyCoupling, 1, clamp(atmoVeil, 0, 1)), 0, 1);
  if (c >= 0.999) return e;
  return Math.max(sceneExposure * Math.pow(2, userSkyEV), e * Math.pow(2, -clamp(sunVeil, 0, 1) * Math.max(0, p.sunVeilEV)));
}
/** v3.8.1 CONT-14 shared point↔disc photometric contract (planets, moons, small bodies; the Sun keeps SUN-381-08).
 *  A resolved disc is drawn on the SCENE exposure; an unresolved world sits among the stars on the SKY exposure. v3.5–3.8.1
 *  switched an unresolved body straight to the sky exposure, so in Exploration next to sunlit Saturn (scene EV 7.4,
 *  sky EV 20.7) Titan's point was ≈2¹³ × over-exposed relative to its own disc and the hand-over showed a step (SW
 *  titan-handover: ≈1.9× integrated displayed signal at 1.9 px after clipping/compression).
 *  Contract: the point's exposure leaves the scene exposure at the start of the hand-over (rpxHand) and may approach the
 *  sky exposure no faster than the inverse-square law takes the body's flux away, |Δ ln E| ≤ 2·ln(rpxHand/rpx), so the
 *  displayed integrated signal is continuous and never increases while the body recedes (it plateaus, then follows
 *  the sky domain once the exposures meet). Scientific (sky = scene exposure) is the identity. */
export const POINT_HANDOVER_PX = 3.5;
export function pointExposure(sceneExposure: number, skyExp: number, rpx: number, rpxHand = POINT_HANDOVER_PX) {
  const lnS = Math.log(Math.max(sceneExposure, 1e-30)), d = Math.log(Math.max(skyExp, 1e-30)) - lnS;
  const lim = 2 * Math.max(0, Math.log(rpxHand / Math.max(rpx, 1e-9)));
  if (lim <= 0) return sceneExposure;
  return Math.exp(lnS + clamp(d, -lim, lim));
}
/** v3.8.1 CONT-14 representation/depth contract. Through the disc→point cross-fade (3.5 → 0.55 px) the body's own sphere
 *  is still drawn (dimmed by discWeight) and writes depth, while its PSF sprite sat at the body CENTRE with depth testing:
 *  the sphere's front surface rejected the sprite's core pixels (SW A/B with only the sphere's depth writes switched off,
 *  same geometry/flux/exposure: +45–105 % point signal at 1.0–1.5 px). The sprite is placed on the line of sight just in
 *  front of the body's bounding sphere (camera-relative scale), so its own disc never occludes it while geometry nearer
 *  than the body's limb (another body, rings) still does. Depth testing is never disabled. The bound includes the
 *  atmosphere shell: its premultiplied-over blend keeps absorbing (τ > 3 for Titan) after its emission fades with the disc. */
/** CONT-14f-H (2026-10-16): a margin of 2 % of the radius is below the depth-comparison resolution of the rasterised sphere
 *  at sub-3-px sizes. SW A/B on Callisto α60° at 1.2–1.5 px (work/qa/c14f-ho): pull 1.02 R / 1.1 R → the sprite still loses
 *  15 % of its flux to its own sphere; 1.4 R, 3 R, 30 R or depth test off → identical, continuous flux (0.685 → 0.688). The
 *  failing margins in front of the limb are 1.6e-5–7.8e-5 of the distance, the passing ones ≥ 3.1e-4. The sprite therefore
 *  sits at least POINT_DEPTH_REL × distance in front of the bounding sphere. A body behind another's disc stays occluded
 *  while that margin is below √(a² − R²) (the smallest line-of-sight separation of a satellite behind its primary's disc):
 *  Phobos–Mars 8,740 km vs 4,700 km at Mars' 0.55-px distance; Amalthea–Jupiter 166,000 vs 100,000 km; Pan–Saturn
 *  119,000 vs 80,000 km. Grazing ring-plane geometry (a moon just behind the ring sheet) can be mis-ordered: documented. */
export const POINT_DEPTH_REL = 5e-4;
export function pointDepthScale(boundRadius: number, dist: number) {
  const D = Math.max(dist, 1e-9);
  return Math.max(0, 1 - Math.max(1.02 * boundRadius / D, (boundRadius + POINT_DEPTH_REL * D) / D));
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
 * v3.8.1 CONT-14c — shared disc-integrated photometry (one model for the resolved disc and the unresolved point).
 * Engine radiance convention: L = a · E · f(μ0, μ, α) with f the shader BRDF (shaderlib lunarLambert / minnaert / μ0)
 * and E the pre-exposed solar term (LS / r²). The disc's integrated flux per unit reflectance a, solar term E and
 * angular area (R/d)² is I(α) = ∫disc f dΩ (numerical, 1° table, cached per kind).
 * Physical anchor: the catalog albedo is the GEOMETRIC albedo p, defined by F(0) = p · π · E · (R/d)² in this convention
 * (Lambert check: f = μ0 ⇒ I(0) = 2π/3 ⇒ a = 3p/2, the textbook relation). Hence
 *   disc reflectance  a(p)  = p · π / I(0)                       (replaces the inherited a = 1.25 p heuristic)
 *   point flux        F(α)  = a(p) · E · (R/d)² · I(α)          (replaces ⅔·p·π·Φ_Lambert, which was ⅔ low and used
 *                                                                  the Lambert phase law whatever the disc used)
 * so disc and point agree by construction wherever the disc is the surface BRDF. Atmosphere shells add light the
 * surface BRDF does not contain (e.g. Titan's forward-scattering haze); that residual is measured, not hidden (CONT-14c).
 */
const PHOT_TABLE = new Map<string, Float64Array>();
export function discPhaseIntegral(kind: PhotometricKind, alphaDeg: number, minnaertK = 0.9) {
  const key = kind + (kind === 'gas' ? ':' + minnaertK.toFixed(3) : '');
  let T = PHOT_TABLE.get(key);
  if (!T) {
    T = new Float64Array(181); const n = 64, h = 2 / n;   // 64² samples: < 0.3 % vs 800² (QA check)
    for (let ai = 0; ai <= 180; ai++) {
      const a = ai * Math.PI / 180, lx = Math.sin(a), lz = Math.cos(a); let sum = 0;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = -1 + (i + 0.5) * h, y = -1 + (j + 0.5) * h, r2 = x * x + y * y; if (r2 >= 1) continue;
        const mu = Math.sqrt(1 - r2), mu0 = x * lx + mu * lz; if (mu0 <= 0) continue;
        sum += kind === 'gas' ? minnaert(mu0, mu, minnaertK) : kind === 'earth' ? mu0 : lunarLambert(mu0, mu, ai, kind === 'icy' ? 0.45 : 0);
      }
      T[ai] = sum * h * h;
    }
    PHOT_TABLE.set(key, T);
  }
  const x = clamp(alphaDeg, 0, 180), i = Math.min(179, Math.floor(x)), t = x - i;
  return T[i] * (1 - t) + T[i + 1] * t;
}
/** Disc reflectance a that makes the shaded sphere integrate to geometric albedo p at zero phase (capped at 0.92). */
export function discReflectance(p: number, kind: PhotometricKind, minnaertK = 0.9) {
  return Math.min(0.92, p * Math.PI / discPhaseIntegral(kind, 0, minnaertK));
}
/** Unresolved-body flux (engine units, before exposure): a(p)·I(α)·(R/d)²/r² — the disc's own integral. */
export function pointBodyFlux(p: number, kind: PhotometricKind, alphaDeg: number, radiusOverDist: number, rSunAU: number, minnaertK = 0.9) {
  return discReflectance(p, kind, minnaertK) * discPhaseIntegral(kind, alphaDeg, minnaertK) * radiusOverDist * radiusOverDist / (rSunAU * rSunAU);
}
/** Point colour from a body tint: luminance-normalised so the tint never changes the integrated luminance. */
export function lumNormalised(c: readonly number[]) { const Y = Math.max(1e-6, 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]); return [c[0] / Y, c[1] / Y, c[2] / Y]; }
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
  /** v3.8.1 RING-381-02: explicit highlight-protection weight (default smooth(0.25, 1, weight)) */
  hiWeight?: number;
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
    if (!(b.weight > 0) && !(b.hiWeight! > 0)) continue;
    const s = b.subjectFull * Math.max(b.litWeight, cap) * b.weight;
    if (s > subject) subject = s;
    const h = key * b.highlightRadiance / highlightTarget * (b.hiWeight ?? smooth(0.25, 1, b.weight));
    if (h > hi) hi = h;
  }
  return { subject, highlight: hi, luminance: Math.max(subject, hi, ambient) };
}

/**
 * v3.8.1 GA-SCI-01 (Gate A audit): findability contract. Visibility exaggerations for unresolved bodies — the per-kind
 * minimum point brightness and the user boosts (bodyBoost, asteroidBoost, cometBoost) — are PRESENTATION transforms.
 * Until now they were applied in every mode, so Scientific mode silently drew a 1 000 AU-distant Neptune as a 2nd-magnitude
 * star and asteroids 4·10⁶× (default) too bright. Scientific now uses the physical value (gain 1, floor 0) everywhere;
 * Exploration/Cinematic keep the labelled enhancement. One function so no renderer can implement its own rule.
 */
export type FindabilityKind = 'planet' | 'dwarf' | 'moon' | 'other';
export const POINT_FLOOR: Record<FindabilityKind, number> = { planet: 0.22, dwarf: 0.1, moon: 0.06, other: 0 };
export function visibilityGain(mode: ViewMode, userBoost: number): number {
  return mode === 'scientific' ? 1 : Math.max(1, userBoost || 1);
}
/** display-referred minimum point flux (≈ a 2nd-magnitude star for planets); 0 in Scientific. Moons only above 500 km. */
export function pointFloor(mode: ViewMode, kind: string, radiusKm: number, pxAng: number, fade: number): number {
  if (mode === 'scientific') return 0;
  const k: FindabilityKind = kind === 'planet' ? 'planet' : kind === 'dwarf' ? 'dwarf' : kind === 'moon' && radiusKm > 500 ? 'moon' : 'other';
  return POINT_FLOOR[k] * pxAng * pxAng * 4.54 * fade;
}

/**
 * v3.8.1 CONT-14f — visible-hemisphere albedo factor for the unresolved point.
 * The point flux (pointBodyFlux / the disc twin) uses the map-MEAN reflectance; the resolved disc shows the albedo of the
 * illuminated visible hemisphere. H = Σ A·f(μ0,μ,α)·μ·dS / Σ f·μ·dS over the cells of a coarse equirect grid of the
 * map's luminance relative to its mean (tools/ingest/albedo_grid.py, same convention as the shader's equirect()), so the
 * point carries the same surface albedo weighting as the disc it hands over to. Derived, no fit; equals 1 for a uniform
 * map. Directions are body-fixed (the shader's camLocal / sunLocal), any length.
 */
export interface AlbedoGrid { w: number; h: number; v: ArrayLike<number> }
export function hemisphereAlbedoFactor(G: AlbedoGrid, cam: readonly number[], sun: readonly number[], kind: PhotometricKind) {
  const cl = Math.hypot(cam[0], cam[1], cam[2]) || 1, sl = Math.hypot(sun[0], sun[1], sun[2]) || 1;
  const vx = cam[0] / cl, vy = cam[1] / cl, vz = cam[2] / cl, sx = sun[0] / sl, sy = sun[1] / sl, sz = sun[2] / sl;
  const aDeg = Math.acos(clamp(vx * sx + vy * sy + vz * sz, -1, 1)) * 180 / Math.PI;
  let num = 0, den = 0;
  for (let j = 0; j < G.h; j++) {
    const lat = Math.PI / 2 - (j + 0.5) / G.h * Math.PI, cl2 = Math.cos(lat), z = Math.sin(lat);
    for (let i = 0; i < G.w; i++) {
      const lon = ((i + 0.5) / G.w - 0.5) * 2 * Math.PI, x = cl2 * Math.cos(lon), y = cl2 * Math.sin(lon);
      const mu = x * vx + y * vy + z * vz, mu0 = x * sx + y * sy + z * sz; if (mu <= 0 || mu0 <= 0) continue;
      const f = kind === 'earth' ? mu0 : lunarLambert(mu0, mu, aDeg, kind === 'icy' ? 0.45 : 0), wgt = f * mu * cl2;
      num += G.v[j * G.w + i] * wgt; den += wgt;
    }
  }
  return den > 0 ? num / den : 1;
}
