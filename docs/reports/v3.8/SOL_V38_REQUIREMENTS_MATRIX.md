---
title: "SOL v3.8 — Requirements-to-Evidence Matrix"
subtitle: "Master specification 'v3.7 Completion, v3.8 Major Upgrade & v4.0 Readiness', section by section"
date: "2026-10-12"
---

**Status vocabulary.**

* **Done-verified:** code, an automated test and image or metric evidence.
* **Done-software:** code plus software-WebGPU evidence, with no hardware check.
* **Partial**, **Open**, **Blocked**, **Not started**, **Doc**.

**Evidence references.** Image names refer to the QA evidence package (`QA_IMAGES/<set>/<name>.png` plus a JSON sidecar).
Report names are abbreviated: V37, V38, AUD (scientific and asset audit), VQA (visual QA), PERF and HAND (master hand-off).

| § | Requirement | Status | Evidence / where | Remaining |
|---|---|---|---|---|
| 2 | Desktop Chrome, native WebGPU only, no WebGL | Done-verified | `core/gpu.ts` probe; no-WebGPU error screen `final-ui5/load/load-error-no-webgpu` | — |
| 3 | No arbitrary quality ceiling | Done-software | no caps added; optimisations are worker/caching only (PERF §2) | hardware tiers |
| 4 | Honesty, evidence classes | Done | truth labels in asset manifest, inspector "Size source", "Model" badge, enhancement labels | — |
| 6–7 | Baseline recovered, audited, reproduced | Done-verified | tag `v3.7.0` = upload (2,158 files identical); tsc/tests/build reproduced (V37 §2) | — |
| 8 | Preserve verified foundations | Done-verified | regression audit + v3.7.1 hunk check (RELEASE_VERIFICATION) | — |
| 9 | Outstanding-work register, classified | Done | V37 §3 | — |
| 10 | Venus terminator | Done-software | `final/venus-terminator` vs `v370-A` (−9.25 → −1.32 EV); cloud-top flight | real-GPU look |
| 10 | Jupiter backlit rings | Done-software | `final/jup-backlit(-sci)` | — |
| 10 | Io plumes | Done-software (REPRESENTATIVE look) | `final/io-pele-limb-*`, `io-tvashtar-limb` | time-variable activity |
| 10 | Enceladus plumes | Done-software | `final/enceladus-plume-*` (0 clipped px) | — |
| 10 | Other regressions | Done | DEF-38-001…013 (V38 §9) | — |
| 11 | Ring completion (Uranus eccentric, tiers, Pan/Encke) | Partial | `final/ura-*`, `seq-ura-epsilon-precession_*`, `moon-pan`; test innermoons38, rings371 | R5 volumetric, wakes, spokes, propellers (Open) |
| 12 | Atmosphere completion | Partial | V37 §5; DEF-38-001 fix | volumetric clouds (CLD-001 Open) |
| 13 | v3.6 obligations | Partial | LUT worker done; terrain patch worker not done | terrain worker |
| 14 | Moon inventory + appearance policy | Partial | `docs/inventory/moons-v371.json`, `satSizes.json`, `final/moon-*` (24 views) | controlled small-moon mosaics |
| 15 | v3.8 release title / workstreams | Done | V38 §1 | — |
| 16–17 | Far-Sun regimes (photosphere → disc → subpixel → star) | Done-software | `final/sunfar-*` (13 distances × modes), `seq-sunfar_f00–15`, Sun at 1 ly / 1 pc / Proxima distance | real-GPU bloom |
| 18 | Far-Sun QA set | Done-software | VQA §2 | 4K captures (1600×900 used) |
| 19 | Lighting system | Partial | metering fixes; planetshine unchanged | BRDF upgrades, GI |
| 20–21 | Galactic architecture, source data | Done (foundation) | Gaia DR3 20-pc refinement; GCNS + Hipparcos; G→V photometry (DEF-38-013) | Gaia bulk > 100 pc |
| 22 | Catalogue streaming | Done-software | journey metadata: shards 0 → 39 → 85 resident; SHA-256-verified | bulk tiles |
| 23 | Reference frames | Done-verified | `contracts/frames.ts`, tests (Sgr A\*, NGP) | — |
| 24 | First interstellar journey (Earth → Proxima → back) | Done-software | `final-journey/*` (21 frames, finite, monotonic), Sun from Proxima, α Cen from Proxima | hardware smoothness |
| 25 | Milky Way background + structural model | Partial (model + card; panorama unchanged) | `milkyWayModel.ts` + tests; Galactic card in UI shots; `final-gal/*` | rendered 3-D Galaxy (v3.9) |
| 26 | Deep-sky reference objects | Done (markers) | 9 objects, `deepSky.ts` | volumetric rendering |
| 27–29 | Visual identity, tiers O1–O4, no repetition | Partial | size-dependent geology, families, AUD §4 | mosaics |
| 30 | Textures and materials | Partial | asset manifest (1,513 assets) | KTX2, 3 NC maps |
| 31 | Small bodies and shape models | Done-software (2 new) | Itokawa, Phoebe GLB (PDS) | more SBN models |
| 32 | High-resolution planetary surfaces | Not started in v3.8 | v3.6 terrain unchanged | LROC/CTX imagery |
| 33 | Improve, do not rebuild, the UI | Done | UI polished in place | — |
| 34 | Loading & intro | Done-software | `final-ui5/load/*` (7 stills + error) | — |
| 35 | Navigation & information | Done-software | search fix, star inspector, Galactic card, journeys | panel docking (UX-002) |
| 36 | Motion & transitions | Done-software | radial interstellar legs; reduced-motion honoured (ui38) | hardware motion review |
| 37 | Accessibility | Done-software | ui38 on release build: 230 controls, 0 unnamed, 0 < 24 px, 0 low-contrast; Tab/Esc/R/search checks | screen-reader pass with real AT |
| 38–39 | Travel stutter: reproduce + profile | Done-software | PERF §2–3, 3+3 runs | hardware traces |
| 40–41 | Optimisation without visual compromise | Done-software | workers, pre-smoothing, predictive prep; identical images (DEF-38-001 caught a precision loss, fixed) | KTX2 |
| 42 | Real hardware validation | **Blocked** | no GPU in this environment | owner RTX 3050 run (guide in docs/qa) |
| 43–46 | v3.9 / v4.0 readiness | Doc | HAND §7–9 | — |
| 47–48 | Sources and media rights | Done | AUD §1–2, CREDITS.md | 3 NC maps |
| 49–57 | Still-image QA with metadata | Done-software | 94 final views + 6 Galactic + journey 21 + UI 11 + loader 8, JSON sidecars | 4K; terrain not re-captured |
| 58–61 | Six reports, MD + image-rich PDF | Done | `docs/reports/v3.8/` | — |
| 62 | Engineering verification | Done-verified | tsc 0 errors, 310/310 tests, assets 0 unmatched, build, clean-extract boot (RELEASE_VERIFICATION) | — |
| 63–68 | Acceptance gates | Scientific/functional/doc: met in software scope; visual: met with listed residuals; performance & UX: **not met until hardware validation** | VQA §10, PERF §6 | hardware |
| 69 | Recovery & checkpointing | Done | git history, tags `v3.7.0`, branch `v3.7.1`, tag `v3.8.0`, WORKLOG | — |
| 71–72 | Releases | Done (owner-amended: single consolidated ZIP) | `sol-solar-system-v3.8-final.zip` | — |
| 73 | Final scope audit | Done | this matrix | — |
