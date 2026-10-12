// v3.7 ring systems: catalogue science, measured profile, optical-depth math, sub-pixel conservation, photometric limits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RING_SYSTEMS, ringLabels, equivalentDepth } from '../../src/data/rings';
import { CATALOG as BODIES } from '../../src/data/catalog';
import { ringTau, coverage, litIF, unlitIF, peakIF, buildProfileLOD, decodeProfile } from '../../src/render/ringSystem';

const prof = () => { const rs = RING_SYSTEMS.saturn.profile!; const b = readFileSync('public/assets/' + rs.file); const a = decodeProfile(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); return buildProfileLOD(a, rs.r0, rs.dr); };

test('every ring system belongs to a catalogue body; all four giants + Chariklo, Haumea, Quaoar are covered', () => {
  const ids = new Set(BODIES.map(b => b.id));
  for (const k of Object.keys(RING_SYSTEMS)) assert.ok(ids.has(k), k);
  for (const k of ['saturn', 'jupiter', 'uranus', 'neptune', 'chariklo', 'haumea', 'quaoar']) assert.ok(RING_SYSTEMS[k], k);
});
test('Uranus has the 13 catalogued rings; Neptune the five named rings + five Adams arcs', () => {
  const U = RING_SYSTEMS.uranus, n = U.narrow.length + U.broad.length; assert.equal(n, 13);
  for (const nm of ['6', '5', '4', 'α', 'β', 'η', 'γ', 'δ', 'λ', 'ε']) assert.ok(U.narrow.find(r => r.name === nm), nm);
  const N = RING_SYSTEMS.neptune, names = [...N.narrow, ...N.broad].map(r => r.name);
  for (const nm of ['Galle', 'Le Verrier', 'Lassell', 'Arago', 'Adams']) assert.ok(names.includes(nm), nm);
  assert.equal(N.arcs!.list.length, 5);
});
test('every ring component carries a source and a status; radii lie inside the system span', () => {
  for (const d of Object.values(RING_SYSTEMS)) for (const r of [...d.narrow, ...d.broad]) {
    assert.ok((r as any).source?.length > 8 && (r as any).status, `${d.body} ${r.name}`);
    const lo = 'r' in r ? r.r - r.width / 2 : r.rIn, hi = 'r' in r ? r.r + r.width / 2 : r.rOut;
    assert.ok(lo >= d.inner - 1 && hi <= d.outer + 1, `${d.body} ${r.name}`);
  }
});
test('Saturn: measured Voyager PPS profile reproduces the published regional optical depths', () => {
  const p = prof(), S = RING_SYSTEMS.saturn;
  const mean = (a: number, b: number) => { let t = 0, n = 0; for (let r = a; r < b; r += 1) { t += ringTau(S, r, 1, p)[0]; n++; } return t / n; };
  const C = mean(74658, 91975), B = mean(91975, 117507), CD = mean(117507, 122340), A = mean(122340, 136780);
  assert.ok(C > 0.05 && C < 0.35, `C ${C}`);            // NSSDC 0.05–0.35
  assert.ok(B > 1.2 && B < 2.6, `B ${B}`);              // NSSDC 0.4–2.5 (PPS saturates in the core)
  assert.ok(CD > 0.05 && CD < 0.25, `CD ${CD}`);        // NSSDC 0–0.1 (+ ringlets)
  assert.ok(A > 0.4 && A < 1.0, `A ${A}`);              // NSSDC 0.4–1.0
  assert.ok(mean(133450, 133700) < 0.15, 'Encke gap clear');
  assert.ok(B > 3 * A && A > 3 * C, 'B ≫ A ≫ C ordering');
});
test('profile LOD levels conserve the mean optical depth (no brightening/dimming when zooming out)', () => {
  const p = prof(), S = RING_SYSTEMS.saturn, a = 80000, b = 136000;
  const m = (fw: number) => { let t = 0, n = 0; for (let r = a; r < b; r += 50) { t += ringTau(S, r, fw, p)[0]; n++; } return t / n; };
  const m1 = m(1), m3 = m(600);
  assert.ok(Math.abs(m3 - m1) / m1 < 0.03, `${m1} vs ${m3}`);
});
test('narrow rings: sub-pixel footprint conserves the equivalent depth ∫τ dr', () => {
  const U = RING_SYSTEMS.uranus, eps = U.narrow.find(r => r.name === 'ε')!;
  for (const fw of [0.5, 5, 50, 500]) {
    let s = 0; for (let r = eps.r - 2000; r <= eps.r + 2000; r += fw / 4) s += coverage(r, fw, eps.r - eps.width / 2, eps.r + eps.width / 2) * eps.tau * fw / 4;
    assert.ok(Math.abs(s - equivalentDepth(eps)) / equivalentDepth(eps) < 0.02, `fw ${fw}: ${s}`);
  }
});
test('slab photometry: lit face saturates at ϖP/4·μ0/(μ0+μ); unlit face → 0 for τ → 0 and τ → ∞', () => {
  assert.ok(Math.abs(litIF(50, 0.5, 0.5, 0.5, 1) - 0.0625) < 1e-6);
  assert.ok(unlitIF(1e-6, 0.3, 0.6, 0.5, 1) < 1e-6 && unlitIF(30, 0.3, 0.6, 0.5, 1) < 1e-6);
  const best = [0.1, 0.3, 0.6, 1, 2].map(t => unlitIF(t, 0.3, 0.6, 0.5, 1)); assert.ok(best[2] > best[0] && best[2] > best[4], 'unlit glow peaks at moderate τ (C ring / Cassini Division)');
});
test('intrinsic brightness order: Saturn ≫ Uranus, Neptune ≫ Jupiter (why faint rings need a labelled enhancement)', () => {
  const s = peakIF(RING_SYSTEMS.saturn, prof()), u = peakIF(RING_SYSTEMS.uranus), n = peakIF(RING_SYSTEMS.neptune), j = peakIF(RING_SYSTEMS.jupiter);
  assert.ok(s > 0.05, `saturn ${s}`); assert.ok(s > 10 * u && s > 10 * n, `${s} ${u} ${n}`); assert.ok(j < 1e-4, `jupiter ${j}`);
});
test('Neptune arcs raise the Adams ring τ ≈ 12× inside an arc (NSSDC: 0.12 vs 0.01)', () => {
  const N = RING_SYSTEMS.neptune; const base = ringTau(N, 62933, 1, null, 1), arc = ringTau(N, 62933, 1, null, 12);
  assert.ok(Math.abs((arc[0] + arc[1]) / (base[0] + base[1]) - 12) < 1e-6);
});
test('small-body rings: Chariklo 390.6/404.8 km, Haumea 2287 km, Quaoar 4057/2520 km; label lists non-empty', () => {
  assert.deepEqual(RING_SYSTEMS.chariklo.narrow.map(r => r.r), [390.6, 404.8]);
  assert.equal(RING_SYSTEMS.haumea.narrow[0].r, 2287);
  assert.deepEqual(RING_SYSTEMS.quaoar.narrow.map(r => r.r).sort((a, b) => a - b), [2520, 4057]);
  for (const d of Object.values(RING_SYSTEMS)) assert.ok(ringLabels(d).length > 0, d.body);
  assert.equal(ringLabels(RING_SYSTEMS.saturn).length, 10);
});
