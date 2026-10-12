export default async function (page) {
  await page.evaluate(() => document.querySelector('#loader .enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  return await page.evaluate(async () => {
    const s = window.__sol, b = s.sys.get('sun'), r = s.engine.rig; r.flight = null; s.ui.select(b, false);
    const jdUtc = Date.UTC(2026, 7, 12, 17, 46) / 86400000 + 2440587.5; s.clock.paused = true; s.clock.set(jdUtc + 69.184 / 86400); s.advance();
    const m = s.sys.get('moon'), L = Math.hypot(...m.pos), u = m.pos.map(x => x / L);
    const pos = m.pos.map((x, i) => x + u[i] * 200000);
    r.pos = pos; r.setTarget(b);
    const log = [];
    for (let k = 0; k < 3; k++) { await new Promise(res => requestAnimationFrame(() => setTimeout(res, 50))); log.push({ dbg: s.engine.expDebug, expLog: s.engine.expLog, pos: r.pos.slice(), dist: r.dist, yaw: r.yaw, pitch: r.pitch, quat: [r.quat.x, r.quat.y, r.quat.z, r.quat.w] }); }
    const bad = []; for (const bb of s.sys.bodies) { if (!bb.pos.every(Number.isFinite)) bad.push(bb.id); }
    const sc = [...s.engine.screen.entries()].filter(([k, v]) => !Number.isFinite(v.r) || !Number.isFinite(v.dist)).map(([k]) => k);
    return { log, bad, sc };
  });
}
