// Browser smoke / screenshot harness (Chromium + native WebGPU).
// Usage: node tools/qa/smoke.mjs [--url http://localhost:4173/] [--out qa-out] [--software] [--wait 20000] [--script name]
// --software lets Chromium use its SwiftShader WebGPU adapter (isFallbackAdapter) and appends ?qa-software-gpu=1.
// Software rendering proves functionality (pipelines compile, no exceptions, frames render); it is NOT a performance or
// final-look measurement. Real-GPU runs must be done on the target laptop (see docs/qa/benchmark-protocol.md).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
// Software QA needs a Chromium whose SwiftShader WebGPU can present to a canvas: Debian's chromium 154 does; Playwright's
// bundled Chromium 141 loses the device ~2 s after any canvas configure() (verified 2026-10-08, see docs/qa/README.md).
const exe = process.env.CHROME || (fs.existsSync('/usr/lib/chromium/chromium') ? '/usr/lib/chromium/chromium' : path.join(process.env.HOME, '.cache/ms-playwright/chromium-1194/chrome-linux/chrome'));
const software = flag('software');
let url = arg('url', 'http://localhost:4173/');
if (software) url += (url.includes('?') ? '&' : '?') + 'qa-software-gpu=1';
const out = arg('out', 'qa-out'); fs.mkdirSync(out, { recursive: true });
const waitMs = +arg('wait', '30000');
const W = +arg('w', '1280'), H = +arg('h', '720');
const args = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan'];
if (software) args.push('--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog', '--disable-features=DawnSIRepsUseClientProvidedSemaphores');
const browser = await chromium.launch({ executablePath: exe, headless: !flag("headed"), args: flag("stderr") ? [...args, "--enable-logging=stderr"] : args });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript({ path: path.resolve('tools/qa/gpu-errors.js') });
if (flag('compat')) await page.addInitScript({ path: path.resolve('tools/qa/chromium-compat.js') });
const log = []; const T0 = Date.now(); const ts = () => ((Date.now() - T0) / 1000).toFixed(1) + "s ";
page.on('console', m => log.push(ts() + `[${m.type()}] ${m.text()}`));
page.on('pageerror', e => log.push(ts() + `[pageerror] ${e.message}`));
page.on('requestfailed', r => log.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));
page.on('response', r => { if (r.status() >= 400) log.push(`[http ${r.status()}] ${r.url()}`); });
const blockRe = arg('block', null); if (blockRe) await page.route(new RegExp(blockRe), r => r.abort());
const t0 = Date.now();
await page.goto(url);
let ready = false;
try { await page.waitForFunction(() => (window).__sol && (window).__frames > 3, null, { timeout: waitMs }); ready = true; } catch { }
const bootMs = Date.now() - t0;
const result = { url, software, ready, bootMs, viewport: [W, H] };
result.state = await page.evaluate(() => {
  const w = window; const s = w.__sol;
  return { err: w.__err ?? null, frames: w.__frames ?? 0, gpu: w.__solGpu ?? null, loaderText: document.querySelector('#loader')?.textContent?.slice(0, 300) ?? null,
    diag: s?.engine?.diagnostics?.() ?? null };
});
const scen = arg("script", null);
if (ready && scen) {
  const mod = await import(path.resolve('tools/qa/scenarios', scen + '.mjs'));
  result.scenario = await mod.default(page, { out, log });
}
try { await page.screenshot({ path: path.join(out, 'final.png'), timeout: 120000 }); } catch (e) { log.push('[harness] final.png screenshot timed out (software adapter after the scenario; not an app error)'); }
result.log = log;
// shader validation gate: any WGSL compile error or uncaptured WebGPU validation error fails the run
result.gpuErrors = log.filter(l => /\[wgsl-error\]|\[gpu-uncaptured\]|\[pageerror\]/.test(l));
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, log: log.slice(0, 60) }, null, 2));
await browser.close();
process.exit(ready && !result.state.err && !result.gpuErrors.length ? 0 : 1);
