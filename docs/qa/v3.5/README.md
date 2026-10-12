# SOL v3.5 — QA evidence

**Evidence class: `verified-software`.** Every capture was rendered by the real application in Debian Chromium 154 with
the **SwiftShader software WebGPU adapter** (headless, 1280×720, `?qa-off=small,smallcompute` because any compute pass
crashes SwiftShader on this arm64 host — R-013), epoch **2026-10-08 12:00 UTC**, paused clock, exposure and viewing-mode
parameters settled deterministically, UI hidden. It proves pipelines compile and run without WebGPU validation errors and
allows matched, *measured* comparisons. It is **not** real-GPU appearance (MSAA/anisotropy/bloom on hardware), motion, or
performance evidence. No GPU and no video capture exist in this environment.

## Harness defect found and fixed
`tools/qa/scenarios/golden.mjs` (v3.3/v3.4) never restored the clock after the eclipse view (2026-08-12), so every view
captured after it in the same run used the eclipse date. v3.5 resets the epoch for every view. For the matched comparison
the **v3.4 build was re-captured with the fixed v3.5 harness** (`screens/v3.4-matched`, script `golden35.mjs` in the v3.4
tree) — its metrics agree with the shipped v3.4 screens (e.g. Io 45.0 % clipped in both), confirming the baseline.
Images in `screens/v3.5-extra/` whose names end in `@2026-08-12` were captured after the eclipse view by the *old*
harness and therefore show that date; they are kept only as additional, explicitly dated views.

## Folders
| Folder | Content |
|---|---|
| `screens/v3.4-matched/` | v3.4.0 build, 18 views, fixed harness |
| `screens/v3.5-exploration/` | v3.5.0 default mode, the same 18 views (final build) |
| `screens/v3.5-scientific/` | v3.5.0 Scientific mode, 14 views (final build) |
| `screens/v3.5-cinematic/` | v3.5.0 Cinematic mode, 8 views — captured **before** the final highlight-target tuning (0.9 → 1.25) and airglow 0.25 → 0.15 |
| `screens/v3.5-extra/` | further Exploration views (Sun distances, limb, eclipse, terrain, rings, small bodies) — mostly from builds before the final highlight-target tuning; see dates/notes above |
| `compare/` | labelled side-by-side sheets v3.4.0 │ v3.5.0 Exploration for the 18 matched views |
| `metrics-*.json` | `tools/qa/metrics.py` output per set |
| `ui/` | interface scenario captures (viewing-mode control, Evidence tab "Map colour" row, HUD colour label). Captured before the mode control was moved 48 px down to clear the top bar. |

## Measured results — matched views, v3.4.0 → v3.5.0 Exploration
Metrics (`tools/qa/metrics.py`): **clip %** = % of disc pixels with any channel ≥ 250 (EXP-002); **disc median** = median
luma of body pixels (0–255); **sky mean** = mean luma of non-body pixels (Milky Way + stars); **stars** = isolated point
sources detected in the background.

| View | clip % v3.4 → v3.5 | disc median v3.4 → v3.5 | sky mean v3.4 → v3.5 | stars v3.4 → v3.5 |
|---|---|---|---|---|
| earth-mw | 0.261 → 0.000 | 114.1 → 57.2 | 0.02 → 3.61 | 2 → 812 |
| earth-night | 4.402 → 0.478 | 151.6 → 83.9 | 0.30 → 3.02 | 7 → 668 |
| earth-orbit | 0.000 → 0.000 | 113.8 → 72.4 | 0.01 → 1.84 | 2 → 539 |
| europa | 32.471 → 0.014 | 240.6 → 160.7 | 0.05 → 3.09 | 5 → 743 |
| io | 44.994 → 0.001 | 240.2 → 150.3 | 0.00 → 3.03 | 3 → 732 |
| jupiter | 15.477 → 0.009 | 219.4 → 154.4 | 0.00 → 3.19 | 3 → 858 |
| jupiter-mw | 11.500 → 0.000 | 181.7 → 54.2 | 0.03 → 5.17 | 7 → 892 |
| jupiter-night | 9.353 → 0.020 | 186.4 → 82.1 | 0.04 → 5.78 | 3 → 702 |
| mars | 29.219 → 0.007 | 148.1 → 72.6 | 0.03 → 1.72 | 2 → 559 |
| mars-crescent | 28.159 → 0.000 | 136.3 → 66.0 | 0.08 → 2.94 | 2 → 485 |
| moon | 0.007 → 0.000 | 182.2 → 168.9 | 0.08 → 1.93 | 5 → 458 |
| moon-night | 0.000 → 0.010 | 61.3 → 48.2 | 0.02 → 3.11 | 13 → 536 |
| moon-side | 0.006 → 0.007 | 133.2 → 111.9 | 0.10 → 2.49 | 29 → 676 |
| pluto | 39.990 → 0.002 | 228.6 → 122.2 | 1.23 → 5.60 | 0 → 859 |
| saturn | 6.486 → 0.154 | 187.2 → 135.7 | 0.19 → 2.57 | 31 → 778 |
| sun-0.05AU | 0.000 → 0.000 | 161.1 → 173.8 | 0.21 → 0.21 | 2 → 2 |
| triton | 47.289 → 0.000 | 245.1 → 166.2 | 0.17 → 3.40 | 0 → 714 |
| vesta | 34.580 → 0.001 | 243.8 → 159.0 | 0.00 → 1.83 | 10 → 553 |

Reading the table honestly:
- **EXP-002 is fixed** in every matched view (worst remaining: earth-night 0.48 % — the specular sun glint on the ocean at
  the limb, which is a true specular highlight; Saturn 0.15 % — ring ansae).
- **Disc medians fall** because v3.4's were clipped or near-clipped; Mars/Earth are darker than v3.4 by ≈1 EV. Earth's
  exposure is now set by its brightest clouds (protected at 1.25 linear) instead of clipping them. Whether the owner
  prefers slightly brighter globes is a key-value choice (`ev` or `keyEV`) — flagged for sign-off, not hidden.
- **Sky continuity:** in v3.4 every planetary view had an essentially black, starless background (0–31 detected stars);
  in Exploration the stars and the calibrated diffuse Milky Way are present in all of them (≈450–900 detected stars),
  and **Scientific deliberately keeps the v3.4 physical behaviour** (`metrics-v3.5-scientific.json`: 0–17 stars).
- **sun-0.05AU:** `sun_spots` = 0.0 in both — no sunspots are visible at this distance, and v3.5 no longer claims any
  (AUD-07). The disc is +0.3 EV brighter in Exploration.

## Automated checks (final run, see logs)
| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors (`typecheck.log`) |
| `npm test` | **252 tests, 252 pass, 0 fail** (`test-results.log`) |
| `node tools/validate/assets.mjs` | 198 files, 0 unmatched, 0 exact duplicates, 3 non-commercial (Ariel/Titania/Oberon, unchanged) |
| `vite build` | pass (multi-file, hashed) (`build.log`) |
| WebGPU validation / WGSL compile errors in all capture runs | none recorded (harness gate `[wgsl-error]`/`[gpu-uncaptured]`/`[pageerror]`) |

## Not verified here (pending hardware)
Real-GPU look, frame time and VRAM of the new terms (planetshine, airglow march term, grade node); exposure pumping and
mode-transition smoothness in motion (the transitions are tested numerically, not filmed); star temporal stability while
panning; device-loss recovery; long sessions. Protocol: `docs/qa/benchmark-protocol.md`, `docs/qa/RTX3050-guide.md`.
