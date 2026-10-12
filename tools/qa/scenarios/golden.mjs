// Golden-view capture (master spec §13.C subset available before terrain/galaxy phases).
// Fixed epoch 2026-10-08 12:00 UTC, paused clock, camera placed through the app's rig, exposure settled
// deterministically (engine.settleExposure), UI hidden (cinematic mode). Software-adapter captures prove the views
// render without errors; they are NOT final-look or performance evidence.
import path from 'node:path';
export const EPOCH_MS = Date.UTC(2026, 9, 8, 12, 0, 0);
const AU = 149597870.7;
const ALL = [
  ['earth-orbit', 'earth', 3.2], ['moon', 'moon', 3.0], ['sun-0.05AU', 'sun', { km: 0.05 * AU }], ['sun-1AU', 'sun', { km: AU }], ['sun-5AU', 'sun', { km: 5 * AU }],
  ['sun-30AU', 'sun', { km: 30 * AU }], ['eclipse-total', 'sun', { eclipse: 200000 }], ['eclipse-partial', 'sun', { eclipse: 200000, offset: 2500 }], ['jupiter', 'jupiter', 3.5], ['saturn', 'saturn', 6.5], ['mars', 'mars', 3.2], ['pluto', 'pluto', 3.5], ['bennu', 'bennu', 4], ['titania', 'titania', 3.0], ['oberon', 'oberon', 3.0], ['moon-terrain', 'moon', { altKm: 25, look: 1.2 }], ['mars-terrain', 'mars', { altKm: 40, look: 1.2 }],
  // v3.3 additions: Sun tuning distances (spec §7/§9), limb close-up, body-identity atlas (spec §15 visual regression)
  ['sun-0.2AU', 'sun', { km: 0.2 * AU }], ['sun-0.5AU', 'sun', { km: 0.5 * AU }], ['sun-limb', 'sun', { km: 1.25 * 695700, look: 0.5 }],
  ['sun-0.05AU-cinematic', 'sun', { km: 0.05 * AU, sunLook: 'cinematic' }], ['sun-0.05AU-scientific', 'sun', { km: 0.05 * AU, sunLook: 'scientific' }],
  ['hyperion', 'hyperion', 4], ['itokawa', 'itokawa', 4], ['ryugu', 'ryugu', 4], ['phobos', 'phobos', 4], ['eros', 'eros', 4], ['cg67p', 'cg67p', 4],
  ['halley', 'halley', 4], ['haumea', 'haumea', 3.5], ['miranda', 'miranda', 3.2], ['umbriel', 'umbriel', 3.2], ['pallas', 'pallas', 3.5], ['psyche', 'psyche', 3.8],
  ['lutetia', 'lutetia', 3.8], ['ida', 'ida', 4], ['amalthea', 'amalthea', 4], ['phoebe', 'phoebe', 3.6], ['eris', 'eris', 3.2], ['sedna', 'sedna', 3.2],
  ['io', 'io', 3.2], ['europa', 'europa', 3.2], ['ganymede', 'ganymede', 3.2], ['callisto', 'callisto', 3.2], ['ceres', 'ceres', 3.2], ['vesta', 'vesta', 3.5],
  // v3.4 additions: every body whose map changed (AST-003 replacement) + Titan
  ['enceladus', 'enceladus', 3.2], ['tethys', 'tethys', 3.2], ['dione', 'dione', 3.2], ['rhea', 'rhea', 3.2], ['mimas', 'mimas', 3.2], ['iapetus', 'iapetus', 3.2],
  ['triton', 'triton', 3.2], ['charon', 'charon', 3.2], ['titan', 'titan', 3.2], ['pluto-close', 'pluto', 1.6],
  // v3.4 ring near-field slice: inside the A ring (r = 128,000 km), 20 m above the mid-plane, looking toward Saturn
  ['ring-flythrough', 'saturn', { ring: { r: 128000, z: 0.02, lookPitch: -0.12, lookYaw: 0.5 } }], ['ring-flythrough-B', 'saturn', { ring: { r: 105000, z: 0.015, lookPitch: -0.25, lookYaw: 1.2 } }],
  // v3.5 lighting & visibility matrix (spec v3.5 §29): night sides, terminators, backlit views, Milky Way behind worlds
  ['earth-night', 'earth', { radii: 3.2, yawOff: Math.PI }], ['earth-terminator', 'earth', { radii: 3.2, yawOff: 2.4 }], ['earth-polar', 'earth', { radii: 3.2, pitch: 1.35 }],
  ['moon-night', 'moon', { radii: 3.0, yawOff: Math.PI }], ['moon-side', 'moon', { radii: 3.0, yawOff: 2.3 }],
  ['mars-night', 'mars', { radii: 3.2, yawOff: Math.PI }], ['mars-crescent', 'mars', { radii: 3.2, yawOff: 2.6 }],
  ['jupiter-night', 'jupiter', { radii: 3.5, yawOff: 2.7 }], ['saturn-backlit', 'saturn', { radii: 6.5, yawOff: 2.9, pitch: 0.12 }],
  ['earth-mw', 'earth', { radii: 4.0, toward: 'gc' }], ['jupiter-mw', 'jupiter', { radii: 6.0, toward: 'gc' }], ['moon-mw', 'moon', { radii: 5.0, toward: 'gc' }],
  ['earth-far', 'earth', { radii: 60 }], ['earth-veryfar', 'earth', { radii: 2000 }],
  ['saturn-guides', 'saturn', { km: 3.0e6, guides: 'system' }], ['neptune-guides', 'neptune', { km: 1.2e6, guides: 'focused' }], ['system-overview', 'sun', { km: 40 * AU, guides: 'clean', pitch: 0.6 }],
];
export default async function (page, { out }) {
  const only = (process.env.VIEWS || '').split(',').filter(Boolean);
  const VIEWS = only.length ? ALL.filter(v => only.includes(v[0])) : ALL;
  const shots = [];
  const MODE = process.env.MODE || null;
  if (MODE) await page.evaluate((m) => { const s = window.__sol; if (s.settings.get('viewMode') !== undefined) s.settings.set('viewMode', m); }, MODE);
  await page.evaluate((ms) => { const s = window.__sol; document.querySelector('#loader .enter, #loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.body.classList.add('cine');
    s.clock.paused = true; const jdUtc = ms / 86400000 + 2440587.5; s.clock.set(jdUtc + 69.184 / 86400); s.advance(); }, EPOCH_MS);
  for (const [name, id, d] of VIEWS) {
    const t0 = Date.now();
    const info = await page.evaluate(async ([id, d, ms]) => {
      const s = window.__sol, b = s.sys.get(id); if (!b) return { missing: id };
      // v3.5 harness fix: every view starts at the fixed epoch. v3.3/v3.4 never restored the clock after the eclipse view
      // (2026-08-12), so every view captured after it in the same run silently used the eclipse date.
      { const jdUtc = ms / 86400000 + 2440587.5; s.clock.set(jdUtc + 69.184 / 86400); s.advance(); }
      const r = s.engine.rig; r.flight = null; s.ui.select(b, false); s.ui.following = true;
      if (d.eclipse) {
        // 2026-08-12 total solar eclipse: put the camera in the Moon's shadow cone, looking at the Sun
        const jdUtc = Date.UTC(2026, 7, 12, 17, 46) / 86400000 + 2440587.5; s.clock.set(jdUtc + 69.184 / 86400); s.advance();
        const m = s.sys.get('moon'), L = Math.hypot(...m.pos), u = m.pos.map(x => x / L);
        const side = [-u[1], u[0], 0]; const sl = Math.hypot(...side);
        const pos = m.pos.map((x, i) => x + u[i] * d.eclipse + (d.offset ?? 0) * side[i] / sl);
        r.target = b; r.mode = 'orbit'; r.pos = pos; r.setTarget(b); r.lookYaw = r.lookPitch = 0; r.tFov = r.fov = 8;
        const f0 = window.__frames;
        await new Promise(res => { const chk = () => { s.engine.settleExposure(); return window.__frames - f0 >= 3 ? res(0) : requestAnimationFrame(chk); }; chk(); });
        const res = { id, eclipse: true, sunVisible: s.engine.sunVisibility(pos), diag: s.engine.diagnostics() };
        return res;
      }
      if (d.ring) {
        const m = b.rot, l = [d.ring.r * Math.cos(0.7), d.ring.r * Math.sin(0.7), d.ring.z];
        const pos = [0, 1, 2].map(i => b.pos[i] + m[i * 3] * l[0] + m[i * 3 + 1] * l[1] + m[i * 3 + 2] * l[2]);
        r.tFov = r.fov = 60; r.target = b; r.mode = 'orbit'; r.pos = pos; r.setTarget(b); r.lookPitch = d.ring.lookPitch; r.lookYaw = d.ring.lookYaw;
        const f0 = window.__frames;
        await new Promise(res => { const chk = () => { s.engine.settleExposure(); return window.__frames - f0 >= 4 ? res(0) : requestAnimationFrame(chk); }; chk(); });
        return { id, ring: s.engine.ringFieldState, diag: s.engine.diagnostics() };
      }
      if (typeof d === 'object') { s.settings.set('sunLook', d.sunLook ?? 'natural'); if (d.guides) { s.settings.set('orbits', true); s.settings.set('guideMode', d.guides); } }
      const dist = typeof d === 'number' ? Math.max(b.radii[0], b.radius) * d : d.radii ? Math.max(b.radii[0], b.radius) * d.radii : d.altKm ? Math.max(b.radii[0], b.radius) + d.altKm : d.km;
      let [y, p0] = r.niceAngles(b); let p = typeof d === 'object' && d.pitch ? d.pitch : p0;
      if (typeof d === 'object' && d.yawOff) y += d.yawOff;
      // look toward the Galactic centre (ecliptic λ 266.84°, β −5.54°, J2000) with the body in front of it
      if (typeof d === 'object' && d.toward === 'gc') { const l = 266.84 * Math.PI / 180, bb = -5.54 * Math.PI / 180; y = l + Math.PI; p = -bb; }
      r.tFov = r.fov = 50; r.target = b; r.mode = 'orbit'; r.yaw = r.tYaw = y; r.pitch = r.tPitch = p; r.dist = r.tDist = dist; r.lookYaw = r.lookPitch = 0;
      r.pos = r.orbitPos(b, y, p, dist);
      if (d.look) r.lookPitch = d.look;
      if (b.def.terrain) { const t0 = performance.now(); while (!s.engine.views.get(b.id)?.terrain && performance.now() - t0 < 30000) await new Promise(res => setTimeout(res, 250)); }
      const f0 = window.__frames;
      await new Promise(res => { const chk = () => { s.engine.settleExposure(); return window.__frames - f0 >= 3 ? res(0) : requestAnimationFrame(chk); }; chk(); });
      return { id, distKm: dist, tier: b.ephemTier(), terrain: s.engine.terrainStats, diag: s.engine.diagnostics() };
    }, [id, d, EPOCH_MS]);
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file, timeout: 180000 });
    shots.push({ name, file, wallMs: Date.now() - t0, ...info });
    console.error('captured', name, Date.now() - t0, 'ms');
  }
  return { epochUtcMs: EPOCH_MS, shots };
}
