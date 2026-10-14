# SOL v3.8.1 — Gate A: recovery and independent architecture audit

Owner brief: `SOL_v3.8.1_Independent_Architecture_Audit_Master_Brief.md` (2026-10-14), additional to the v3.8.1 master spec.
Evidence class for everything here: **CPU / static analysis / SOFTWARE WEBGPU** — nothing is hardware-validated.

## A0. Recovery and remote

| Item | State |
|---|---|
| Remote | `github.com/antuadie9-web/SOL-Solar-System` (private), `main` = local `master`; push via `tools/git/push.sh` (no force, refuses files > 50 MB, verifies remote head). Workflow: `docs/REPOSITORY.md` |
| Tags | `v3.8.0-supplied` 3ccb1c5, `v3.8.1-cp1` 91a8c41, `v3.8.1-cp2` annotated → **f4974e8** (unchanged); all on the remote |
| History | not rewritten; no LFS migration (largest blob in history < 40 MB, largest tracked file 29.6 MB) |
| Baseline | TypeScript clean; tests 330 → **336** pass / 0 fail (6 new Gate A tests); assets 1549, unmatched 0, duplicates 0, non-commercial 0 |

Each finding below names the commit that fixed it; QA captures are kept in build-keyed folders (`work/qa/ast3-<sha>-<body>`).

## A1. Inventory (every tracked file) — `tools/audit/inventory.py` → `docs/v3.8.1/audit/inventory.json`

2,399 tracked files; every image, GLB, JSON, gzip/zlib payload and PDF was **decoded/structurally validated: 0 invalid**.

| Class | Files | MB |
|---|---:|---:|
| runtime imagery (textures, maps) | 88 | 164.0 |
| documentation images (QA evidence) | 429 | 128.4 |
| terrain DEM tiles (`.i16z`, Moon + Mars pyramids) | 1312 | 109.0 |
| runtime scientific data (ephemerides, catalogues, sky) | 119 | 81.1 |
| documents (MD/PDF) | 179 | 47.2 |
| geometry (GLB shape models) | 25 | 22.7 |
| tools | 118 | 9.9 |
| application source (TS) | 72 | 0.8 |
| tests | 42 | 0.2 |
| fonts | 4 | 0.1 |

Module graph: `tools/audit/deps.py` → `docs/v3.8.1/audit/deps.json`. Hotspots: `render/engine.ts` (1,314 dense lines, fan-out 34,
347 float literals), `ui/ui.ts` (1,127 lines; 22 direct reads of engine internals), `render/planetMaterial.ts` (408 literals),
`render/sun.ts` (387 literals).

## A2. Risks named by the brief — findings

| ID | Risk | Finding | Class | Action / evidence |
|---|---|---|---|---|
| GA-SCI-01 | Scientific-mode brightness floor (`engine.ts`) | **Confirmed.** The per-kind minimum point flux (planets ≈ 2nd mag) AND the user boosts — `bodyBoost`, `asteroidBoost` (default 4·10⁶×), `cometBoost` (default 3,000×) — applied in **every** mode, Scientific included, undisclosed there | defect (science) | Fixed `bdce6bd`: one findability contract `visibilityGain()` / `pointFloor()` in `presentation.ts`; Scientific = gain 1, floor 0; Exploration/Cinematic unchanged; mode note discloses it; `findability381.test.ts` (3 tests incl. "no direct boost reads in engine") |
| GA-EPH-01 | Streamed ephemeris transitions | **Confirmed, severe.** Until a system's payload streamed in, `SampledEphemeris.pos()` two-body-propagated the *window-edge* state of that same window — for 2026 that is 26 years from the 2000 edge. 471 bodies jumped on activation; moons up to 2–4 orbital radii, the Pluto barycentre 7.7·10⁶ km | defect (science + continuity) | Fixed `9d1e515`: a window that covers the epoch but has not streamed answers `null`, the body's own fallback model answers and labels itself. Measured with `tools/qa/science/ephem_activation.ts` → `docs/qa/ephem-activation.json`: 471 → 75 bodies change, max 0.09 orbital radii (Phobos two-body without J2) |
| GA-EPH-02 | (found by GA-EPH-01) | **Confirmed.** Equatorial mean-element frames of satellites of RETROGRADE rotators (Uranus, Pluto) used the IAU north pole, i.e. the wrong sense of motion: the anchored fallback of Ariel / Miranda ran backwards (74° / 149° off after one day). Also the orbit-line elements of the inner Uranian moons | defect (science) | Fixed `9d1e515` (`bindSat`: right-hand-rule pole when W decreases); Ariel/Miranda now 0.0–0.1° from Horizons over 7 d |
| GA-EPH-03 | (found by GA-EPH-01) | **Confirmed.** Nix/Hydra/Kerberos/Styx fallback = two-body about Pluto's centre (μ = Pluto + moon), ignoring the barycentre: Nix 37,000 km off after 7 d | defect (science) | Fixed `9d1e515`: two-body about the Pluto–Charon barycentre (μ = Pluto + Charon); Nix 2,800 km. `ephemActivation381.test.ts` |
| GA-EPH-04 | residual activation change | Comets (67P 4.7·10⁷ km, Halley 2.8·10⁷ km) and the Pluto barycentre (5.6·10⁶ km) still change when their payload lands (osculating SBDB / two-body fallbacks); in **orbit/follow mode the camera is target-relative** so the focused body does not jump; the streaming order puts the focused system first | open (P2) | Option: start the (≈36 MB) payload fetches in parallel with boot data and hold the free-flight hand-off until the focused system is attached; or accept + label. Decision deferred to Gate B after the travel test |
| GA-ARCH-01 | WebGPU-only via private `_getFallback` | three **0.186.1 pinned exactly**; `WebGPURenderer` always installs a WebGL2 `getFallback`, the only switch is the private field. SOL nulls it before `init()` **and** asserts afterwards that the backend is WebGPU on a real `GPUDevice` (authoritative hard failure). Reliable for the pinned build | risk controlled | `webgpuOnly381.test.ts` pins the field and the call order to the installed build, so a three upgrade fails CI instead of silently enabling WebGL |
| GA-RES-01 | Resource ownership | Body views (`BodyView`: material, uniforms, ring system, atmosphere) are created lazily and **never released**; textures are budgeted/evicted by `TextureStore`, terrain disposes its patches, line sets dispose. In a long session every visited body keeps its material/pipelines | risk (P2, perf/memory) | Needs owner-HW long-session data (bench kit) before any change; candidate: LRU release of views far from the camera with pipeline cache retained |
| GA-ARCH-02 | Monolithic engine / UI | `engine.ts` owns scene lifecycle, metering, point photometry, glare, ring/plume enhancement, comet tails, guides and diagnostics; `ui.ts` reads engine internals directly. **No observed defect is caused by the structure itself**; the defects found were missing shared contracts | debt | Extract contracts where defects demand them (done: findability; exposure already single-owner in `engine`+`presentation`). No wholesale split in v3.8.1 |
| GA-PHOT-01 | Shared exposure/photometry contracts | Exposure has one owner (`expLog`/`displayExposure` written only in the engine meter). **New risk CONT-14:** unresolved planets/moons are drawn on the SKY exposure while their resolved disc uses the SCENE exposure, and the point colour uses an unexplained ×1.6 factor (the Sun normalises by luminance). The Sun had exactly this mismatch (SUN-010) and now glides exposure across its fade; planets/moons do not | risk → test | `continuity_travel.mjs titan-handover(-sci)`: Titan 9 → 0.5 px with sunlit Saturn in frame; fix only if the integrated signal jumps at 1.2–3.5 px |

## A3. Prioritised reconstruction decisions

| Rank | Work | Basis | Acceptance |
|---|---|---|---|
| 1 | AST-381-03 completion (Gate B) | open defect; iterations 8c–8e (`c024879`, `c8f2674`, `c25234d`) | matched cp2/current near+far, six bodies, two lighting azimuths, boundary crops |
| 2 | CONT-14 planet/moon point↔disc exposure domain | same class as the confirmed Sun defect | Titan travel: integrated signal follows distance law within ±15 % across 0.5–9 px, both modes |
| 3 | SUN far travel (100 AU → 1 pc), rings entry/exit sliver | outstanding acceptance | existing travel tooling |
| 4 | WP-E atmospheres (Titan detached haze first, then giant-planet limbs) | primary visual priority of the brief | matched limb/terminator/backlit views vs spacecraft geometry |
| 5 | WP-F rings: edge-on black slab, near-field compositing | confirmed visual defect (REV2) | edge-on / ring-plane sweeps |
| 6 | GA-RES-01, GA-EPH-04, perf | needs hardware data | owner RTX 3050 bench JSON |

Not justified now (no evidence): a renderer framework, a three.js upgrade, raw WebGPU/WASM paths, a full surface-material rewrite.
