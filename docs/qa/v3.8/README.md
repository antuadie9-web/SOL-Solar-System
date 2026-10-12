# SOL v3.8 QA evidence (index)

The full-resolution original images (PNG + JSON metadata sidecar per image) are delivered separately as
`SOL_V38_QA_EVIDENCE.zip`, and representative sheets are embedded in the reports in `docs/reports/v3.8/` (Markdown + PDF).
This folder keeps the machine-readable results.

| Set (evidence ZIP folder) | Build | Content |
|---|---|---|
| `final/` | fe0bd93 (renderer identical to the release) | 94 views: far Sun (13 distances × modes, 16-frame sequence), Venus, Jupiter/Saturn/Uranus rings, Io/Enceladus plumes, 24 minor moons |
| `v370-A/` | v3.7.0 (upload) | matched "before" views for the A list |
| `wip8/`, `wip9/` | intermediate v3.8 builds | "before" views for moon identity (pre DEF-38-007) and Pan (pre DEF-38-009) |
| `final-gal/` | release code | Galactic sky: centre, anticentre, NGP, Scientific; α Cen parallax pair |
| `final-journey/` | release | Earth → Proxima → Earth, 21 stills (`journey.json` here) |
| `final-ui/` (+ `load/`) | release | ui38 keyboard/a11y stills, loader stills, no-WebGPU error (`ui38-audit.json`, `loadshots.json` here) |
| `perf/` | v3.7.0 ×3, release ×3 | travel38 summaries (`perf/*.json` here) |

Re-run: `tools/qa/smoke.mjs --script golden38|journey38|ui38|travel38` (see `tools/qa/scenarios/`); contact sheets with
`tools/qa/sheet.py`; PDFs with `tools/qa/md2pdf.sh`; release verification with `tools/qa/release-verify.sh`.
Renderer: Chromium + SwiftShader software WebGPU — real-GPU appearance and performance are UNVERIFIED.
