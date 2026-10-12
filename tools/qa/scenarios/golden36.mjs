// SOL v3.6 matched-comparison capture set (runs unchanged against the v3.5 baseline tree for fair A/B).
// Fixed epoch 2026-10-08 12:00 UTC unless a view searches a date for a requested solar elevation at a surface site
// (the same search runs on both trees, so both see the same date). Software-adapter captures: not final-look evidence.
import path from 'node:path';
import fs from 'node:fs';
export const EPOCH_MS = Date.UTC(2026, 9, 8, 12, 0, 0);
const AU = 149597870.7, RS = 695700;
export const ALL = [
  ['earth-orbit', 'earth', 3.2], ['earth-terminator', 'earth', { radii: 3.2, yawOff: 2.4 }], ['earth-limb', 'earth', { altKm: 400, look: 1.12 }],
  ['mars', 'mars', 3.2], ['mars-crescent', 'mars', { radii: 3.2, yawOff: 2.6 }], ['mars-limb', 'mars', { altKm: 250, look: 1.1 }],
  ['venus', 'venus', 3.2], ['titan', 'titan', 3.2], ['jupiter', 'jupiter', 3.5], ['saturn-backlit', 'saturn', { radii: 6.5, yawOff: 2.9, pitch: 0.12 }],
  ['ring-flythrough', 'saturn', { ring: { r: 128000, z: 0.02, lookPitch: -0.12, lookYaw: 0.5 } }], ['earth-polar', 'earth', { radii: 3.2, pitch: 1.35 }], ['mars-night', 'mars', { radii: 3.2, yawOff: Math.PI }], ['mars-polar', 'mars', { radii: 3.2, pitch: 1.35 }],
  ['moon', 'moon', 3.0], ['moon-terrain', 'moon', { altKm: 25, look: 1.2 }], ['mars-terrain', 'mars', { altKm: 40, look: 1.2 }],
  ['moon-hadley', 'moon', { site: { lat: 26.1, lon: 3.65, alt: 6, sunEl: 9, rel: 80, down: 0.22, span: 30, step: 0.25 } }],
  ['moon-tycho', 'moon', { site: { lat: -41.0, lon: 348.8, alt: 30, sunEl: 18, rel: 180, down: 0.42, span: 30, step: 0.25 } }],
  ['mars-gale', 'mars', { site: { lat: -4.2, lon: 137.6, alt: 9, sunEl: 14, rel: 200, down: 0.3, span: 1.03, step: 0.01 } }],
  ['mars-candor', 'mars', { site: { lat: -4.5, lon: 287.0, alt: 14, sunEl: 20, rel: 160, down: 0.38, span: 1.03, step: 0.01 } }],
  ['mars-olympus', 'mars', { site: { lat: 15.5, lon: 226.2, alt: 70, sunEl: 22, rel: 0, down: 0.55, span: 1.03, step: 0.01 } }],
  ['mars-gale-noatmo', 'mars', { set: { atmospheres: false }, site: { lat: -4.2, lon: 137.6, alt: 9, sunEl: 14, rel: 200, down: 0.3, span: 1.03, step: 0.01 } }],
  ['sun-0.05AU', 'sun', { km: 0.05 * AU }], ['sun-limb', 'sun', { km: 1.25 * RS, look: 0.5 }], ['sun-close', 'sun', { km: 1.06 * RS, look: 1.0 }], ['sun-grazing', 'sun', { km: 1.012 * RS, look: 1.33 }],
];
export default async function (page, { out }) {
  const only = (process.env.VIEWS || '').split(',').filter(Boolean);
  const VIEWS = only.length ? only.map(n => ALL.find(v => v[0] === n)).filter(Boolean) : ALL;
  const shots = [];
  const MODE = process.env.MODE || null;
  if (MODE) await page.evaluate((m) => { const s = window.__sol; s.settings.set('viewMode', m); }, MODE);
  await page.evaluate(() => { const e = window.__sol.engine; if ('terrainBuildMs' in e) e.terrainBuildMs = 400; });
  await page.evaluate((ms) => { const s = window.__sol; document.querySelector('#loader .enter, #loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.body.classList.add('cine');
    s.clock.paused = true; const jdUtc = ms / 86400000 + 2440587.5; s.clock.set(jdUtc + 69.184 / 86400); s.advance(); }, EPOCH_MS);
  for (const [name, id, d] of VIEWS) {
    const t0 = Date.now();
    const info = await page.evaluate(async ([id, d, ms]) => {
      const s = window.__sol, b = s.sys.get(id); if (!b) return { missing: id };
      { const jdUtc = ms / 86400000 + 2440587.5; s.clock.set(jdUtc + 69.184 / 86400); s.advance(); }
      const r = s.engine.rig; r.flight = null; s.ui.select(b, false); s.ui.following = true;
      // per-view settings (diagnostic variants), reverted at the start of the next view
      if (window.__qaRestore) { for (const [k, v] of Object.entries(window.__qaRestore)) s.settings.set(k, v); window.__qaRestore = null; }
      if (d && d.set) { window.__qaRestore = {}; for (const [k, v] of Object.entries(d.set)) { window.__qaRestore[k] = s.settings.get(k); s.settings.set(k, v); } }
      const frames = (n) => new Promise(res => { const f0 = window.__frames; const chk = () => { s.engine.settleExposure(); return window.__frames - f0 >= n ? res(0) : requestAnimationFrame(chk); }; chk(); });
      const M = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
      const nrm = (v) => { const l = Math.hypot(...v); return v.map(x => x / l); };
      const dotp = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
      const crs = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
      if (d.ring) {
        const m = b.rot, l = [d.ring.r * Math.cos(0.7), d.ring.r * Math.sin(0.7), d.ring.z];
        const pos = [0, 1, 2].map(i => b.pos[i] + m[i * 3] * l[0] + m[i * 3 + 1] * l[1] + m[i * 3 + 2] * l[2]);
        r.tFov = r.fov = 60; r.target = b; r.mode = 'orbit'; r.pos = pos; r.setTarget(b); r.lookPitch = d.ring.lookPitch; r.lookYaw = d.ring.lookYaw;
        await frames(4); return { id, ring: s.engine.ringFieldState, diag: s.engine.diagnostics() };
      }
      if (d.site) {
        const S = d.site, la = S.lat * Math.PI / 180, lo = S.lon * Math.PI / 180;
        const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
        const east = nrm([-Math.sin(lo), Math.cos(lo), 0]), north = crs(up, east);
        // date search: solar elevation at the site closest to the target, Sun rising (morning shadows), same on both trees
        const jd0 = s.sys.jd; let best = null;
        const elev = () => { const sd = nrm(M(b.rot, [0, 0, 0]).map((_, i) => 0)); const sl = nrm(b.rot ? (() => { const v = [s.sys.sun.pos[0] - b.pos[0], s.sys.sun.pos[1] - b.pos[1], s.sys.sun.pos[2] - b.pos[2]]; const m = b.rot; return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]; })() : [1, 0, 0]); void sd; return sl; };
        for (let t = -S.span; t <= S.span; t += S.step) {
          s.clock.set(jd0 + t); s.advance(); const sl = elev(), e = Math.asin(dotp(sl, up)) * 180 / Math.PI;
          s.clock.set(jd0 + t + S.step * 0.1); s.advance(); const e2 = Math.asin(dotp(elev(), up)) * 180 / Math.PI;
          if (e2 > e && (!best || Math.abs(e - S.sunEl) < best.err)) best = { t, err: Math.abs(e - S.sunEl), e };
        }
        s.clock.set(jd0 + best.t); s.advance();
        const sl = elev(); const sunAz = Math.atan2(dotp(sl, east), dotp(sl, north));
        const az = sunAz + (S.rel ?? 90) * Math.PI / 180;
        const hd = [0, 1, 2].map(i => Math.cos(az) * north[i] + Math.sin(az) * east[i]);
        const fB = nrm([0, 1, 2].map(i => Math.cos(S.down) * hd[i] - Math.sin(S.down) * up[i]));
        const place = () => { const gR = s.engine.groundRadius(b, up); const pB = up.map(x => x * (gR + S.alt)); const pE = M(b.rot, pB); return [b.pos[0] + pE[0], b.pos[1] + pE[1], b.pos[2] + pE[2]]; };
        s.ui.following = false; r.tFov = r.fov = 60; r.target = b; r.mode = 'free'; r.freeVel = [0, 0, 0]; r.lookYaw = r.lookPitch = 0;
        const aim = () => { const p = place(); r.pos = p; const f = M(b.rot, fB); r.quat.copy(r.lookQuat(p, [p[0] + f[0], p[1] + f[1], p[2] + f[2]], M(b.rot, up))); };
        aim();
        const tw = performance.now(); while (!s.engine.views.get(b.id)?.terrain && performance.now() - tw < 30000) await new Promise(res => setTimeout(res, 250));
        // stream until the patch set is stable (no builds, nothing provisional) or 40 s
        let last = -1, stable = 0; const ts = performance.now();
        while (performance.now() - ts < 40000 && stable < 3) { aim(); await frames(1); const st = s.engine.terrainStats || {}; const k = (st.built ?? 0) + (st.rebuilt ?? 0); stable = (k === last && !(st.provisional > 0) && !(st.tiles?.loading > 0)) ? stable + 1 : 0; last = k; }
        aim(); await frames(2);
        const rel = [r.pos[0] - b.pos[0], r.pos[1] - b.pos[1], r.pos[2] - b.pos[2]];
        const camAlt = Math.hypot(...rel) - s.engine.groundRadius(b, up), vw = s.engine.views.get(b.id);
        return { id, camAltKm: camAlt, tier: vw?.tier, useTerrain: vw?.useTerrain, site: S, sunElevation: best.e, jd: s.sys.jd, terrain: s.engine.terrainStats, diag: s.engine.diagnostics() };
      }
      if (typeof d === 'object') { s.settings.set('sunLook', d.sunLook ?? 'natural'); }
      const dist = typeof d === 'number' ? Math.max(b.radii[0], b.radius) * d : d.radii ? Math.max(b.radii[0], b.radius) * d.radii : d.altKm ? Math.max(b.radii[0], b.radius) + d.altKm : d.km;
      let [y, p0] = r.niceAngles(b); let p = typeof d === 'object' && d.pitch ? d.pitch : p0;
      if (typeof d === 'object' && d.yawOff) y += d.yawOff;
      r.tFov = r.fov = 50; r.target = b; r.mode = 'orbit'; r.yaw = r.tYaw = y; r.pitch = r.tPitch = p; r.dist = r.tDist = dist; r.lookYaw = r.lookPitch = 0;
      r.pos = r.orbitPos(b, y, p, dist);
      if (d.look) r.lookPitch = d.look;
      if (b.def.terrain && (d.altKm || d.radii < 1.6)) { const t0 = performance.now(); while (!s.engine.views.get(b.id)?.terrain && performance.now() - t0 < 30000) await new Promise(res => setTimeout(res, 250)); await frames(12); }
      await frames(3);
      return { id, distKm: dist, terrain: s.engine.terrainStats, diag: s.engine.diagnostics() };
    }, [id, d, EPOCH_MS]);
    // v3.6/3.7 per-image metadata record (spec v3.7 §32)
    const meta = await page.evaluate(([name, id, d]) => {
      const s = window.__sol, e = s.engine, r = e.rig, b = s.sys.get(id), sun = s.sys.sun;
      const rel = [r.pos[0] - b.pos[0], r.pos[1] - b.pos[1], r.pos[2] - b.pos[2]], dist = Math.hypot(...rel);
      const ts = [sun.pos[0] - b.pos[0], sun.pos[1] - b.pos[1], sun.pos[2] - b.pos[2]], tl = Math.hypot(...ts);
      const phase = Math.acos(Math.max(-1, Math.min(1, (rel[0] * ts[0] + rel[1] * ts[1] + rel[2] * ts[2]) / (dist * tl)))) * 180 / Math.PI;
      const v = e.views.get(id), dg = e.diagnostics();
      return { image: name + '.png', version: window.__solVersion ?? null, object: id, view: name, request: d,
        camera: { posHelioEclKm: r.pos, quat: [r.quat.x, r.quat.y, r.quat.z, r.quat.w], fovDeg: r.fov, mode: r.mode, distanceKm: dist, altitudeKm: dist - Math.max(b.radii[0], b.radius) },
        simJdTT: s.sys.jd, simUtc: new Date((s.sys.jd - 69.184 / 86400 - 2440587.5) * 86400000).toISOString(), viewingMode: s.settings.get('viewMode'), phaseAngleDeg: phase,
        quality: s.settings.get('quality'), toneMap: s.settings.get('toneMap'), exposureEV: dg.exposureEV, skyEV: dg.view?.skyEV, detailTier: v?.tier ?? null,
        terrain: e.terrainStats ? { maxLevel: e.terrainStats.maxLevel, finestData: e.terrainStats.finestData, patches: e.terrainStats.patches, provisional: e.terrainStats.provisional } : null,
        rings: e.ringDiag ? e.ringDiag(id) : null, backend: dg.backend, adapter: dg.adapter, resolution: [innerWidth * devicePixelRatio, innerHeight * devicePixelRatio],
        limitations: 'Software WebGPU (SwiftShader) capture; not real-GPU look or performance evidence' };
    }, [name, id, d]);
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file, timeout: 180000 });
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(meta, null, 1));
    shots.push({ name, file, wallMs: Date.now() - t0, ...info });
    console.error('captured', name, Date.now() - t0, 'ms');
  }
  return { epochUtcMs: EPOCH_MS, shots };
}
