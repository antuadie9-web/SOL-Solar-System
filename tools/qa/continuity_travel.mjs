// SOL v3.8.1 CONT-381 continuity acceptance: CONTINUOUS camera motion, sampled every few frames (no exposure settling),
// so exposure adaptation, representation hand-overs and caches behave as in real use.
//   sun:   camera recedes from the Sun 0.25 → 300 AU (log-uniform, 90 steps × 3 frames), 20° and 50° FOV, auto and fixed EV
//   rings: camera pans across Saturn → lit rings → planet shadow on rings → empty sky (60 steps × 3 frames)
// Per step: diagnostics (EV, sunGlare, meter) + a centre crop. Output: <out>/<seq>/NNN.png + <out>/<seq>.json
// usage: node tools/qa/continuity_travel.mjs --url http://localhost:4175/ --out <dir> [--seq sun-f20-auto,...]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const exe = fs.existsSync('/usr/lib/chromium/chromium') ? '/usr/lib/chromium/chromium' : 'chromium';
const url = arg('url', 'http://localhost:4175/') + '?qa-off=small,smallcompute&qa-software-gpu=1';
const out = arg('out', 'qa-travel'); fs.mkdirSync(out, { recursive: true });
const ALL = ['sun-f20-auto', 'sun-f20-fixed', 'sun-f50-auto', 'rings-pan', 'sun-far-auto', 'titan-handover', 'titan-handover-sci'];   // titan: planet/moon point↔disc hand-over next to a bright Saturn (CONT-14)   // sun-far: 100 AU → 1 pc (point regime)
const seqs = (arg('seq', ALL.join(','))).split(',');
const W = 960, H = 540;
// QA-381-02 cost accounting: --shots 0 skips the full-frame images (≈30 s each in software WebGPU); timings go into <seq>.json
const SHOTS = arg('shots', '1') !== '0', HDR = arg('hdr', '0') === '1', T0 = Date.now(), cost = { bootMs: 0 };
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog', '--disable-features=DawnSIRepsUseClientProvidedSemaphores'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.addInitScript({ path: 'tools/qa/gpu-errors.js' });
await page.goto(url);
await page.waitForFunction(() => window.__sol && window.__frames > 3, null, { timeout: 240000 });
cost.bootMs = Date.now() - T0; console.log('boot ms', cost.bootMs);
await page.evaluate(() => { const s = window.__sol; s.settings.set('onboarded', true); document.querySelector('#loader .enter, #loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.body.classList.add('cine'); document.querySelectorAll('.coach').forEach(e => e.remove()); });
for (const seq of seqs) {
  fs.mkdirSync(`${out}/${seq}`, { recursive: true });
  const rows = [];
  const N = seq === 'rings-pan' ? 60 : seq === 'sun-far-auto' ? 48 : seq.startsWith('titan') ? 40 : 90;
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const info = await page.evaluate(async ({ seq, i, N }) => {
      const s = window.__sol, r = s.engine.rig, AU = 149597870.7;
      const frames = (n) => new Promise(res => { const f0 = window.__frames; const chk = () => window.__frames - f0 >= n ? res(0) : requestAnimationFrame(chk); chk(); });
      const nrm = (v) => { const l = Math.hypot(...v); return v.map(x => x / l); };
      s.ui.following = false; r.mode = 'free'; r.freeVel = [0, 0, 0]; r.lookYaw = r.lookPitch = 0;
      if (seq.startsWith('sun')) {
        const fov = seq.includes('f50') ? 50 : 20, fixed = seq.endsWith('fixed'), far = seq.startsWith('sun-far');
        if (i === 0) { s.settings.set('autoExposure', !fixed); if (fixed) s.settings.set('manualExposure', Math.pow(2, -10.26)); }
        const sun = s.sys.sun, e = s.sys.get('earth');
        const h = nrm([e.pos[0] - sun.pos[0], e.pos[1] - sun.pos[1], 0]), el = 20 * Math.PI / 180, dir = [h[0] * Math.cos(el), h[1] * Math.cos(el), Math.sin(el)];
        const au = far ? 100 * Math.pow(206264.8 / 100, i / (N - 1)) : 0.25 * Math.pow(300 / 0.25, i / (N - 1)), km = au * AU;
        const pos = [sun.pos[0] + dir[0] * km, sun.pos[1] + dir[1] * km, sun.pos[2] + dir[2] * km];
        r.tFov = r.fov = fov; r.target = sun; r.pos = pos; r.quat.copy(r.lookQuat(pos, sun.pos, [0, 0, 1]));
        await frames(3); r.pos = pos; r.quat.copy(r.lookQuat(pos, sun.pos, [0, 0, 1]));
        const d = s.engine.diagnostics();
        return { i, au, fov, fixed, ev: d.exposureEV, skyEV: d.view?.skyEV, sunGlare: d.sunGlare };
      } else if (seq.startsWith('titan')) {
        // CONT-14: Titan recedes from 9 px to 0.5 px radius (log-uniform, 20° FOV, 540 px high) while sunlit Saturn stays in
        // frame 1.5–4° away, so the scene exposure is set by Saturn and the sky exposure differs — the point/disc hand-over
        // (1.2–3.5 px) must not change Titan's integrated displayed signal by more than its distance law.
        if (i === 0) { s.settings.set('autoExposure', true); s.settings.set('viewMode', seq.endsWith('sci') ? 'scientific' : 'exploration'); }
        const ti = s.sys.get('titan'), sat = s.sys.get('saturn'), sun = s.sys.sun;
        const u = nrm([ti.pos[0] - sat.pos[0], ti.pos[1] - sat.pos[1], ti.pos[2] - sat.pos[2]]);
        const ts = nrm([sun.pos[0] - ti.pos[0], sun.pos[1] - ti.pos[1], sun.pos[2] - ti.pos[2]]), dd = ts[0] * u[0] + ts[1] * u[1] + ts[2] * u[2];
        const w = nrm([ts[0] - dd * u[0], ts[1] - dd * u[1], ts[2] - dd * u[2]]), c = Math.cos(25 * Math.PI / 180), sn = Math.sin(25 * Math.PI / 180);
        const dir = [u[0] * c + w[0] * sn, u[1] * c + w[1] * sn, u[2] * c + w[2] * sn];
        const pxAng = (20 * Math.PI / 180) / 540, rpx = 9 * Math.pow(0.5 / 9, i / (N - 1)), km = 2574.7 / (rpx * pxAng);
        const pos = [ti.pos[0] + dir[0] * km, ti.pos[1] + dir[1] * km, ti.pos[2] + dir[2] * km];
        r.tFov = r.fov = 20; r.target = ti; r.pos = pos; r.quat.copy(r.lookQuat(pos, ti.pos, [0, 0, 1]));
        if (i === 0) for (let k = 0; k < 4; k++) { s.engine.settleExposure(); await frames(2); }
        await frames(3); r.pos = pos; r.quat.copy(r.lookQuat(pos, ti.pos, [0, 0, 1]));
        const d = s.engine.diagnostics(), sc = s.engine.screen.get('titan');
        const ca = (ts[0] * dir[0] + ts[1] * dir[1] + ts[2] * dir[2]);   // camera on +dir side of Titan: phase angle = angle(sun, camera) at Titan
        return { i, rpx, km, alphaDeg: Math.acos(Math.max(-1, Math.min(1, ca))) * 180 / Math.PI, ev: d.exposureEV, skyEV: d.view?.skyEV, mode: d.view?.mode, scr: sc ? { x: sc.x, y: sc.y, r: sc.r, bright: sc.bright } : null };
      } else {
        if (i === 0) s.settings.set('autoExposure', true);
        // camera 3.2 Saturn radii out (v2: 8.5 R left the rings small) on the sunward side of the terminator plane, 18° above the lit ring face; the view
        // direction sweeps 0 → 40° from Saturn's centre TOWARD THE ANTI-SUN side: planet → lit rings → planet shadow on
        // the rings → ring ansa → empty sky (v1 swept 150° the other way and left the rings within 8°)
        const sat = s.sys.get('saturn'), sun = s.sys.sun, R = 60268;
        const toSun = nrm([sun.pos[0] - sat.pos[0], sun.pos[1] - sat.pos[1], sun.pos[2] - sat.pos[2]]);
        const M = sat.rot, pole = [M[2], M[5], M[8]], side = nrm([pole[1] * toSun[2] - pole[2] * toSun[1], pole[2] * toSun[0] - pole[0] * toSun[2], pole[0] * toSun[1] - pole[1] * toSun[0]]);
        const sgn = Math.sign(toSun[0] * pole[0] + toSun[1] * pole[1] + toSun[2] * pole[2]) || 1, e = 12 * Math.PI / 180;
        const az = 35 * Math.PI / 180;   // 35° toward the Sun from the terminator plane: day side and the shadow both in view
        const hz = [side[0] * Math.cos(az) + toSun[0] * Math.sin(az), side[1] * Math.cos(az) + toSun[1] * Math.sin(az), side[2] * Math.cos(az) + toSun[2] * Math.sin(az)];
        const off = nrm([hz[0] * Math.cos(e) + pole[0] * sgn * Math.sin(e), hz[1] * Math.cos(e) + pole[1] * sgn * Math.sin(e), hz[2] * Math.cos(e) + pole[2] * sgn * Math.sin(e)]);
        const pos = [sat.pos[0] + off[0] * 3.2 * R, sat.pos[1] + off[1] * 3.2 * R, sat.pos[2] + off[2] * 3.2 * R];
        const a = (i / (N - 1)) * 95 * Math.PI / 180, toC = nrm([sat.pos[0] - pos[0], sat.pos[1] - pos[1], sat.pos[2] - pos[2]]);
        const as = [-toSun[0], -toSun[1], -toSun[2]], dd = as[0] * toC[0] + as[1] * toC[1] + as[2] * toC[2];
        const u = nrm([as[0] - dd * toC[0], as[1] - dd * toC[1], as[2] - dd * toC[2]]);   // anti-sun direction ⟂ line of sight
        const dir = [toC[0] * Math.cos(a) + u[0] * Math.sin(a), toC[1] * Math.cos(a) + u[1] * Math.sin(a), toC[2] * Math.cos(a) + u[2] * Math.sin(a)];
        const tgt = [pos[0] + dir[0] * 1e7, pos[1] + dir[1] * 1e7, pos[2] + dir[2] * 1e7];
        if (i === 0) { r.pos = pos; r.quat.copy(r.lookQuat(pos, tgt, pole)); for (let k = 0; k < 4; k++) { s.engine.settleExposure(); await frames(2); } }   // a cut: start settled (exposure carried over from the previous sequence otherwise)
        r.tFov = r.fov = 50; r.target = sat; r.pos = pos; r.quat.copy(r.lookQuat(pos, tgt, pole));
        await frames(3); r.pos = pos; r.quat.copy(r.lookQuat(pos, tgt, pole));
        const d = s.engine.diagnostics();
        return { i, angDeg: a * 180 / Math.PI, ev: d.exposureEV, meter: s.engine.meter ?? null, exp: s.engine.expDebug ?? null };
      }
    }, { seq, i, N });
    // software screenshots cost ~30 s: every step is rendered and logged (continuous motion), every SHOT-th step is imaged
    const SHOT = seq === 'rings-pan' ? 6 : 10;
    // point regime: a 33×33 centre clip every step (cheap) — integrated and peak displayed Sun signal vs distance
    const t1 = Date.now();
    // QA-381-02: --hdr 1 reads the scene-linear HDR pass (engine.qaReadHDR) instead of an 8-bit clip: no tone-map
    // inversion, no clipping, and the SwiftShader PNG encode is skipped (clip screenshots were ~75 % of a travel run).
    if (HDR && (seq === 'sun-far-auto' || seq.startsWith('titan'))) info.hdr = await page.evaluate(async () => { const e = window.__sol.engine, h = await e.qaReadHDR(33); return h && { signal: h.signal / e.displayExposure, peak: h.peak / e.displayExposure, median: h.median / e.displayExposure, X: e.displayExposure, pxAng: e.pxAng }; });
    else if (seq === 'sun-far-auto' || seq.startsWith('titan')) await page.screenshot({ path: `${out}/${seq}/c${String(i).padStart(3, '0')}.png`, clip: { x: W / 2 - 16, y: H / 2 - 16, width: 33, height: 33 }, timeout: 180000 });
    const t2 = Date.now();
    if (SHOTS && (i % SHOT === 0 || i === N - 1)) await page.screenshot({ path: `${out}/${seq}/${String(i).padStart(3, '0')}.png`, timeout: 180000 });
    info.ms = { step: t1 - t0, clip: t2 - t1, shot: Date.now() - t2 };
    rows.push(info);
    if (i % 10 === 0) fs.writeFileSync(`${out}/${seq}.json`, JSON.stringify(rows, null, 1));   // partial results survive a timeout
  }
  fs.writeFileSync(`${out}/${seq}.json`, JSON.stringify(rows, null, 1));
  console.log('done', seq, 'ms', Date.now() - T0);
}
await browser.close();
