// DEF-38-001: half-float encoding of worker-built atmosphere LUTs must match the main-thread (THREE) encoding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { toHalf16 } from '../../src/render/halfFloat';
import { buildLUTs, buildSkyIrradiance, physicalFrom } from '../../src/render/atmoModel';
import { CATALOG } from '../../src/data/catalog';
const dec = (h: number) => THREE.DataUtils.fromHalfFloat(h);
test('toHalf16 keeps subnormals and is within 1 ulp of THREE.DataUtils.toHalfFloat', () => {
  for (let i = 0; i < 100000; i++) { const v = Math.exp(Math.random() * 55 - 45); if (v > 65000) continue; const a = toHalf16(v), b = THREE.DataUtils.toHalfFloat(v); assert.ok(Math.abs(a - b) <= 1, `${v}: ${a} vs ${b}`); }
  assert.equal(dec(toHalf16(3e-6)), dec(THREE.DataUtils.toHalfFloat(3e-6))); assert.ok(dec(toHalf16(3e-6)) > 0);
  assert.equal(dec(toHalf16(1.9999999)), 2);          // rounding carry propagates into the exponent (old bug halved it)
  assert.equal(dec(toHalf16(0.99999)), 1);
});
test('Venus LUTs: worker encoding loses no non-zero texel and agrees to < 0.1 % relative', () => {
  const A = physicalFrom(CATALOG.find(b => b.id === 'venus')!.atmo as any, 6051.8), L = buildLUTs(A), S = buildSkyIrradiance(A, L, 48);
  for (const arr of [L.T, L.MS, S]) for (let i = 0; i < arr.length; i++) {
    const a = dec(toHalf16(arr[i])), b = dec(THREE.DataUtils.toHalfFloat(Math.min(65000, arr[i])));
    if (b > 0) assert.ok(a > 0, 'flushed'); if (b > 6.2e-5) assert.ok(Math.abs(a - b) / b < 1e-3, `${a} vs ${b}`);
  }
});
