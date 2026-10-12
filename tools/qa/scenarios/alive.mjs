// Liveness probe: enter, run ~20 s, report frames + whether the device was lost.
export default async function (page) {
  await page.evaluate(() => document.querySelector('#loader .enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const f0 = await page.evaluate(() => window.__frames); await page.waitForTimeout(20000);
  return await page.evaluate((f0) => ({ frames: window.__frames - f0, lost: window.__sol.engine.deviceLost }), f0);
}
