// v3.8.1 Galactic context card captures (UI visible). Camera 1 pc from the Sun toward Proxima. Software WebGPU.
import { chromium } from '../../node_modules/playwright-core/index.mjs';
const Q = '/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa/sheets/';
const b = await chromium.launch({ executablePath: '/usr/lib/chromium/chromium', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader'] });
for (const [port, f, big] of [[4174, 'L0-galmap-v380.png', false], [4175, 'L1-galmap-v381.png', false], [4175, 'L2-galmap-v381-enlarged.png', true]]) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await p.goto(`http://localhost:${port}/?qa-software-gpu=1&qa-off=small,smallcompute`);
  await p.waitForSelector('#loader .ld-enter.show', { timeout: 240000 });
  await p.evaluate((big) => { document.querySelector('#loader .ld-enter').click(); const s = window.__sol, r = s.engine.rig, t = s.sys.bodies.find(x => x.name === 'Proxima Centauri');
    s.clock.paused = true; r.flight = null; s.ui.following = false; r.setTarget(t, 3.0856775814913673e13 * 0.3); s.ui.galmap.auto = false; s.ui.galmap.toggle(true);
    if (big) s.ui.galmap.el.querySelector('.grow')?.click(); }, big);
  await p.waitForTimeout(20000); await p.screenshot({ path: Q + f, timeout: 120000 }); console.log('shot', f); await p.close();
}
await b.close();
