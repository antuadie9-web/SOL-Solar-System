// SOL v3.8.1 (WP-J, PERF-381-01) — in-app real-hardware benchmark. Open the app with `?bench=1` in desktop Chrome.
//
// Purpose: give the owner a one-click, reproducible measurement on the RTX 3050 laptop (or any desktop GPU) that the
// agent's software-WebGPU sandbox cannot produce. Nothing here changes rendering, quality or settings; it drives the same
// camera API the UI uses and records what happened. The report is downloaded as JSON and summarised on screen.
//
// Phases (deterministic): idle at Earth · cold first-visit travel (7 legs) · the same legs again (warm) · interstellar
// Earth → Proxima → Earth · a Sun-in/out-of-frame pan at 1 AU · star-field hold + zoom at 50 AU from Proxima.
// Per frame: requestAnimationFrame interval, engine.render() CPU time, GPU time (WebGPU timestamp queries, when the adapter
// exposes 'timestamp-query'), target/flight state, sky/scene EV. Plus long tasks (PerformanceObserver), JS heap where
// Chrome exposes it, texture residency and the adapter/driver description.
export interface BenchFrame { t: number; iv: number; cpu: number; gpu: number | null; phase: string; flying: boolean; sceneEV: number; skyEV: number }
type Sol = any;
const q = (a: number[], p: number) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)].toFixed(2); };
export function summarise(frames: BenchFrame[], phase?: string) {
  const f = phase ? frames.filter(x => x.phase === phase) : frames;
  const iv = f.map(x => x.iv).filter(x => x > 0), cpu = f.map(x => x.cpu), gpu = f.map(x => x.gpu).filter((x): x is number => x !== null && x >= 0);
  return { frames: f.length, fps: iv.length ? +(1000 / (iv.reduce((a, b) => a + b, 0) / iv.length)).toFixed(1) : null,
    intervalMs: { p50: q(iv, 0.5), p95: q(iv, 0.95), p99: q(iv, 0.99), max: iv.length ? +Math.max(...iv).toFixed(1) : null, over33: iv.filter(x => x > 33.4).length, over50: iv.filter(x => x > 50).length, over100: iv.filter(x => x > 100).length },
    cpuMs: { p50: q(cpu, 0.5), p95: q(cpu, 0.95), p99: q(cpu, 0.99), max: cpu.length ? +Math.max(...cpu).toFixed(1) : null },
    gpuMs: gpu.length ? { p50: q(gpu, 0.5), p95: q(gpu, 0.95), p99: q(gpu, 0.99), max: +Math.max(...gpu).toFixed(2), samples: gpu.length } : null };
}
export async function runBenchmark(sol: Sol) {
  const { engine: e, sys, ui, settings } = sol;
  const frames: BenchFrame[] = [], long: { t: number; d: number }[] = [];
  let phase = 'boot', last = performance.now(), gpuPending = false, lastGpu: number | null = null;
  const box = document.createElement('div');
  box.setAttribute('role', 'status');
  box.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:99999;padding:10px 16px;border-radius:10px;background:rgba(8,9,12,.82);color:#f3efe6;font:13px/1.4 Inter,system-ui,sans-serif;border:1px solid rgba(255,255,255,.14);max-width:90vw;text-align:center';
  document.body.appendChild(box);
  const say = (s: string) => { box.textContent = 'SOL benchmark — please do not touch the mouse or keyboard · ' + s; };
  try { new PerformanceObserver(l => { for (const t of l.getEntries()) long.push({ t: t.startTime, d: t.duration }); }).observe({ type: 'longtask', buffered: true } as any); } catch { /* not supported */ }
  const hasTs = !!(e.renderer?.backend?.trackTimestamp);
  const rd = e.render.bind(e);
  e.render = (dt: number) => {
    const t0 = performance.now(); rd(dt); const t1 = performance.now();
    const view = e.diagnostics?.()?.view ?? {};
    frames.push({ t: t0, iv: t0 - last, cpu: t1 - t0, gpu: lastGpu, phase, flying: !!e.rig.flying, sceneEV: view.sceneEV ?? 0, skyEV: view.skyEV ?? 0 });
    last = t0; lastGpu = null;
    if (hasTs && !gpuPending) { gpuPending = true; e.renderer.resolveTimestampsAsync('render').then((ms: number) => { lastGpu = typeof ms === 'number' ? ms : null; gpuPending = false; }).catch(() => { gpuPending = false; }); }
  };
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  const goTo = async (id: string, sec: number) => { const b = sys.get(id); if (!b) return; ui.select(b, true); await wait(sec * 1000); };
  document.querySelector('#loader .ld-enter, #loader .enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await wait(1500);
  const LEGS: [string, number][] = [['jupiter', 7], ['saturn', 7], ['titan', 6], ['enceladus', 6], ['neptune', 7], ['pluto', 7], ['earth', 7]];
  phase = 'idle-earth'; say('idle at Earth (1/6)'); await goTo('earth', 6);
  phase = 'travel-cold'; say('first-visit travel (2/6)'); for (const [id, s] of LEGS) await goTo(id, s);
  phase = 'travel-warm'; say('repeat travel (3/6)'); for (const [id, s] of LEGS) await goTo(id, s);
  phase = 'interstellar'; say('Earth → Proxima Centauri → Earth (4/6)');
  const prox = sys.bodies.find((b: any) => b.name === 'Proxima Centauri');
  if (prox) { ui.select(prox, true); await wait(14000); }
  await goTo('earth', 14);
  phase = 'sun-pan'; say('Sun in/out of frame at 1 AU (5/6)');
  { const r = e.rig, sun = sys.sun, earth = sys.get('earth'); r.flight = null; ui.following = false; r.mode = 'free'; r.freeVel = [0, 0, 0];
    const d = [earth.pos[0] - sun.pos[0], earth.pos[1] - sun.pos[1], earth.pos[2] - sun.pos[2]], l = Math.hypot(...d);
    const pos = [sun.pos[0] + d[0] / l * 1.4959787e8, sun.pos[1] + d[1] / l * 1.4959787e8, sun.pos[2] + d[2] / l * 1.4959787e8 + 3e7];
    const t0 = performance.now();
    while (performance.now() - t0 < 12000) { const a = ((performance.now() - t0) / 12000) * 2 * Math.PI; const side = [-d[1] / l, d[0] / l, 0];
      const tgt = [sun.pos[0] + side[0] * Math.sin(a) * 1.5e8, sun.pos[1] + side[1] * Math.sin(a) * 1.5e8, sun.pos[2]]; r.pos = pos; r.quat.copy(r.lookQuat(pos, tgt, [0, 0, 1])); await wait(16); } }
  phase = 'proxima-zoom'; say('star field near Proxima: hold and zoom (6/6)');
  if (prox) { ui.select(prox, true); await wait(14000); const r = e.rig; for (let k = 0; k < 120; k++) { r.zoom(-40); await wait(25); } await wait(3000); }
  phase = 'done';
  e.render = rd;
  const gpu = e.gpuInfo ?? (window as any).__solGpu ?? null;
  const mem = (performance as any).memory ? { usedJSHeapMiB: +((performance as any).memory.usedJSHeapSize / 1048576).toFixed(1), limitMiB: +((performance as any).memory.jsHeapSizeLimit / 1048576).toFixed(1) } : null;
  const phases = ['idle-earth', 'travel-cold', 'travel-warm', 'interstellar', 'sun-pan', 'proxima-zoom'];
  const report = {
    sol: { version: (window as any).__solVersion, commit: (window as any).__solCommit }, created: new Date().toISOString(),
    evidenceClass: gpu?.fallback ? 'SOFTWARE ADAPTER — not hardware evidence' : 'HARDWARE (owner machine)',
    environment: { userAgent: navigator.userAgent, adapter: gpu, timestampQuery: hasTs, devicePixelRatio: devicePixelRatio, canvas: [e.renderer.domElement.width, e.renderer.domElement.height],
      window: [innerWidth, innerHeight], settings: { quality: settings.get('quality'), renderScale: settings.get('renderScale'), viewMode: settings.get('viewMode'), hiTextures: settings.get('hiTextures'), bloom: settings.get('bloom') } },
    summary: Object.fromEntries(phases.map(p => [p, summarise(frames, p)])), overall: summarise(frames.filter(f => f.phase !== 'boot')),
    longTasks: { count: long.length, totalMs: +long.reduce((a, b) => a + b.d, 0).toFixed(0), over100: long.filter(x => x.d > 100).length, over250: long.filter(x => x.d > 250).length, worst: [...long].sort((a, b) => b.d - a.d).slice(0, 15) },
    memory: mem, diagnostics: e.diagnostics?.() ?? null, frames,
  };
  const blob = new Blob([JSON.stringify(report)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sol-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.textContent = 'Download the benchmark report (JSON)'; a.style.cssText = 'color:#f2c27b;display:block;margin-top:6px';
  const o = report.overall;
  box.innerHTML = '';
  const h = document.createElement('div'); h.textContent = `SOL benchmark finished · ${report.evidenceClass} · overall ${o.fps ?? '–'} fps · frame p95 ${o.intervalMs.p95 ?? '–'} ms · p99 ${o.intervalMs.p99 ?? '–'} ms · hitches >100 ms: ${o.intervalMs.over100}` + (o.gpuMs ? ` · GPU p95 ${o.gpuMs.p95} ms` : ' · GPU timing unavailable');
  box.appendChild(h); box.appendChild(a); a.click();
  (window as any).__solBench = report;
  return report;
}
