# SOL v3.3 — visual QA and test evidence

**What this evidence is.** Every screenshot here was rendered by the real app through Chromium 154's **SwiftShader software WebGPU adapter** (headless, 1280×720, epoch 2026-10-08 12:00 UTC, paused clock, exposure settled). It proves the views render with **zero WebGPU validation errors** and lets us compare composition, exposure and shading. It is **not** evidence of real-GPU appearance (colour pipeline, bloom, MSAA, anisotropy) or of performance. No hardware GPU was available in the build environment; frame times in `result*.json` are software numbers and meaningless for real hardware.

## Folders
- `screens/v3.2/` — baseline v3.2 captures (same harness, same epoch).
- `screens/v3.3/` — v3.3 captures (Sun at 0.05/0.2/1/5/30 AU, limb close-up, three Sun looks, eclipse, planets, identity atlas bodies, guide modes, UI states).
- `compare/` — side-by-side v3.2 | v3.3 for each view captured in both versions, plus the v3.3 body-identity atlas.
- `test-results.log`, `typecheck.log`, `build.log`, `assets.log` — the final automated runs.

## Results (final run, 2026-10-09)
| Check | Result |
|---|---|
| Unit/assertion tests (`npm test`) | 219 tests: 218 pass, 0 fail, 1 documented todo (Neptune VSOP87B 2.44″ in 2075, ISSUE SCI-003) |
| Type check (`tsc --noEmit`) | pass |
| Asset manifest check | 107 assets, 0 unmatched, 0 duplicates; 31 still non-commercial licence (AST-003) |
| Production build (`vite build`) | pass (main bundle 3.7 MB, 1.24 MB gzip) |
| Software-WebGPU golden captures | all requested views captured, 0 GPU validation errors in the final runs |
| UI scenario (palette, inspector, evidence tab, guides, atlas, settings, journeys, flight-cancel) | passed (exit 0) |

## Comparison caveat
v3.3 hides labels/HUD in the capture's cinematic mode while v3.2 drew labels in the same mode, so label clutter in the v3.2 frames partly reflects that difference, not only the new guide policy. Orbit-line clutter difference is real (new Clean default guide mode).

## Not verified here
- Appearance and frame time on a real GPU (protocol: `docs/qa/benchmark-protocol.md`).
- Orbit-line stability as *motion* (slow-pan video); stability is covered by numeric precision tests only.
- Animations and camera transitions as motion; only functional checks (flight cancels on wheel within a frame) and stills.
- Screen-reader behaviour with real assistive technology.
