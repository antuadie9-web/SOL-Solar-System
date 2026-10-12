// v3.7 planetary atmospheres: taxonomy coverage, per-body profiles, ATM-005 per-channel view transmittance, plumes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../../src/data/catalog';
import { ATMOSPHERES } from '../../src/data/atmospheres';
import { PLUMES } from '../../src/render/plumes';
import { physicalFrom, buildTransmittance, sampleT, verticalOpticalDepth, extinction } from '../../src/render/atmoModel';

const def = (id: string) => CATALOG.find(b => b.id === id)!;
test('every major planet + Titan, Triton, Pluto, Io, Enceladus, Galileans has an atmosphere classification with sources', () => {
  for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'titan', 'triton', 'pluto', 'io', 'europa', 'ganymede', 'callisto', 'enceladus']) {
    const a = ATMOSPHERES[id]; assert.ok(a, id); assert.ok(a.sources.length > 5 && a.render.length > 3, id);
  }
});
test('no false shells: Mercury and the exosphere moons have no rendered atmosphere; Io/Enceladus get plumes only', () => {
  for (const id of ['mercury', 'europa', 'ganymede', 'callisto', 'moon']) { assert.equal(def(id)?.atmo, undefined, id); assert.equal(ATMOSPHERES[id].status, 'metadata-only'); }
  for (const id of ['io', 'enceladus']) { assert.equal(def(id).atmo, undefined, id); assert.ok(PLUMES[id]?.length > 0, id); }
});
test('every LUT-atmosphere body has its own preset (no universal preset) with a declared source', () => {
  const ids = Object.entries(ATMOSPHERES).filter(([, a]) => a.status === 'LUT-atmosphere' || a.status === 'LUT-haze').map(([k]) => k);
  const seen = new Set<string>();
  for (const id of ids) { const a = def(id).atmo!; assert.ok(a, id); const key = JSON.stringify([a.rayleigh, a.mie, a.mieH, a.rayleighH]); assert.ok(!seen.has(key), `${id} duplicates another preset`); seen.add(key); }
});
test('ice giants: Uranus and Neptune absorb red more than blue (methane) and Neptune has the thinner haze', () => {
  for (const id of ['uranus', 'neptune']) { const a = def(id).atmo!; assert.ok(a.absorb![0] > 20 * a.absorb![2], id); }
  assert.ok(def('neptune').atmo!.mie * def('neptune').atmo!.mieH < def('uranus').atmo!.mie * def('uranus').atmo!.mieH);
});
test('Venus: the shell sits on a ≈ 70 km cloud deck; gas-giant shells are density-shifted above 1 bar', () => {
  assert.equal(def('venus').cloudTopKm, 70); assert.equal(def('venus').atmo!.ground, 70);
  for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) assert.equal((def(id).atmo as any).phys.densityShiftH, 2, id);
  const J = physicalFrom(def('jupiter').atmo as any, 71492), J0 = physicalFrom({ ...def('jupiter').atmo, phys: { ...(def('jupiter').atmo as any).phys, densityShiftH: 0 } } as any, 71492);
  assert.ok(Math.abs(extinction(J, 0)[1] / extinction(J0, 0)[1] - Math.exp(-2)) < 1e-6);
});
test('Mars dust ω₀ uses the measured blue value (Wolff et al. 2010, 437 nm)', () => {
  const a = def('mars').atmo as any; assert.deepEqual(a.phys.mieAlbedo, [0.975, 0.90, 0.77]);
});
test('ATM-005: LUT ratio T(p→top)/T(c→top) reproduces direct per-channel transmittance between two points (Mars, Earth)', () => {
  for (const id of ['mars', 'earth']) {
    const A = physicalFrom(def(id).atmo as any, def(id).radius), T = buildTransmittance(A);
    const r0 = A.Rg + 0.2, mu0 = 0.35, d = 60;             // ground point, slanted ray, camera 60 km along it
    const x: [number, number] = [0, r0], dir: [number, number] = [Math.sqrt(1 - mu0 * mu0), mu0];
    const c: [number, number] = [x[0] + dir[0] * d, x[1] + dir[1] * d], rc = Math.hypot(...c), muc = (c[0] * dir[0] + c[1] * dir[1]) / rc;
    const a = sampleT(A, T, r0, mu0), b = sampleT(A, T, rc, muc), ratio = a.map((v, i) => v / b[i]);
    // direct
    const n = 2000, tau = [0, 0, 0]; for (let i = 0; i < n; i++) { const s = (i + 0.5) / n * d, p = [x[0] + dir[0] * s, x[1] + dir[1] * s], h = Math.hypot(p[0], p[1]) - A.Rg, e = extinction(A, h); for (let k = 0; k < 3; k++) tau[k] += e[k] * d / n; }
    const direct = tau.map(t => Math.exp(-t));
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(ratio[k] - direct[k]) < 0.02, `${id} ch${k}: ${ratio[k]} vs ${direct[k]}`);
    if (id === 'mars') assert.ok(direct[0] > direct[2], 'Mars: red transmitted better than blue through dust');
  }
});
test('Titan obscures its surface; Pluto/Triton hazes are optically thin', () => {
  const t = (id: string) => verticalOpticalDepth(physicalFrom(def(id).atmo as any, def(id).radius));
  assert.ok(Math.min(...t('titan')) > 3); assert.ok(Math.max(...t('pluto')) < 0.05); assert.ok(Math.max(...t('triton')) < 0.05);
});
test('plumes: heights and positions within the published ranges', () => {
  const pele = PLUMES.io.find(p => p.name === 'Pele')!; assert.ok(pele.height >= 300 && pele.height <= 400);
  for (const p of PLUMES.enceladus) assert.ok(p.lat < -75, p.name);
});
