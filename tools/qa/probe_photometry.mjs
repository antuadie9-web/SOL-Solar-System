// CONT-14c L1 photometry probe (QA-381-02). For each body × phase angle × apparent radius, places the camera at that
// geometry (clock frozen), settles Scientific exposure and reads the scene-linear HDR pass around the body directly
// (engine.qaReadHDR — no screenshot, no tone map). Reports the integrated flux in engine units next to the CPU point flux
// and the Lambert reference p·Φ_L(α)·π(R/d)²/r² so disc (large rpx) and point (rpx < 0.55, sphere not drawn) can be
// compared at identical phase.
// usage: node tools/qa/probe_photometry.mjs --out <dir> --bodies callisto,rhea,titan --alpha 10,60,120 --rpx 12,0.45
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
for (const id of arg('bodies', 'callisto,rhea,titan').split(','))
  for (const alpha of arg('alpha', '10,60,120').split(',').map(Number))
    for (const rpx of arg('rpx', '12,0.45').split(',').map(Number)) {
      const t0 = Date.now();
      const info = await page.evaluate(async ({ id, alpha, rpx }) => {
        const s = window.__sol, r = s.engine.rig, e = s.engine;
        const frames = (n) => new Promise(res => { const f0 = window.__frames; const chk = () => window.__frames - f0 >= n ? res(0) : requestAnimationFrame(chk); chk(); });
        const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], nrm = (v) => { const l = Math.hypot(...v); return v.map(x => x / l); };
        const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        s.ui.following = false; r.mode = 'free'; r.freeVel = [0, 0, 0]; r.lookYaw = r.lookPitch = 0;
        const b = s.sys.get(id), sun = s.sys.sun, par = b.parent ? s.sys.get(b.parent) ?? null : null;
        const ts = nrm(sub(sun.pos, b.pos));
        // rotate the sun direction by α about an axis ⟂ to it; the axis is chosen so the camera swings AWAY from the parent
        const up = par ? nrm(sub(b.pos, par.pos)) : [0, 0, 1];
        let ax = cross(ts, up); if (Math.hypot(...ax) < 1e-6) ax = cross(ts, [0, 0, 1]); ax = nrm(ax);
        const perp = nrm(cross(ax, ts)), a = alpha * Math.PI / 180;
        const dir = nrm([ts[0] * Math.cos(a) + perp[0] * Math.sin(a), ts[1] * Math.cos(a) + perp[1] * Math.sin(a), ts[2] * Math.cos(a) + perp[2] * Math.sin(a)]);
        const pxAng = (20 * Math.PI / 180) / 540, km = b.radius / Math.tan(rpx * pxAng);
        const pos = [b.pos[0] + dir[0] * km, b.pos[1] + dir[1] * km, b.pos[2] + dir[2] * km];
        r.tFov = r.fov = 20; r.target = b; r.pos = pos; r.quat.copy(r.lookQuat(pos, b.pos, [0, 0, 1]));
        let evp = 99; for (let k = 0; k < 16; k++) { e.settleExposure(); await frames(2); const ev = e.diagnostics().exposureEV; if (Math.abs(ev - evp) < 0.02) break; evp = ev; }
        r.pos = pos; r.quat.copy(r.lookQuat(pos, b.pos, [0, 0, 1])); await frames(3);
        const w = 2 * Math.ceil(2.2 * rpx + 8) + 1, hdr = await e.qaReadHDR(w);
        const rel = sub(b.pos, pos), dist = Math.hypot(...rel), toSun = sub(sun.pos, b.pos), rS = Math.hypot(...toSun) / 149597870.7;
        const al = Math.acos(-(toSun[0] * rel[0] + toSun[1] * rel[1] + toSun[2] * rel[2]) / (Math.hypot(...toSun) * dist));
        const phiL = (Math.sin(al) + (Math.PI - al) * Math.cos(al)) / Math.PI, X = e.displayExposure, pa = e.pxAng;
        const Fref = b.albedo * phiL * Math.PI * Math.pow(b.radius / dist, 2) / (rS * rS);   // Lambert phase law, geometric albedo p
        const P = e.points; let Fpt = 0, best = 0;   // the body's committed point flux (mean RGB, exposure removed): the entry nearest the view axis
        const fw = e.camera.getWorldDirection(e.camera.position.clone());
        for (let k = 0; k < P.count; k++) { const q = [P.pos[k * 3], P.pos[k * 3 + 1], P.pos[k * 3 + 2]], l = Math.hypot(...q); if (!l) continue;
          const c = (q[0] * fw.x + q[1] * fw.y + q[2] * fw.z) / l; if (c > best) { best = c; Fpt = (P.flux[k * 3] + P.flux[k * 3 + 1] + P.flux[k * 3 + 2]) / 3 / X; } }
        if (best < Math.cos(3 * pxAng)) Fpt = 0;
        const Fmeas = hdr ? hdr.signal * pa * pa / X : null;
        return { id, kind: b.def?.kind, p: b.albedo, alphaDeg: al * 180 / Math.PI, rpx, ev: e.diagnostics().exposureEV, X, pxAng: pa, w, Fmeas, Fref, Fpt, meas_ref: Fmeas / Fref, pt_ref: Fpt / Fref, hdr: hdr && { peak: hdr.peak / X, median: hdr.median / X, half: hdr.half, W: hdr.W } };
      }, { id, alpha, rpx });
      info.ms = Date.now() - t0; rows.push(info); console.log(JSON.stringify(info));
      fs.writeFileSync(`${out}/photometry.json`, JSON.stringify({ bootMs: boot, rows }, null, 1));
    }
await browser.close();
