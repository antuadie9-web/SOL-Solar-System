export default async function (page) {
  await page.evaluate(() => { document.querySelector('#loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.mouse.move(800, 450); await page.mouse.move(805, 452); await page.waitForTimeout(800);
  const st = () => page.evaluate(() => { const u = window.__sol.ui, e = window.__sol.engine, lh = u.lastHover, p = lh ? u.pick(lh[0], lh[1]) : null, es = e.screen.get('earth');
    return { lastHover: lh, tipOn: u.tip.classList.contains('on'), tip: u.tip.textContent, pick: p?.id, earth: es && { x: Math.round(es.x), y: Math.round(es.y), vis: es.vis, r: es.r }, hoverTick: u.hoverTick, now: performance.now() }; });
  const a = await st();
  await page.evaluate(() => { const s = window.__sol; s.ui.select(s.sys.get('star:proxima-centauri'), true); const f = s.engine.rig.flight; if (f) f.t0 = performance.now() - f.dur * 1.01; });
  await page.waitForTimeout(4000); const b = await st();
  console.error(JSON.stringify({ a, b })); return { a, b };
}
