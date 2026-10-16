// v3.8.1 CONT-14f — visible-hemisphere albedo factor of the unresolved point (presentation.hemisphereAlbedoFactor).
// Checks: identity for a uniform map; exact for a two-albedo dichotomy viewed pole-on vs edge-on; shipped grids are
// normalised to their own map mean (area-weighted mean of every grid = 1 within rounding); the factor is a weighted MEAN
// of the grid, so it is always bounded by the grid's min/max (never an extrapolated multiplier).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hemisphereAlbedoFactor } from '../../src/render/presentation';

const W = 64, Hh = 32;
const grid = (fn: (lat: number, lon: number) => number) => { const v: number[] = [];
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) v.push(fn(Math.PI / 2 - (j + 0.5) / Hh * Math.PI, ((i + 0.5) / W - 0.5) * 2 * Math.PI)); return { w: W, h: Hh, v }; };

test('CONT-14f: uniform map → factor 1 at every geometry', () => {
  const G = grid(() => 1);
  for (const [c, s] of [[[1, 0, 0], [1, 0, 0]], [[0, 1, 0.3], [-0.4, 1, 0]], [[0, 0, 1], [1, 0, 0.2]]] as number[][][])
    assert.ok(Math.abs(hemisphereAlbedoFactor(G, c, s, 'rocky') - 1) < 1e-12);
});
test('CONT-14f: hemispheric dichotomy (north 2, south 0) seen from the north pole at zero phase → 2; equator-on → ≈1', () => {
  const G = grid(lat => lat > 0 ? 2 : 0);
  assert.ok(Math.abs(hemisphereAlbedoFactor(G, [0, 0, 1], [0, 0, 1], 'rocky') - 2) < 1e-12);
  assert.ok(Math.abs(hemisphereAlbedoFactor(G, [1, 0, 0], [1, 0, 0], 'rocky') - 1) < 1e-9);
});
test('CONT-14f: shipped grids are mean-normalised and the factor stays within grid bounds', () => {
  const A = JSON.parse(readFileSync('public/assets/data/albedo_grid.json', 'utf8'));
  for (const [name, v] of Object.entries(A.maps) as [string, number[]][]) {
    let s = 0, w = 0; for (let j = 0; j < A.h; j++) { const c = Math.cos(Math.PI / 2 - (j + 0.5) / A.h * Math.PI); for (let i = 0; i < A.w; i++) { s += v[j * A.w + i] * c; w += c; } }
    assert.ok(Math.abs(s / w - 1) < 0.01, `${name} mean ${s / w}`);
    const lo = Math.min(...v), hi = Math.max(...v);
    for (const c of [[1, 0, 0], [0, 1, 0], [-1, 0.2, 0.3], [0, 0, -1]]) { const h = hemisphereAlbedoFactor({ w: A.w, h: A.h, v }, c, [c[0] + 0.3, c[1], c[2] + 0.1], 'rocky');
      assert.ok(h >= lo - 1e-9 && h <= hi + 1e-9, `${name} ${h}`); }
  }
});
