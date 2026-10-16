// TEX-381-01 diagnostic: boot one session, frame a body, log texture residency, net stats and every console warning/error
// usage: node tools/qa/tex_diag.mjs --body mars --secs 60 [--extra-off x]
import { chromium } from 'playwright-core';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const body = arg('body', 'mars'), secs = +arg('secs', 60), T0 = Date.now(), log = [];
const browser = await chromium.launch({ executablePath: '/usr/lib/chromium/chromium', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') log.push(`${((Date.now() - T0) / 1000).toFixed(1)}s ${m.type()}: ${m.text().slice(0, 240)}`); });
page.on('pageerror', e => log.push(`${((Date.now() - T0) / 1000).toFixed(1)}s pageerror: ${String(e).slice(0, 300)}`));
page.on('requestfailed', r => log.push(`${((Date.now() - T0) / 1000).toFixed(1)}s reqfail: ${r.url()} ${r.failure()?.errorText}`));
await page.goto(arg('url', 'http://localhost:4175/') + '?qa-off=small,smallcompute' + (arg('extra-off', '') ? ',' + arg('extra-off', '') : '') + '&qa-software-gpu=1');
await page.waitForFunction(() => window.__sol && window.__frames > 3, null, { timeout: 240000 });
console.log('boot', ((Date.now() - T0) / 1000).toFixed(1));
await page.evaluate((id) => { const s = window.__sol; s.settings.set('onboarded', true); document.querySelector('#loader .enter, #loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); const b = s.sys.byId?.get?.(id) ?? s.sys.bodies.find(x => x.id === id); s.engine.rig.target = b; s.engine.rig.pos = [b.pos[0] + b.radius * 12, b.pos[1], b.pos[2]]; }, body);
for (let t = 0; t < secs; t += 10) {
  await page.waitForTimeout(10000);
  const st = await page.evaluate((id) => { const s = window.__sol, e = s.engine, b = s.sys.bodies.find(x => x.id === id); const T = e.assets.textures; return { frames: window.__frames, tex: T.stats ? T.stats() : null, net: e.diagnostics().net, lv: (e.views.get(id)?.texNames ?? []).map(n => n + ':' + T.level(n)) }; }, body);
  console.log(((Date.now() - T0) / 1000).toFixed(0) + 's', JSON.stringify(st));
}
console.log(log.join('\n')); await browser.close();
