# SOL frames, units and precision domains (v3.4 contract 1)

Code: `src/contracts/frames.ts`, `src/contracts/precision.ts`. Tests: `tests/contracts/contracts.test.ts`, `tests/render/precision.test.ts`.

| Domain | Storage unit | Frame | How it reaches the GPU |
|---|---|---|---|
| Ground patch | km (metre resolution) | body-fixed local tangent | camera-relative float32 (hi/lo when needed) |
| Body | km | body-fixed (IAU WGCCRE 2015 rotation) / body-centred | camera-relative |
| Planet system | km | system barycentric, ecliptic J2000 axes | camera-relative |
| Solar System | km (AU = 149 597 870.7 km exactly) | SSB / heliocentric, ecliptic J2000 (ICRF-aligned), TDB | camera-relative float64 → hi/lo float32 |
| Stellar neighbourhood | pc (648000/π AU) | ICRS at SSB, epoch J2016.0 + space motion | sector shards (50 pc cells), camera offset subtracted |
| Milky Way | kpc | Galactocentric (R☉ = 8.122 kpc, z☉ = 20.8 pc; Hipparcos ICRS→Galactic matrix) | contract only in v3.4 |
| Extragalactic | Mpc + redshift | cosmological — every distance must name its kind and model (`validDistance`) | contract only in v3.4 |

**Rule:** positions are stored relative to a parent anchor; vectors between two anchors are formed by walking to the
lowest common ancestor (`relative()`), never by differencing absolute universe coordinates.
**Measured:** two lunar surface points 1 m apart keep their separation to < 1e-12 km via the hierarchy; an absolute
Galactocentric float64 round-trip (|r| ≈ 2.5·10¹⁷ km) loses ≈0.6 m of the 1 m baseline — that is the failure the
hierarchy avoids. Transformation precision (this table) is distinct from source-position uncertainty (catalogue σ),
which is carried per property in `AstroObject` (`src/contracts/astroObject.ts`).

**Known simplifications (documented):** Galactocentric frame omits the ≈1·10⁻⁴ rad Sgr A* roll; light-time /
aberration ("observed sky") mode is not yet implemented — SOL shows the geometric coordinate atlas.
