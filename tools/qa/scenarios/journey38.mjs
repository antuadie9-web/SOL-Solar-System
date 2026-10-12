// SOL v3.8 first genuine interstellar journey (spec §24): Earth → distant Sun → Proxima Centauri region → look back at the
// Sun → Alpha Centauri → return to Earth. The flight is the application's own travel (rig.goTo through ui.select), with the
// flight clock driven to fixed fractions so the ordered still frames are reproducible on a slow software adapter.
// Every frame records the camera's heliocentric position, its distance to Sun and Proxima, the target's catalogue data and
// a precision check (finite state, distance monotonic along the leg).
import fs from 'node:fs'; import path from 'node:path';
const FR = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95, 1];
export default async function (page, { out }) {
  const shots = [];
  const meta = async (name, extra = {}) => page.evaluate(([name, extra]) => {
    const s = window.__sol, r = s.engine.rig, PC = 3.0856775814913673e13, AU = 149597870.7;
    const prox = s.sys.get('star:proxima-centauri'), d = (b) => b ? Math.hypot(r.pos[0] - b.pos[0], r.pos[1] - b.pos[1], r.pos[2] - b.pos[2]) : null;
    return { image: name + '.png', version: window.__solVersion, camera: { posHelioEclKm: r.pos, quat: [r.quat.x, r.quat.y, r.quat.z, r.quat.w], fovDeg: r.fov, mode: r.mode },
      distSunKm: Math.hypot(...r.pos), distSunPc: Math.hypot(...r.pos) / PC, distSunAU: Math.hypot(...r.pos) / AU, distProximaKm: d(prox), distProximaAU: prox ? d(prox) / AU : null,
      target: r.target ? { id: r.target.id, name: r.target.name, info: r.target.info } : null, finite: r.pos.every(Number.isFinite), flying: r.flying,
      exposureEV: s.engine.diagnostics().exposureEV, sunPointExposure: s.engine.sunPointExposure, glare: s.engine.glareDisplay, hud: document.querySelector('#tele .alt')?.textContent ?? null,
      viewingMode: s.settings.get('viewMode'), simJdTT: s.sys.jd, catalog: window.__solStars ? { counts: window.__solStars.counts(), resident: window.__solStars.resident().length, residentIds: window.__solStars.resident().map(x => x.id) } : null, limitations: 'Software WebGPU (SwiftShader) capture; Proxima drawn as a calibrated point source (no resolved stellar surface in v3.8)', ...extra };
  }, [name, extra]);
  const snap = async (name, extra) => { const m = await meta(name, extra); await page.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 }); fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(m, null, 1)); shots.push(m); console.error('captured', name, m.distSunPc.toFixed(5), 'pc'); };
  const frames = (n) => page.evaluate((n) => new Promise(res => { const f0 = window.__frames; const chk = () => { window.__sol.engine.settleExposure(); return window.__frames - f0 >= n ? res(0) : requestAnimationFrame(chk); }; chk(); }), n);
  await page.evaluate(() => { document.querySelector('#loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); const s = window.__sol; s.clock.paused = true; s.settings.set('viewMode', 'exploration'); document.body.classList.remove('cine'); });
  await page.waitForTimeout(500);
  // start at Earth (orbit view), the opening flight finished
  await page.evaluate(() => { const s = window.__sol, e = s.sys.get('earth'), r = s.engine.rig; r.flight = null; s.ui.select(e, false); r.mode = 'orbit'; r.target = e; r.dist = r.tDist = 6378 * 4; r.pos = r.orbitPos(e, r.yaw, r.pitch, r.dist); });
  await frames(3); await snap('journey-00-earth');
  // the 3-D star layer streams only beyond 300 AU; make sure the shards near the destination are resident before arrival
  const leg = async (id, tag) => {
    await page.evaluate((id) => { const s = window.__sol; s.ui.select(s.sys.get(id), true); const f = s.engine.rig.flight; if (f) { f.dur = 1e12; f.t0 = performance.now(); } }, id);
    for (const [k, fr] of FR.entries()) {
      await page.evaluate((fr) => { const f = window.__sol.engine.rig.flight; if (f) f.t0 = performance.now() - fr * f.dur; }, fr);
      await frames(fr === 1 ? 3 : 2);
      if (fr === 1) await page.waitForTimeout(3000);   // star shards stream in at the destination
      await frames(1);
      await snap(`journey-${tag}-f${String(k).padStart(2, '0')}`, { legFraction: fr });
    }
  };
  await leg('star:proxima-centauri', '10-to-proxima');
  // at Proxima: look back at the Sun (it should be a ~0.4-mag star, not invisible and not a giant sprite)
  await page.evaluate(() => { const s = window.__sol, r = s.engine.rig; r.flight = null; r.mode = 'free'; r.freeVel = [0, 0, 0]; r.lookYaw = r.lookPitch = 0; r.quat.copy(r.lookQuat(r.pos, [0, 0, 0], [0, 0, 1])); });
  await frames(3); await snap('journey-20-sun-from-proxima');
  await page.evaluate(() => { const s = window.__sol, r = s.engine.rig, a = s.sys.get('star:rigil-kentaurus'); r.quat.copy(r.lookQuat(r.pos, a.pos, [0, 0, 1])); });
  await frames(3); await snap('journey-21-alpha-centauri-from-proxima');
  await page.evaluate(() => { const s = window.__sol, r = s.engine.rig; r.mode = 'orbit'; });
  await leg('earth', '30-return-earth');
  fs.writeFileSync(path.join(out, 'journey.json'), JSON.stringify(shots, null, 1));
  return { shots: shots.length };
}
