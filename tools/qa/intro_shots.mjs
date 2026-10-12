// v3.8.1 intro captures (candidate :4175, baseline :4174). Output: work/qa/sheets/U*.png. Software WebGPU.
import { chromium } from '../../node_modules/playwright-core/index.mjs';
const Q = process.env.SHOTDIR || '/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa/sheets/';
const b = await chromium.launch({ executablePath: '/usr/lib/chromium/chromium', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader'] });
for (const [port, w, h, dpr, f, wait] of [[4175, 1600, 900, 1, 'U1-intro-1600-loading.png', 6000], [4175, 1600, 900, 1, 'U2-intro-1600-ready.png', 0], [4175, 1280, 800, 2, 'U3-intro-1280-dpr2-ready.png', 0], [4174, 1600, 900, 1, 'U0-intro-v380-ready.png', 0]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await p.addInitScript(() => localStorage.setItem('sol.recent.v1', JSON.stringify(['saturn', 'earth'])));
  await p.goto(`http://localhost:${port}/?qa-software-gpu=1&qa-off=small,smallcompute`);
  if (wait) await p.waitForTimeout(wait); else await p.waitForSelector('.ld-enter.show', { timeout: 240000 }).catch(() => console.log('not ready', f));
  await p.waitForTimeout(1500); await p.screenshot({ path: Q + f, timeout: 120000 }); console.log('shot', f); await p.close();
}
await b.close();
