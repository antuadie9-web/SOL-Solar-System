// SOL v3.8 loading-experience evidence (spec §34, §55): ordered stills of the real loader from navigation to interactive,
// with the stage list state and elapsed time, plus the error screen without WebGPU (graceful failure state).
// Usage: node tools/qa/loadshots.mjs --url http://localhost:PORT/ --out DIR [--software]
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', 'qa-load'); fs.mkdirSync(out, { recursive: true });
let url = arg('url', 'http://localhost:4173/'); const sw = process.argv.includes('--software');
const exe = process.env.CHROME || '/usr/lib/chromium/chromium';
const gpuArgs = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-angle=vulkan', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'];
const res = { stills: [] };
{
  const b = await chromium.launch({ executablePath: exe, headless: true, args: gpuArgs });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const t0 = Date.now(); await p.goto(url + (url.includes('?') ? '&' : '?') + (sw ? 'qa-software-gpu=1&' : '') + 'qa-off=small,smallcompute');
  const at = [300, 1200, 2500, 4500, 8000, 14000, 25000];
  for (const [i, ms] of at.entries()) {
    const wait = ms - (Date.now() - t0); if (wait > 0) await p.waitForTimeout(wait);
    const st = await p.evaluate(() => ({ stages: [...document.querySelectorAll('#ld-stages li')].map(li => li.dataset.st + ':' + li.className + (li.querySelector('.sd')?.textContent ? ' ' + li.querySelector('.sd').textContent : '')),
      text: document.querySelector('#loader')?.innerText?.slice(0, 400) ?? null, ready: !!window.__sol && (window.__frames ?? 0) > 3, frames: window.__frames ?? 0 }));
    const name = `load-${String(i).padStart(2, '0')}-${ms}ms`; await p.screenshot({ path: path.join(out, name + '.png') });
    const m = { image: name + '.png', elapsedMs: Date.now() - t0, ...st, limitations: 'Software WebGPU; stage timings are not real-GPU timings' };
    fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(m, null, 1)); res.stills.push(m); console.error('still', name, st.ready);
  }
  await b.close();
}
{
  // no WebGPU: launch without the WebGPU/Vulkan flags and with WebGPU disabled → the app must show its error screen
  const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--disable-features=WebGPU', '--disable-gpu'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto(url); await p.waitForTimeout(4000);
  res.noWebGPU = await p.evaluate(() => ({ hasGpu: !!navigator.gpu, text: document.body.innerText.slice(0, 600) }));
  await p.screenshot({ path: path.join(out, 'load-error-no-webgpu.png') }); await b.close();
}
fs.writeFileSync(path.join(out, 'loadshots.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ n: res.stills.length, noWebGPU: res.noWebGPU }, null, 1));
