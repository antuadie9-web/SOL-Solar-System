// SOL v3.8 (PERF-005): atmosphere LUT construction off the main thread. v3.6–3.7 built the transmittance, multiple-
// scattering and skylight tables synchronously inside engine.getView() — 0.1–0.45 s of main-thread work the first time a
// world with an atmosphere became resolved, i.e. in the middle of a flight toward it (a visible freeze). The tables are
// pure functions of the physical description, so they are built here and returned as transferable half-float buffers.
import { buildLUTs, buildSkyIrradiance, discTable, discSurface, type AtmoPhysical } from './atmoModel';
// v3.8 PERF-005 follow-up (DEF-38-001): the first version of this converter flushed every value below 2^-14 to zero (no
// subnormals) and OR-ed a rounding carry into the exponent (values just under an odd power of two were halved). The tiny
// multiple-scattering and skylight terms were lost, dimming e.g. Venus' backlit limb ring ≈ 4x vs the synchronous build.
// Now: IEEE-754 binary16 with subnormals and round-half-to-even (within 1 ulp of THREE.DataUtils.toHalfFloat, which
// truncates); tests/render/halfFloat38.test.ts.
import { toHalf16 as half } from './halfFloat';
const toHalf = (a: Float32Array) => { const o = new Uint16Array(a.length); for (let i = 0; i < a.length; i++) o[i] = half(a[i]); return o; };
self.onmessage = (ev: MessageEvent<{ key: string; A: AtmoPhysical; surf?: any }>) => {
  const t0 = performance.now(), { key, A, surf } = ev.data;
  const luts = buildLUTs(A), sky = buildSkyIrradiance(A, luts, 48);
  const T16 = toHalf(luts.T), MS16 = toHalf(luts.MS), S16 = toHalf(sky), TS16 = toHalf(luts.Tsim!);
  const L2 = { A, T: luts.T.slice(), MS: luts.MS.slice(), Tsim: luts.Tsim!.slice() };
  (self as any).postMessage({ key, T: luts.T, MS: luts.MS, Tsim: luts.Tsim, T16, MS16, S16, TS16, ms: performance.now() - t0 }, [luts.T.buffer, luts.MS.buffer, luts.Tsim!.buffer, T16.buffer, MS16.buffer, S16.buffer, TS16.buffer]);
  // v3.8.1 CONT-14d: disc-integrated flux table (shell + surface), posted separately so the shell is not held back by it
  if (surf) { const disc = discTable(A, L2 as any, discSurface(surf)); (self as any).postMessage({ key: key + ':disc', disc }, [disc.buffer]); }
};
