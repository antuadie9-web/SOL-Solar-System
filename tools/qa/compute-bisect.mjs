import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/lib/chromium/chromium', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader'] });
for (const v of process.argv.slice(2)) {
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  await p.goto(`http://localhost:5174/tests/render/${v.startsWith("raw") ? "rawcompute.html?" + v.slice(4) : "compute.html?" + v}`);
  await p.waitForFunction(() => window.done, null, { timeout: 60000 }).catch(() => errs.push('timeout'));
  console.log(v, await p.evaluate(() => ({ lost: window.lost, result: window.result })), errs.slice(0, 2));
  await p.close();
}
await b.close();
