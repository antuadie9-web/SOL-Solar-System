// SOL v3.8.1 Gate 1 — deterministic star-centroid stability trace (WP-B "reproduce first").
// Run: npm run qa:stars   (bundled with esbuild; reads the shipped named-star extract, no browser needed)
//
// For each scenario the camera follows a deterministic double-precision path (orbit-mode zoom toward a selected star,
// lateral translation, a stationary camera with simulation time running) exactly like CameraRig does (camera looks at
// the star's float64 position). Each frame the star's projected position is computed three ways:
//   ref    — double precision from the float32 catalogue row (the truth the camera aims at)
//   legacy — v3.8.0 GPU arithmetic (single float32 camera uniform), emulated with Math.fround
//   split  — v3.8.1 GPU arithmetic (hi/lo camera + reordered subtraction)
// Reported: max and RMS direction error in pixels (1920×1080, vertical FOV 50°) and the frame-to-frame jitter, i.e.
// the RMS of the second difference of the error (a smooth constant offset is not jitter; snapping is).
import fs from 'node:fs';
import { relLegacyF32, relSplitF32, relRef, dirErrorPx, V3 } from '../../src/galaxy/starPrecision';

const AU = 149597870.7, PC = 3.0856775814913673e13, AU_PC = AU / PC;
const named: { name: string; index: number; distPc: number }[] = JSON.parse(fs.readFileSync('public/assets/catalogs/stars/named.json', 'utf8'));
const rows = new Float32Array(fs.readFileSync('public/assets/catalogs/stars/named-rows.bin').buffer.slice(0));
const row = (name: string) => { const j = named.findIndex(n => n.name === name); const r = rows.subarray(j * 10, j * 10 + 10); return { sP: [r[0], r[2], -r[1]] as V3, sV: [r[3], r[5], -r[4]] as V3 }; };
const H = 1080, FOV = 50, JD0 = 2461326.5; // 2026-10-12
const years = (jd: number) => (jd - 2457389.0) / 365.25;

type Sample = { cam: V3; jd: number };
function measure(star: { sP: V3; sV: V3 }, path: Sample[]) {
  const out: Record<string, { max: number; rms: number; jitter: number; maxStep: number }> = {};
  for (const scheme of ['legacy', 'split'] as const) {
    const err: number[] = [], sx: number[] = [], sy: number[] = [];
    for (const s of path) {
      const y = years(s.jd);
      const ref = relRef(star.sP, star.sV, y, s.cam);
      const rel = scheme === 'legacy' ? relLegacyF32(star.sP, star.sV, y, s.cam) : relSplitF32(star.sP, star.sV, y, s.cam);
      err.push(dirErrorPx(rel, ref, FOV, H));
      // signed screen-plane error components in a frame built around the reference direction
      const n = Math.hypot(...ref), d = ref.map(x => x / n) as V3, up: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const ex = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const ne = Math.hypot(...ex); for (let i = 0; i < 3; i++) ex[i] /= ne;
      const ey = [d[1] * ex[2] - d[2] * ex[1], d[2] * ex[0] - d[0] * ex[2], d[0] * ex[1] - d[1] * ex[0]];
      const nr = Math.hypot(...rel), pxAng = 2 * Math.tan(FOV * Math.PI / 360) / H;
      sx.push((rel[0] * ex[0] + rel[1] * ex[1] + rel[2] * ex[2]) / nr / pxAng); sy.push((rel[0] * ey[0] + rel[1] * ey[1] + rel[2] * ey[2]) / nr / pxAng);
    }
    let j2 = 0, nj = 0, maxStep = 0;
    for (let i = 1; i < sx.length - 1; i++) { const ax = sx[i + 1] - 2 * sx[i] + sx[i - 1], ay = sy[i + 1] - 2 * sy[i] + sy[i - 1]; j2 += ax * ax + ay * ay; nj++; }
    for (let i = 1; i < sx.length; i++) maxStep = Math.max(maxStep, Math.hypot(sx[i] - sx[i - 1], sy[i] - sy[i - 1]));
    out[scheme] = { max: Math.max(...err), rms: Math.sqrt(err.reduce((a, b) => a + b * b, 0) / err.length), jitter: Math.sqrt(j2 / Math.max(1, nj)), maxStep };
  }
  return out;
}
const at = (star: { sP: V3; sV: V3 }, jd: number, offAU: number, dir: V3): V3 => { const y = years(jd); return [0, 1, 2].map(i => star.sP[i] + star.sV[i] * y + dir[i] * offAU * AU_PC) as V3; };
const DIR: V3 = (() => { const v = [0.31, 0.62, -0.72]; const n = Math.hypot(...v); return v.map(x => x / n) as V3; })();
const report: any[] = [];
for (const name of ['Proxima Centauri', 'Sirius']) {
  const s = row(name);
  // (1) stationary camera at fixed offsets, simulation running 1 h per frame (target moves with its proper motion)
  for (const off of [50, 5, 1, 0.1]) {
    const path = Array.from({ length: 240 }, (_, k) => { const jd = JD0 + k / 24; return { jd, cam: at(s, jd, off, DIR) }; });
    report.push({ star: name, scenario: `orbit-hold ${off} AU (sim +1 h/frame)`, ...measure(s, path) });
  }
  // (2) orbit-mode zoom: log-distance 50 AU → 0.05 AU over 300 frames (paused simulation)
  { const path = Array.from({ length: 300 }, (_, k) => ({ jd: JD0, cam: at(s, JD0, 50 * Math.pow(0.001, k / 299), DIR) })); report.push({ star: name, scenario: 'zoom 50 → 0.05 AU (paused)', ...measure(s, path) }); }
  // (3) slow lateral translation at 20 AU (orbit drag: 0.05°/frame around the star)
  { const path = Array.from({ length: 300 }, (_, k) => { const a = k * 0.05 * Math.PI / 180, d: V3 = [DIR[0] * Math.cos(a) - DIR[2] * Math.sin(a), DIR[1], DIR[0] * Math.sin(a) + DIR[2] * Math.cos(a)]; return { jd: JD0, cam: at(s, JD0, 20, d) }; });
    report.push({ star: name, scenario: 'orbit drag at 20 AU (0.05°/frame)', ...measure(s, path) }); }
}
const fmt = (x: number) => x < 0.001 ? x.toExponential(1) : x.toFixed(3);
console.log('star | scenario | v3.8.0 max px | v3.8.0 jitter px | v3.8.1 max px | v3.8.1 jitter px');
for (const r of report) console.log(`${r.star} | ${r.scenario} | ${fmt(r.legacy.max)} | ${fmt(r.legacy.jitter)} | ${fmt(r.split.max)} | ${fmt(r.split.jitter)}`);
fs.mkdirSync('docs/qa/v3.8.1', { recursive: true });
fs.writeFileSync('docs/qa/v3.8.1/star-stability-trace.json', JSON.stringify({ generated: new Date().toISOString(), viewport: [1920, 1080], fovDeg: FOV, jd0: JD0, report }, null, 2));
