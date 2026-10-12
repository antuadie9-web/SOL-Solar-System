// Contract 4 — universal detail tiers and screen-error-driven selection with hysteresis (spec D1.4, F4 "Render at the
// required level", F5 "Render-detail contract"). The engine asks `selectDetail` per object per frame; the answer is a
// tier plus the reason, so diagnostics can show WHY something is drawn the way it is.
//   D0 unresolved (search index only, no fake sphere) · D1 photometric point source · D2 silhouette/proxy
//   D3 mapped orbital detail (measured or labelled reconstruction) · D4 near-surface (DEM tiles, terrain, collision)
//   D5 cinematic/high-cost effects (only when budget allows)
export type DetailTier = 0 | 1 | 2 | 3 | 4 | 5;
export const TIER_NAMES = ['D0 unresolved', 'D1 point source', 'D2 proxy', 'D3 mapped', 'D4 near-surface', 'D5 cinematic'] as const;
export interface DetailInput {
  radiusKm: number;
  distanceKm: number;          // camera → centre
  fovYRad: number;
  viewportH: number;           // device pixels
  luminous?: boolean;          // star / lit body: point source while sub-pixel (never vanishes)
  hasSurface: boolean;         // texture map or labelled procedural surface
  hasTerrain: boolean;         // DEM tiles exist
  budgetOk: boolean;           // GPU/memory budget allows D5
  focused?: boolean;           // selected/foreground object
}
/** Apparent radius in pixels (exact for a sphere: angular radius asin(R/d)). */
export function pixelRadius(R: number, d: number, fovY: number, H: number) {
  if (!(d > 0)) return Infinity;
  const ang = d <= R ? Math.PI / 2 : Math.asin(R / d);
  return Math.tan(ang) / Math.tan(fovY / 2) * (H / 2);
}
/** Thresholds in pixels of apparent radius (enter values); exit = enter × (1 − HYST). */
export const TIER_ENTER_PX = { 2: 1.5, 3: 12, 4: 2500, 5: 60 } as const;
export const HYST = 0.2;
export function selectDetail(i: DetailInput, prev?: DetailTier): { tier: DetailTier; px: number; reason: string } {
  const px = pixelRadius(i.radiusKm, i.distanceKm, i.fovYRad, i.viewportH);
  const altitude = i.distanceKm - i.radiusKm;
  const enter = (t: 2 | 3 | 4 | 5) => TIER_ENTER_PX[t] * ((prev !== undefined && prev >= t) ? 1 - HYST : 1);
  let tier: DetailTier = i.luminous ? 1 : px < 0.25 ? 0 : 1;
  let reason = i.luminous ? 'luminous point source (flux-conserving PSF)' : px < 0.25 ? 'sub-pixel, not luminous enough to matter' : 'unresolved → PSF point';
  if (px >= enter(2)) { tier = 2; reason = 'resolved disc/silhouette'; }
  if (px >= enter(3) && i.hasSurface) { tier = 3; reason = 'mapped surface (measured or labelled reconstruction)'; }
  // near-surface tier is driven by altitude relative to radius (terrain screen error), not by disc size alone
  if (i.hasTerrain && (px >= enter(4) || altitude < i.radiusKm * 0.6)) { tier = 4; reason = 'near-surface: DEM terrain tiles'; }
  if (tier >= 3 && i.focused && i.budgetOk && px >= enter(5) && tier < 4) { tier = 5; reason = 'focused object, budget allows cinematic effects'; }
  return { tier, px, reason };
}
/** Screen-space error (px) of a terrain/geometry patch with geometric error `errKm` at distance `dKm`. */
export function screenError(errKm: number, dKm: number, fovY: number, H: number) { return errKm / Math.max(1e-9, dKm) / Math.tan(fovY / 2) * (H / 2); }
/** v3.6 geometry LOD of plain ellipsoids per detail tier (AUD-04 remainder): D2 proxy 24 segments per cube-face edge
 *  (3.5k triangles), D3 mapped 96 (128 for giants), D5 focused 192 — a full-screen limb stays below ≈ 0.5 px chord error at
 *  1440 px (chord sagitta ≈ R·(π/(4·seg))²/2). */
export function sphereSegmentsForTier(tier: DetailTier, radiusKm: number) { return tier <= 2 ? 24 : tier >= 5 ? 192 : radiusKm > 20000 ? 128 : 96; }
export function limbChordErrorPx(seg: number, discRadiusPx: number) { const a = Math.PI / (4 * seg); return discRadiusPx * (1 - Math.cos(a)); }
