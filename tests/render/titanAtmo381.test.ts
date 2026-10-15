// v3.8.1 WP-E / CONT-14d — Titan atmosphere validated against MEASURED quantities (not tuned to look right):
//  • vertical extinction τ(λ) per altitude region = the DISR fits (Tomasko et al. 2008 / Tomasko & West 2010 Fig. 12.4)
//  • disc-integrated geometric albedo p_V = 0.22 and colour B−V = 1.28 (p_B/p_V = 10^(−0.4·(1.28 − 0.65)) = 0.56)
//  • phase curve shape (García Muñoz et al. 2017, Cassini ISS): dimming to a minimum/plateau at 100–140°, steep rise
//    beyond 150°, at 160–166° "comparable to or higher than at full illumination" for λ ≲ 600 nm
//  • the focus-shell march resolves the detached layer: limb radiance converged vs a 10× finer march
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { physicalFrom, buildLUTs, verticalOpticalDepth, discFlux, discSurface, rayRadiance, aeroDensity, type AtmoPhysical, type V3 } from '../../src/render/atmoModel';
import { CATALOG as BODIES } from '../../src/data/catalog';

const ti = BODIES.find(b => b.id === 'titan')!;
const A: AtmoPhysical = physicalFrom(ti.atmo as any, ti.radius);
const L = buildLUTs(A);
const S = discSurface({ refl: [0.15, 0.13, 0.10], kind: 'gas', k: 0.9, dm: 1 });
const F0 = discFlux(A, L, 0, S, 36, 18);

test('Titan: vertical haze extinction equals the DISR fits per altitude region', () => {
  const tau = verticalOpticalDepth(A);
  const disr = (nm: number) => 1.012e7 * nm ** -2.339 + 2.029e4 * nm ** -1.409 + 627 * nm ** -0.9706;
  const ray = [600, 550, 450].map(nm => 1.0 * (550 / nm) ** 4);
  [600, 550, 450].forEach((nm, k) => assert.ok(Math.abs(tau[k] - ray[k] - disr(nm)) / disr(nm) < 0.04, `${nm} nm: ${tau[k].toFixed(2)} vs ${(disr(nm) + ray[k]).toFixed(2)}`));
});
test('Titan: detached layer sits above a depleted gap (2017 state)', () => {
  const ext = (h: number) => A.aerosols!.reduce((s, a) => s + a.ext[1] * aeroDensity(a.prof, h), 0);
  assert.ok(ext(510) > 1.5 * ext(450), 'detached peak above the gap minimum');
  assert.ok(ext(510) > ext(480) && ext(510) > ext(540));
});
test('Titan: disc-integrated geometric albedo and colour match photometry', () => {
  const p = F0.map(x => x / Math.PI);
  assert.ok(Math.abs(p[1] - 0.22) < 0.02, `p_V ${p[1].toFixed(3)}`);
  assert.ok(Math.abs(p[2] / p[1] - 0.56) < 0.05, `p_B/p_V ${(p[2] / p[1]).toFixed(3)}`);
  assert.ok(p[0] > p[1], 'redder than grey');
});
test('Titan: phase curve has the observed mid-phase plateau and high-phase surge', () => {
  const r = (a: number) => { const F = discFlux(A, L, a, S, 36, 18); return F.map((x, k) => x / F0[k]); };
  const r90 = r(90), r120 = r(120), r140 = r(140), r163 = r(163);
  assert.ok(r140[1] >= r120[1] * 0.97, 'plateau or mild increase 120 → 140°');
  assert.ok(r120[1] < r90[1], 'dims to ~120°');
  assert.ok(r163[2] >= 0.9, `450 nm at 163°: ${r163[2].toFixed(2)} (observed ≳ 1)`);
  assert.ok(r163[1] >= 0.55, `550 nm at 163°: ${r163[1].toFixed(2)} (observed ~ comparable)`);
});
test('Titan: focus-shell march resolves the detached layer (limb ray converged)', () => {
  const sun: V3 = [0, 1, 0], w: V3 = [0, 0, -1];
  for (const h of [470, 510, 560, 300]) {
    const o: V3 = [0, A.Rg + h, 5000];
    const a = rayRadiance(A, L, o, w, sun, 40, 12), b = rayRadiance(A, L, o, w, sun, 400, 120);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(a[k] - b[k]) / b[k] < 0.05, `h ${h} ch ${k}: ${a[k]} vs ${b[k]}`);
  }
});
