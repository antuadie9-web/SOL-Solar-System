// Precision contract (spec §4 "Floating-point precision and origin handling", §10 guides).
//
// Scientific state is float64 on the CPU. The GPU only ever receives float32, so every value that is large in absolute
// terms but must be differenced at small scale is sent as a high/low pair:
//     hi = fround(x)            (nearest float32)
//     lo = fround(x − hi)       (the float32 residual; |lo| ≤ ½ ulp(hi))
// and the shader forms   rel = (pHi + oHi) + (pLo + oLo)   where o = −camera (or parent − camera). The first sum is
// exact or nearly so when the two terms cancel (Sterbenz), so the result keeps ≈ 48 bits of the original difference.
// This is the "relative-to-eye" scheme used by CesiumJS and others; it replaces SOL v3.2's path, which transformed
// float32 vertices of up to 4.5·10⁹ km by a float32 translation of similar magnitude and therefore quantised orbit
// vertices to ~256–512 km steps that changed every frame as the camera moved (the owner-reported orbit "vibration").

/** Split a float64 into a float32 (hi, lo) pair. */
export function splitDouble(x: number): [number, number] {
  const hi = Math.fround(x);
  return [hi, Math.fround(x - hi)];
}
/** Split a float64 xyz array into two Float32Arrays (hi, lo) of the same layout. */
export function splitArray(src: ArrayLike<number>): { hi: Float32Array; lo: Float32Array } {
  const n = src.length, hi = new Float32Array(n), lo = new Float32Array(n);
  for (let i = 0; i < n; i++) { const h = Math.fround(src[i]); hi[i] = h; lo[i] = Math.fround(src[i] - h); }
  return { hi, lo };
}
/** Emulates the shader's float32 arithmetic for a relative-to-eye reconstruction (used by tests). */
export function rteF32(pHi: number, pLo: number, oHi: number, oLo: number): number {
  const f = Math.fround;
  return f(f(pHi + oHi) + f(pLo + oLo));
}
/** The v3.2 path for comparison: float32 vertex + float32 translation. */
export function naiveF32(p: number, o: number): number {
  const f = Math.fround;
  return f(f(p) + f(o));
}
/** Unit of length for each precision domain (spec §4 canonical units). Data are converted only through these. */
export const LENGTH_UNITS_KM = {
  m: 1e-3,
  km: 1,
  AU: 149597870.7,                 // IAU 2012 Resolution B2 (exact)
  ly: 9.4607304725808e12,          // Julian year × c (IAU)
  pc: 3.0856775814913673e13,       // IAU 2015 Resolution B2 (exact definition: 648000/π AU)
  kpc: 3.0856775814913673e16,
  Mpc: 3.0856775814913673e19,
} as const;
export type LengthUnit = keyof typeof LENGTH_UNITS_KM;
export const convertLength = (v: number, from: LengthUnit, to: LengthUnit) => v * LENGTH_UNITS_KM[from] / LENGTH_UNITS_KM[to];
