// SOL v3.8 release boot check (run from a CLEAN EXTRACTION's production build): the application initialises, loads its
// required resources and renders the Sun, Saturn (rings) and Proxima Centauri. smoke.mjs already records failed requests,
// HTTP >= 400 responses, page errors and WGSL/GPU validation errors; this scenario adds per-view frame counts, the loader
// stage list, the resources loaded and a screenshot per view.
import fs from 'node:fs'; import path from 'node:path';
export default async function (page, { out, log }) {
  const res = { stages: await page.evaluate(() => [...document.querySelectorAll('#ld-stages li')].map(li => li.dataset.st + ':' + li.className)), views: [] };
  await page.evaluate(() => { document.querySelector('#loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.body.classList.remove('cine'); window.__sol.clock.paused = true; });
  const frames = (n) => page.evaluate((n) => new Promise(r => { const f0 = window.__frames; const c = () => { window.__sol.engine.settleExposure(); window.__frames - f0 >= n ? r(window.__frames - f0) : requestAnimationFrame(c); }; c(); }), n);
  for (const [name, id] of [['boot-sun', 'sun'], ['boot-saturn', 'saturn'], ['boot-proxima', 'star:proxima-centauri']]) {
    const f0 = await page.evaluate(() => window.__frames);
    const ok = await page.evaluate((id) => { const s = window.__sol, b = s.sys.get(id); if (!b) return false; s.ui.select(b, true); const f = s.engine.rig.flight; if (f) f.t0 = performance.now() - f.dur * 1.01; return true; }, id);
    await frames(8); await page.waitForTimeout(id.startsWith('star') ? 2500 : 800); await frames(4);
    const st = await page.evaluate((id) => { const s = window.__sol, e = s.engine, d = e.diagnostics(); return { selected: s.ui.sel?.id, viewBuilt: e.views?.has ? e.views.has(id) : null, exposureEV: d.exposureEV, catalog: window.__solStars ? window.__solStars.counts() : null, finite: s.engine.rig.pos.every(Number.isFinite) }; }, id);
    const f1 = await page.evaluate(() => window.__frames);
    try { await page.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 }); } catch (e) { log.push('[boot38] screenshot timed out for ' + name + ' (software adapter)'); }
    res.views.push({ name, id, found: ok, framesRendered: f1 - f0, ...st });
  }
  res.resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({ n: r.name.replace(location.origin, ''), b: r.transferSize || r.encodedBodySize || 0 })));
  res.resourceCount = res.resources.length; res.resourceBytes = res.resources.reduce((a, r) => a + r.b, 0);
  res.resources = res.resources.map(r => r.n).filter(n => /assets\//.test(n)).slice(0, 400);
  fs.writeFileSync(path.join(out, 'boot38.json'), JSON.stringify(res, null, 1));
  return { views: res.views, resourceCount: res.resourceCount, resourceBytes: res.resourceBytes };
}
