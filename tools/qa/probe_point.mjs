// CONT-14 L1 probe: one Titan geometry per rpx; logs the CPU point flux the engine committed (+ formula check) and a 33×33 clip.
// --ab-depth 1 needs the temporary window.__qaDiscDepthOff hook (removed after the A/B in 2026-10-14; re-add only for diagnosis).
// usage: node tools/qa/probe_point.mjs --url http://localhost:4175/ --out <dir> --rpx 3.4,1.0 [--mode scientific]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', 'probe'); fs.mkdirSync(out, { recursive: true });
const W = 960, H = 540, T0 = Date.now();
const browser = await chromium.launch({ executablePath: '/usr/lib/chromium/chromium', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto(arg('url', 'http://localhost:4175/') + '?qa-off=small,smallcompute' + (arg('extra-off', '') ? ',' + arg('extra-off', '') : '') + '&qa-software-gpu=1');
await page.waitForFunction(() => window.__sol && window.__frames > 3, null, { timeout: 240000 });
const boot = Date.now() - T0;
await page.evaluate((mode) => { const s = window.__sol; s.settings.set('onboarded', true); document.querySelector('#loader .enter, #loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.body.classList.add('cine'); document.querySelectorAll('.coach').forEach(e => e.remove()); s.settings.set('autoExposure', true); s.settings.set('viewMode', mode); const ck = s.ui.clock; ck.set(2461314.5); ck.paused = true; ck.emit(); }, arg('mode', 'scientific'));
const rows = [];
for (const rpx of arg('rpx', '3.4,1.0').split(',').map(Number)) {
  const t0 = Date.now();
  const info = await page.evaluate(async (rpx) => {
    const s = window.__sol, r = s.engine.rig;
    const frames = (n) => new Promise(res => { const f0 = window.__frames; const chk = () => window.__frames - f0 >= n ? res(0) : requestAnimationFrame(chk); chk(); });
    const nrm = (v) => { const l = Math.hypot(...v); return v.map(x => x / l); };
    s.ui.following = false; r.mode = 'free'; r.freeVel = [0, 0, 0]; r.lookYaw = r.lookPitch = 0;
    const ti = s.sys.get('titan'), sat = s.sys.get('saturn'), sun = s.sys.sun;
    const u = nrm([ti.pos[0] - sat.pos[0], ti.pos[1] - sat.pos[1], ti.pos[2] - sat.pos[2]]);
    const ts = nrm([sun.pos[0] - ti.pos[0], sun.pos[1] - ti.pos[1], sun.pos[2] - ti.pos[2]]), dd = ts[0] * u[0] + ts[1] * u[1] + ts[2] * u[2];
    // near-full phase (camera sunward of Titan, tilted 20° away from Saturn) so the photometry is not dominated by a thin crescent
    const c = Math.cos(20 * Math.PI / 180), sn = Math.sin(20 * Math.PI / 180);
    const dir = nrm([ts[0] * c + u[0] * sn, ts[1] * c + u[1] * sn, ts[2] * c + u[2] * sn]);
    const pxAng = (20 * Math.PI / 180) / 540, km = 2574.7 / (rpx * pxAng);
    const pos = [ti.pos[0] + dir[0] * km, ti.pos[1] + dir[1] * km, ti.pos[2] + dir[2] * km];
    r.tFov = r.fov = 20; r.target = ti; r.pos = pos; r.quat.copy(r.lookQuat(pos, ti.pos, [0, 0, 1]));
    let evp = 99; for (let k = 0; k < 16; k++) { s.engine.settleExposure(); await frames(2); const ev = s.engine.diagnostics().exposureEV; if (Math.abs(ev - evp) < 0.02) break; evp = ev; }
    r.pos = pos; r.quat.copy(r.lookQuat(pos, ti.pos, [0, 0, 1])); await frames(2);
    const e = s.engine, P = e.points, n = P.count, pts = [];
    for (let k = 0; k < n; k++) pts.push({ k, flux: Array.from(P.flux.slice(k * 3, k * 3 + 3)), comp: P.comp[k] });
    const d = e.diagnostics();
    const cp = e.camPos ?? r.pos, rel = [ti.pos[0] - r.pos[0], ti.pos[1] - r.pos[1], ti.pos[2] - r.pos[2]], dist = Math.hypot(...rel);
    const toSun = [sun.pos[0] - ti.pos[0], sun.pos[1] - ti.pos[1], sun.pos[2] - ti.pos[2]], rS = Math.hypot(...toSun) / 149597870.7;
    const cosA = -(toSun[0] * rel[0] + toSun[1] * rel[1] + toSun[2] * rel[2]) / (Math.hypot(...toSun) * dist), al = Math.acos(cosA);
    const phase = (Math.sin(al) + (Math.PI - al) * Math.cos(al)) / Math.PI;
    const F0 = ti.albedo * (2 / 3) * Math.PI * Math.pow(ti.radius / dist, 2) / (rS * rS) * phase;
    const expect = { dist, rS, alphaDeg: al * 180 / Math.PI, phase, F0, F0xE: F0 * Math.pow(2, d.exposureEV), F0xExC16red: F0 * Math.pow(2, d.exposureEV) * 1.6 * ti.def.color[0], toneMap: s.settings.get('toneMap'), skyExp: e.skyExp, displayExposure: e.displayExposure };
    return { expect, rpx, ev: d.exposureEV, skyEV: d.view?.skyEV, pxAng: e.pxAng, pts: pts.filter(p => p.flux[0] > 0).sort((a, b) => b.flux[0] - a.flux[0]).slice(0, 4) };
  }, rpx);
  const t1 = Date.now();
  await page.screenshot({ path: `${out}/r${rpx}.png`, clip: { x: W / 2 - 16, y: H / 2 - 16, width: 33, height: 33 }, timeout: 180000 });
  info.ms = { step: t1 - t0, clip: Date.now() - t1 };
  if (arg('ab-depth', '0') === '1') {   // same geometry, flux and exposure: only the target sphere's depth writes change
    await page.evaluate(async () => { window.__qaDiscDepthOff = true; const f0 = window.__frames; await new Promise(res => { const c = () => window.__frames - f0 >= 2 ? res(0) : requestAnimationFrame(c); c(); }); });
    info.evB = await page.evaluate(() => window.__sol.engine.diagnostics().exposureEV);
    await page.screenshot({ path: `${out}/r${rpx}-nodepth.png`, clip: { x: W / 2 - 16, y: H / 2 - 16, width: 33, height: 33 }, timeout: 180000 });
    await page.evaluate(async () => { window.__qaDiscDepthOff = false; const f0 = window.__frames; await new Promise(res => { const c = () => window.__frames - f0 >= 1 ? res(0) : requestAnimationFrame(c); c(); }); window.__qaDiscDepthOff = undefined; });
  }
  rows.push(info); console.log(JSON.stringify(info));
}
fs.writeFileSync(`${out}/probe.json`, JSON.stringify({ bootMs: boot, rows }, null, 1));
await browser.close();
