# SOL v3.8.1 — handoff / resume guide (written 2026-10-16 20:35 IST)

Source of truth = this repo, branch `main` (local name `master` in the old sandbox). Everything needed to resume is in git.
Read in this order: this file → docs/v3.8.1/spec/ (owner master spec + architecture audit brief) → docs/v3.8.1/WORKLOG.md (full session history, newest at bottom) → docs/issues.md (register, newest at bottom) → docs/v3.8.1/*ACCEPTANCE.md, GATE_A_AUDIT.md, CONTINUITY_AUDIT.md, QA_WORKFLOW.md.

## Goal
SOL = true-scale WebGPU astronomy simulator (TS/Vite/three r186 WebGPU). v3.8.0 supplied → v3.8.1 reconstruction per spec Gates A–H:
A audit, B REV2 + shared defects, C atmospheres, D rings/materials, E terrain, F stars/sky/UX, G HW perf, H release.
Final: `sol-solar-system-v3.8.1-final.zip` + reports (MD + illustrated PDF), QA images, before/after sheets, requirements matrix, clean-extraction check. Desktop Chrome native WebGPU only (no WebGL/mobile).

## Owner rules (standing)
- Complete ALL remaining work through Gate H autonomously; reports are non-blocking checkpoints; ask only for consequential decisions / external blockers (owner RTX 3050 benchmark data).
- Never mark unverified work accepted. No arbitrary multipliers/tints. Scientific mode stays physical; presentation tweaks labelled.
- TIME-BOX: an issue gets at most 2 scheduled runs without a measured improvement → document it in issues.md as OPEN (evidence + next hypothesis) and move on.
- Evidence classes SW (SwiftShader software WebGPU) / CPU / HW. Sandbox evidence is SW only — never claim hardware results.
- Concise progress, efficient token usage, smallest meaningful test first. Stable issue IDs. Label parameters measured/derived/fitted/inferred with sources.
- Owner feedback 2026-10-16 on live build: stars look good; Milky Way and stars can both still be improved (Gate F).

## Status at handoff (main = d4b9e7a)
Rough estimate ≈35 % of full v3.8.1 scope. Gate A done; B mostly (REV2 items open); C partial (Titan accepted; Venus δ-M deck; Mars WPE-MA-01/02 done); D–H mostly not started (some sun/star work from cp1/cp2, HW kit exists).
Closed recently: CONT-14e, CONT-14f, CONT-14f-H, CONT-14g, TEX-381-01(+01b), QA-381-05, CONT-14h (fix d4b9e7a; Callisto/Titan regression sweep still to run: tools/handoff/c14h.batch).
OPEN: CONT-14f-S (Mars 2–8 px disc too bright under MSAA), GA-EPH-04, GA-RES-01, AST-381-04 (Triton recon), REV2 items, Uranian NC texture rights (owner), owner HW benchmark JSON.

## NEXT (in order)
1. CONT-14h regression sweep (Callisto, Titan) → close or document.
2. MA-03 Mars disc calibration (minus shell share); MA-04 dust optics (Wolff 2009, sky colour); rest of Mars WP-E (aureole, clouds, τ variation, low altitude) + Mars milestone report.
3. Venus, Earth, Jupiter/Saturn, Uranus/Neptune, Pluto/Triton hazes, WPE-SPEC-01.
4. Gate D (rings/materials, AST-381-04), E (terrain Moon/Mars), F (sun/stars/Milky Way/UX/intro, REV2), G (perf, GA-RES-01, HW kit), H (release package).

## Settled contracts (don't re-research)
Photometry in presentation.ts: catalog albedo = geometric p; pointBodyFlux/discReflectance; hemisphere albedo grid (public/assets/data/albedo_grid.json) on surface share only; atmo bodies point = shell + H×surface. Point sprite depth ≥ 5e-4·d in front of own sphere. Exposure target uses meterLuminance blend result (CONT-14h). Texture store: heal on touch, 45 s stall watchdog, back-off 20/40/80 s then 300 s.

## Commands
- Every change: `npx tsc --noEmit -p .` ; `node tools/run-tests.mjs` (354 tests) ; `node tools/validate/assets.mjs` for assets.
- Never commit docs/qa/ephemeris-residuals.json (tests regenerate it; `git checkout` it before add).
- Push: `bash tools/git/push.sh` (never force; tags v3.8.0-supplied, v3.8.1-cp1, cp2 never move).
- Live build: GitHub Pages from branch gh-pages → https://antuadie9-web.github.io/SOL-Solar-System/ . Redeploy: `SOL_WORK=<work dir> bash tools/handoff/deploy-pages.sh` after meaningful fixes.
- Lease lock for scheduled runs: tools/handoff/sol-lock.sh (set SOL_WORK). acquire/beat(≤20 min)/release.
- QA: `bash tools/qa/sandbox/setup.sh` restores headless chromium; `. tools/qa/sandbox/snaplib.sh; qa_tools; S=$(build_snap $(qa_commit))`; photometry probe `node tools/qa/probe_photometry.mjs --snap $S --out DIR --bodies X --alpha a,b --rpx r1,r2 [--mode exploration]`. Runner template tools/handoff/acc14f_c.sh + batch file of `run <label> <args>` lines. One body per probe session. QA switches ?qa-off=hemi,discdraw,pointdepth,msaa,albtex,normal,surfT,sunT,tsim,skylight,atmoalpha,atmoL,points,prewarm.
- Headless screenshots of the WebGPU canvas come out black in sandbox — don't try to record videos there; the owner judges via the live link.
- Paths in these scripts assumed the old sandbox; set SOL_WORK / SOL_REPO for a new workspace.

## Scheduler pattern (recreate in new environment)
Recurring task every 90 min: acquire lease (skip if held) → read HANDOFF/WORKLOG tail/issues tail → do the next NEXT item with the time-box rule → tsc + tests → commit + push → append WORKLOG → redeploy Pages if meaningful → release lease. Work is mandatory once the lease is held (no idle runs).
