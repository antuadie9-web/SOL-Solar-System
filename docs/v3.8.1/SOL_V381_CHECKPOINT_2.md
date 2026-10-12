---
title: "SOL v3.8.1 — Checkpoint 2"
subtitle: "Owner QA requirements 1–5 · stellar close range · Galactic context · observed moon shapes · intro · camera smoothing"
date: "12 October 2026"
---

# 1. Status

| Item | State | Evidence |
|---|---|---|
| Req. 1 — sky star removal validated in the rendered radiance domain | **Done** | §2, `docs/qa/v3.8.1/sky-removal-qa.json` |
| Req. 2 — star stability in rendered frames at several resolutions / pixel ratios | **Done (SW)** | §3, `centroids.json` per run; CPU trace kept |
| Req. 3 — Sun distances, 20° FOV, modes, far transitions | **Done (SW)** | §4 sheets |
| Req. 4 — Ariel / Titania / Oberon rights-cleared maps | **Done** — 0 non-commercial assets remain | §5 |
| Req. 5 — benchmark package + explanation | **Ready** (no install, no admin, no upload) | §6 |
| Resolved stellar discs (WP-B close range) | **Implemented** | §7 |
| Observed shape models for 11 Saturnian small moons (WP-G) | **Implemented** | §5 |
| Galactic context card (WP-C/L) | **Redesigned** | §8 |
| Intro "Into the Universe" (WP-K) | **Implemented** | §8 |
| Free-look judder (WP-I) | **Fixed + test** | §7 |
| Atmospheres (WP-E), rings (WP-F), terrain (WP-H), wider UI pass, perf integration | **Next** | §10 |

Tests **327/327** (310 inherited + 17 new), typecheck clean, asset manifest 1,527 files / 0 unmatched / **0 non-commercial**.
Checkpoint 1 preserved as tag `v3.8.1-cp1`; this checkpoint is tag `v3.8.1-cp2`. Every capture is software WebGPU
(SwiftShader); none of this is hardware or final visual acceptance.

SECTIONS
