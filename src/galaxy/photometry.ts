// SOL v3.8 (DEF-38-013) — photometric band of the stellar catalogue.
// The 3-D catalogue rows (stars3d v1) carry the ABSOLUTE magnitude in the band of their source: Gaia G for GCNS / Gaia DR3
// rows, Hipparcos Hp for the Hipparcos-only bright stars (flag bit 2). SOL's Sun (V = −26.74), planets and the directional
// bright-star catalogue are Johnson V, and the renderer's flux zero point is V. v3.4–3.8-wip used G as if it were V: red
// dwarfs (G − V ≈ −2.2 at BP−RP ≈ 3.8) were drawn ≈ 7× too bright and the HUD showed G-band magnitudes unlabelled
// (Proxima from 50 AU: −9.7 "mag" = G; in V it is ≈ −7.6 — SIMBAD V = 11.13, G = 8.985 from Earth).
// Conversion: Gaia EDR3 photometric relation G − V = −0.02704 + 0.01424 C − 0.2156 C² + 0.01426 C³, C = BP − RP,
// valid −0.5 < C < 5.0, σ = 0.0302 mag (Riello et al. 2021, A&A 649, A3, Table C.2; Gaia EDR3 documentation §5.5.1,
// gea.esac.esa.int/archive/documentation/GEDR3/Data_processing/chap_cu5pho/cu5pho_sec_photSystem/cu5pho_ssec_photRelations.html, checked 2026-10-11). The rows store Teff (not BP − RP):
// C is recovered by inverting the ingest's own colour–temperature fit (tools/ingest/gaia.mjs teffBPRP:
// 5040/T = 0.4929 + 0.5092 C − 0.0353 C²), which is exact for rows whose Teff came from that fit. Hp is kept as ≈ V
// (|Hp − V| ≲ 0.2 mag for B − V < 1.5, ESA 1997 Vol. 1 §1.3) and labelled so.
export function bprpFromTeff(T: number): number {
  const th = 5040 / Math.max(2300, Math.min(40000, T)), a = -0.0353, b = 0.5092, c = 0.4929 - th;
  const disc = b * b - 4 * a * c; if (disc < 0) return 4.5;
  return Math.max(-0.4, Math.min(4.5, (-b + Math.sqrt(disc)) / (2 * a)));
}
/** G − V for Gaia colour C = BP − RP (Riello et al. 2021) */
export function gMinusV(C: number): number { const c = Math.max(-0.5, Math.min(5, C)); return -0.02704 + 0.01424 * c - 0.2156 * c * c + 0.01426 * c * c * c; }
export type Band = 'G' | 'Hp';
export function rowBand(flags: number): Band { return (flags & 2) ? 'Hp' : 'G'; }
/** Johnson V absolute magnitude from a catalogue row's (M, Teff, flags) */
export function rowMV(M: number, T: number, flags: number): number { return rowBand(flags) === 'Hp' ? M : M - gMinusV(bprpFromTeff(T)); }
