// v3.8.1 WP-B: energy-conserving stellar PSF (STAR-P01) and camera-relative star precision (STAR-J01).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erfApprox, pixelFraction1D, PSF_WING } from '../../src/render/points';
import { relLegacyF32, relSplitF32, relRef, dirErrorPx, splitHiLo, V3 } from '../../src/galaxy/starPrecision';

test('erf approximation (Winitzki) is within 1.3e-4 of reference values', () => {
  const ref: [number, number][] = [[0, 0], [0.1, 0.1124629], [0.5, 0.5204999], [1, 0.8427008], [1.5, 0.9661051], [2, 0.9953223], [3, 0.9999779]];
  for (const [x, e] of ref) { assert.ok(Math.abs(erfApprox(x) - e) < 1.3e-4, `erf(${x})`); assert.ok(Math.abs(erfApprox(-x) + e) < 1.3e-4); }
});
test('pixel-integrated PSF core conserves energy at every sub-pixel phase (Σ = 1 ± 3e-4) for σ = 0.45…1.2 px', () => {
  for (const sigma of [0.45, 0.62, 0.85, 1.2]) for (let ph = 0; ph < 1; ph += 0.0625) for (let pv = 0; pv < 1; pv += 0.25) {
    let sum = 0;
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) sum += pixelFraction1D(i - ph, sigma) * pixelFraction1D(j - pv, sigma);
    assert.ok(Math.abs(sum - 1) < 3e-4, `σ ${sigma} phase ${ph},${pv}: Σ = ${sum}`);
  }
});
test('point sampling only conserves energy for σ ≳ 0.6 px (42 % error at σ = 0.35); the pixel integral holds for sharp PSFs too', () => {
  // v3.8.0 kept σ = 0.85 CSS px (energy-safe, but a 1.7-device-px blob on a 2× display); a sharper star needs the integral
  const sampled = (ph: number, s: number) => { let t = 0; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) t += Math.exp(-((i - ph) ** 2 + j * j) / (2 * s * s)) / (2 * Math.PI * s * s); return t; };
  const spread = (s: number) => { const v = [0, 0.25, 0.5].map(p => sampled(p, s)); return Math.max(...v) - Math.min(...v); };
  assert.ok(spread(0.35) > 0.3 && spread(0.85) < 1e-4);
  let worst = 0; for (const ph of [0, 0.25, 0.5]) { let t = 0; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) t += pixelFraction1D(i - ph, 0.35) * pixelFraction1D(j, 0.35); worst = Math.max(worst, Math.abs(t - 1)); }
  assert.ok(worst < 3e-4, `integral ${worst}`);
});
test('PSF wing energy fractions are small and bounded (bright stars glow, but the wing never dominates the flux)', () => {
  assert.ok(PSF_WING.star > 0 && PSF_WING.star <= 0.06 && PSF_WING.body <= PSF_WING.star);
});
const PROX: { sP: V3; sV: V3 } = { sP: [-0.47, -0.36, -1.15], sV: [-1.5e-5, 2.6e-5, 1.1e-5] };
const AU_PC = 149597870.7 / 3.0856775814913673e13;
test('hi/lo camera split reconstructs the double position to < 1e-14 pc', () => {
  const v: V3 = [1.234567891234, -0.000123456789, 0.987654321987]; const { hi, lo } = splitHiLo(v);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(hi[i] + lo[i] - v[i]) < 1e-14);
});
test('STAR-J01: zooming to Proxima from 50 AU to 0.05 AU — v3.8.0 float32 camera errs by > 20 px, v3.8.1 split stays < 0.1 px', () => {
  const D: V3 = [0.31, 0.62, -0.72].map(x => x / Math.hypot(0.31, 0.62, 0.72)) as V3; const y = 10.78;
  let legacyMax = 0, splitMax = 0;
  for (let k = 0; k < 200; k++) {
    const off = 50 * Math.pow(0.001, k / 199) * AU_PC;
    const cam: V3 = [0, 1, 2].map(i => PROX.sP[i] + PROX.sV[i] * y + D[i] * off) as V3;
    const ref = relRef(PROX.sP, PROX.sV, y, cam);
    legacyMax = Math.max(legacyMax, dirErrorPx(relLegacyF32(PROX.sP, PROX.sV, y, cam), ref, 50, 1080));
    splitMax = Math.max(splitMax, dirErrorPx(relSplitF32(PROX.sP, PROX.sV, y, cam), ref, 50, 1080));
  }
  assert.ok(legacyMax > 20, `legacy ${legacyMax}`); assert.ok(splitMax < 0.1, `split ${splitMax}`);
});
test('STAR-J01: distant stars are unaffected (direction error < 0.01 px seen from the Sun and from 1 pc)', () => {
  const far: V3 = [120.3, -45.2, 300.1], v: V3 = [1e-5, 2e-5, -1e-5];
  for (const cam of [[0, 0, 0], [0.4, 0.2, -0.9]] as V3[]) assert.ok(dirErrorPx(relSplitF32(far, v, 10, cam), relRef(far, v, 10, cam), 50, 1080) < 0.01);
});
import { sunGlareVeil, skyExposureV381, MODE_PARAMS as MP, SKY_REF_EXPOSURE as SREF } from '../../src/render/presentation';
test('EXP-381-01: the Sun glare veil is continuous across the frame edge (no step), 1 inside, 0 far outside', () => {
  const hy = 25 * Math.PI / 180, hx = Math.atan(Math.tan(hy) * 16 / 9);
  const veilAt = (offDeg: number) => { const a = offDeg * Math.PI / 180; return sunGlareVeil({ ndcX: Math.tan(a) / Math.tan(hx), ndcY: 0, inFront: a < Math.PI / 2, halfFovX: hx, halfFovY: hy, sunVis: 1, sunMagV: -26.7 }); };
  assert.equal(veilAt(0), 1); assert.equal(veilAt(30), 1); assert.ok(veilAt(80) === 0);
  let prev = veilAt(0), maxStep = 0;
  for (let o = 0.05; o < 89; o += 0.05) { const v = veilAt(o); maxStep = Math.max(maxStep, Math.abs(v - prev)); assert.ok(v <= prev + 1e-12, 'monotone'); prev = v; }
  assert.ok(maxStep < 0.01, `largest change per 0.05° = ${maxStep}`);
});
test('EXP-381-01: the veil follows the Sun\'s apparent brightness (full ≲ 2,000 AU, none as a bright star at 1 pc)', () => {
  const v = (m: number) => sunGlareVeil({ ndcX: 0, ndcY: 0, inFront: true, halfFovX: 0.7, halfFovY: 0.44, sunVis: 1, sunMagV: m });
  assert.equal(v(-26.7), 1); assert.equal(v(-16.5), 1); assert.equal(v(-0.2), 0); assert.ok(v(-12) > 0 && v(-12) < 1);
  assert.equal(sunGlareVeil({ ndcX: 0, ndcY: 0, inFront: true, halfFovX: 0.7, halfFovY: 0.44, sunVis: 0, sunMagV: -26.7 }), 0, 'eclipsed Sun casts no glare veil');
});
test('EXP-381-01: Exploration/Cinematic sky darkens by at most sunVeilEV under the Sun veil; Scientific stays the physical camera', () => {
  const scene = SREF * Math.pow(2, -20);                      // scene metered for a sunlit disc, 20 EV under the sky reference
  for (const m of ['exploration', 'cinematic'] as const) {
    const free = skyExposureV381(scene, MP[m], 0, 0), veiled = skyExposureV381(scene, MP[m], 0, 1);
    const dEV = Math.log2(free / veiled); assert.ok(dEV > 0.5 && dEV <= MP[m].sunVeilEV + 1e-9, `${m}: ${dEV} EV`);
    assert.ok(veiled >= scene, 'never darker than the scene camera');
  }
  assert.equal(skyExposureV381(scene, MP.scientific, 0, 1), scene);
  // daylit air still re-couples completely (no stars through a blue sky)
  assert.ok(Math.abs(skyExposureV381(scene, MP.exploration, 1, 0) - scene) < 1e-9 * scene);
});
import { sunDiscScale, glareAmplitudes, glareExtentRad, SUN_LOOKS } from '../../src/render/sun';
test('SUN-381-02: local disc presentation is identity in Scientific, continuous in disc size, and lands the centre at the target once resolved', () => {
  assert.equal(sunDiscScale(1e6, 50, 'scientific'), 1);
  assert.equal(sunDiscScale(1e6, 2, 'exploration'), 1, 'unresolved/tiny discs are not compressed (point regime)');
  assert.ok(Math.abs(sunDiscScale(1e6, 20, 'exploration') * 1e6 - 2.4) < 1e-6);
  let prev = 1; for (let r = 2; r < 20; r += 0.01) { const s = sunDiscScale(1e6, r, 'cinematic'); assert.ok(s <= prev + 1e-12); assert.ok(Math.abs(Math.log(s) - Math.log(prev)) < 0.05, `jump at ${r}`); prev = s; }
});
test('SUN-381-01: glare amplitudes are monotone, bounded and grow only logarithmically with brightness; extent shrinks with distance', () => {
  let prev = { halo: 0, veil: 0 };
  for (let lx = -6; lx <= 14; lx += 0.1) { const a = glareAmplitudes(Math.pow(10, lx)); assert.ok(a.halo >= prev.halo && a.veil >= prev.veil); assert.ok(a.halo <= 4 && a.veil <= 0.18); prev = a; }
  const th1 = 0.01, ext = (dAU: number) => { const a = glareAmplitudes(Math.PI / (dAU * dAU) * 3e4); return glareExtentRad(a.halo, a.veil, th1, 0.0087); };
  assert.ok(ext(1) >= ext(5) && ext(5) >= ext(30) && ext(30) >= ext(1000));
});
test('SUN-381-03: Scientific look is neutral; the default look is a gentle warm grade (no channel below 0.9), not an orange lamp', () => {
  assert.deepEqual(SUN_LOOKS.scientific.tint, [1, 1, 1]);
  assert.ok(Math.min(...SUN_LOOKS.natural.tint) >= 0.9);
});
import { MEASURED_RADII, surfaceBrightnessRelSun, limbDarkeningV } from '../../src/galaxy/stellarRadii';
test('STAR-381-R/D: measured radii carry sources and σ; the Sun has unit relative surface brightness; Proxima V-band surface brightness is ≈ 2×10⁻³ of the solar value', () => {
  for (const [n, r] of Object.entries(MEASURED_RADII)) { assert.ok(r.rSun > 0.05 && r.rSun < 3 && r.sigma > 0 && r.sigma < 0.1 * r.rSun, n); assert.match(r.source, /\d{4}/); }
  assert.ok(Math.abs(surfaceBrightnessRelSun(4.83, 1) - 1) < 1e-12);
  const S = surfaceBrightnessRelSun(15.53, MEASURED_RADII['Proxima Centauri'].rSun);   // M_V(Proxima) ≈ 15.5
  assert.ok(S > 1e-3 && S < 3e-3, `Proxima V surface brightness ${S}`);
  assert.ok(limbDarkeningV(3000) > limbDarkeningV(9900), 'cool dwarfs darken more strongly toward the limb (representative trend)');
});
import { resolvedGlare, resolvedGlareWeight } from '../../src/render/sun';
test('SUN-381-06: resolved-Sun glare hands over continuously and its footprint (∝ amplitude × angular radius²) grows as the Sun is approached', () => {
  assert.equal(resolvedGlareWeight(3.5), 0); assert.equal(resolvedGlareWeight(8), 1);
  for (let r = 3.5; r < 8; r += 0.25) assert.ok(resolvedGlareWeight(r + 0.25) >= resolvedGlareWeight(r));
  let prev = 0;
  for (const au of [1.5, 1, 0.7, 0.39, 0.2, 0.1]) {           // disc display held at the local-HDR target (2.4)
    const ang = 0.004652 / au, g = resolvedGlare(2.4, 'exploration'), energy = g.halo * ang * ang;
    assert.ok(energy > prev, `${au} AU`); prev = energy;
  }
  assert.ok(resolvedGlare(2.4, 'scientific').halo < resolvedGlare(2.4, 'exploration').halo && resolvedGlare(2.4, 'exploration').halo < resolvedGlare(2.4, 'cinematic').halo);
});
