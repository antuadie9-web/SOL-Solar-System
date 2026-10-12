// SOL v3.8.1 (WP-B, STAR-J01) — numerical model of the GPU camera-relative star transform.
//
// The 3-D star layer (stars3d.ts) evaluates, per star and per frame on the GPU in float32:
//     rel = sP + sV·years − cam            (parsecs, heliocentric ecliptic → scene axes)
// v3.4–3.8.0 uploaded `cam` as ONE float32 vector. Near another star |cam| ≈ |sP| ≈ 1.3 pc, where one float32 ulp is
// 1.19e-7 pc ≈ 0.0245 AU ≈ 3.7 million km. Every frame the camera's float32 image snaps by up to ½ ulp per axis, so the
// star drawn at `rel` jumps by that amount while the double-precision camera (which looks at the star's float64 position)
// moves smoothly: the selected star wobbles around the screen centre with an amplitude ∝ 0.0245 AU / distance —
// ≈ 0.4 px at 50 AU, ≈ 20 px at 1 AU, and the error is in DIRECTION, so zooming toward the star amplifies it.
//
// v3.8.1 fix: split the camera into hi + lo float32 parts (cam = hi + lo exactly to ~1e-14 relative) and reorder:
//     rel = ((sP − camHi) + sV·years) − camLo
// `sP − camHi` is exact when the components are within a factor 2 (Sterbenz lemma) — i.e. exactly for the nearby stars
// whose relative vector is small — so the residual error is O(ulp(|rel|)) instead of O(ulp(|cam|)). The catalogue row is
// itself float32, and the navigable body's double-precision position is computed from the SAME float32 row (main.ts), so
// the drawn star and the camera target agree exactly.
//
// These functions emulate both schemes with Math.fround so the error can be measured on the CPU (tests + QA traces).
export type V3 = [number, number, number];
const f = Math.fround;

/** float32 hi/lo split of a double vector (hi = nearest float32, lo = float32 of the remainder). */
export function splitHiLo(v: V3): { hi: V3; lo: V3 } {
  const hi: V3 = [f(v[0]), f(v[1]), f(v[2])];
  return { hi, lo: [f(v[0] - hi[0]), f(v[1] - hi[1]), f(v[2] - hi[2])] };
}
/** v3.8.0 GPU path: one float32 camera uniform, rel = (sP + sV·y) − cam in float32. */
export function relLegacyF32(sP: V3, sV: V3, years: number, camPc: V3): V3 {
  const y = f(years), c: V3 = [f(camPc[0]), f(camPc[1]), f(camPc[2])];
  return [0, 1, 2].map(i => f(f(f(sP[i]) + f(f(sV[i]) * y)) - c[i])) as V3;
}
/** v3.8.1 GPU path: hi/lo camera, rel = ((sP − hi) + sV·y) − lo in float32. */
export function relSplitF32(sP: V3, sV: V3, years: number, camPc: V3): V3 {
  const y = f(years), { hi, lo } = splitHiLo(camPc);
  return [0, 1, 2].map(i => f(f(f(f(sP[i]) - hi[i]) + f(f(sV[i]) * y)) - lo[i])) as V3;
}
/** Exact (double) reference using the float32 catalogue values (which ARE the catalogue). */
export function relRef(sP: V3, sV: V3, years: number, camPc: V3): V3 {
  return [0, 1, 2].map(i => f(sP[i]) + f(sV[i]) * years - camPc[i]) as V3;
}
/** Angle (radians) between two vectors. */
export function angleBetween(a: V3, b: V3): number {
  const la = Math.hypot(...a), lb = Math.hypot(...b);
  const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
  const cr = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return Math.atan2(Math.hypot(...cr) / (la * lb), c);
}
/** Direction error (pixels) of a scheme vs the reference for a camera with vertical FOV `fovDeg` and `H` pixels. */
export function dirErrorPx(rel: V3, ref: V3, fovDeg: number, H: number): number {
  const pxAng = 2 * Math.tan(fovDeg * Math.PI / 360) / H;
  return angleBetween(rel, ref) / pxAng;
}
