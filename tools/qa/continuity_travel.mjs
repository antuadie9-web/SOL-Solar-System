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
const ALL = ['sun-f20-auto', 'sun-f20-fixed', 'sun-f50-auto', 'rings-pan', 'sun-far-auto'];   // sun-far: 100 AU → 1 pc (point regime)
const seqs = (arg('seq', ALL.join(','))).split(',');
const W = 960, H = 540;
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog', '--disable-features=DawnSIRepsUseClientProvidedSemaphores'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.addInitScript({ path: 'tools/qa/gpu-errors.js' });
await page.goto(url);
await page.waitForFunction(() => window.__sol && window.__frames > 3, null, { timeout: 240000 });
await page.evaluate(() => { const s = window.__sol; s.settings.set('onboarded', true); document.querySelector('#loader .enter, #loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.body.classList.add('cine'); document.querySelectorAll('.coach').forEach(e => e.remove()); });
for (const seq of seqs) {
  fs.mkdirSync(`${out}/${seq}`, { recursive: true });
  const rows = [];
  const N = seq === 'rings-pan' ? 60 : seq === 'sun-far-auto' ? 48 : 90;
  for (let i = 0; i < N; i++) {
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
    if (seq === 'sun-far-auto') await page.screenshot({ path: `${out}/${seq}/c${String(i).padStart(3, '0')}.png`, clip: { x: W / 2 - 16, y: H / 2 - 16, width: 33, height: 33 }, timeout: 180000 });
    if (i % SHOT === 0 || i === N - 1) await page.screenshot({ path: `${out}/${seq}/${String(i).padStart(3, '0')}.png`, timeout: 180000 });
    rows.push(info);
  }
  fs.writeFileSync(`${out}/${seq}.json`, JSON.stringify(rows, null, 1));
  console.log('done', seq);
}
await browser.close();
