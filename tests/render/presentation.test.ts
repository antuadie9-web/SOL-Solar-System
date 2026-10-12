// v3.5 viewing modes & exposure model (src/render/presentation.ts). Tolerances are declared before measurement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MODE_PARAMS, PRESENTATION_KEYS, VIEW_MODES, MODE_INFO, mixParams, approachParams, skyExposure, compressPeak, photometricPeak, lunarLambert, meterLuminance, radianceFromSB, SUN_SB, SKY_REF_EXPOSURE, pbrNeutral, HIGHLIGHT_TARGET } from '../../src/render/presentation';

test('modes change presentation only: the parameter set contains no physical quantity', () => {
  const physical = /pos|orbit|radius|radii|rot|spin|terrain|elev|distance|sun(Dir|Pos|Irr)|irradiance|ephem|scale(?!d)/i;
  for (const k of PRESENTATION_KEYS) assert.ok(!physical.test(k), `presentation key ${k} must not be physical`);
  for (const m of VIEW_MODES) { assert.deepEqual(Object.keys(MODE_PARAMS[m]).sort(), [...PRESENTATION_KEYS].sort(), m); assert.ok(MODE_INFO[m].label && MODE_INFO[m].note, m); }
  // Scientific is the physical camera: sky coupled, no compression, no inspection light, no grade
  const s = MODE_PARAMS.scientific;
  assert.equal(s.skyCoupling, 1); assert.equal(s.starGamma, 1); assert.equal(s.inspect, 0); assert.equal(s.contrast, 1); assert.equal(s.saturation, 1); assert.equal(s.vignette, 0);
  // Exploration's inspection light is a small fraction of local sunlight (never "day on the night side")
  assert.ok(MODE_PARAMS.exploration.inspect > 0 && MODE_PARAMS.exploration.inspect <= 0.06);
  assert.ok(MODE_PARAMS.cinematic.inspect <= MODE_PARAMS.exploration.inspect);
});

test('the mode is never applied through engine physics: engine sets sunlight from geometry, not from presentation params', () => {
  const src = fs.readFileSync('src/render/engine.ts', 'utf8');
  // the solar irradiance passed to every surface is LS / r² × disc weight — no presentation factor in it
  assert.match(src, /const rS = len\(b\.pos\) \/ AU, irr = LS \/ \(rS \* rS\) \* v\.discWeight;/);
  assert.ok(!/U\.sunPos\.value[^\n]*pres/.test(src) && !/b\.pos[^\n]*this\.pres/.test(src), 'no presentation term touches positions or the light direction');
});

test('mode transitions interpolate smoothly and converge (no popping)', () => {
  let p = { ...MODE_PARAMS.scientific }; const tgt = MODE_PARAMS.cinematic; let prevD = Infinity;
  for (let i = 0; i < 240; i++) {
    const q = approachParams(p, tgt, 1 / 60);
    for (const k of PRESENTATION_KEYS) { const a = (p as any)[k], b = (q as any)[k], t = (tgt as any)[k]; assert.ok(Math.abs(b - t) <= Math.abs(a - t) + 1e-9, `${k} monotone toward target`); }
    const d = Math.abs(q.skyCoupling - tgt.skyCoupling); assert.ok(d <= prevD); prevD = d; p = q;
  }
  assert.ok(Math.abs(p.inspect - tgt.inspect) < 1e-3 && Math.abs(p.skyCoupling - tgt.skyCoupling) < 1e-3, 'within 4 s');
  // one frame never moves more than ~4 % of the way (τ = 0.45 s at 60 fps)
  const one = approachParams(MODE_PARAMS.scientific, MODE_PARAMS.exploration, 1 / 60);
  assert.ok((MODE_PARAMS.scientific.skyCoupling - one.skyCoupling) / (MODE_PARAMS.scientific.skyCoupling - MODE_PARAMS.exploration.skyCoupling) < 0.04);
  assert.deepEqual(mixParams(MODE_PARAMS.exploration, MODE_PARAMS.cinematic, 0), MODE_PARAMS.exploration);
});

test('sky exposure: Scientific = scene camera; Exploration keeps the night sky within ~1.5 EV near a sunlit world; a veil re-couples it', () => {
  const sunlit = 2.0, dark = 2.5e4;
  assert.equal(skyExposure(sunlit, MODE_PARAMS.scientific), sunlit);
  const e = skyExposure(sunlit, MODE_PARAMS.exploration), eDark = skyExposure(dark, MODE_PARAMS.exploration);
  const dropEV = Math.log2(SKY_REF_EXPOSURE / e);
  assert.ok(dropEV > 0 && dropEV < 1.5, `sky dims only ${dropEV.toFixed(2)} EV next to a sunlit planet (v3.4: ${Math.log2(SKY_REF_EXPOSURE / sunlit).toFixed(1)} EV)`);
  assert.ok(eDark >= e, 'monotone in scene exposure');
  assert.ok(Math.abs(skyExposure(sunlit, MODE_PARAMS.exploration, 1) - sunlit) < 1e-9, 'full veil (daylit air, Sun in frame) = physical camera');
  assert.ok(skyExposure(sunlit, MODE_PARAMS.exploration, 0.5) < e);
  assert.ok(skyExposure(1e9, MODE_PARAMS.exploration) >= 1e9 * (1 - 1e-12), 'never darker than the scene camera');
  assert.ok(Math.abs(skyExposure(sunlit, MODE_PARAMS.exploration, 0, 1) / e - 2) < 1e-9, 'user sky EV is a clean multiplier');
});

test('surface-brightness calibration: the Sun is −10.58 mag/arcsec² ↔ mean disc radiance; the Galactic band lands at a visible display level', () => {
  assert.ok(Math.abs(SUN_SB - -10.58) < 0.02, `${SUN_SB}`);
  const Lsun = (149597870.7 / 695700) ** 2;
  assert.ok(Math.abs(radianceFromSB(SUN_SB) / Lsun - 1) < 1e-12);
  assert.ok(Math.abs(radianceFromSB(21) / radianceFromSB(23.5) - 10) < 1e-9, '2.5 mag = 10×');
  const disp = radianceFromSB(21) * SKY_REF_EXPOSURE;
  assert.ok(disp > 0.02 && disp < 0.06, `band at ${disp.toFixed(3)} display-linear in the sky domain`);
  assert.ok(radianceFromSB(21) * 2.0 < 1e-7, 'and invisible (< 1e-7) on a sunlit-planet exposure — the physical reason v3.4 lost it');
});

test('star compression is identity below the knee, monotone, preserves magnitude order and shrinks bright peaks', () => {
  assert.equal(compressPeak(0.2, 0.35, 0.5), 0.2);
  assert.equal(compressPeak(50, 1e9, 1), 50);
  let prev = 0; for (let m = 12; m >= -1.5; m -= 0.25) { const p = 0.4 * Math.pow(10, -0.4 * (m - 5)); const c = compressPeak(p, 0.35, 0.5); assert.ok(c >= prev, `order at m=${m}`); prev = c; }
  const vega = compressPeak(20.7, 0.35, 0.5); assert.ok(vega < 3 && vega > 1, `Vega-like peak ${vega.toFixed(2)}`);
});

test('photometricPeak: matches the shader law at full phase, decreases toward crescent, Lommel–Seeliger limb brightening captured', () => {
  const p0 = photometricPeak(0, 'rocky'); assert.ok(Math.abs(p0 - lunarLambert(1, 1, 0, 0)) < 0.02, `${p0}`);
  const p90 = photometricPeak(90, 'rocky'), p150 = photometricPeak(150, 'rocky');
  assert.ok(p0 > p90 && p90 > p150 && p150 > 0);
  assert.equal(photometricPeak(180, 'rocky'), 0);
  assert.ok(photometricPeak(0, 'earth') <= 1 + 1e-9 && photometricPeak(0, 'earth') > 0.99);
  assert.ok(photometricPeak(0, 'gas', 0.9) >= 1);
});

test('EXP-002 metering: highlights of bright bodies are protected; dark bodies are not darkened; night-side opening is bounded', () => {
  const key = 0.16, ht = HIGHLIGHT_TARGET.neutral;
  // Io-like: bright yellow map (calibrated p99 max-channel ≈ 1.2 at full phase factor 1.35, 5.2 AU) vs. a dark comet
  const io = { subjectFull: 0.012, litWeight: 1, highlightRadiance: 1.2 * 1.35 / (5.2 * 5.2), weight: 1 };
  const comet = { subjectFull: 0.012, litWeight: 1, highlightRadiance: 0.08 * 1.35 / (5.2 * 5.2), weight: 1 };
  const mi = meterLuminance([io], key, ht, 40), mc = meterLuminance([comet], key, ht, 40);
  const Eio = key / mi.luminance, Ec = key / mc.luminance;
  assert.ok(io.highlightRadiance * Eio <= ht * 1.0001, 'Io brightest 1 % at or below the highlight target');
  assert.equal(mc.highlight < mc.subject, true, 'cap inactive for a dark body'); assert.ok(Math.abs(Ec - key / comet.subjectFull) < 1e-9);
  // the tone curve then keeps Io's highlight below clipping (sRGB < 250/255)
  const out = pbrNeutral([ht, ht * 0.95, ht * 0.6]); assert.ok(Math.max(...out) < 0.93, `${out}`);   // sRGB < 246
  // night side facing the camera: Exploration opens at most 1.5 EV beyond fully lit; Scientific is the free camera
  const night = { ...comet, litWeight: 0, highlightRadiance: 0 };   // anti-solar view: no sunlit highlight (photometricPeak(180°) = 0)
  const eExp = key / meterLuminance([night], key, ht, MODE_PARAMS.exploration.nightCapEV).luminance;
  assert.ok(Math.abs(Math.log2(eExp / Ec) - MODE_PARAMS.exploration.nightCapEV) < 1e-9);
  assert.ok(meterLuminance([night], key, ht, MODE_PARAMS.scientific.nightCapEV).luminance < 1e-12 * 0.012 * 1e3);
});

test('Khronos PBR Neutral reference: identity below 0.76 (after the 0.04 toe offset), shoulder above, 0.9 → 0.831', () => {
  assert.deepEqual(pbrNeutral([0.5, 0.4, 0.3]).map(x => +x.toFixed(6)), [0.46, 0.36, 0.26]);
  assert.ok(Math.abs(pbrNeutral([0.9, 0.9, 0.9])[0] - 0.8306) < 1e-3);
});
