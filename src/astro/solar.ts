// Pure solar photometry helpers (no rendering imports) — shared by the corona renderer and tests.
/** Baumbach (1937) K+F corona radial profile, brightness relative to MEAN disc radiance, r in solar radii (r ≥ 1). */
export const baumbach = (r: number) => 1e-6 * (0.0532 * r ** -2.5 + 1.425 * r ** -7 + 2.565 * r ** -17);
