// v3.8.1 GA-ARCH-01: the native-WebGPU-only policy relies on (a) nulling three's private _getFallback before init() and
// (b) a post-init assertion that the backend is WebGPU on a real GPUDevice. (b) is authoritative; (a) avoids ever creating
// a WebGL context. This test pins (a) to the installed three build so an upgrade that renames the field fails here, not in use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('three pinned exactly and its fallback hook is the field SOL nulls', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(pkg.dependencies?.three ?? pkg.devDependencies?.three, /^\d+\.\d+\.\d+$/, 'three must be pinned to an exact version');
  const lib = fs.readFileSync('node_modules/three/build/three.webgpu.js', 'utf8');
  assert.ok(lib.includes('this._getFallback = getFallback'), 'Renderer stores the fallback in _getFallback');
  assert.ok(/if \( this\._getFallback !== null \)/.test(lib), 'init() consults _getFallback only when non-null');
  const eng = fs.readFileSync('src/render/engine.ts', 'utf8');
  const iNull = eng.indexOf('_getFallback = null'), iInit = eng.indexOf('await r.init()');
  assert.ok(iNull > 0 && iInit > iNull, 'fallback removed before init()');
  assert.ok(/isWebGPUBackend[\s\S]{0,200}instanceof \(globalThis as any\)\.GPUDevice[\s\S]{0,120}throw new Error/.test(eng), 'post-init native WebGPU assertion present');
});
