export default async function (page, { out }) {
  await page.evaluate(() => document.querySelector('#loader .enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(8000);
  return await page.evaluate(async () => {
    const cv = document.querySelector('canvas#gl');
    const grab = () => new Promise(res => requestAnimationFrame(() => setTimeout(async () => { try { const bm = await createImageBitmap(cv); const c2 = new OffscreenCanvas(bm.width, bm.height); const x = c2.getContext('2d'); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, bm.width, bm.height).data; let mx = 0, sum = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; sum += v; if (v > mx) mx = v; } res({ mx, mean: sum / (d.length / 4) }); } catch (e) { res(String(e)); } }, 0)));
    const a = await grab();
    const els = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 1000 && r.height > 600 && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0; }).map(e => e.tagName + '#' + e.id + '.' + e.className + ' bg=' + getComputedStyle(e).backgroundColor + ' z=' + getComputedStyle(e).zIndex + ' op=' + getComputedStyle(e).opacity);
    return { a, overlays: els, bodyBg: getComputedStyle(document.body).backgroundColor };
  });
}
