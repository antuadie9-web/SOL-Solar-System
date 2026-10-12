# SOL v3.8.1 hardware benchmark (owner kit, PERF-381-01)

The development sandbox has no physical GPU (software WebGPU only), so every real-hardware number in the v3.8.1 reports
must come from this kit. It changes nothing in the renderer; it drives the normal camera API and records what happens.

## Run it (Windows, no coding)
1. Install **Node.js LTS** from https://nodejs.org (default options) and make sure Google Chrome is up to date.
2. Unzip SOL, open the folder `tools/bench/` and double-click **RUN-SOL-BENCHMARK-WINDOWS.bat**.
   The first run installs and builds (a few minutes); later runs start in seconds.
3. Chrome opens `http://localhost:4173/?bench=1`. Leave the mouse and keyboard alone for ~3 minutes.
4. A file `sol-benchmark-<date>.json` downloads. Send it back together with a screenshot of `chrome://gpu`
   (the "Graphics Feature Status" and "WebGPU" sections) and your Chrome version (`chrome://version`).

Optional second run at a different window size or quality preset helps separate GPU-bound from CPU-bound stalls.

## What it measures
| Phase | What happens | Why |
|---|---|---|
| idle-earth | 6 s at Earth | steady-state frame time |
| travel-cold | Jupiter → Saturn → Titan → Enceladus → Neptune → Pluto → Earth (first visits) | shader/texture/mesh first-use stalls |
| travel-warm | the same legs again | separates first-use cost from steady travel cost |
| interstellar | Earth → Proxima Centauri → Earth | catalogue streaming, far-Sun regime |
| sun-pan | Sun swept in and out of frame at 1 AU | exposure continuity under real GPU timing |
| proxima-zoom | hold and zoom near Proxima | star-field stability and cost |

Per frame: rAF interval (what you perceive as a hitch), `engine.render()` CPU time, GPU time from WebGPU timestamp
queries when the adapter supports them, scene/sky EV. Also long tasks (> 50 ms), JS heap, texture residency, adapter.
The report states its evidence class (`HARDWARE` vs `SOFTWARE ADAPTER`).

## Manual equivalent
`npm ci && npm run build && npm run preview` then open `http://localhost:4173/?bench=1` in Chrome.
