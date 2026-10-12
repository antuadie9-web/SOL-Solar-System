// Debug probe: guide opacity state at a Solar-System overview (QA only).
export default async function (page) {
  await page.evaluate(() => { const s = window.__sol; document.querySelector('#loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); s.settings.set('onboarded', true); });
  await page.waitForTimeout(800);
  return await page.evaluate(async () => {
    const s = window.__sol, AU = 149597870.7; s.ui.select(null); const r = s.engine.rig, sun = s.sys.sun; r.flight = null; r.target = sun; r.yaw = r.tYaw = -1.2; r.pitch = r.tPitch = 0.55; r.dist = r.tDist = 42 * AU; r.pos = r.orbitPos(sun, -1.2, 0.55, 42 * AU); r.setTarget(sun);
    const f0 = window.__frames; await new Promise(res => { const chk = () => window.__frames - f0 >= 6 ? res(0) : requestAnimationFrame(chk); chk(); });
    const o = {}; for (const id of ['earth', 'jupiter', 'neptune', 'moon']) { const ob = s.engine.orbits.get(id); o[id] = { alpha: s.engine.orbitAlpha.get(id), vis: ob?.set.mesh.visible, op: ob?.set.U.opacity.value }; }
    return { glare: s.engine.glare.U.flux.value, gf: s.engine.glareFlux, sunRpx: s.engine.sunRpx, exp: s.engine.expDebug, pts: s.engine.points?.count ?? null, sunScr: s.engine.screen.get('sun'), o, settings: { orbits: s.settings.get('orbits'), mode: s.settings.get('guideMode') }, ev: s.engine.diagnostics().exposureEV };
  });
}
