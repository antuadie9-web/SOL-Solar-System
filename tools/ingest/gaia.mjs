// Build SOL's 3D star catalogue (Phase 7/8 first slice, milestone S1 "true-scale nearby stars + bright stars").
//
// Sources (provenance written to public/assets/catalogs/stars/manifest.json):
//  • Gaia Catalogue of Nearby Stars (GCNS; Gaia Collaboration, Smart et al. 2021, A&A 649, A6; VizieR J/A+A/649/A6/table1c)
//      — 331,291 sources within 100 pc with GCNSprob > 0.38 (the catalogue's own membership threshold) and Bayesian
//      distance posteriors (Dist16/50/84); Gaia EDR3 astrometry (identical to DR3 astrometry).
//  • optional: Gaia DR3 gaia_source bright-star query (G < 9, 0.1 < ϖ ≤ 10 mas, ϖ/σϖ > 5) when available
//  • Hipparcos new reduction (van Leeuwen 2007, VizieR I/311/hip2) — Hp < 6.5 stars that Gaia DR3 lacks or saturates
//    (Sirius, α Cen A/B, Vega, …), added only when no Gaia source of similar brightness lies within 90″.
// Distances: GCNS posterior medians (Dist50); others 1/parallax with ϖ/σϖ > 5 (DERIVED). Positions are epoch J2016.0
// (Gaia) / J1991.25 (Hipparcos, propagated to J2016.0 with its proper motion); the runtime applies space motion linearly.
// Teff: Gaia GSP-Phot when present, else Mucciarelli & Bellazzini (2020) BP−RP colour–Teff relation (dwarfs, E(B−V)=0);
// Hipparcos stars: Ballesteros (2012) B−V formula. Output frame: J2000 ecliptic (SOL scene frame), parsecs.
//
// Record (Float32 ×10): x, y, z [pc], vx, vy, vz [pc/yr], M (absolute G or Hp mag), Teff [K], flags, distErrFrac
//   flags bit0 = has radial velocity, bit1 = Hipparcos-sourced, bit2 = RUWE > 1.4 (possible binary / poor astrometry), bit3 = white dwarf (GCNS WDprob > 0.5)
// Usage: node tools/ingest/gaia.mjs <gcns.csv> <hip.csv> [gaiaB.csv]   (CSV as returned by the TAP queries in docs/science/stars.md)
import fs from 'node:fs';
import crypto from 'node:crypto';
const [fg, fh, fb] = process.argv.slice(2);
const EPS = 84381.406 / 3600 * Math.PI / 180, ce = Math.cos(EPS), se = Math.sin(EPS), D = Math.PI / 180;
const KMS_TO_PCYR = 1 / 977792.2; // 1 km/s = 1.0227e-6 pc/yr
const csv = f => { const [h, ...rows] = fs.readFileSync(f, 'utf8').trim().split('\n'); const k = h.split(','); return rows.map(r => { const c = r.split(','); const o = {}; k.forEach((n, i) => o[n.replace(/"/g, '')] = c[i] === '' ? null : c[i]); return o; }); };
const teffBPRP = c => { if (c == null || !Number.isFinite(c)) return 5800; c = Math.max(-0.4, Math.min(4.5, c)); const th = 0.4929 + 0.5092 * c - 0.0353 * c * c; return Math.max(2300, Math.min(40000, 5040 / th)); };
const teffBV = bv => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
function vec(raDeg, decDeg, distPc, pmra, pmdec, rv) { // ICRS → ecliptic J2000; pm in mas/yr (pmra includes cos δ)
  const a = raDeg * D, d = decDeg * D, ca = Math.cos(a), sa = Math.sin(a), cd = Math.cos(d), sd = Math.sin(d);
  const p = [cd * ca, cd * sa, sd], e = [-sa, ca, 0], n = [-sd * ca, -sd * sa, cd];
  const vt = 4.740470446 / 1000 * distPc; // km/s per mas/yr
  const v = [0, 1, 2].map(i => (e[i] * (pmra ?? 0) * vt + n[i] * (pmdec ?? 0) * vt + p[i] * (rv ?? 0)) * KMS_TO_PCYR);
  const ecl = u => [u[0], ce * u[1] + se * u[2], -se * u[1] + ce * u[2]];
  return { pos: ecl(p.map(x => x * distPc)), vel: ecl(v), dir: p };
}
const out = []; const gaiaDirs = [];
let nA = 0, nB = 0, nH = 0;
for (const r of csv(fg)) {   // GCNS (100 pc)
  const dist = +r.Dist50 * 1000, G = +r.Gmag; if (!(dist > 0) || !Number.isFinite(G)) continue;
  const { pos, vel, dir } = vec(+r.RA_ICRS, +r.DE_ICRS, dist, +r.pmRA, +r.pmDE, r.RV == null ? 0 : +r.RV);
  const bprp = r.BPmag != null && r.RPmag != null ? +r.BPmag - +r.RPmag : null;
  const teff = +r.WDprob > 0.5 ? Math.max(5000, teffBPRP(bprp)) : teffBPRP(bprp);
  const flags = (r.RV != null ? 1 : 0) | ((+r.RUWE > 1.4) ? 4 : 0) | (+r.WDprob > 0.5 ? 8 : 0);
  out.push([...pos, ...vel, G - 5 * Math.log10(dist / 10), teff, flags, (+r.Dist84 - +r.Dist16) / 2 / +r.Dist50]);
  gaiaDirs.push({ dir, G, i: out.length - 1 }); nA++;
}
if (fb) for (const r of csv(fb)) {   // optional Gaia DR3 bright-star query
  const plx = +r.parallax, dist = 1000 / plx, G = +r.phot_g_mean_mag; if (!(plx > 0) || plx > 10 || !Number.isFinite(G)) continue;
  const { pos, vel, dir } = vec(+r.ra, +r.dec, dist, +r.pmra, +r.pmdec, r.radial_velocity == null ? 0 : +r.radial_velocity);
  const teff = r.teff_gspphot ? +r.teff_gspphot : teffBPRP(r.bp_rp == null ? null : +r.bp_rp);
  out.push([...pos, ...vel, G + 5 * Math.log10(plx) - 10, teff, (r.radial_velocity != null ? 1 : 0) | ((+r.ruwe > 1.4) ? 4 : 0), +r.parallax_error / plx]);
  gaiaDirs.push({ dir, G, i: out.length - 1 }); nB++;
}
// spatial hash on the sphere for the Hipparcos cross-check
const cell = d => `${Math.floor((Math.atan2(d[1], d[0]) + Math.PI) / 0.02)},${Math.floor((Math.asin(d[2]) + Math.PI / 2) / 0.02)}`;
const grid = new Map(); for (const g of gaiaDirs) { const k = cell(g.dir); (grid.get(k) ?? grid.set(k, []).get(k)).push(g); }
const near = (d, Hp) => { const [i, j] = cell(d).split(',').map(Number); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const g of grid.get(`${i + a},${j + b}`) ?? []) { const c = g.dir[0] * d[0] + g.dir[1] * d[1] + g.dir[2] * d[2]; if (c > Math.cos(90 / 206265) && Math.abs(g.G - Hp) < 1.2) return true; } return false; };
// Literature overrides where Hipparcos is known to be poor (documented, cited):
//  α Cen A (HIP 71683) and B (HIP 71681): system parallax 750.81 ± 0.38 mas (Akeson et al. 2021, AJ 162, 14) — the
//  Hipparcos 2007 value for B (796.92 mas) is biased by binarity.
const PLX_OVERRIDE = { '71683': [750.81, 0.38], '71681': [750.81, 0.38] };
for (const r of csv(fh)) {
  if (PLX_OVERRIDE[r.HIP]) { r.Plx = String(PLX_OVERRIDE[r.HIP][0]); r.e_Plx = String(PLX_OVERRIDE[r.HIP][1]); }
  const plx = +r.Plx, Hp = +r.Hpmag; if (!(plx > 0) || +r.e_Plx > plx / 5) continue;
  const raDeg = +r.RArad, decDeg = +r.DErad, dist = 1000 / plx; // VizieR columns RArad/DErad are degrees (J1991.25)
  const dt = 2016.0 - 1991.25, dec2 = decDeg + (+r.pmDE) / 3.6e6 * dt, ra2 = raDeg + (+r.pmRA) / 3.6e6 * dt / Math.cos(decDeg * D);
  const { pos, vel, dir } = vec(ra2, dec2, dist, +r.pmRA, +r.pmDE, 0);
  if (near(dir, Hp)) continue;
  out.push([...pos, ...vel, Hp + 5 * Math.log10(plx) - 10, teffBV(+r['B-V']), 2, +r.e_Plx / plx]); nH++;
}
// names: IAU-style common names (bundled starnames.json: [name, ra, dec, Vmag, dist pc]) matched by direction + distance
const names = JSON.parse(fs.readFileSync('public/assets/data/starnames.json', 'utf8'));
const named = []; const usedIdx = new Set();
// brightest first so a bright primary claims its own record before a fainter companion name can
for (const [name, ra, dec, mag, dpc] of [...names].sort((a, b) => a[3] - b[3])) {
  const { pos } = vec(ra, dec, 1, 0, 0, 0); let best = -1, bs = 1e9;
  for (let i = 0; i < out.length; i++) {
    const o = out[i], r = Math.hypot(o[0], o[1], o[2]), c = (o[0] * pos[0] + o[1] * pos[1] + o[2] * pos[2]) / r;
    if (c < Math.cos(0.1 * D) || usedIdx.has(i)) continue; const s = (1 - c) * 1e6 + Math.abs(Math.log(r / dpc)) * 5; if (s < bs) { bs = s; best = i; }
  }
  if (best >= 0) usedIdx.add(best);
  if (best >= 0) named.push({ name, index: best, distPc: +Math.hypot(...out[best].slice(0, 3)).toFixed(4) });
}
const F = new Float32Array(out.length * 10); out.forEach((o, i) => F.set(o, i * 10));
const dir = 'public/assets/catalogs/stars'; fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/stars3d.bin`, Buffer.from(F.buffer));
fs.writeFileSync(`${dir}/named.json`, JSON.stringify(named));
fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify({
  format: 'SOL stars3d v1: Float32 x10 [x,y,z pc; vx,vy,vz pc/yr; M; Teff; flags; σd/d], J2000 ecliptic, epoch J2016.0',
  count: out.length, gcns_d100pc: nA, gaiaB_bright: nB, hipparcosFill: nH, named: named.length,
  sources: ['Gaia Catalogue of Nearby Stars — Gaia Collaboration, Smart et al. 2021, A&A 649, A6 (VizieR J/A+A/649/A6) via https://tapvizier.cds.unistra.fr; Gaia data CC BY-SA 3.0 IGO', 'Hipparcos new reduction, van Leeuwen 2007 (VizieR I/311/hip2) via https://tapvizier.cds.unistra.fr'],
  cuts: { gcns: 'GCNSprob > 0.38 (catalogue definition)', B: 'G < 9 AND 0.1 < parallax <= 10 AND parallax_over_error > 5', hip: 'Hp < 6.5, Plx/e_Plx > 5, no Gaia match within 90″ and 1.2 mag' },
  truth: 'positions OBSERVED (astrometry); distances DERIVED (GCNS Bayesian posterior medians; Hipparcos 1/parallax); Teff DERIVED; completeness: Gaia DR3 incompleteness at G<3 and in crowded fields',
  built: new Date().toISOString(), sha256: crypto.createHash('sha256').update(Buffer.from(F.buffer)).digest('hex'),
}, null, 1));
console.log({ count: out.length, nA, nB, nH, named: named.length });
