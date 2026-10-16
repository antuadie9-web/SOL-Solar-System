// TEX-381-01 diagnostic: boot one session, frame a body, log texture residency, net stats and every console warning/error
// usage: node tools/qa/tex_diag.mjs --body mars --secs 60 [--extra-off x]
import { chromium } from 'playwright-core';
import { startSnapServer } from './lib/snapserver.mjs';
const SNAPSRV = (() => { const i = process.argv.indexOf('--snap'); return i > 0 ? process.argv[i + 1] : null; })();
const SRV = SNAPSRV ? await startSnapServer(SNAPSRV) : null;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const body = arg('body', 'mars'), secs = +arg('secs', 60), T0 = Date.now(), log = [];
const browser = await chromium.launch({ executablePath: '/usr/lib/chromium/chromium', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') log.push(`${((Date.now() - T0) / 1000).toFixed(1)}s ${m.type()}: ${m.text().slice(0, 240)}`); });
page.on('pageerror', e => log.push(`${((Date.now() - T0) / 1000).toFixed(1)}s pageerror: ${String(e).slice(0, 300)}`));
page.on('requestfailed', r => log.push(`${((Date.now() - T0) / 1000).toFixed(1)}s reqfail: ${r.url()} ${r.failure()?.errorText}`));
await page.goto((SRV ? SRV.url : arg('url', 'http://localhost:4175/')) + '?qa-off=small,smallcompute' + (arg('extra-off', '') ? ',' + arg('extra-off', '') : '') + '&qa-software-gpu=1');
await page.waitForFunction(() => window.__sol && window.__frames > 3, null, { timeout: 240000 });
console.log('boot', ((Date.now() - T0) / 1000).toFixed(1));
await page.evaluate((id) => { const s = window.__sol; s.settings.set('onboarded', true); document.querySelector('#loader .enter, #loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); const b = s.sys.byId?.get?.(id) ?? s.sys.bodies.find(x => x.id === id); s.ui.following = false; const r = s.engine.rig; r.mode = 'free'; r.freeVel = [0, 0, 0]; r.lookYaw = r.lookPitch = 0; const km = b.radius * 8, pos = [b.pos[0] + km * 0.6, b.pos[1] + km * 0.8, b.pos[2]]; r.tFov = r.fov = 20; r.target = b; r.pos = pos; r.quat.copy(r.lookQuat(pos, b.pos, [0, 0, 1])); }, body);
for (let t = 0; t < secs; t += 10) {
  await page.waitForTimeout(10000);
  const st = await page.evaluate((id) => { const s = window.__sol, e = s.engine, b = s.sys.bodies.find(x => x.id === id); const T = e.assets.textures; return { frames: window.__frames, tex: T.stats ? T.stats() : null, net: e.diagnostics().net, lv: (e.views.get(id)?.texNames ?? []).map(n => n + ':' + T.level(n)) }; }, body);
  console.log(((Date.now() - T0) / 1000).toFixed(0) + 's', JSON.stringify(st));
}
// --selftest 1: drive the TEX-381-01 failure modes on the live store (eviction to placeholder, superseded load, failed decode
// with back-off) for every map of the body's view and check that a drawn map heals back to a decoded level
if (arg('selftest', '0') === '1') {
  const r = await page.evaluate(async (id) => {
    const s = window.__sol, e = s.engine, T = e.assets.textures, v = e.views.get(id); if (!v) return { error: 'no view for ' + id };
    const names = v.texNames, out = {}, wait = (ms) => new Promise(r => setTimeout(r, ms));
    const until = async (f, ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (f()) return Math.round(performance.now() - t0); await wait(200); } return -1; };
    for (const n of names) await until(() => T.level(n) !== 'placeholder', 60000);
    const E = (n) => T.map.get(n), r0 = T.reloads;
    // 1 eviction: idle base → placeholder; the view keeps touching it
    for (const n of names) { const x = E(n); x.loading = null; T.swap(x, null, 'placeholder'); }
    out.evict = Object.fromEntries(await Promise.all(names.map(async n => [n, await until(() => T.level(n) !== 'placeholder', 60000)])));
    // 2 superseded: a load in flight is cancelled (loading cleared) before it lands
    { const n = names[0], x = E(n); x.loading = null; T.swap(x, null, 'placeholder'); x.loading = 'base'; await wait(50); x.loading = null;
      out.superseded = await until(() => T.level(n) !== 'placeholder', 60000); }
    // 3 failed decode: within back-off it must wait; after back-off it retries
    { const n = names[0], x = E(n); x.loading = null; T.swap(x, null, 'placeholder'); x.failed.add('base'); x.failCount = 1; x.failAt = performance.now();
      await wait(3000); out.failedHeldInBackoff = T.level(n) === 'placeholder' && !x.loading;
      x.failAt = performance.now() - 25000; out.failedRetried = await until(() => T.level(n) !== 'placeholder', 60000); out.failCountAfter = x.failCount; }
    // 4 long outage: after many failures it waits ≤ 5 min, REPORTS the placeholder (stats.failed) and then retries
    { const n = names[0], x = E(n); x.loading = null; T.swap(x, null, 'placeholder'); x.failed.add('base'); x.failCount = 9; x.failAt = performance.now();
      await wait(2000); out.capHolds = T.level(n) === 'placeholder'; out.capReported = T.stats().failed.includes(n + ':base');
      x.failAt = performance.now() - 301000; out.capRestored = await until(() => T.level(n) !== 'placeholder', 60000); }
    // 5 stall: a load that never settles is aborted by the watchdog and retried
    { const n = names[0], x = E(n); x.loading = null; T.swap(x, null, 'placeholder'); x.loading = 'base'; x.ctl = new AbortController(); x.loadT0 = performance.now() - 46000;
      out.stallRecovered = await until(() => T.level(n) !== 'placeholder', 90000); out.stalls = T.stalls; }
    out.reloads = T.reloads - r0; out.final = names.map(n => n + ':' + T.level(n)); return out;
  }, body);
  console.log('SELFTEST', JSON.stringify(r));
}
console.log(log.join('\n')); await browser.close(); if (SRV) { console.log('snapserver', JSON.stringify({ requests: SRV.stats.requests, missing: SRV.stats.missing.slice(0, 20) })); SRV.close(); }
