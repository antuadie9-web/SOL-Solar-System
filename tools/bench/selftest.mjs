// Sandbox self-test of the packaged benchmark kit: serve the EXTRACTED kit with its own serve.mjs (port 4180), run ?bench=1
// in software WebGPU, save the downloaded report. usage: node tools/bench/selftest.mjs <out.json>
import { chromium } from '../../node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
const out = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/lib/chromium/chromium', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 640, height: 360 }, acceptDownloads: true }); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
const dl = p.waitForEvent('download', { timeout: 1500000 });
await p.goto('http://127.0.0.1:4180/?bench=1&qa-software-gpu=1&qa-off=small,smallcompute');
const d = await dl; await d.saveAs(out);
const r = JSON.parse(fs.readFileSync(out, 'utf8'));
console.log(JSON.stringify({ errs, evidence: r.evidenceClass, version: r.version, phases: Object.fromEntries(Object.entries(r.summary).map(([k, v]) => [k, v.frames])), env: Object.keys(r.environment) }));
await b.close();
