# SOL v3.4 — QA evidence

**What this evidence is.** Every capture was rendered by the real application through Debian Chromium 154's
**SwiftShader software WebGPU adapter** (headless, 1280×720, epoch 2026-10-08 12:00 UTC unless the view says otherwise,
clock paused, exposure settled deterministically, UI hidden). v3.3.0 (`/screens/v3.3`) and v3.4.0 (`/screens/v3.4`)
were captured with the **same harness, camera placements, epoch and settle procedure** (`tools/qa/scenarios/golden.mjs`,
run against each production build). It proves the views render with zero WebGPU validation errors and lets look,
composition and exposure be compared. It is **not** evidence of real-GPU appearance (MSAA, anisotropy, bloom on real
hardware) or of performance. No hardware GPU and no video capture were available in this environment.

Captures require `?qa-off=small,smallcompute`: any WebGPU compute pass kills SwiftShader on this arm64 host (R-013), so
the GPU asteroid field is absent from all frames (unchanged from v3.3; hardware behaviour unknown).

## Folders
- `screens/v3.3/`, `screens/v3.4/` — raw PNGs, plus the harness `result-*.json` (adapter, diagnostics, ring-field state).
- `compare/` — labelled v3.3 | v3.4 sheets for all 36 views present in both builds (`tools/qa/sidebyside.py`).
- `ui/` — v3.4 interface scenario captures (`tools/qa/scenarios/ui.mjs`).
- `typecheck.log`, `test-results.log`, `assets.log`, `build.log` — the final automated runs.

## Results (2026-10-09)
| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `npm test` | **235 tests, 235 pass, 0 fail, 0 todo** (v3.3: 219 = 218 + 1 todo) |
| Asset manifest | 193 files, 0 unmatched, 0 exact duplicates, **3 non-commercial** (v3.3: 31) |
| `vite build` | pass (multi-file, hashed assets) |
| Golden captures | 36 comparable views + 2 ring fly-through views; 0 page errors in final runs |

## What changed visibly (see `compare/`)
- **Sun** (`sun-0.05AU`, `sun-0.2AU`, `sun-limb`, `sun-0.05AU-cinematic`): flat beige disc → warm limb-darkened
  disc at 0.05 AU *[v3.5 correction, AUD-07: the original text claimed "visible sunspot groups and plage"; the capture shows none — measured `sun_spots` = 0.0 with tools/qa/metrics.py; at a 72 px disc radius the simulated groups are ≤ 2 px]*; limb close-up warmer with per-granule brightness. Remaining
  weakness: the granulation close-up still reads somewhat regular ("tiled") — owner sign-off pending.
- **Colour fidelity everywhere** (Earth, Jupiter, Mars, Io): Neutral tone mapping instead of AgX (measured AgX
  desaturation). Mars may now read more saturated than the eye sees; AgX remains selectable.
- **Moons**: Europa, Enceladus, Tethys, Dione, Rhea, Iapetus, Pluto, Charon, Ganymede, Io, Triton, Vesta, Ceres, Mimas now
  from public-domain USGS/NASA mosaics. Vesta and Charon are now correctly registered (v3.3 was 150° / 180° off).
  Pluto/Charon low-resolution approach hemispheres are shown as observed (blurry ~20–30 km/px data), not repainted;
  unobserved southern latitudes are labelled reconstructions.
- **Rings**: `ring-flythrough` (A ring, 20 m above the plane) and `ring-flythrough-B` (B ring, unlit face) show the
  new particle field; far-field Saturn ring rendering unchanged except tone mapping.

## Not verified here
- Real-GPU frame time, VRAM, look (`docs/qa/benchmark-protocol.md`, `docs/qa/RTX3050-guide.md`).
- Motion: slow-pan guide stability, granulation temporal coherence, ring-field motion, travel transitions — no video.
- Screen-reader behaviour with real assistive technology.
