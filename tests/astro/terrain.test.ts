// DEM georeferencing tests against well-known landmarks, read through the v3.6 tile pyramid (same OBSERVED data as the
// v3.5 16 ppd grid at levels 0–2; regional 118 m LOLA / 200 m HRSC-MOLA tiles above). Tolerances reflect the level used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import zlib from 'node:zlib';
import { TilePyramid, locate, sampleTile, type TileManifest } from '../../src/terrain/tiles';
const open = (b: string) => {
  const man: TileManifest = JSON.parse(fs.readFileSync(`public/assets/terrain/${b}/tiles.json`, 'utf8'));
  const read = (L: number, r: number, c: number) => { const buf = zlib.gunzipSync(fs.readFileSync(`public/assets/terrain/${b}/t/${L}/${r}_${c}.i16z`)); return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2); };
  // synchronous sampler at an exact level (tests read tiles directly)
  const at = (L: number, lat: number, lon: number) => { const p = locate(L, lat, lon); return sampleTile(read(L, p.row, p.col), p.x, p.y) / 1000; };
  return { man, read, at };
};
const mars = open('mars'), moon = open('moon');
test('Mars: Olympus Mons summit (18.65°N, 226.2°E) radius ≈ 3396 + 21 km', () => { const h = mars.at(2, 18.65, 226.2); assert.ok(h > 19 && h < 22.5, String(h)); });
test('Mars: Hellas floor (42.4°S, 70.5°E) lies > 30 km radially below the Olympus Mons summit', () => { const d = mars.at(2, 18.65, 226.2) - mars.at(2, -42.4, 70.5); assert.ok(d > 30 && d < 40, String(d)); });
test('Mars: north polar radius ≈ 3376 km (oblateness present in MEGDR radius)', () => { const h = mars.at(2, 89.9, 0); assert.ok(h < -15 && h > -24, String(h)); });
test('Moon: highest terrain near Selenean summit (5.4°N, 201.4°E) ≈ +10.7 km', () => { let mx = -99; for (let la = 3; la <= 8; la += 0.1) for (let lo = 199; lo <= 204; lo += 0.1) mx = Math.max(mx, moon.at(2, la, lo)); assert.ok(mx > 10 && mx < 11, String(mx)); });
test('Moon: South Pole–Aitken basin floor (~53°S, ~191°E) below −6 km', () => { let mn = 99; for (let la = -60; la <= -45; la += 0.25) for (let lo = 180; lo <= 200; lo += 0.25) mn = Math.min(mn, moon.at(2, la, lo)); assert.ok(mn < -6, String(mn)); });
test('longitude wrap is continuous at 0°/360° on every global level', () => { for (const L of [0, 1, 2]) { assert.ok(Math.abs(moon.at(L, 10, 0) - moon.at(L, 10, 360)) < 1e-9); assert.ok(Math.abs(moon.at(L, 10, -0.001) - moon.at(L, 10, 359.999)) < 1e-9); } });
test('tile seams: sampling across a tile edge from either tile agrees (apron)', () => {
  for (const L of [1, 2]) for (const lon of [60, 15, 30]) { const ppd = 4 << L, edge = Math.round(lon * ppd / 240) * 240 / ppd; const a = moon.at(L, 10, edge - 1e-7), b = moon.at(L, 10, edge + 1e-7); assert.ok(Math.abs(a - b) < 1e-3, `${L} ${a} ${b}`); }
});
test('levels nest: a level-L sample is the mean of its 2×2 level-(L+1) children', () => {
  const t1 = moon.read(1, 1, 2), t2r = 2, t2c = 4, t2 = moon.read(2, t2r, t2c);
  // sample (i, j) of tile (1,1,2) without apron ↔ children (2i, 2j)… of tile (2,2,4) for i, j < 120
  for (const [i, j] of [[3, 5], [60, 77], [119, 0]]) { const m = (t2[(2 * j + 1) * 242 + 2 * i + 1] + t2[(2 * j + 1) * 242 + 2 * i + 2] + t2[(2 * j + 2) * 242 + 2 * i + 1] + t2[(2 * j + 2) * 242 + 2 * i + 2]) / 4; assert.ok(Math.abs(t1[(j + 1) * 242 + i + 1] - m) <= 1, `${t1[(j + 1) * 242 + i + 1]} vs ${m}`); }
});
test('regional high-res tiles agree with the 16 ppd OBSERVED base (block means, ingest QA in tiles.json)', () => {
  for (const b of [moon, mars]) for (const r of b.man.regions) { assert.ok(Math.abs(r.vs16ppd!.meanM) < 15, `${r.name} mean ${r.vs16ppd!.meanM}`); assert.ok(r.vs16ppd!.rmsM < 150, `${r.name} rms ${r.vs16ppd!.rmsM}`); }
});
test('Hadley Rille is resolved at 118 m but not at 1.9 km (Apollo 15 site, 26.13°N 3.63°E)', () => {
  // rille ≈ 1.2 km wide, ≈ 300 m deep: a W–E transect across it near the landing site shows a > 150 m dip only at L6
  const prof = (L: number) => { const v: number[] = []; for (let lo = 3.4; lo <= 3.9; lo += 0.004) v.push(moon.at(L, 26.08, lo)); return v; };
  const relief = (v: number[]) => { let best = 0; for (let i = 5; i < v.length - 5; i++) best = Math.max(best, (v[i - 5] + v[i + 5]) / 2 - v[i]); return best * 1000; };
  const hi = relief(prof(6)), lo = relief(prof(2));
  assert.ok(hi > 150, `L6 dip ${hi} m`); assert.ok(lo < hi / 2, `L2 dip ${lo} m vs L6 ${hi} m`);
});
test('Olympus Mons caldera floor resolved at 128 ppd: summit plateau ≈ 21 km, caldera ≈ 2–3 km deep', () => {
  let mx = -99, mn = 99; for (let la = 17.8; la <= 19.6; la += 0.02) for (let lo = 225.2; lo <= 227.2; lo += 0.02) { const h = mars.at(5, la, lo); mx = Math.max(mx, h); mn = Math.min(mn, h); }
  assert.ok(mx > 20.5 && mx < 23, `max ${mx}`); assert.ok(mx - mn > 2 && mx - mn < 12, `depth ${mx - mn}`);
});
test('TilePyramid: streams on demand, answers from the finest resident ancestor, honours its byte budget', async () => {
  const p = new TilePyramid(moon.man, async (L, r, c) => moon.read(L, r, c), 5 * 2 ** 20, 4);
  await p.warm();
  const q0 = p.height(26.13, 3.63); assert.equal(q0.level, 0);     // nothing finer resident yet → level 0, requests queued
  for (let i = 0; i < 50 && p.counts().loading + p.counts().queued > 0; i++) await new Promise(r => setTimeout(r, 5));
  for (let k = 0; k < 8; k++) { p.height(26.13, 3.63); await new Promise(r => setTimeout(r, 5)); }
  const q1 = p.height(26.13, 3.63); assert.equal(q1.level, 6, JSON.stringify(p.counts()));
  assert.ok(Math.abs(q1.h - moon.at(6, 26.13, 3.63)) < 1e-9);
  // walk far away: budget (5 MiB: level 0 ≈ 2 MiB + ≈ 26 finer tiles) forces eviction of the least-recently-used tiles, never level 0
  for (let lo = 0; lo < 360; lo += 7) { p.height(-30, lo, 2); await new Promise(r => setTimeout(r, 1)); }
  for (let i = 0; i < 100 && p.counts().loading + p.counts().queued > 0; i++) await new Promise(r => setTimeout(r, 5));
  assert.ok(p.counts().residentMiB <= 5.05, JSON.stringify(p.counts())); assert.ok(p.counts().evicted > 0);
  assert.equal(p.height(0, 100, 0, false).level, 0);
  assert.equal(p.dataLevelAt(-30, 200), 2); assert.equal(p.dataLevelAt(26.1, 3.6), 6);
});
