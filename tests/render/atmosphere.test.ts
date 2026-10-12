// v3.6 atmosphere model: LUT correctness against direct integration and physical sanity checks per planet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../../src/data/catalog';
import { physicalFrom, verticalOpticalDepth, buildLUTs, sampleT, opticalDepthToTop, skyRadiance, buildSkyIrradiance, skyMu, MS_N } from '../../src/render/atmoModel';
const phys = (id: string) => { const d = CATALOG.find(b => b.id === id)!; return physicalFrom(d.atmo as any, (d.radii ?? [d.radius])[0]); };
const earth = phys('earth'), mars = phys('mars'), titan = phys('titan');
const LE = buildLUTs(earth), LM = buildLUTs(mars), LT = buildLUTs(titan);
const close = (a: number, b: number, rel: number) => Math.abs(a - b) <= rel * Math.abs(b) + 1e-6;
test('Earth vertical optical depths: Rayleigh τ(680/550/440 nm) ≈ 0.046/0.108/0.265, ozone column = tent area', () => {
  const t = verticalOpticalDepth(earth);
  const r = [5.802e-3, 13.558e-3, 33.1e-3].map(b => b * 8 * (1 - Math.exp(-100 / 8)));
  const m = 4.44e-3 * 1.2, oz = [0.65e-3, 1.881e-3, 0.085e-3].map(o => o * 15);
  for (let k = 0; k < 3; k++) assert.ok(close(t[k], r[k] + m + oz[k], 0.01), `${k}: ${t[k]} vs ${r[k] + m + oz[k]}`);
});
test('Mars dust column τ ≈ 0.5 (non-storm opacity), Titan haze τ > 3 in every channel', () => {
  const tm = verticalOpticalDepth(mars); for (const x of tm) assert.ok(x > 0.48 && x < 0.56, String(x));
  const tt = verticalOpticalDepth(titan); for (const x of tt) assert.ok(x > 3, String(x)); assert.ok(tt[2] > tt[0], 'Titan haze absorbs/extincts more in blue');
});
test('transmittance LUT reproduces direct integration (zenith, 60°, grazing, from altitude) within 1.5 %', () => {
  for (const [A, L] of [[earth, LE], [mars, LM]] as const) for (const [h, mu] of [[0, 1], [0, 0.5], [0, 0.05], [10, 0.2], [30, -0.05], [60, 0.9]]) {
    const r = A.Rg + h; if (h > A.Rt - A.Rg) continue;
    const ref = opticalDepthToTop(A, r, mu, 2000).map(x => Math.exp(-x)), got = sampleT(A, L.T, r, mu);
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(got[k] - ref[k]) < 0.015 * Math.max(ref[k], 0.05) + 2e-3, `${h} ${mu} ${k}: ${got[k]} vs ${ref[k]}`);
  }
});
test('multiple-scattering LUT is finite, non-negative, and largest on the day side', () => {
  for (const L of [LE, LM, LT]) {
    let day = 0, night = 0;
    for (let j = 0; j < MS_N; j++) for (let i = 0; i < MS_N; i++) for (let k = 0; k < 3; k++) { const v = L.MS[(j * MS_N + i) * 4 + k]; assert.ok(Number.isFinite(v) && v >= 0); if (i > MS_N * 0.75) day += v; if (i < MS_N * 0.25) night += v; }
    assert.ok(day > 5 * night, `${day} ${night}`);
  }
});
test('Earth: daytime zenith sky is blue (B > G > R) and the low sun is reddened', () => {
  const sun = [Math.sin(0.6), 0, Math.cos(0.6)] as [number, number, number];
  const z = skyRadiance(earth, LE, earth.Rg + 0.01, [0, 0, 1], sun); assert.ok(z[2] > z[1] && z[1] > z[0], z.join());
  const Tlow = sampleT(earth, LE.T, earth.Rg, 0.03); assert.ok(Tlow[0] > 3 * Tlow[2], Tlow.join());
});
test('Mars: red/butterscotch sky away from the Sun, blue aureole around a setting Sun (forward-scattering dust)', () => {
  const e = 5 * Math.PI / 180, sun = [Math.cos(e), 0, Math.sin(e)] as [number, number, number];
  const near = skyRadiance(mars, LM, mars.Rg + 0.01, [Math.cos(e + 0.07), 0, Math.sin(e + 0.07)], sun);
  const away = skyRadiance(mars, LM, mars.Rg + 0.01, [-Math.cos(0.6), 0, Math.sin(0.6)], sun);
  assert.ok(away[0] > away[2], `away ${away.join()}`);
  assert.ok(near[2] / near[0] > away[2] / away[0] * 1.3, `near B/R ${near[2] / near[0]} vs away ${away[2] / away[0]}`);
});
test('skylight irradiance: positive by day, Mars sky fill is a large fraction of direct light (dusty), Earth bluish', () => {
  const sm = buildSkyIrradiance(mars, LM, 48), se = buildSkyIrradiance(earth, LE, 48);
  const i = sm.length / 4 - 1; assert.ok(skyMu(31) > 0.99);
  // overhead Sun: Mars diffuse/direct ≈ 0.2–0.6 for τ = 0.5 (red); Earth clear sky ≈ 0.1–0.3 of direct in blue
  const Tm = sampleT(mars, LM.T, mars.Rg, 1), Te = sampleT(earth, LE.T, earth.Rg, 1);
  const fm = sm[i * 4] / (Math.PI * Tm[0] / Math.PI), fe = se[i * 4 + 2] / (Te[2]);
  assert.ok(fm > 0.08 && fm < 0.8, `mars ${fm}`); assert.ok(fe > 0.05 && fe < 0.5, `earth ${fe}`);
  assert.ok(se[i * 4 + 2] > se[i * 4], 'Earth skylight is bluer than red');
  for (let k = 0; k < sm.length; k++) assert.ok(Number.isFinite(sm[k]) && sm[k] >= 0);
});
