// v3.8: CPU profile (Chrome DevTools Protocol) of first-time view construction for the bodies in PROF_IDS (default saturn).
// Writes <out>/cpuprofile-<id>.cpuprofile (loadable in Chrome DevTools) and a top-self-time summary.
import fs from 'node:fs'; import path from 'node:path';
export default async function (page, { out }) {
  const ids = (process.env.PROF_IDS || 'saturn').split(',');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  const res = {};
  for (const id of ids) {
    await cdp.send('Profiler.start');
    const ms = await page.evaluate((id) => { const s = window.__sol, b = s.sys.get(id); const t0 = performance.now(); s.engine.getView(b); return performance.now() - t0; }, id);
    const { profile } = await cdp.send('Profiler.stop');
    fs.writeFileSync(path.join(out, `cpuprofile-${id}.cpuprofile`), JSON.stringify(profile));
    const self = new Map(); const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map(n => [n.id, n]));
    profile.samples.forEach((sid, i) => { const n = byId.get(sid); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0) / 1000); });
    res[id] = { getViewMs: ms, topSelfMs: [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15) };
  }
  fs.writeFileSync(path.join(out, 'cpuprof.json'), JSON.stringify(res, null, 1));
  console.error(JSON.stringify(res, null, 1));
  return res;
}
