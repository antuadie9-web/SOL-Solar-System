// v3.8.1 TEX-381-01b — every map the engine may promote to its high-resolution tier (hiAvailable) must have that file.
// A declared-but-missing _hi map made the browser decode Vite's HTML fallback (Earth's ocean mask, "source image could not
// be decoded") and spent a slot and a warning per session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CATALOG } from '../../src/data/catalog';

test('TEX-381-01b: hiAvailable maps all ship a _hi file (engine + boot preload rules)', () => {
  const missing: string[] = [];
  for (const d of CATALOG as any[]) {
    if (!d.texHi) continue;
    const names = [d.tex, d.normal, d.night, d.clouds, ...(d.noData?.recon && d.tex ? [`${d.tex}_mask`] : [])].filter(Boolean);
    for (const n of names) if (!existsSync(`public/assets/tex/${n}_hi.jpg`)) missing.push(`${d.id}:${n}`);
  }
  assert.deepEqual(missing, []);
});
