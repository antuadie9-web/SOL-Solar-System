# SOL_V3.7_RING_SYSTEM_RESEARCH_AND_IMPLEMENTATION

Report date 2026-10-10. Scope: spec Part III (§8–17) and §33, §41. Self-contained for external review. **All renders are
software WebGPU (SwiftShader); no real-GPU look/performance evidence exists.**

## 1. Audit of the pre-v3.7 rings (spec §10) — v3.6.0 code
| Body | Catalogue data? | Geometry created? | Visible? | Radii/orientation | Optical depth | Texture / licence | Occlusion / order | LOD | Shadows / scattering | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| Saturn | `rings: {inner 69570, outer 140240, tex saturn_ring}` | yes (annulus 768×8) | yes | main rings only (no D/E/G; F in texture only); equatorial ✓ | **none**: alpha of an art texture (Solar System Scope, CC BY 4.0) × 0.995, converted to a pseudo-τ | colour+alpha CC BY 4.0 ✓ | premultiplied, depthWrite off, renderOrder 2 ✓ | single tier + near-field particles (v3.4) | planet shadow on rings ✓; ring shadow on planet = 0.92 × texture alpha (not τ) | **working but not physical** |
| Jupiter | `rings: {92000–129000, opacity 0.015}` + 1-D profile table | yes | barely / never | halo, main, gossamer as 4 Gaussian bands; radii roughly right | τ 6e-6 … 5e-7 (order of magnitude right) | procedural ✓ | ✓ | none | forward-scatter boost ×60 on the unlit side only; no dust phase function | **intentionally faint, accidentally invisible** (no labelled enhancement) |
| Uranus | 9 narrow rings in a 1-D 8192-texel profile | yes | no (sub-texel rings smeared to τ ≈ 0.001 per texel) | radii ✓ (NSSDC), ε width ok | τ ✓ but averaged over 2 km/texel → invisible at most distances; λ, ζ, ν, μ missing (9 of 13) | procedural ✓ | ✓ | none | same generic slab photometry | **misrepresented (texel smearing)** |
| Neptune | 4 rings + 1 dust band | yes | no | Adams, Le Verrier ✓; Galle/Lassell as narrow lines (wrong — they are broad) | Adams τ 0.08 uniform (no arcs) | procedural ✓ | ✓ | none | generic | **arcs missing; broad rings wrong** |
| Chariklo, Haumea, Quaoar | Chariklo absent from catalogue; Haumea/Quaoar without rings | no | — | — | — | — | — | — | — | **missing** |
| Near field (Saturn) | v3.4 particle field 120 m box | yes | yes | Hill frame ✓ | coarse 9-step τ table; **cap 24,000 particles ≈ 55 % of the B-ring τ** (RING-001) | — | opaque impostors ✓ | fades in < 3 km | Lambert-ish | **under-dense** |

## 2. Inventory of ring-bearing objects (spec §9, §41)
| Body | Status | Rings in SOL v3.7 | Key sources |
|---|---|---|---|
| Saturn | confirmed | D, C, B, Cassini Division, A, Encke gap, Keeler gap, F (all in the measured profile 72,000–142,500 km), G, E | NASA NSSDCA Saturnian Rings Fact Sheet (upd. 2022-04-19); PDS Ring-Moon Systems Node VG_2801 (Voyager 2 PPS δ Sco, 1981-08-26) |
| Jupiter | confirmed | halo, main ring, Amalthea gossamer, Thebe gossamer, Thebe extension | NSSDCA Jupiter Rings Fact Sheet; JPL/Galileo (dust from Metis, Adrastea, Amalthea, Thebe) |
| Uranus | confirmed | 6, 5, 4, α, β, η, γ, δ, λ, ε, ζ (1986U2R), ν (R/2003 U 2), μ (R/2003 U 1) = 13 | NSSDCA Uranus Rings Fact Sheet; de Pater et al. 2006; NASA Webb 2023 ("13 known rings") |
| Neptune | confirmed | Galle, Le Verrier, Lassell, Arago, unnamed (Galatea orbit), Adams + arcs Fraternité, Égalité 1/2, Liberté, Courage | NSSDCA Neptunian Rings Fact Sheet; Dumas et al. 1999; de Pater et al. 2005, 2018 |
| (10199) Chariklo | confirmed | C1R 390.6 km, C2R 404.8 km | Braga-Ribas et al. 2014 (Nature 508); Morgado et al. 2021 (A&A 652) |
| (136108) Haumea | confirmed | 2287 km ring | Ortiz et al. 2017 (Nature 550) |
| (50000) Quaoar | confirmed | Q1R 4057 km (dense arc + tenuous), Q2R 2520 km | Morgado et al. 2023 (Nature 614); Pereira et al. 2023 (A&A 673 L4); Proudfoot et al. 2025 (PSJ, JWST) |
| (2060) Chiron | **candidate / disputed** | not rendered | Ortiz et al. 2015 proposed a ring system; later occultations report changing secondary features whose interpretation (rings vs evolving disc/shell of material) is unsettled — not rendered until confirmed |
| Quaoar 5,700 km structure | **not a ring** | not rendered | Nolthenius et al. 2025 event; 2025 ApJL analysis favours a small satellite |
| Mars (Phobos/Deimos dust tori), Rhea ring | **undetected / refuted** | not rendered | predicted Martian dust tori undetected; Rhea ring not found in Cassini imaging (Tiscareno et al. 2010) |

## 3. Data per system (radii in km from the centre; τ normal optical depth)
Full machine-readable record: `src/data/rings.ts` (each component has `status` and `source`). Summary:
* **Saturn** — measured profile (Voyager 2 PPS, 1 km): regional means computed from the shipped asset (test
  `tests/render/rings.test.ts`): C 0.11, B 1.99 (cap 4.5 where PPS saturates, 4,666 samples), Cassini Division 0.15, A 0.55,
  Encke gap < 0.05. D 66,900–74,510 τ 1e-5 (dust); G 166,000–173,000 τ 1e-6; E 180,000–480,000 τ 1e-6 peaking at Enceladus'
  orbit (238,040). Particle ϖ 0.6 (NSSDCA A/B albedo 0.4–0.6), HG g −0.35 + opposition surge; dust ϖ 0.7, g +0.7.
* **Jupiter** — halo 89,400–123,000 τ 3e-6 (10,000 km thick, rendered flat); main 123,000–128,940 τ 5e-6 (dust fraction 0.6,
  APPROXIMATE); Amalthea 128,940–181,350 τ 1e-7; Thebe 181,350–221,900 τ 1e-7; extension to 280,000 (τ INFERRED ≈ 3e-8).
  Macro ϖ 0.015 (NSSDCA main-ring albedo), dust ϖ 0.4, g +0.7.
* **Uranus** — 6 41,837/1.5/0.3; 5 42,234/2/0.5; 4 42,571/2/0.3; α 44,718/7/0.4; β 45,661/8/0.3; η 47,176/1.6/0.4;
  γ 47,627/2.5/0.3; δ 48,300/5/0.5; λ 50,024/2/0.1 (dusty); ε 51,149/58/1.4; ζ 37,850–41,350 τ 1e-4; ν peak 67,300 τ 1e-5;
  μ peak 97,700 τ 8.5e-6. Albedo ≈ 0.015. ε eccentricity (0.0079, width 20–96 km) NOT modelled.
  The Voyager PPS σ Sgr profile was ingested but not used radially (its equatorial-geometry cut places ε at 50,870 km).
* **Neptune** — Galle 40,900–42,900 τ 1e-4; Le Verrier 53,200 w 113 τ 0.01; Lassell 53,200–57,200 τ 1e-4; Arago 57,200
  w 100 τ 1e-4 (INFERRED); unnamed 61,500–62,400 τ 3e-5 (INFERRED); Adams 62,933 w 15 τ 0.01 with arcs τ 0.12 (Fraternité,
  Égalité 1/2) and faded Liberté (0.03) / Courage (0.01) per de Pater et al. 2018. Arc pattern speed 820.1194°/day
  (Dumas et al. 1999); **absolute arc longitude not anchored to an observation (REPRESENTATIVE)**. Dust fraction 0.5–0.7.
* **Chariklo** C1R 390.6 w 6.5 τ 0.38, C2R 404.8 w 3.5 τ 0.06; body 143.8×135.2×99.1 km; pole = ring pole (151.30°, 41.48°).
* **Haumea** 2287 w 70 τ 0.5, equatorial (coplanar with Hiʻiaka).
* **Quaoar** Q1R dense part 4057 FWHM 5 km τ 0.4 over a REPRESENTATIVE 40° arc + tenuous 4010–4100 τ 0.003; Q2R 2520 w 10
  τ 0.004. Quaoar pole set to the ring pole (259.82°, 53.45°; Pereira 2023) — replaces the v3.6 placeholder (0°, 90°).
* Particle albedos of the small-body rings are unknown: INFERRED 0.08–0.1 and labelled.

## 4. Rendering architecture (spec §11)
| Tier | Condition | What is drawn |
|---|---|---|
| R0 | ring system < 1.5 px | nothing (no false large geometry); the planet's point/disc photometry carries the light |
| R1 | < 60 px | shaded τ annulus, coarse profile LOD (550 / 69 km) |
| R2 | < 2500 px | same shader, profile LOD by pixel footprint (69 → 9 km), analytic narrow rings, arcs, planet shadow |
| R3 | ≥ 2500 px (close) | exact 1-km measured samples (manual linear filter, 2-D 4096-wide texture), narrow rings sharp at any zoom |
| R4 | within 3 km of Saturn's ring plane inside the main rings | v3.4 Hill-frame particle field (now τ from the measured profile, cap 65,536) blended over the sheet |
| R5 | volumetric ring ray-march | **not implemented** — see §9 |
Implementation: `src/render/ringSystem.ts` (one material per system, WGSL `ringCore` + `ringShade` + `ringPlanetShadow`),
`src/data/rings.ts`, engine integration in `getView`/`updateView` (`ringState`, `ringDiag`, `flyToRing`, `ringLabelAnchors`).

Key equations (all in `ringShade`, CPU twins in `ringSystem.ts` used by tests):
* Lit face (single-scattering slab, Chandrasekhar / Cuzzi et al. 1984): I/F = ϖP(α)/4 · μ0/(μ0+μ) · (1 − e^{−τ(1/μ0+1/μ)}),
  × multiple-scattering factor 1/(1 − ½ϖ(1 − e^{−τ})) (APPROXIMATE two-stream estimate).
* Unlit face (diffuse transmission): I/F = ϖP/4 · μ0/(μ0−μ) · (e^{−τ/μ0} − e^{−τ/μ}) → glowing C ring / Cassini Division.
* Dust (thin): I/F = ϖ_d P_HG(g>0)/4 · τ_d/μ · attenuation by the macro particles.
* Background transmission: 1 − e^{−(τ_m+τ_d)/μ} (rings occlude planet and stars physically; edge-on rings become opaque lines).
* Narrow-ring anti-aliasing: pixel-footprint box filter; equivalent depth ∫τ dr conserved to < 2 % at 0.5–500 km/px (test).
* Profile LOD levels conserve mean τ within 3 % (test) → no brightness change when zooming.
* Planet shadow on rings: ray–ellipsoid test toward the Sun with solar-disc penumbra. Ring shadow on the planet:
  e^{−τ/|l_z|} from the system's total-τ texture (all ring systems; v3.6: Saturn only, 0.92 × art alpha).
* Arcs: azimuth in the body frame + inertial pattern phase (pattern speed × t − prime-meridian angle, `primeMeridian`).

## 5. Visibility and modes (spec §15)
Scientific mode: physical brightness (gain 1) always. Exploration / Cinematic: a per-system gain = clamp(0.08 [0.1] /
peak I/F, 1, enhanceMax) — Saturn 1 (never enhanced), Uranus ≤ 100, Neptune ≤ 1000, Jupiter ≤ 1000, Quaoar ≤ 20,
Chariklo/Haumea 1. The gain multiplies radiance only — τ, geometry, colours and occlusion are unchanged — and the mode badge
states "Rings: brightness ×N (enhanced, optical depth unchanged)" whenever it is > 1. Setting `ringEnhance` disables it.
Ring-region labels (`ringLabels`, off by default) name the major regions as a scientific overlay.

## 6. Near field (spec §13)
* B-ring under-density fixed: cap 24,000 → 65,536 (needed N = τL²/(π⟨a²⟩) ≈ 44,000 at τ 2.5; the PPS-saturated core τ 4.5
  would need ≈ 80,000 and is still capped — documented).
* Local τ now from the measured profile at the box scale (120 m), not a 9-step table.
* Icier, smoother particle shading (v3.4 noise bump removed — it read as cratered rock; ±20 % albedo; approximate ringshine fill); still single-quad impostors, no self-shadowing between
  particles, no wakes, no collisions, no regolith texture (not claimed).
* Differential (Keplerian shear) motion unchanged (v3.4): ẏ = −1.5Ωx in the Hill frame.

## 7. Precision and performance (spec §16)
* Far/mid field: the annulus is body-local (km) and drawn camera-relative; r = |p.xy| in float32 resolves ≈ 8 m at 10⁵ km —
  invisible from > 2,000 km but it produced visible 8–30 m banding/blocks 30 m above the plane (found in v3.7 QA).
* **Near-field patch (v3.7, new):** within 2,000 km of the plane over the measured profile, a camera-anchored disc
  (radius 25 × altitude, 30 m–8,000 km) replaces the annulus locally (the annulus discards inside it). Its vertices are
  LOCAL (km from the patch centre) and placed camera-relative from float64 on the CPU; the radius is evaluated as
  r = r0 + Δr with Δr = u·l + (|l|² − (u·l)²)/(2r0) (series in the small offset l), and the profile index is split into an
  exact integer base + fraction. Result: no quantisation or vertex jitter near the plane (`sat-nearfield-*`,
  `seq-ring-plane-traverse_*`). Particles keep the v3.4 float64 Hill frame.
* Cost per pixel: one 4-level profile fetch + a loop over ≤ 16 analytic components (Uranus 13) + ≤ 8 arcs. No ray-marching,
  no per-frame CPU particle work (particles are a static seeded buffer). Textures: Saturn fine profile 4096×18 r16f (147 kB),
  three coarse levels, a component table. Measured cost on real GPUs: **NOT TESTED**.

## 8. Tests (all pass) — `tests/render/rings.test.ts` (10)
catalogue coverage of all 7 systems; Uranus 13 rings, Neptune 5 rings + 5 arcs; every component sourced and inside its span;
Saturn PPS regional τ (C/B/CD/A, Encke gap); LOD mean-τ conservation; narrow-ring equivalent-depth conservation; slab
photometry limits; intrinsic brightness ordering (why enhancement is needed); Neptune arc τ ratio; small-body radii and labels.

## 9. Known inaccuracies and remaining work
* R5 volumetric ring rendering (SpaceEngine 2021 blog technique) **not implemented**; no statistical volume filling between the
  sheet and particles; no self-gravity wakes, spokes, propellers, density-wave azimuthal structure.
* Eccentric/inclined rings (Uranus ε, Saturn's Titan and Maxwell ringlets) drawn circular; Uranus ring inclinations ignored.
* Jupiter halo/gossamer vertical thickness not rendered; dust phase function single HG lobe.
* Neptune arc absolute longitude not anchored; Quaoar dense-arc azimuth representative.
* Saturn colour from an art map (chroma only); the PPS profile is one 1981 occultation cut (no azimuthal asymmetry, saturated B core).
* Planetshine on rings (Saturnshine on the unlit face) not included.
* All visuals software-rendered; owner/real-GPU review pending.
