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

## QA-381-03 — measurement preflight and scientific acceptance (2026-10-15)
**Preflight (automatic, tools/qa/probe_photometry.mjs).** Every GPU sample records and checks: target body (requested = rig target),
measured vs requested phase (≤ 1°), epoch (JD 2461314.5 TT), display exposure finite > 0, exposure converged, atmosphere LUTs
uploaded, CPU disc twin built (engine.qaAtmoState), atmospheres enabled, HDR readback present, point entry found (rpx < 0.55),
flux ratio plausible. Readiness failures are retried twice (2 s apart); anything still failing is written with `valid:false` and
its reasons into `photometry.json → invalid[]` and must not enter a conclusion. The first sample of a run is a discarded warm-up.

**Quantities — never mix them.**
| name | meaning | unit |
|---|---|---|
| `Fmeas` | physical flux recovered from the scene-linear HDR target: Σ(L − median)·pxAng² ÷ X | engine flux (Sun irradiance at 1 AU = 1) |
| `Fpt` | committed point flux (exposure removed) — CPU photometry / disc twin | same |
| `Fref` | Lambert reference p·Φ_L(α)·π(R/d)²/r² | same |
| `X` | DISPLAY EXPOSURE — a scale factor, not a flux (the L2a misreading) | dimensionless |
| `hdr.peak/median` | scene-linear radiance ÷ X | engine radiance |
| PNG pixels | post-tone-map, sRGB — appearance only, never photometry | 0–255 |

**Scientific acceptance checklist** (for any substantial physical model): governing equations and their approximations; parameter
conventions (e.g. geometric vs Bond albedo, per-km coefficients); which inputs are MEASURED, DERIVED, FITTED or INFERRED; an
independent reference that does not share the implementation's assumptions (e.g. Monte Carlo vs LUT RT, published observations not
used in the fit); a stated tolerance; CPU/GPU parity where both exist (parity proves equivalence of implementations, not physics).
