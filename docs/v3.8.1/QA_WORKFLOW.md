# SOL v3.8.1 — risk-based QA workflow (QA-381-02, adopted 2026-10-14)

Quality targets, evidence classes (SW/CPU/HW) and the immutable-snapshot rule (QA-381-01) are unchanged.

| Level | When | What |
|---|---|---|
| L1 diagnostic | during implementation | smallest test that can falsify the hypothesis: unit tests, `tools/qa/probe_*.mjs` single geometries, short travel with `--shots 0` |
| L2 focused | change ready | regression + visual acceptance of the systems the change touches (travel sequences, the affected views, A/B vs immutable baseline) |
| L3 full | milestones / release | full applicable matrix (golden views, travel, sheets, perf kit) |

Expand a level whenever a change touches a shared contract (exposure, PSF/points, depth/representation, ephemeris).
Reuse evidence whose build (snapshot blob manifest) and dependencies are unchanged.

Runner: `tools/qa/sandbox/l1.sh <label> <cmd…>` — recovers tools, serves an immutable git-object snapshot of HEAD or of the
uncommitted tracked tree (`git stash create`), verifies identity, logs each phase to `work/qa/qa-cost.log`.
Metric: `tools/qa/hdr_metric.py` (inverse Neutral tone map; plain sRGB sums mis-weight dim pixels several-fold).

## Measured cost (SW Chromium 154 + SwiftShader, 960×540, 2026-10-14)
| Phase | Cost | Note |
|---|---|---|
| tools reinstall after sandbox reset | 16–17 s | resets ≈ every 20–60 min (4 this session) |
| snapshot build / server start / identity verify | 1–7 s / 2–8 s / 1.2 s | negligible |
| app boot to first frames | 18 s | |
| travel step (3 frames + diagnostics) | 2–9 s, typ. 5 s | |
| 33×33 clip screenshot | 12–20 s | **bottleneck: ≈ 75 % of a travel run** — next optimisation target |
| full-frame screenshot | ≈ 30 s | skipped in L1 (`--shots 0`) |
| harness hang (vite inherited the job's stdin) | +1,200 s per job (×3) | fixed in snaplib.sh |
