# Ephemeris tiers (what produces each position)

The inspector's **Position source** row shows the live tier for the selected body.

| Tier | Bodies | Window | Measured accuracy vs JPL Horizons (tests/astro/ephemeris.test.ts) |
|---|---|---|---|
| **Horizons sampled, interpolated** | 8 planets (Earth & giants via system barycentre − moon offsets), Phobos, Deimos, Io, Europa, Ganymede, Callisto, Mimas…Phoebe (9), Miranda…Oberon (5), Triton, Nereid, Proteus, Pluto (barycentre), Charon, Nix, Hydra, 1P/Halley, 2P/Encke, 67P | 2000-01-01 → 2050-01-01 TDB | planets ≤ 2.5 km; moons off-grid ≤ 10⁻³ of orbital radius (worst Nereid 348 km, Mimas 166 km, Titan 1.7 km, Triton 1.0 km, Charon 0.01 km) |
| ELP/MPP02 + rigorous precession | Moon | any (series valid ~1500–2500) | 0.07–0.37 km, 1950–2050 |
| VSOP87B | planets outside the window | ±4000 yr | ≤ 0.4″ inner/giants 1950–2075; Uranus 1.2″, Neptune 2.4″ (2075, known deviation) |
| Lieske E5 | Galilean moons outside the window | 1500–2500 | 150–730 km (2026) |
| Horizons osculating state @ 2026-10-08.0, two-body | ~440 other moons | best near epoch; degrades with time (perturbations ignored) | exact at epoch; not yet characterised away from it |
| Two-body from window edge | sampled bodies outside the window | — | labelled "extrapolation"; error grows with distance from the edge |
| SBDB full-precision osculating elements, two-body | other asteroids, dwarf planets, comets | best near element epoch | Ceres 7,580 km, Vesta 3,898 km, Pallas 4,826 km (~0.3 yr from epoch); comets with non-gravitational forces are not modelled |
| Rounded SBDB elements on GPU | 94,523 point sprites | — | O(10⁵ km); visual only (ISSUE SCI-005) |

**Frame:** ICRF axes, J2000 ecliptic (SOL uses ε₀ = 84381.406″; Horizons' ecliptic uses 84381.448″ — 0.042″, below every tolerance). Geometric positions (no light-time or aberration). Time argument TDB.

**Interpolation:** two-sided two-body propagation (universal variables) from the neighbouring grid states, blended with a smoothstep weight; exact at nodes, continuous, no allocation of extra data.

**Refreshing data:** `npm run ingest:sampled` (network; ~40 MB of Horizons output), `npm run ingest:minor-moons`, `npm run ingest:sbdb`, then `npm test`.
