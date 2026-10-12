// probe: ring-frame radius/height of ring-embedded moons vs their gaps (Pan/Encke, Daphnis/Keeler, Atlas, Prometheus)
export default async function (page) {
  const r = await page.evaluate(() => {
    const s = window.__sol, sat = s.sys.get('saturn'), m = sat.rot, out = {};
    for (const id of ['sat618', 'sat635', 'sat615', 'sat616', 'sat617']) { const b = s.sys.get(id); if (!b) continue;
      const d = [b.pos[0] - sat.pos[0], b.pos[1] - sat.pos[1], b.pos[2] - sat.pos[2]];
      const l = [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]];
      out[b.name] = { rPlane: Math.hypot(l[0], l[1]), z: l[2], radius: b.radius }; }
    return out; });
  console.error(JSON.stringify(r)); return r;
}
