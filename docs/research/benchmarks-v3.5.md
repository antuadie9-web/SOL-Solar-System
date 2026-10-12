# SOL v3.5 — benchmark research (SpaceEngine · ARK Starmap · universesimulator.org)

Accessed 2026-10-09. Only what was actually retrieved or observed is recorded. No proprietary assets, shaders or code
were copied from any reference.

## 1. SpaceEngine (primary benchmark) — official documentation read

**Sources:** SpaceEngine blog "HDR rendering 2" (15 Apr 2017, https://spaceengine.org/news/blog170415/); SpaceEngine
user manual, Graphics settings (https://spaceengine.org/manual/user-manual).

| What SpaceEngine documents | Why it matters for SOL | Adopted? |
|---|---|---|
| "Photo mode" with three options: **Auto** — physically based brightness of all objects, automatic adaptation "by analysing the image brightness in the central area of the screen"; **Manual** — same, adaptation off, exposure correction by the user; **HDR** — "the old rendering mode, when you can see planet and stars in the sky simultaneously … faked, because engine simply renders each kind of object with its own brightness multiplier (not physically based)". | This is exactly SOL's dilemma. SE's own author calls the "see everything" mode faked and unphysical. | SOL's **Scientific** mode ≈ SE Auto/Manual (one physical camera). SOL's **Exploration** mode replaces SE's ad-hoc per-object multipliers with a *calibrated, documented* two-domain composite: the sky layers (stars, diffuse Milky Way, unresolved worlds, airglow) are exposed with a dark-adapted reference exposure that is weakly coupled to the scene exposure and fully re-coupled by physical veils (daylit air, the Sun in frame). It is labelled on screen. |
| Exposure correction keys (< and >). | Manual compensation must never change the simulation. | SOL keeps `ev` (scene) and adds `skyEV` (sky domain only). |
| Lens flare "disappearing smoothly behind occluder, not instantly"; takes "color/absorption of the transparent occluders such as atmosphere and rings" into account. | Sun glare continuity. | SOL already fades glare with the visible solar-disc fraction (circle–circle occlusion, v3.2+). Atmosphere/ring colouring of glare: **not yet** (open). |
| Post-filters: sharpness, saturation, "color vibrance … fixes losing of color saturation caused by the new bloom effect". | Confirms that bloom desaturates and a grade may compensate. | SOL Cinematic has a bounded saturation/contrast grade applied before tone mapping; Scientific/Exploration have none. |
| Graphics options "Planet shine" (illumination of objects by light reflected from planets/moons) with low/medium/high colour accuracy (catalogue colour vs. averaged sun-facing image). | Secondary illumination is a standard expectation. | SOL v3.5 adds physical planetshine (Lambert-sphere phase law, neighbour's catalogue colour ≈ SE "low"). Averaged-image colour: open. |
| "Eclipse shadows", "Ring shadows on sky", dithering against banding in sky/Milky Way. | Background banding. | SOL has eclipse shadows (v3.2); v3.5 adds ±½-LSB dither in the diffuse-sky shader. Ring shadows on atmospheres: open. |
| MSAA options up to 32×; FXAA "makes background stars look dim". | Star sub-pixel visibility. | SOL keeps 4× MSAA in the HDR pass and uses energy-normalised Gaussian PSFs (no FXAA). |

## 2. Star Citizen ARK Starmap (interface benchmark)

**Attempted:** https://robertsspaceindustries.com/en/starmap via a page fetch. **Result:** the page delivers its shell
("Loading Ark interface", a lore intro, an "Explore starmap" button) and the message "Your browser does not seem to
support WebGL." — the interactive map needs WebGL, which the fetch (and the remote browser used for §3) does not provide,
so the map itself could not be inspected. **No observations of its visual hierarchy, camera motion or panels are claimed in this release.** What can
be stated from the page itself: it is a WebGL application with a fullscreen recommendation and a skippable narrative
intro. SOL's interface work in v3.5 is limited to the viewing-mode control and honesty labels; ARK-inspired UI work stays
on the roadmap (P6) pending an inspection on a machine with WebGL.

## 3. universesimulator.org (user-supplied reference)

**Attempted** with a remote browser agent (2026-10-09 16:18 IST). **Exact result:** the site stays on a static screen
reading "WebGL 2 is required — please use a current Chrome, Edge, Safari or Firefox." No 3D scene, controls, menus or HUD
appeared. Therefore **no observation** of its lighting, dark sides, stars/Milky Way, scale transitions, UI or load times
is made here, and nothing is adopted or rejected on its basis. Fact established: it is a WebGL 2 application (SOL is
WebGPU-only by requirement). Re-inspection on a GPU-equipped desktop is listed as an open item (RES-01).

## 4. Physical references used for the lighting model
- NASA Earth Observatory, "Where are the stars?" (M. Carlowicz, 28 Sep 2011): Juno's Earth–Moon image "exposure time …
  was too short for any stars to be seen … The brighter an object is, the shorter the exposure time"; ISS: "Shorter
  exposure imagery of the Earth … typically do not record stars as they are too dim compared to the brightness of the
  planet"; Cassini long exposures (Tethys in eclipse, Iapetus by Saturnshine) do show stars. → Scientific mode behaviour,
  and the reason Exploration needs a separate, labelled sky exposure.
- Leinert et al. 1998, A&AS 127, 1 ("The 1997 reference of diffuse night sky brightness") — airglow ≈ V 22 mag arcsec⁻²
  at the zenith; diffuse Galactic light and the zodiacal floor (used for the derived SKY_CAL constants).
- Khronos PBR Neutral tone mapper (reference implementation reproduced in `presentation.ts pbrNeutral` and tested).
- Jarzynski & Olano 2020, "Hash Functions for GPU Rendering", JCGT 9(3) — PCG3D hash used to remove the periodic
  granulation lattice.
