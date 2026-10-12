export default async function (page, { out }) {
  await page.evaluate(() => { document.querySelector('#loader .enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.body.classList.add('cine'); });
  const t0 = Date.now(); const f0 = await page.evaluate(() => window.__frames);
  await page.waitForTimeout(12000);
  const f1 = await page.evaluate(() => window.__frames);
  await page.screenshot({ path: out + '/one.png' });
  return { fps: (f1 - f0) / ((Date.now() - t0) / 1000) };
}
