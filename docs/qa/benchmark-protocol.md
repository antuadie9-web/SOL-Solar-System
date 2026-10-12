# Real-GPU benchmark protocol (to run on the target laptop)

Target: Ryzen 5 5600H · RTX 3050 4 GB · 16 GB RAM · Windows, latest stable Chrome, hardware acceleration on.
Nothing in this file has been executed yet — the build environment has no GPU.

1. `npm ci && npm run check && npm run build && npm run preview` → open `http://localhost:4173/`.
2. Settings → Graphics → enable **Diagnostics overlay**. Confirm `backend WebGPU (native)` and a non-software adapter line.
3. For each golden view (`tools/qa/scenarios/golden.mjs`: Earth orbit, Moon, Sun at 0.05/1/5/30 AU, Jupiter, Saturn, Mars, Pluto, Bennu) wait 10 s and record median / p95 / p99 frame time, estimated texture MiB and draw calls from the overlay, at 1080p and 1440p, presets Medium/High/Ultra.
4. Stress route (master spec §12): Earth → Moon → Saturn → Pluto → Sun → Earth via search + Travel, three loops. Record texture MiB after each loop (must not grow monotonically) and any hitch > 100 ms.
5. Interaction: during each Travel, scroll and drag — the flight must cancel immediately and the view must not jump.
6. Automated variant (Chrome with GPU): `CHROME="<path to chrome>" node tools/qa/smoke.mjs --url http://localhost:4173/ --script golden --out qa-out/gpu --wait 60000` (omit `--software`).
7. Archive `qa-out/gpu/result.json` + screenshots with the exact Chrome version and GPU driver.
