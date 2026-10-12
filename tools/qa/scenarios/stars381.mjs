// SOL v3.8.1 (STAR-J01 rendered-frame verification). Camera in orbit mode around a catalogue star at distance D with the
// simulation clock advancing between frames (the star moves with its proper motion; the camera follows it in float64,
// exactly as CameraRig does). A crop around the screen centre is saved for every frame; tools/qa/star_centroids.py measures
// the star's centroid in each crop. A correct renderer keeps the centroid fixed (the camera always aims at the star).
// env: STAR (default "Proxima Centauri"), DISTS (AU list, default "5,1,0.3"), NF (frames per distance, default 8)
import fs from 'node:fs';
import path from 'node:path';
export default async function (page, { out }) {
  const star = process.env.STAR || 'Proxima Centauri', dists = (process.env.DISTS || '5,1,0.3').split(',').map(Number), NF = +(process.env.NF || 8);
  await page.evaluate(() => { document.querySelector('#loader .enter, #loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); document.body.classList.add('cine'); const s = window.__sol; s.clock.paused = true; s.settings.set('orbits', false); s.settings.set('labels', false); });
  const res = { star, frames: [] };
  for (const D of dists) {
    await page.evaluate(([star, D]) => { const s = window.__sol, r = s.engine.rig, b = s.sys.bodies.find(x => x.name === star); r.flight = null; s.ui.following = false; r.tFov = r.fov = 50; r.setTarget(b, D * 149597870.7); r.yaw = r.tYaw = 0.7; r.pitch = r.tPitch = 0.3; r.lookYaw = r.lookPitch = 0; window.__solStarsTick?.(); }, [star, D]);
    // let the 3-D catalogue stream its nearest shards
    const t0 = Date.now(); while (Date.now() - t0 < 60000) { const n = await page.evaluate(() => window.__sol.engine.stars3d?.loadedRows ?? 0); if (n > 1000) break; await page.waitForTimeout(1000); await page.evaluate(() => window.__solStarsTick?.()); }
    await page.waitForTimeout(1500);
    for (let k = 0; k < NF; k++) {
      // orbit-mode zoom toward the star: 4 % closer per frame (the CPU trace showed zoom is where the float32 camera snaps)
      await page.evaluate(([D, k]) => new Promise(res => { const s = window.__sol, r = s.engine.rig; r.dist = r.tDist = D * 149597870.7 * Math.pow(0.96, k); const f0 = window.__frames; const chk = () => (window.__frames - f0 >= 2 ? res(0) : requestAnimationFrame(chk)); chk(); }), [D, k]);
      const vp = page.viewportSize(); const c = 120;
      const file = path.join(out, `star-D${String(D).replace('.', 'p')}-f${k}.png`);
      await page.screenshot({ path: file, clip: { x: vp.width / 2 - c, y: vp.height / 2 - c, width: 2 * c, height: 2 * c }, timeout: 120000 });
      const st = await page.evaluate(() => ({ jd: window.__sol.sys.jd, rows: window.__sol.engine.stars3d?.loadedRows ?? 0, dpr: window.devicePixelRatio, canvas: [window.__sol.engine.renderer.domElement.width, window.__sol.engine.renderer.domElement.height] }));
      res.frames.push({ D, k, file: path.basename(file), ...st });
      fs.writeFileSync(path.join(out, 'stars381.json'), JSON.stringify(res, null, 1));   // incremental (slow software adapter)
    }
  }
  fs.writeFileSync(path.join(out, 'stars381.json'), JSON.stringify(res, null, 1));
  return res;
}
