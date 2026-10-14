# AST-381-03 — partial-mosaic observed/reconstructed boundary: acceptance (2026-10-14)

**Candidate:** `4e3d06f` (iteration 10, guide-rim fix + signed-distance mask). **Baseline:** tag `v3.8.1-cp2` (`f4974e8`).
**Evidence class:** SW — headless Chromium 154 + SwiftShader WebGPU, DPR 1, 1280×720. Not hardware evidence; native Chrome/RTX 3050 confirmation remains open.

## Reproducibility
Both sides are served from immutable `git archive` snapshots of the exact commit (code and every `public/` file, git-object extraction; `node_modules` is the only link, three 0.186.1 on both). Each snapshot carries a blob manifest and is re-hashed before every capture batch (`work/qa/snapshot-identity.txt`: cp2 1,606/1,606, candidate 1,628/1,628 every batch). The queue (`tools/qa/sandbox/ast3_queue.sh`) completes only when every required image of the candidate commit and the baseline exists with a matching BUILD record.

Earlier cp2 evidence was contaminated: the old baseline linked the working tree's `public/`, so its Ariel/Oberon/Titania near views and its far set used post-cp2 colour maps and `texstats`. Those captures are kept and renamed `*.contaminated-assets`; they are not used here. Triton/Pluto cp2 near views were kept: no file the cp2 build loads for them differs from the tag. The first Oberon/Triton candidate views and one Oberon cp2 recapture were taken with working-tree servers whose `src`/`public` were byte-identical to the commit at the time (tree clean; noted in each BUILD).

## Coverage
Six bodies (Ariel, Titania, Oberon, Triton, Pluto, Charon) × near (1.7 R at the boundary latitude, sun azimuth 20° and 70° = grazing and higher sun across the boundary; hi texture level) + far (3.2 R mission views; base level). GPU errors: none in any candidate batch.

## Result
| Criterion | Result |
|---|---|
| Dotted / beaded dark boundary | **Gone** in all 12 near and 6 far candidate views (cp2 shows a hard stepped edge in every near view and in the Titania/Triton/Pluto/Charon far views) |
| One-texel bright hairline | Gone; isolated high-pass pixels on the lit disc (|L − median5| > 25) fall 2–9× vs cp2 (e.g. Ariel 4,491→637, Titania 2,831→553, Triton 2,584→491); the remainder are crater rims and stars |
| Stepped/staircase boundary | Gone (cp2 stair-step edge on Ariel, Titania, Triton) |
| Procedural discontinuity across the boundary | None seen; detail fades over the ramp |
| Transition width | Soft, ~8–12 px at far range on Triton; no edge ringing |
| Provenance | Observed/reconstructed labels unchanged |

**AST-381-03 is closed** (boundary artefact defect), SW evidence.

## Remaining limitations (not boundary defects; opened as AST-381-04)
1. **Reconstructed tone/colour vs observed edge.** The join is smooth everywhere, but on Triton the reconstruction stays neutral grey against green-yellow observed terrain, so the two domains read as two materials (clearest at far range). Pluto and Charon now carry a muted version of the observed hue (better than cp2's flat grey), still lower in contrast than the observed side. Needs a scientifically defensible colour prior (disc-integrated colour / ground-based spectra) rather than a per-body tint.
2. **Reconstruction morphology.** The procedural detail is crater-dominated everywhere. That is wrong for Triton (very young, few craters, cantaloupe terrain) and probably for Pluto/Charon unknown terrain; it should be driven by per-body crater density and terrain class.
3. **Faint circular rim outlines** from large procedural craters are visible in the reconstructed area (cp2 and current alike).
4. **Source-data smear** in the observed Ariel/Charon mosaics near their limb (stretched pixels) is in the source map; not a renderer issue.
5. Hardware (native Chrome WebGPU) confirmation outstanding.

Evidence: `work/qa/ast3-4e3d06f-*`, `work/qa/ast3-cp2-*` (excluding `*.contaminated-assets`), sheet `work/qa/sheets/ast3-acceptance-4e3d06f.png`.
