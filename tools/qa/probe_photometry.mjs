// CONT-14c L1 photometry probe (QA-381-02). For each body × phase angle × apparent radius, places the camera at that
// geometry (clock frozen), settles Scientific exposure and reads the scene-linear HDR pass around the body directly
// (engine.qaReadHDR — no screenshot, no tone map). Reports the integrated flux in engine units next to the CPU point flux
// and the Lambert reference p·Φ_L(α)·π(R/d)²/r² so disc (large rpx) and point (rpx < 0.55, sphere not drawn) can be
// compared at identical phase.
// usage: node tools/qa/probe_photometry.mjs --out <dir> --bodies callisto,rhea,titan --alpha 10,60,120 --rpx 12,0.45
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { startSnapServer } from './lib/snapserver.mjs';
// QA-381-05: --snap <built snapshot dir> serves it from inside this process (preferred); --url keeps the old external server
const SNAPSRV = (() => { const i = process.argv.indexOf('--snap'); return i > 0 ? process.argv[i + 1] : null; })();
const SRV = SNAPSRV ? await startSnapServer(SNAPSRV) : null;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', 'probe'); fs.mkdirSync(out, { recursive: true });
const W = 960, H = 540, T0 = Date.now();
const browser = await chromium.launch({ executablePath: '/usr/lib/chromium/chromium', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
// QA-381-03: a shader/pipeline build error means the measured material is a fallback, not the code under test
const SHADER_ERR = [];
page.on('console', (m) => { if (m.type() === 'error' && /TSL|WGSL|shader|pipeline|GPUValidation/i.test(m.text())) SHADER_ERR.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => SHADER_ERR.push('pageerror: ' + String(e).slice(0, 200)));
// TEX-381-01: asset/texture warnings are recorded with their session time (diagnosis of placeholder maps)
const ASSET_WARN = [];
page.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && /texture|asset|unavailable|HTTP|decode/i.test(m.text())) ASSET_WARN.push(((Date.now() - T0) / 1000).toFixed(1) + 's ' + m.text().slice(0, 200)); });
await page.goto((SRV ? SRV.url : arg('url', 'http://localhost:4175/')) + '?qa-off=small,smallcompute' + (arg('extra-off', '') ? ',' + arg('extra-off', '') : '') + '&qa-software-gpu=1' + (arg('qs', '') ? '&' + arg('qs', '') : ''));
await page.waitForFunction(() => window.__sol && window.__frames > 3, null, { timeout: 240000 });
const boot = Date.now() - T0;
await page.evaluate(([mode, jd]) => { const s = window.__sol; s.settings.set('onboarded', true); document.querySelector('#loader .enter, #loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.body.classList.add('cine'); document.querySelectorAll('.coach').forEach(e => e.remove()); s.settings.set('autoExposure', true); s.settings.set('viewMode', mode); const ck = s.ui.clock; ck.set(+jd); ck.paused = true; ck.emit(); }, [arg('mode', 'scientific'), arg('jd', '2461314.5')]);
// --set k=v,k2=v2: diagnostic settings (e.g. atmospheres=false to isolate the surface term); recorded in every row
const SETS = (arg('set', '') || '').split(',').filter(Boolean).map(kv => { const [k, v] = kv.split('='); return [k, v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v]; });
if (SETS.length) await page.evaluate((S) => { for (const [k, v] of S) window.__sol.settings.set(k, v); }, SETS);
const rows = [];
// v3.8.1: the FIRST sample of a run was taken before streaming/ephemerides settled (titan-l2a: requested 20°, measured 84°,
// flux ×10⁸ — another body in the read window). A discarded warm-up sample now precedes the list, and every row reports
// the measured phase so a misplaced sample is visible.
const JD0 = +arg('jd', '2461314.5');   // --jd: probe epoch (TT); the preflight checks every sample against it
// Quantities, kept apart: Fmeas = physical flux in engine units recovered from the scene-linear HDR target (signal × pxAng²
// ÷ displayExposure); Fpt = the committed point flux (exposure removed); Fref = Lambert reference (geometric albedo);
// X = DISPLAY EXPOSURE (a scale factor, never a flux); hdr.peak/median = scene-linear radiance ÷ X. No tone-mapped pixels.
function preflight(r, req) {
  const w = [];
  if (SHADER_ERR.length) w.push(`shader/page errors in session (${SHADER_ERR.length}): ${SHADER_ERR[0]}`);
  if (r.id !== req.id || r.pre?.target !== req.id) w.push(`target ${r.pre?.target} ≠ ${req.id}`);
  if (!(Math.abs(r.alphaDeg - req.alpha) <= 1)) w.push(`phase ${r.alphaDeg?.toFixed(2)}° vs requested ${req.alpha}°`);
  if (r.pre?.jd != null && Math.abs(r.pre.jd - JD0) > 1e-6) w.push(`epoch ${r.pre.jd} ≠ ${JD0}`);
  if (!(r.X > 0 && isFinite(r.X))) w.push(`display exposure ${r.X}`);
  if (!r.pre?.evConverged) w.push('exposure not converged');
  // a build older than QA-381-03 cannot report readiness: rejected unless --legacy-ok 1 (then flagged in r.warn)
  if (r.pre?.legacy) { if (arg('legacy-ok', '0') !== '1') w.push('legacy build: LUT/disc readiness unverifiable'); else r.warn = 'legacy build: readiness unverified'; }
  else { if (r.pre?.texReady === false) w.push(`surface textures not ready ${JSON.stringify(r.pre.tex)}`); if (!r.pre?.lutReady) w.push('atmosphere LUTs not ready'); if (!r.pre?.discReady) w.push('CPU disc table not ready'); }
  if (r.pre?.hasAtmo && !r.pre?.atmospheres && !SETS.some(([k]) => k === 'atmospheres')) w.push('atmospheres disabled');
  if (SETS.length) r.sets = Object.fromEntries(SETS);
  if (r.Fmeas == null || !isFinite(r.Fmeas)) w.push('no HDR readback');
  // QA-381-04: the HDR signal must be luminance (Y709); older builds summed (R+G+B)/3 (red bodies over-read, Mars ×1.16)
  else if (r.hdr?.quantity !== 'Y709') { if (arg('legacy-ok', '0') !== '1') w.push('HDR signal is mean-RGB, not luminance (pre QA-381-04 build)'); else r.warn = (r.warn ? r.warn + '; ' : '') + 'HDR signal mean-RGB (pre QA-381-04)'; }
  if (req.rpx < 0.55 && !(r.Fpt > 0)) w.push('point entry not found');
  if (r.Fmeas != null && r.Fref > 0 && (r.meas_ref > 1e4 || r.meas_ref < 1e-4) && req.alpha < 170) w.push(`flux ratio ${r.meas_ref} implausible (contaminated window?)`);
  return w;
}
const combos = [];
for (const id of arg('bodies', 'callisto,rhea,titan').split(','))
  for (const alpha of arg('alpha', '10,60,120').split(',').map(Number))
    for (const rpx of arg('rpx', '12,0.45').split(',').map(Number)) combos.push([id, alpha, rpx]);
const queue = [[...combos[0], 0, true], ...combos.map(c => [...c, 0, false])];
while (queue.length) { const [id, alpha, rpx, tries, warm] = queue.shift();
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
        const P = e.points; let Fpt = 0, best = 0;   // the body's committed point flux (Y709 luminance like qaReadHDR — QA-381-04b, was mean RGB; exposure removed): the entry nearest the view axis
        const fw = e.camera.getWorldDirection(e.camera.position.clone());
        for (let k = 0; k < P.count; k++) { const q = [P.pos[k * 3], P.pos[k * 3 + 1], P.pos[k * 3 + 2]], l = Math.hypot(...q); if (!l) continue;
          const c = (q[0] * fw.x + q[1] * fw.y + q[2] * fw.z) / l; if (c > best) { best = c; Fpt = (0.2126 * P.flux[k * 3] + 0.7152 * P.flux[k * 3 + 1] + 0.0722 * P.flux[k * 3 + 2]) / X; } }
        if (best < Math.cos(3 * pxAng)) Fpt = 0;
        const Fmeas = hdr ? hdr.signal * pa * pa / X : null;
        const vU = e.views.get(id)?.U, geo = vU ? { camLocal: vU.cam.value.toArray(), sunLocal: vU.sunPos.value.toArray() } : null;
        const st = e.qaAtmoState ? e.qaAtmoState(b) : { legacy: true }, jd = s.ui.clock.jd ?? null;
        return { geo, pre: { ...st, jd, evConverged: Math.abs(e.diagnostics().exposureEV - evp) < 0.05, hdrFloat: !!hdr && hdr.half !== undefined, window: hdr?.w, target: s.engine.rig.target?.id }, id, kind: b.def?.kind, p: b.albedo, alphaDeg: al * 180 / Math.PI, rpx, ev: e.diagnostics().exposureEV, X, pxAng: pa, w, Fmeas, Fref, Fpt, meas_ref: Fmeas / Fref, pt_ref: Fpt / Fref, hdr: hdr && { peak: hdr.peak / X, median: hdr.median / X, half: hdr.half, W: hdr.W, quantity: hdr.quantity } };
      }, { id, alpha, rpx });
      info.ms = Date.now() - t0; info.reqAlpha = alpha;
      // QA-381-03 preflight: a sample is used only when its measurement conditions are verified; otherwise it is retried
      // (readiness) and finally recorded with valid:false and its reasons — never folded into a conclusion.
      const why = preflight(info, { id, alpha, rpx });
      info.valid = why.length === 0; info.invalid = why;
      if (warm) { console.log('warm-up', JSON.stringify(info)); continue; }
      info.tries = tries + 1;
      if (!info.valid && tries < 2 && why.some(w => /ready|converg/.test(w))) { console.log('retry', why.join('; ')); queue.unshift([id, alpha, rpx, tries + 1, false]); await new Promise(r => setTimeout(r, 2000)); continue; }
      rows.push(info); console.log(JSON.stringify(info));
      fs.writeFileSync(`${out}/photometry.json`, JSON.stringify({ bootMs: boot, assetWarnings: ASSET_WARN, rows, valid: rows.filter(r => r.valid).length, invalid: rows.filter(r => !r.valid).map(r => ({ id: r.id, alpha: r.reqAlpha, rpx: r.rpx, why: r.invalid })) }, null, 1));
    }
await browser.close(); if (SRV) { console.log('snapserver', JSON.stringify({ requests: SRV.stats.requests, missing: SRV.stats.missing.slice(0, 20) })); SRV.close(); }
