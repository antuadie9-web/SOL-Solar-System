# SOL object-class coverage — v3.3 (2026-10-08)

Statuses (spec §1/§14): **Complete+verified** · **Implemented, visually unapproved** (works, owner sign-off and real-GPU look pending) · **In progress** · **Queued** (scheduled phase) · **Blocked** · **Not knowable**.
Counts are runtime-registry counts from `src/data/catalog.ts` and the shipped data files, not estimates.

## Solar System

| Family | Status | What exists in v3.3 | Evidence tier mix |
|---|---|---|---|
| Sun | Implemented, visually unapproved | Hero photosphere (granulation, meso/supergranulation, active regions, faculae, differential rotation), three looks, physical corona, eclipse metering, flux-conserving point source | Limb darkening measured; surface structure simulated |
| Planets (8) | Implemented, visually unapproved | Global maps, per-world atmospheres, Earth clouds/night/ocean glint, Saturn rings; Moon/Mars DEM terrain | A (giants: representative-epoch maps) |
| Major moons (24 sampled + others) | Implemented | Global maps where licensed; Ariel/Titania/Oberon partial with labelled reconstruction | A / B / C |
| Small moons (≈400 from JPL elements) | Implemented (point + representative shape on approach) | Two-body orbits from Horizons states | D |
| Dwarf planets (Ceres, Pluto, Eris, Haumea, Makemake, Gonggong, Quaoar, Sedna, Orcus) | Implemented | Ceres/Pluto/Charon mapped; others volatile-dwarf family reconstructions with literature basis | A / C |
| Featured asteroids (21) | Implemented | 9 observed shape models + 12 distinct family reconstructions (rubble-top, contact binary, fragment, metal-rich …) | B / C |
| Catalogued small bodies (94,523) | Implemented (GPU points) | SBDB elements (rounded ≈10⁵ km for points); promote-to-body on search | D |
| Comets (12 featured) | Implemented | 67P observed shape; others comet-nucleus family; activity-scaled coma/tails | B / C / D |
| Interstellar objects | Implemented (3I/ATLAS) | SBDB hyperbolic orbit, open arc | D |
| Rings (Saturn, Uranus, Neptune, Jupiter) | Implemented (photometric annulus) | Cassini-derived radial profile for Saturn | A (profile) |
| Heliosphere boundaries | Queued (Phase 7) | — | — |
| Oort cloud (conceptual shell) | Queued (Phase 7) | — | Not knowable object-by-object |

## Stars, Milky Way, beyond

| Family | Status | Notes |
|---|---|---|
| Nearby stars in 3D (335,865; GCNS < 100 pc + Hipparcos) | Implemented (v3.2, preserved) | True parallax; 157 named travel targets |
| Gaia DR3 bulk streaming (octree/HEALPix shards) | Queued (Phase 8) | Spec contract recorded; ingestion tool skeleton exists (`tools/ingest/gaia.mjs`) |
| Resolved stellar surfaces, binaries/multiples | Queued (Phase 8/10) | |
| Milky Way morphology (disk, bar, arms, halo, dust) | Queued (Phase 9) | Current panorama is labelled a 2D image |
| Clusters, nebulae, SNRs, dark clouds | Queued (Phase 10) | |
| Exoplanet systems | Queued (Phase 10) | |
| Sgr A* / compact objects | Queued (Phase 10) | |
| Local Group, extragalactic atlas, cosmic web, cosmology modes | Queued (U1–U6) | Breadcrumb shows Universe/Milky Way as disabled future levels |

No family has been removed relative to v3.2.
