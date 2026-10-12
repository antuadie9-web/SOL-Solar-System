# SOL v3.6 — release QA evidence (software WebGPU)

**Renderer for every image: Chromium 154 + SwiftShader software WebGPU (`fallback: true`)** — these images show what the
shaders compute; they are NOT real-GPU look, frame-time, VRAM or motion evidence.

## How the images were made
* Harness `tools/qa/scenarios/golden36.mjs` (27 views), run **unchanged** on the v3.5 tree (git worktree of `master`) and on
  v3.6.0 (commit on branch `v3.6`). Epoch **2026-10-08 12:00 UTC**; surface sites use the same automatic date search for a
  requested solar elevation on both trees. 1600×900 viewport, `?qa-off=small,smallcompute` (SwiftShader crashes on compute).
* v3.6 images: `screens/v3.6/{exploration,scientific,cinematic}/*.png`, each with a **`.json` metadata record** (version,
  object, view request, camera position/quaternion/FOV/distance/altitude, sim JD TT and UTC, viewing mode, phase angle,
  quality preset, tone map, exposure EV, sky EV, detail tier, terrain stats, adapter, resolution, limitations).
  (The UTC field is printed by the page's Date implementation in the QA browser's locale; the JD TT field is authoritative.)
* v3.5 baseline images: `screens/v3.5/exploration/*.png` (same harness; no metadata — the v3.5 build has no metadata hook).
* Matched sheet: `compare/v3.5-vs-v3.6-matched.jpg` (14 views, left v3.5, right v3.6).

## Metrics (tools/qa/metrics.py, tools/qa/detail.py)
* `metrics-v3.5-vs-v3.6.md` — clipped-pixel %, disc median, sky mean, detected stars for all 27 views.
* `detail-v3.5-vs-v3.6.txt` — high/mid-frequency energy (ground detail).
* `screens/*/metrics.json` — raw per-set metrics.

Headline results (Exploration):
| View | v3.5 | v3.6 | Meaning |
|---|---|---|---|
| titan disc median | 51.5 | 134.1 | Titan is now an opaque orange haze globe (surface map no longer visible from space) |
| mars-night clipped % | 0.000 (2.56 % in the interim build before limb metering) | 0.000 | backlit dust crescent highlight-protected |
| mars-gale sky mean | 7.6 | 19.5 | dusty daytime sky instead of a black/space-like sky |
| moon-hadley ground HF energy | 0.85 | 1.96 | horizon-map cast shadows + 118 m LOLA tiles |
| moon-tycho ground HF energy | 9.02 | 11.7 | crater-rim shadows |
| every view clipped % | ≤ 0.06 | ≤ 0.06 | no new highlight clipping |

## Known visual issues found in this release QA (carried into v3.7)
* **Mars from orbit looks too desaturated / the polar cap is washed out (`mars`, `mars-polar`).** Cause identified: the
  atmosphere shell is composited with a single *grey* alpha (1 − mean transmittance), so the surface behind dust is dimmed
  equally in all channels and mixed toward the haze colour. Physically, the red surface should be transmitted more than blue.
  Fix (v3.7): per-channel view transmittance applied in the surface shader from the transmittance LUT, inscatter-only
  compositing over the disc.
* Martian low-altitude sky is brown-olive rather than butterscotch in some views for the same compositing reason combined
  with the low sun; the dust ω₀ values are now measured (blue 0.77, Wolff et al. 2010), not tuned.
* Sun close-range look unchanged from the v3.6 granulation pass; owner sign-off pending.

## Verification of the release
See `../../SOL_V3.6_COMPLETE_PHASE_REPORT.md` §Release for the clean-extract run (npm ci, typecheck, tests, assets, build).
