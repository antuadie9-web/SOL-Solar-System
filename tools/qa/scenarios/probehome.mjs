export default async function (page) {
  await page.evaluate(() => { document.querySelector('#loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); const s = window.__sol; s.ui.select(s.sys.get('star:proxima-centauri'), true); const f = s.engine.rig.flight; if (f) f.t0 = performance.now() - f.dur * 1.01; });
  await page.waitForTimeout(1500);
  const st = () => page.evaluate(() => { const s = window.__sol; return { sel: s.ui.sel?.id, mode: s.engine.rig.mode, flying: s.engine.rig.flying, active: document.activeElement?.tagName + ':' + (document.activeElement?.getAttribute('aria-label') || ''), overlays: [...document.querySelectorAll('.overlay.open')].map(x => x.id) }; });
  const a = await st(); await page.mouse.click(800, 450); await page.keyboard.press('Home'); await page.waitForTimeout(400); const b = await st();
  await page.keyboard.press('KeyM'); await page.keyboard.press('Home'); await page.waitForTimeout(400); const c = await st();
  console.error(JSON.stringify({ a, b, c })); return { a, b, c };
}
