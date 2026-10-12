# SOL v3.8.1 — hardware benchmark kit (PERF-381-01)

The development sandbox has no physical GPU, so real-hardware performance numbers can only come from your PC.
This kit measures SOL on your machine. **It installs nothing, needs no administrator rights and uploads nothing.**

## What is in the package
| File | Purpose |
|---|---|
| `dist/` | the pre-built SOL app (HTML/JS + astronomical data and textures), exactly what the source builds to |
| `tools/bench/RUN-SOL-BENCHMARK-WINDOWS.bat` | double-click launcher |
| `tools/bench/serve.mjs` | tiny local web server using only Node.js built-ins (used if Node.js is installed) |
| `tools/bench/serve.ps1` | the same server in Windows PowerShell (used if Node.js is not installed) |
| `src/qa/bench.ts` (source zip) | the benchmark code itself, for review |

## What the launcher does, step by step
1. Checks that `dist/index.html` exists (no download, no build, no `npm install`).
2. Starts a local web server in its own window: Node.js `serve.mjs` if `node` is on your PATH, otherwise PowerShell
   `serve.ps1` (run with `-ExecutionPolicy Bypass` for that one process only — your system policy is not changed).
   The server listens on **localhost:4173 only** (loopback); nothing outside your PC can connect to it.
3. Opens Google Chrome at `http://localhost:4173/?bench=1` (falls back to your default browser if Chrome is not found).
4. The page runs a fixed, hands-off script for about 3 minutes (please don't touch mouse/keyboard):
   idle at Earth · first-visit travel Jupiter → Saturn → Titan → Enceladus → Neptune → Pluto → Earth · the same legs again
   · Earth → Proxima Centauri → Earth · the Sun swept in and out of frame at 1 AU · hold and zoom near Proxima.
5. Chrome saves `sol-benchmark-<date>.json` to your Downloads folder and shows a one-line summary.

## What it collects (stays on your PC unless you send it)
- Per-frame: frame interval, CPU time of the render call, GPU time (WebGPU timestamp queries, if your GPU/driver exposes
  them), which phase was running, scene/sky exposure.
- Summary: p50/p95/p99/max frame time, hitches over 33/50/100 ms, long main-thread tasks, JS heap size.
- Environment: Chrome user-agent string, WebGPU adapter vendor/architecture/description and feature list, window and
  canvas size, device pixel ratio, SOL quality settings, SOL version/commit.
- It does **not** collect files, browsing data, accounts, IP addresses or anything outside the SOL tab. The JSON is plain
  text — open it in Notepad to see everything it contains before sending it.

## Requirements
Windows 10/11, current Google Chrome with hardware acceleration on. Node.js is optional. Free disk ≈ 1 GB (unzipped app).

## Please send back
The `sol-benchmark-*.json`, a screenshot (or "Copy report to clipboard" text) of `chrome://gpu`, and `chrome://version`.
Running it twice (e.g. at your normal window size and maximised) helps separate GPU-bound from CPU-bound stalls.

## Stop / clean up
Close the "SOL local server" window. Delete the unzipped folder to remove everything; nothing else was written except
the downloaded JSON and Chrome's normal cache for localhost.
