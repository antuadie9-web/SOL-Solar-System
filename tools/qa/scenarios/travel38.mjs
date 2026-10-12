// SOL v3.8 travel-stutter profiling scenario (spec §38–39). Scripted journey through many first-visit destinations with
// main-thread instrumentation that needs NO app changes (so v3.7.0 and v3.8 builds are measured identically):
//   • PerformanceObserver 'longtask' (main-thread tasks > 50 ms) with timestamps
//   • per-frame CPU time of engine.render() and of the whole rAF callback interval
//   • attribution hooks: engine.getView (per-body view construction, incl. atmosphere LUT builds and material creation),
//     engine.loadTerrain, and counts of new views per frame
// In software WebGPU the GPU work runs in Chromium's GPU process; main-thread numbers (JS + three.js node→WGSL compilation +
// synchronous resource creation) are meaningful, absolute frame rates are NOT (SwiftShader). See the performance report.
import fs from 'node:fs';
import path from 'node:path';
export const LEGS = [
  ['jupiter', 7], ['io', 6], ['europa', 5], ['saturn', 7], ['titan', 6], ['enceladus', 5], ['uranus', 7], ['miranda', 5], ['neptune', 7], ['triton', 5],
  ['pluto', 7], ['vesta', 6], ['cg67p', 6], ['mars', 6], ['phobos', 5], ['venus', 6], ['earth', 6], ['jupiter', 6], ['saturn', 6],
];
export default async function (page, { out }) {
  const legs = process.env.LEGS ? process.env.LEGS.split(',').map(x => [x.split(':')[0], +(x.split(':')[1] ?? 6)]) : LEGS;
  await page.evaluate(() => {
    const s = window.__sol, e = s.engine, P = window.__perf = { frames: [], long: [], views: [], terrain: [], marks: [] };
    document.querySelector('#loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    try { new PerformanceObserver(l => { for (const t of l.getEntries()) P.long.push({ t: t.startTime, d: t.duration }); }).observe({ type: 'longtask', buffered: true }); } catch (err) { P.longErr = String(err); }
    const gv = e.getView.bind(e); e.getView = (b) => { const t0 = performance.now(); const v = gv(b); P.views.push({ t: t0, id: b.id, ms: performance.now() - t0 }); return v; };
    if (e.loadTerrain) { const lt = e.loadTerrain.bind(e); e.loadTerrain = async (v) => { const t0 = performance.now(); const r = await lt(v); P.terrain.push({ t: t0, id: v.body?.id, ms: performance.now() - t0 }); return r; }; }
    const rd = e.render.bind(e); let lastEnd = performance.now();
    e.render = (dt) => { const t0 = performance.now(); rd(dt); const t1 = performance.now(); P.frames.push({ t: t0, cpu: t1 - t0, gap: t0 - lastEnd, target: e.rig.target?.id ?? null, flying: e.rig.flying }); lastEnd = t1; };
  });
  const t0 = Date.now();
  for (const [id, sec] of legs) {
    await page.evaluate((id) => { const s = window.__sol, b = s.sys.get(id); window.__perf.marks.push({ t: performance.now(), leg: id }); s.ui.select(b, true); }, id);
    await page.waitForTimeout(sec * 1000);
  }
  const P = await page.evaluate(() => window.__perf);
  // frame interval = time between successive render() starts (what the user perceives as a hitch)
  const iv = []; for (let i = 1; i < P.frames.length; i++) iv.push(P.frames[i].t - P.frames[i - 1].t);
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] : null; };
  const cpu = P.frames.map(f => f.cpu);
  const summary = { legs: legs.map(l => l[0]), wallMs: Date.now() - t0, frames: P.frames.length,
    intervalMs: { median: q(iv, 0.5), p95: q(iv, 0.95), p99: q(iv, 0.99), max: Math.max(...iv) },
    renderCpuMs: { median: q(cpu, 0.5), p95: q(cpu, 0.95), p99: q(cpu, 0.99), max: Math.max(...cpu) },
    longTasks: { count: P.long.length, totalMs: P.long.reduce((a, b) => a + b.d, 0), over100: P.long.filter(x => x.d > 100).length, over250: P.long.filter(x => x.d > 250).length, max: P.long.reduce((a, b) => Math.max(a, b.d), 0) },
    views: { count: P.views.length, totalMs: P.views.reduce((a, b) => a + b.ms, 0), max: P.views.reduce((a, b) => Math.max(a, b.ms), 0), worst: [...P.views].sort((a, b) => b.ms - a.ms).slice(0, 12) },
    terrain: P.terrain };
  fs.writeFileSync(path.join(out, 'travel-perf.json'), JSON.stringify({ summary, raw: P }, null, 0));
  console.error(JSON.stringify(summary, null, 1));
  return summary;
}
