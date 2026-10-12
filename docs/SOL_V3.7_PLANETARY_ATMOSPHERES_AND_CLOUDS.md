# SOL_V3.7_PLANETARY_ATMOSPHERES_AND_CLOUDS

Report date 2026-10-10. Scope: spec Part IV (§18–23), §34, §42. Self-contained. Software-WebGPU evidence only.

## 1. Architecture (shared by every body)
* **CPU physical model** `src/render/atmoModel.ts` (v3.6): per-body profiles (Rayleigh, Mie with per-channel ω₀ and g, an
  absorber with exponential or tent profile), transmittance LUT 256×64 (Bruneton 2017), multiple-scattering LUT 32×32
  (Hillaire 2020), skylight table, CPU ray radiance (tests, exposure metering).
* **GPU** `src/render/atmosphere.ts`: per-pixel march on a shell using the LUTs; `viewTransmittance` (v3.7).
* **v3.7 compositing fix (ATM-005)**: v3.6 dimmed everything behind an atmosphere by one grey factor 1 − mean(T). v3.7 applies
  the **per-channel transmittance surface → camera** in the surface shader (LUT ratio T(p→top)/T(c→top), Bruneton 2017 §2.3;
  test: within 0.02 of direct integration on Mars and Earth) and the shell adds only in-scattered light over the disc. Off
  the disc (limb, sky) the shell still dims what lies behind it. Effect: Mars' surface stays red behind dust, the polar cap
  reappears, Titan's surface is obscured per channel, Earth's land keeps its colour near the limb.
* **Density shift for giant planets** (`densityShiftH`): their cloud maps already contain the integrated colour of the deep
  atmosphere, so the shell's coefficients are evaluated 2 scale heights above the 1-bar level (stratosphere + upper haze) —
  it adds the limb, terminator twilight and backlit forward scattering without double-counting the map.
* **Venus cloud deck** (`cloudTopKm: 70`): the visible surface is drawn at the ≈ 70 km cloud tops; the LUT shell sits on it.
* **Plume module** `src/render/plumes.ts` (new): localised plumes as seeded body-fixed particle splats with a forward-scattering
  HG phase function and planet shadowing — never a global shell.
* **Taxonomy** `src/data/atmospheres.ts` (new): class (thick / thin / exosphere / plume / none), composition, pressure, scale
  height, clouds, what is rendered, sources — shown in the inspector (Physical tab).

## 2. Body-by-body matrix
| Body | Class | Composition / pressure | Rendered in v3.7 | Parameters (status) | Clouds | Validation |
|---|---|---|---|---|---|---|
| Mercury | exosphere | O, Na, H, He, K; < 5×10⁻¹⁵ bar | **nothing** (correct; no shell, no limb glow) | — | none | test: no preset |
| Venus | thick | 96.5 % CO₂; 92 bar | LUT shell above the cloud deck at +70 km; cloud map as visible surface | CO₂ Rayleigh at the cloud tops DERIVED (≈ 30 mbar, 230 K → 1.0e-3 km⁻¹ at 550 nm, H 15.9 km); upper H₂SO₄ haze τ ≈ 0.3, H 5 km, ω₀ lower in blue (APPROXIMATE) | single static cloud map (no super-rotation motion, no UV contrast model) | captures venus-*; test: cloudTop 70 |
| Earth | thick | N₂/O₂; 1 bar | v3.6 LUT atmosphere (Rayleigh, Mie, ozone tent, MS), airglow, skylight; v3.7 per-channel view transmittance | MEASURED/DERIVED (v3.6 research record) | one global cloud map rotating with the body; **no cloud shadows, no layered or volumetric clouds** | v3.6 tests (τ, blue sky, red low Sun) |
| Mars | thin | CO₂; 6.1 mbar | LUT atmosphere: CO₂ Rayleigh + dust τ 0.5 | ω₀ red 0.975 (Wolff 2009), blue 0.77 (Wolff 2010, measured), green 0.90 interpolated; g 0.67/0.69/0.72 (G/B inferred) | **none** (water-ice/CO₂ clouds, dust storms, seasonal τ OPEN) | tests: τ 0.5, red sky + blue aureole, transmittance red > blue |
| Jupiter | thick (no surface) | H₂/He; NH₃, NH₄SH, H₂O clouds | LUT stratosphere shell over the observed cloud map, Minnaert limb darkening on the map | Rayleigh DERIVED at 1 bar/165 K (n·σ_H₂ ∝ λ⁻⁴), H 27 km; blue-absorbing haze τ ≈ 0.3 (APPROXIMATE); density shift 2H | belts/zones/GRS from the map only; **no 3-D cloud layers, no wind-driven deformation** | captures jupiter-*; test: density shift |
| Saturn | thick | H₂/He; NH₃ clouds | LUT shell (Rayleigh + thick yellow haze τ ≈ 1.5), ring shadows from ring τ | Rayleigh DERIVED (134 K, H 60 km); haze APPROXIMATE | hexagon/bands only as in the map | captures saturn-* |
| Uranus | thick | H₂/He + 2.3 % CH₄ | LUT shell: Rayleigh + CH₄ red absorption + thick white haze (paler than Neptune) | Rayleigh DERIVED (76 K, H 31 km); CH₄ channel means APPROXIMATE; haze τ 0.4 after Irwin et al. 2024 | **no** discrete storms | test: red ≫ blue absorption, thicker haze than Neptune |
| Neptune | thick | H₂/He + 1.5 % CH₄ | LUT shell: stronger CH₄ absorption, thinner haze → deeper blue | Rayleigh DERIVED (72 K, H 23 km); haze τ 0.15 | **no** methane-ice clouds or dark spots | same test |
| Titan | thick | N₂/CH₄; 1.47 bar | LUT atmosphere τ > 3 orange haze; surface obscured | APPROXIMATE (Tomasko 2008) | methane clouds not rendered | test τ > 3 |
| Triton | thin | N₂; 14 µbar | LUT haze shell (τ ≈ 0.01) | Pollack et al. 1990 APPROXIMATE | geysers not rendered | test τ < 0.05 |
| Pluto | thin | N₂/CH₄/CO; ≈ 10 µbar | LUT haze shell, blue forward scattering | Gladstone 2016, Cheng 2017 APPROXIMATE (single smooth layer, not ~20 layers) | — | test τ < 0.05 |
| Io | plume | patchy SO₂, ≈ 1 nbar | **plume module**: Pele (330 km), Prometheus (90 km), Tvashtar (330 km); no shell | heights MEASURED (Voyager/Galileo/New Horizons), activity REPRESENTATIVE | — | test heights |
| Europa, Ganymede, Callisto | exosphere | O₂ / CO₂ | metadata only (correct: invisible) | — | — | test no preset |
| Enceladus | plume | H₂O vapour + ice grains | **plume module**: 20 representative jets along the four tiger stripes, ~450 km scale, forward scattering | Porco 2006/2014; jet positions REPRESENTATIVE | — | test: jets < −75° lat |
| Moon, Ceres, Eris | exosphere / none | — | metadata only | — | — | — |

## 3. What is NOT implemented (honest)
* **Volumetric clouds** for any body (Earth layered clouds, cloud shadows, Venus cloud structure, giant-planet cloud decks,
  Mars water-ice/CO₂ clouds, Titan methane clouds). Clouds are static or rotating 2-D maps.
* **Weather/dynamics**: no wind-driven deformation, no fluid simulation, no dust storms, no seasonal Martian τ, no polar hood.
* Aerial perspective inside the atmosphere for terrain uses the shell march + per-channel surface transmittance; there is no
  froxel volume, so other bodies seen through an atmosphere (e.g. the Moon from Earth's surface) still use the grey alpha.
* Aurorae, lightning, nightglow outside Earth, Mercury's sodium tail, Io's torus, Enceladus' E-ring feeding (the E ring is
  rendered as a ring component), Triton geysers.
* Gas-giant haze parameters and ice-giant methane coefficients are channel-averaged approximations (cited trends, not
  retrieved spectra). LUT builds remain on the main thread (300–450 ms per body).

## 4. Evidence
Image set `SOL_V37_ATMOSPHERE_IMAGES.zip`: for 13 bodies — day, terminator, backlit (Sun exactly behind the body), pole,
limb, Scientific, Cinematic; plus cloud-top flights for Venus, Jupiter, Saturn, Uranus, Neptune (not implying solid ground),
Titan low altitude, Pluto/Triton backlit haze rings, Enceladus backlit plumes, Io plumes at the limb, Earth sunset limb.
Each PNG has a JSON metadata record. Before/after (v3.6 vs v3.7) for Mars, Venus, Titan in
`SOL_V36_V37_BEFORE_AFTER_COMPARISONS.zip`.
