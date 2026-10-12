# Running and benchmarking SOL on your RTX 3050 laptop

Everything here runs locally; nothing is uploaded. Expected time: ~30 minutes.

## 1. Install and verify
1. Install **Node.js 20 or newer** and the latest **Google Chrome** (stable).
2. Unzip the project, open a terminal in the `sol` folder:
   ```
   npm ci
   npm run check        # typecheck + all assertion tests + production build — must end with "built in …"
   npm run preview      # serves the build at http://localhost:4173
   ```
3. In Chrome open `chrome://gpu` and confirm **WebGPU: Hardware accelerated** and that the NVIDIA GPU is listed.
   On Windows laptops with Optimus, set Chrome to "High performance" in *Settings → System → Display → Graphics*.
4. Open `http://localhost:4173`. If the loader says *Software WebGPU adapter refused*, Chrome is on the integrated/software path — fix step 3.

## 2. Hardware checks that could not be run in the build environment
a. **Compute shaders (ISSUE GPU-003):** run `npm run dev`, open `http://localhost:5173/tests/render/rawcompute.html` — the page must not report a lost device;
   then `http://localhost:5173/tests/render/compute.html?variant=full` (three.js Kepler compute, 94,523 objects).
b. **App with all layers:** Settings → Graphics → enable **Diagnostics overlay**. Check the `backend` line says `WebGPU (native)` with your NVIDIA adapter and that asteroids are visible (Layers → Asteroids).

## 3. Golden views and frame times
With Diagnostics on, visit each view, wait 10 s, note median / p95 / p99 frame time, draw calls, texture MiB and terrain patches:
Earth orbit · Moon · Sun at 0.05 AU, 1 AU, 30 AU · Jupiter · Saturn · Mars · Pluto · Bennu · Titania (unobserved-hemisphere reconstruction) ·
Moon at 25 km altitude looking at the horizon (terrain) · Mars at 40 km (terrain) · total solar eclipse (time console → 2026-08-12 17:46 UTC, travel to the Moon's shadow) ·
search **Proxima** / **Sirius** → Travel (3D stars; the Sun becomes a star in Cassiopeia from α Cen).
Do this at 1080p and 1440p with presets Medium / High / Ultra.

Automated variant (same views, screenshots + JSON):
```
set CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe
node tools/qa/smoke.mjs --url http://localhost:4173/ --script golden --out qa-out/rtx3050 --wait 60000
```
(omit `--software`; the run fails if any WGSL compile error or WebGPU validation error is logged.)

## 4. Stress route
Earth → Moon (descend to 20 km) → Saturn → Pluto → Sun → Proxima → back to Earth, three loops, using search + Travel; scroll and drag during each flight
(travel must cancel instantly without a jump). Record texture MiB after each loop — it must plateau near the budget (Settings → Graphics → Texture memory budget), not grow.

## 5. What to send back
`qa-out/rtx3050/result.json` + screenshots, your Chrome version (`chrome://version`), NVIDIA driver version, and the frame-time table. Those numbers become the first real performance baseline (ISSUE PERF-003).
