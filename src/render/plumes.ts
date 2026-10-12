// @ts-nocheck — TSL node graphs are dynamically typed
// SOL v3.7 plume module: localised gas/dust/ice plumes (Io's volcanic umbrellas, Enceladus' south-polar jets).
// These are NOT atmospheres and never draw a global shell. Each plume is a stable seeded particle cloud in the body-fixed
// frame (attached to the body, so it rotates with the surface), rendered as additive camera-facing splats with a
// forward-scattering Henyey–Greenstein phase function — plumes are brightest when backlit, as in Cassini/Voyager images.
// Geometry and brightness are REPRESENTATIVE: activity varies with time; positions/heights are from the cited observations.
import * as THREE from 'three/webgpu';
import { Fn, uniform, attribute, positionGeometry, vec3, vec4, float, dot, max, varying, cameraProjectionMatrix, cameraViewMatrix, modelWorldMatrix, Discard, If, exp, normalize, pow } from 'three/tsl';

export interface Plume { name: string; lat: number; lon: number; height: number; kind: 'umbrella' | 'jet'; spread: number; tau: number; g: number; color: [number, number, number]; source: string }
export const PLUMES: Record<string, Plume[]> = {
  io: [
    { name: 'Pele', lat: -18.7, lon: 104.7, height: 330, kind: 'umbrella', spread: 600, tau: 0.01, g: 0.6, color: [1.0, 0.85, 0.65], source: 'Voyager 1/Galileo: ≈ 300–400 km high, 1200 km deposit ring (Strom et al. 1981; Geissler et al. 2004)' },
    { name: 'Prometheus', lat: -1.5, lon: 207.0, height: 90, kind: 'umbrella', spread: 120, tau: 0.02, g: 0.6, color: [0.95, 0.92, 0.85], source: 'Voyager/Galileo: ≈ 75–100 km, long-lived (McEwen & Soderblom 1983)' },
    { name: 'Tvashtar', lat: 62.8, lon: 236.0, height: 330, kind: 'umbrella', spread: 500, tau: 0.008, g: 0.6, color: [1.0, 0.88, 0.7], source: 'New Horizons 2007: 330 km (Spencer et al. 2007)' },
  ],
  enceladus: [
    // four "tiger stripes" (Alexandria, Cairo, Baghdad, Damascus) — jets placed along each stripe (Porco et al. 2014 locate ~100)
    ...[['Alexandria', -83.0, 150], ['Cairo', -84.5, 105], ['Baghdad', -86.0, 60], ['Damascus', -86.5, 15]].flatMap(([n, la, lo]) => [-1, -0.5, 0, 0.5, 1].map((k, j) => ({
      name: `${n} jet ${j + 1}`, lat: (la as number) + k * 2.2, lon: (lo as number) + k * 38, height: 450, kind: 'jet' as const, spread: 0.12, tau: 0.0012, g: 0.75, color: [0.92, 0.95, 1.0] as [number, number, number],
      source: 'Cassini ISS: jets along the tiger stripes, plume visible to > 500 km (Porco et al. 2006, 2014) — jet positions REPRESENTATIVE' }))),
  ],
};
/** single-scattering albedo of plume particles (Io: SO₂ frost + silicate dust; Enceladus: water ice) — REPRESENTATIVE */
export const PLUME_W0 = 0.9;
export function makePlumes(bodyId: string, radius: number) {
  const list = PLUMES[bodyId]; if (!list) return null;
  const per = 3000, N = list.length * per, a = new Float32Array(N * 4), w = new Float32Array(N * 4);
  let h = 2166136261 ^ bodyId.length * 7919; const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000003) / 1000003; };
  list.forEach((P, k) => {
    const la = P.lat * Math.PI / 180, lo = P.lon * Math.PI / 180;
    const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    const e = [-Math.sin(lo), Math.cos(lo), 0], n = [up[1] * e[2] - up[2] * e[1], up[2] * e[0] - up[0] * e[2], up[0] * e[1] - up[1] * e[0]];
    for (let i = 0; i < per; i++) {
      let z, rr;
      if (P.kind === 'umbrella') {
        // ballistic umbrella: particles along parabolic paths from the vent; canopy at height H, landing ring at `spread`
        const s = rnd(), x = s * P.spread; z = P.height * (1 - Math.pow(2 * s - 1, 2)) * (0.85 + 0.15 * rnd()); rr = x;
      } else {
        // collimated jet: exponential density with height (scale H/4), half-angle spread·z
        z = -Math.log(1 - rnd() * 0.995) * P.height / 4; rr = Math.abs(z * P.spread * (rnd() + rnd() - 1));
      }
      const az = rnd() * Math.PI * 2, cx = rr * Math.cos(az), cy = rr * Math.sin(az);
      const R0 = radius + z;
      const p = [0, 1, 2].map(j => up[j] * R0 + e[j] * cx + n[j] * cy);
      // v3.8 (session 3): umbrella splats widened height/18 → height/8. With 3,000 particles per canopy the old size left
      // the canopy as a field of discrete sparkles (io-pele-limb views); Voyager/New Horizons show a smooth, filamentary
      // umbrella. Brightness is unaffected — each splat carries Σ/N spread over its own footprint (see below).
      const sz = (P.kind === 'umbrella' ? P.height / 8 : P.height / 40) * (0.6 + rnd() * 0.8);
      a.set([p[0], p[1], p[2], sz], (k * per + i) * 4);
      // v3.7.1 (ATM-012): physically normalised splats. Each particle carries an equal share σᵢ = Σ/N of the plume's total
      // scattering cross-section Σ (km²), spread as a Gaussian column over its world-space footprint, so the summed
      // line-of-sight optical depth — and the optically thin radiance I/F = ϖ·P(θ)·τ_los/4 — no longer depends on the particle
      // count or splat size (v3.7 used an ad-hoc 1/250 overlap factor). Σ = τ_vertical × canopy area (umbrella) or
      // τ_side × side-projected area of the jet's lower scale height (jet). τ values remain REPRESENTATIVE (time-variable).
      const Sigma = P.kind === 'umbrella' ? P.tau * Math.PI * P.spread * P.spread : P.tau * (P.height / 4) * 2 * (P.height / 4) * P.spread * 2;
      const footprint = sz * sz * Math.PI / 3 * (1 - Math.exp(-3));     // ∫ exp(−3 r²/s²) over the splat disc (km²)
      w.set([Sigma / per / footprint, P.g, k, 1], (k * per + i) * 4);
    }
  });
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute('pp', new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute('pw', new THREE.InstancedBufferAttribute(w, 4)); g.instanceCount = N;
  const U = { sunLocal: uniform(new THREE.Vector3(1, 0, 0)), cam: uniform(new THREE.Vector3()), irr: uniform(1), gain: uniform(1) };
  const vUV = varying(vec3(0), 'plUV'), vI = varying(vec3(0), 'plI');
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: true });
  m.blending = THREE.AdditiveBlending;
  const col = list[0].color;
  m.vertexNode = Fn(() => {
    const p = attribute('pp', 'vec4'), q = attribute('pw', 'vec4');
    const l = normalize(U.sunLocal.sub(p.xyz)), v = normalize(U.cam.sub(p.xyz));
    const c = dot(l.negate(), v), gg = q.y;
    const P = float(1).sub(gg.mul(gg)).div(pow(float(1).add(gg.mul(gg)).sub(gg.mul(2).mul(c)), 1.5));   // HG × 4π
    // planet shadow on the particle (body as a sphere)
    const b = dot(p.xyz, l), d2 = dot(p.xyz, p.xyz).sub(b.mul(b));
    const lit = b.greaterThan(0).or(d2.greaterThan(float(radius * radius))).select(float(1), float(0));
    // radiance of a thin plume: ϖ·P·τ/(4μ) with μ ≈ 1 for an extended cloud; per-splat share of the column
    vI.assign(vec3(...col).mul(P.mul(q.x).mul(q.w).mul(0.25 * PLUME_W0).mul(U.irr).mul(U.gain).mul(lit)));   // ϖ·P·τ/4 × irradiance
    vUV.assign(vec3(positionGeometry.xy, 0));
    const view = cameraViewMatrix.mul(modelWorldMatrix.mul(vec4(p.xyz, 1)));
    return cameraProjectionMatrix.mul(view.add(vec4(positionGeometry.xy.mul(p.w), 0, 0)));
  })();
  m.colorNode = Fn(() => {
    const r2 = dot(vUV.xy, vUV.xy);
    If(r2.greaterThan(1), () => { Discard(); });
    return vec4(vI.mul(exp(r2.mul(-3))), 1);     // Gaussian column profile (peak-normalised; see σᵢ above)
  })();
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3;
  return { mesh, U, list };
}
/** v3.7.1 (ATM-012): brightest line-of-sight I/F of a body's plumes for the current geometry (unit vectors from the body
 *  toward the Sun and the camera, body-fixed). Peak τ_los ≈ 2 × Σ / projected area (Σ as in makePlumes), I/F = ϖ·P·τ/4.
 *  Used for the geometry-aware, LABELLED Exploration/Cinematic plume enhancement (never in Scientific) and for highlight
 *  metering, so a forward-scattering Enceladus plume is not driven to white while Io's faint umbrellas can be shown.
 *  v3.8 DEF-38-004: the v3.7.1 estimate took the single brightest plume. Enceladus' 20 tiger-stripe jets sit within
 *  ≈ 30 km of each other and their columns overlap in projection, and a jet's exponential column is ≈ 1.6× denser at the
 *  vent than its mean over the lowest scale height, so the true peak was under-estimated ≈ 10× (gain ×4 on an already
 *  bright plume, core clipped: enceladus-plume-backlit 1,751 saturated px). Columns are now summed with a Gaussian weight
 *  of their projected vent separation, and jets carry the vent concentration factor. Io's umbrellas are far apart, so
 *  their estimate is unchanged. `radius` (km) converts vent directions to projected separations. */
export function plumePeakIF(list: Plume[], sunDir: [number, number, number], camDir: [number, number, number], radius = 0) {
  const cs = -(sunDir[0] * camDir[0] + sunDir[1] * camDir[1] + sunDir[2] * camDir[2]);   // cos scattering angle (1 = forward)
  const one = list.map(P => {
    const la = P.lat * Math.PI / 180, lo = P.lon * Math.PI / 180, up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    const mu = Math.abs(up[0] * camDir[0] + up[1] * camDir[1] + up[2] * camDir[2]), sn = Math.sqrt(Math.max(0, 1 - mu * mu));
    const H = P.kind === 'umbrella' ? P.height : P.height / 4, R = P.kind === 'umbrella' ? P.spread : H * P.spread * 2;
    const Sigma = P.kind === 'umbrella' ? P.tau * Math.PI * P.spread * P.spread : P.tau * H * 2 * H * P.spread * 2;
    const area = Math.PI * R * R * mu + 2 * R * H * sn, tauPeak = 2 * Sigma / Math.max(area, 1e-6);
    const g = P.g, HG = (1 - g * g) / Math.pow(1 + g * g - 2 * g * cs, 1.5);
    const conc = P.kind === 'jet' ? 1 / (1 - Math.exp(-1)) : 1;
    // vent position projected onto the sky plane (km), for the overlap weight
    const d = up[0] * camDir[0] + up[1] * camDir[1] + up[2] * camDir[2];
    const sky = [0, 1, 2].map(k => (up[k] - d * camDir[k]) * radius);
    return { I: PLUME_W0 * HG * tauPeak * conc / 4, sky, R };
  });
  let best = 0;
  for (const a of one) {
    let sum = 0;
    for (const b of one) { const dx = a.sky[0] - b.sky[0], dy = a.sky[1] - b.sky[1], dz = a.sky[2] - b.sky[2], r2 = dx * dx + dy * dy + dz * dz, w = Math.max(a.R, b.R);
      sum += b.I * Math.exp(-r2 / (w * w)); }
    best = Math.max(best, sum);
  }
  return best;
}
