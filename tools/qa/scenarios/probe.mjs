export default async function (page) {
  await page.evaluate(() => document.querySelector('#loader .enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const fr = []; for (let i = 0; i < 8; i++) { await page.waitForTimeout(5000); fr.push(await page.evaluate(() => window.__frames)); }
  const st = await page.evaluate(() => { const s = window.__sol, r = s.engine.renderer; const cv = document.querySelector('canvas');
    return { info: JSON.parse(JSON.stringify(r.info.render)), calls: r.info.calls, compute: r.info.compute, cvs: [cv.width, cv.height, getComputedStyle(cv).opacity, getComputedStyle(cv).display, getComputedStyle(cv).visibility], exp: s.engine.displayExposure, frames: window.__frames, backend: r.backend.isWebGPUBackend }; });

  ; return { ...st, framesOverTime: fr }; }
