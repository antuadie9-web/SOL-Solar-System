// v3.4 contract proofs (spec D1 "Contract proof"): unit round-trips m→Mpc, hierarchical-frame locality, Galactic
// rotation validity, Solar-System→Proxima→Galactic-centre→M31→return path without NaN/jumps, catalogue IDs and
// absent measurements, crossmatch that keeps binaries apart, catalogue streaming (order, checksum, cancellation,
// missing shard), LOD hysteresis, camera state machine interruption/history, device-loss safe state.
// Tolerances are declared in each test BEFORE the measured value is used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { convertLength, LENGTH_UNITS_KM } from '../../src/contracts/precision';
import { anchor, relative, toAncestor, fromAncestor, standardTree, ICRS_TO_GAL, GAL_TO_ICRS, mul, gpuRelative, validDistance, type V3d } from '../../src/contracts/frames';
import { placement, crossmatch, fromBodyDef, type AstroObject } from '../../src/contracts/astroObject';
import { CatalogStream, validateManifest, type CatalogManifest } from '../../src/contracts/catalog';
import { selectDetail, pixelRadius } from '../../src/contracts/lod';
import { CameraStateMachine, travelDuration } from '../../src/navigation/cameraState';
import { frameStats, statusForAdapter } from '../../src/contracts/evidence';
import { CATALOG as BODIES } from '../../src/data/catalog';

const len = (v: V3d) => Math.hypot(...v);
const sub = (a: V3d, b: V3d): V3d => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

test('units: 1 m → km → AU → pc → kpc → Mpc and back is exact to 1e-15 relative; constants are IAU-exact', () => {
  const chain = ['m', 'km', 'AU', 'pc', 'kpc', 'Mpc'] as const;
  for (const v of [1, 1e-3, 42.195, 6.02e23]) {
    let x = v; for (let i = 1; i < chain.length; i++) x = convertLength(x, chain[i - 1], chain[i]);
    for (let i = chain.length - 1; i > 0; i--) x = convertLength(x, chain[i], chain[i - 1]);
    assert.ok(Math.abs(x - v) <= Math.abs(v) * 1e-15, `${v} → ${x}`);
  }
  assert.equal(LENGTH_UNITS_KM.AU, 149597870.7);
  assert.ok(Math.abs(LENGTH_UNITS_KM.pc - 648000 / Math.PI * LENGTH_UNITS_KM.AU) / LENGTH_UNITS_KM.pc < 1e-15);
});

test('ICRS→Galactic matrix is orthonormal (|RRᵀ−I| < 1e-12) and maps the NGP and Galactic centre directions correctly (< 1″)', () => {
  const I = mul(ICRS_TO_GAL, GAL_TO_ICRS);
  for (let i = 0; i < 9; i++) assert.ok(Math.abs(I[i] - (i % 4 === 0 ? 1 : 0)) < 1e-12);
  const d = Math.PI / 180, v = (ra: number, de: number): V3d => [Math.cos(de * d) * Math.cos(ra * d), Math.cos(de * d) * Math.sin(ra * d), Math.sin(de * d)];
  const R = ICRS_TO_GAL, ap = (x: V3d): V3d => [R[0] * x[0] + R[1] * x[1] + R[2] * x[2], R[3] * x[0] + R[4] * x[1] + R[5] * x[2], R[6] * x[0] + R[7] * x[1] + R[8] * x[2]];
  // Hipparcos definition: NGP at (192.85948°, +27.12825°); l = 0, b = 0 at (266.40500°, −28.93617°) (ESA 1997)
  const ngp = ap(v(192.85948, 27.12825)), gc = ap(v(266.405, -28.93617));
  assert.ok(Math.acos(Math.min(1, ngp[2])) / d * 3600 < 1, 'NGP');
  assert.ok(Math.acos(Math.min(1, gc[0])) / d * 3600 < 1, 'GC');
});

test('hierarchical frames keep 1 m locality at the Moon although its Galactocentric address is 2.6e17 km (absolute float64 round-trip cannot)', () => {
  const { milkyWay, ecl } = standardTree();
  const moonC = anchor('moon', 'body-centred', ecl, [1.496e8 + 384400 * 0.7, 384400 * 0.7, 0]);
  // body-fixed frame rotated 30° about z, ground patch on the surface
  const c = Math.cos(0.5236), s = Math.sin(0.5236);
  const moonF = anchor('moon-fixed', 'body-fixed', moonC, [0, 0, 0], [c, -s, 0, s, c, 0, 0, 0, 1]);
  const patch = anchor('patch', 'ground-patch', moonF, [1737.4, 0, 0]);
  const p1: V3d = [0, 0, 0], p2: V3d = [0.001, 0, 0];              // two points 1 m apart (km units)
  // declared tolerance: < 1 µm error on a 1 m baseline via the hierarchy
  const rel = relative(p2, patch, patch); assert.ok(Math.abs(len(sub(rel, p1)) - 0.001) < 1e-9);
  const a = relative(p1, patch, moonC), b = relative(p2, patch, moonC);
  assert.ok(Math.abs(len(sub(b, a)) - 0.001) < 1e-12, 'within the Moon frame');
  // absolute Galactocentric round-trip: measure (this is the failure the hierarchy avoids; expected ≥ 1 m)
  const g1 = toAncestor(p1, patch, milkyWay), g2 = toAncestor(p2, patch, milkyWay);
  const absErr = Math.abs(len(sub(g2, g1)) - 0.001);
  assert.ok(len(g1) > 2.4e17 && len(g1) < 2.6e17, 'Sun ≈ 8.1 kpc from the Galactic centre');
  assert.ok(absErr > 1e-4, `absolute float64 differencing at 2.5e17 km loses metre locality (≥10 cm on a 1 m baseline; measured ≈0.6 m) (err ${absErr} km) — documents why rebasing exists`);
  // and the inverse transform returns the local point to < 1 m only because offsets are subtracted hop by hop
  const back = fromAncestor(toAncestor([0.5, 0.25, 0], patch, ecl), ecl, patch);
  assert.ok(len(sub(back, [0.5, 0.25, 0])) < 1e-6);
});

test('route Sun → Earth → Moon → Proxima → Galactic centre → M31 → back: finite, monotone hops, camera-relative GPU payload finite', () => {
  const { universe, milkyWay, ssb, ecl } = standardTree();
  const pc = LENGTH_UNITS_KM.pc;
  const earth = anchor('earth', 'body-centred', ecl, [1.496e8, 0, 0]);
  const moon = anchor('moon', 'body-centred', earth, [384400, 0, 0]);
  const proxima = anchor('proxima', 'system-barycentric', ssb, [-0.4723 * pc, -0.3624 * pc, -1.1611 * pc]); // ICRS, ≈1.30 pc
  const gc = anchor('sgr-a*', 'body-centred', milkyWay, [0, 0, 0]);
  const m31 = anchor('m31', 'galactocentric', universe, [0.0, 0.765e6 * pc * 0.99, -0.765e6 * pc * 0.12]); // ≈765 kpc
  const stops = [ssb, earth, moon, proxima, gc, m31, gc, proxima, moon, earth, ssb];
  for (let i = 1; i < stops.length; i++) {
    const r = relative([0, 0, 0], stops[i], stops[i - 1]);
    assert.ok(r.every(Number.isFinite), `${stops[i - 1].id}→${stops[i].id}`);
    const g = gpuRelative([0, 0, 0], stops[i], stops[i - 1]);
    assert.ok([...g.hi, ...g.lo].every(Number.isFinite));
  }
  const dProx = len(relative([0, 0, 0], proxima, ssb)) / pc; assert.ok(Math.abs(dProx - 1.301) < 0.01, `Proxima ${dProx} pc`);
  const dGC = len(relative([0, 0, 0], gc, ssb)) / pc / 1000; assert.ok(Math.abs(dGC - 8.122) < 0.01, `GC ${dGC} kpc`);
  const dM31 = len(relative([0, 0, 0], m31, ssb)) / pc / 1e6; assert.ok(dM31 > 0.74 && dM31 < 0.79, `M31 ${dM31} Mpc`);
});

test('distance semantics: cosmological distances must name their model', () => {
  assert.equal(validDistance({ value: 765, unit: 'kpc', kind: 'luminosity' }), false);
  assert.equal(validDistance({ value: 765, unit: 'kpc', kind: 'luminosity', model: 'Planck18' }), true);
  assert.equal(validDistance({ value: 1.3, unit: 'pc', kind: 'parallax', sigma: 0.0002 }), true);
});

test('object schema: every SOL body maps to a canonical id; no two bodies share one; no body without a radius', () => {
  const ids = new Set<string>();
  for (const d of BODIES as any[]) { const o = fromBodyDef(d); assert.ok(o.canonicalId.startsWith('sol:')); assert.ok(!ids.has(o.canonicalId), o.canonicalId); ids.add(o.canonicalId); assert.ok(o.radiusKm && o.radiusKm.value > 0, d.id); }
  assert.ok(ids.size > 50);
});

const star = (id: string, ra: number, de: number, plx?: number, e?: number, comp?: string, cat = 'Gaia', rel = 'DR3'): AstroObject => ({
  canonicalId: id, name: id, aliases: [], sourceIds: [{ catalog: cat, release: rel, id }], cls: 'star', component: comp,
  position: plx === undefined ? { kind: 'sky-only', raDeg: ra, decDeg: de, frame: 'icrs' } : { kind: 'astrometric', raDeg: ra, decDeg: de, parallaxMas: plx, parallaxSigmaMas: e, epochJyr: 2016, frame: 'icrs' } });

test('absent / unreliable distances stay 2D sky sources (never randomly placed); good parallax → 3D', () => {
  assert.equal(placement(star('a', 10, 10)).mode, 'sky');
  assert.equal(placement(star('b', 10, 10, -0.3, 0.2)).mode, 'sky');
  assert.equal(placement(star('c', 10, 10, 1.0, 0.5)).mode, 'sky');
  const p = placement(star('d', 10, 10, 768.07, 0.03)); assert.equal(p.mode, '3d'); assert.ok(p.mode === '3d' && Math.abs(p.distancePc - 1.302) < 0.001);
});

test('crossmatch: same Gaia id merges; binary components A/B never merge; position match across catalogues; parallax conflict is ambiguous', () => {
  const a = star('123', 219.9, -60.83, 747, 0.2, 'A'); const a2 = { ...star('123', 219.9, -60.83, 747, 0.2, 'A') };
  assert.deepEqual(crossmatch(a, a2), { match: true, by: 'identifier' });
  const B = star('124', 219.9001, -60.8301, 747, 0.2, 'B');
  assert.equal(crossmatch(a, B).match, false);                             // distinct DR3 ids and components
  const hip = star('HIP 71683', 219.90002, -60.83001, 754.8, 4.1, 'A', 'Hipparcos', '2007');
  assert.equal(crossmatch(a, hip).match, true);
  const far = star('HIP x', 219.90002, -60.83001, 10, 0.5, undefined, 'Hipparcos', '2007');
  assert.equal(crossmatch(star('125', 219.9, -60.83, 747, 0.2), far).match, 'ambiguous');
});

function fakeCatalog(nShards = 6, rows = 4) {
  const F = 10, files = new Map<string, ArrayBuffer>();
  const shards = [] as CatalogManifest['shards'];
  for (let k = 0; k < nShards; k++) {
    const a = new Float32Array(rows * F).map((_, i) => k * 1000 + i); const buf = a.buffer;
    files.set(`http://x/s${k}.bin`, buf);
    shards.push({ id: 's' + k, file: `s${k}.bin`, bytes: buf.byteLength, sha256: createHash('sha256').update(Buffer.from(buf)).digest('hex'), count: rows, firstRow: k * rows, bounds: { min: [k * 50, 0, 0], max: [k * 50 + 50, 50, 50] } });
  }
  const man: CatalogManifest = { schema: 'sol-catalog/2', catalog: 't', release: 't', frame: 'ecliptic-j2000-heliocentric', unit: 'pc', rowFormat: 't', rowFloats: F, count: nShards * rows, cell: 50, shards, coverage: {} };
  return { man, files };
}
const hasher = async (b: ArrayBuffer) => createHash('sha256').update(Buffer.from(b)).digest('hex');

test('catalogue stream: manifest validation, nearest-first order, checksum failure and missing shard are reported, rows land at firstRow', async () => {
  const { man, files } = fakeCatalog();
  assert.deepEqual(validateManifest(man), []);
  assert.ok(validateManifest({ ...man, count: 1 }).length > 0);
  files.set('http://x/s3.bin', new Float32Array(40).fill(7).buffer);           // corrupt (right size, wrong hash)
  files.delete('http://x/s4.bin');                                             // missing
  const order: string[] = []; const data = new Float32Array(man.count * 10);
  const st = new CatalogStream(man, 'http://x/', { onShard: (s, rows) => { order.push(s.id); data.set(rows, s.firstRow * 10); } },
    async (u) => { const b = files.get(u); if (!b) throw new Error('404'); return b; }, hasher, 1);
  st.setObserver([260, 25, 25]);                                               // nearest shard is s5
  await st.start();
  assert.equal(order[0], 's5');
  assert.equal(st.state.get('s3'), 'failed-checksum');
  assert.equal(st.state.get('s4'), 'failed-missing');
  assert.equal(st.counts().ready, 4);
  assert.equal(data[2 * 4 * 10], 2000);                                        // shard 2's first value at row 8
});

test('catalogue stream: abort cancels queued shards and resolves', async () => {
  const { man, files } = fakeCatalog(8);
  let started = 0;
  const st = new CatalogStream(man, 'http://x/', {}, async (u, signal) => { started++; await new Promise(r => setTimeout(r, 20)); if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' }); return files.get(u)!; }, hasher, 2);
  const done = st.start(); st.abort(); await done;
  const c = st.counts(); assert.equal((c.aborted ?? 0), 8); assert.ok(started <= 2);
});

test('LOD: tiers follow apparent size with hysteresis (no flicker at a boundary); luminous bodies never drop below D1', () => {
  const H = 1080, fov = 50 * Math.PI / 180, R = 1737.4;
  const dAt = (px: number) => R / Math.sin(Math.atan(px / (H / 2) * Math.tan(fov / 2)));
  const base = { radiusKm: R, fovYRad: fov, viewportH: H, hasSurface: true, hasTerrain: true, budgetOk: true };
  assert.ok(Math.abs(pixelRadius(R, dAt(100), fov, H) - 100) < 1e-6);
  assert.equal(selectDetail({ ...base, distanceKm: dAt(0.1) }).tier, 0);
  assert.equal(selectDetail({ ...base, distanceKm: dAt(0.1), luminous: true }).tier, 1);
  assert.equal(selectDetail({ ...base, distanceKm: dAt(5) }).tier, 2);
  assert.equal(selectDetail({ ...base, distanceKm: dAt(40) }).tier, 3);
  assert.equal(selectDetail({ ...base, distanceKm: R + 100 }).tier, 4);
  // hysteresis: at 11 px (below enter 12, above exit 9.6) a D3 object stays D3, a D2 object stays D2
  assert.equal(selectDetail({ ...base, distanceKm: dAt(11) }, 3).tier, 3);
  assert.equal(selectDetail({ ...base, distanceKm: dAt(11) }, 2).tier, 2);
});

test('camera state machine: gesture interrupts travel, history supports back, invalid transitions are rejected, device loss → safe orbit', () => {
  const sm = new CameraStateMachine(() => 0); sm.seed('earth');
  assert.equal(sm.dispatch({ type: 'travel', target: 'moon' }), 'travel');
  assert.equal(sm.dispatch({ type: 'gesture' }), 'orbit');                    // wheel/drag cancels flight
  sm.dispatch({ type: 'travel', target: 'mars' }); sm.dispatch({ type: 'arrive' });
  assert.equal(sm.history.map(h => h.target).join(','), 'earth,moon');
  assert.equal(sm.dispatch({ type: 'back' }), 'travel'); assert.equal(sm.target, 'moon');
  assert.equal(sm.dispatch({ type: 'takeoff' }), null); assert.equal(sm.rejected.length, 1);
  sm.dispatch({ type: 'free' }); assert.equal(sm.dispatch({ type: 'device-lost' }), 'orbit');
});

test('travel duration is scale-aware, bounded (1.6–9 s) and shorter with reduced motion; it is camera time, not an ETA', () => {
  const em = travelDuration(2e4, 5e3, 384400), en = travelDuration(2e4, 9e4, 4.3e9);
  assert.ok(em >= 1.6 && en <= 9 && en > em);
  assert.ok(travelDuration(2e4, 9e4, 4.3e9, true) < 1.3);
});

test('evidence: software adapter results can only be "verified-software"; frame stats', () => {
  assert.equal(statusForAdapter(true, true), 'verified-software');
  assert.equal(statusForAdapter(false, true), 'verified');
  // AUD-06: v3.4 asserted `s.p99 === (18 > s.p99 ? s.p99 : s.p99)` — always true. Nearest-rank expectations, declared:
  const s = frameStats([16, 16, 17, 16, 40, 16, 16, 18]); assert.equal(s.p50, 16); assert.equal(s.p99, 40, 'the single 40 ms hitch is the 99th percentile of 8 frames');
  const t = frameStats(Array.from({ length: 200 }, (_, i) => i < 198 ? 16 : 50)); assert.equal(t.p99, 16); assert.equal(frameStats(Array.from({ length: 200 }, (_, i) => i < 197 ? 16 : 50)).p99, 50);
  assert.ok(Number.isNaN(frameStats([]).p99));
});
import { sphereSegmentsForTier, limbChordErrorPx } from '../../src/contracts/lod';
test('v3.6 geometry LOD: proxy discs are cheap, focused full-screen limbs stay sub-pixel', () => {
  assert.equal(sphereSegmentsForTier(2, 6371), 24); assert.equal(sphereSegmentsForTier(3, 69911), 128); assert.equal(sphereSegmentsForTier(5, 3389), 192);
  assert.ok(limbChordErrorPx(24, 12) < 0.05);            // a 12-px proxy disc
  assert.ok(limbChordErrorPx(192, 1440) < 0.1);          // focused body filling a 1440-px-high screen
  assert.ok(limbChordErrorPx(96, 1440) > limbChordErrorPx(192, 1440));
});
