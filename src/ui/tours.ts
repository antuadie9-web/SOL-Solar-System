// Guided journeys (spec §10 "tours and compare experiences"). Each stop names a real body; camera travel is a
// presentation time-lapse, never a spacecraft ETA, and the physical scene is not altered. Stops whose body is missing
// from the runtime catalogue are skipped (tests/ui/tours.test.ts verifies every stop resolves).
export interface TourStop { target: string; dwell: number; caption: string; distR?: number }
export interface Tour { id: string; title: string; blurb: string; stops: TourStop[] }
export const TOURS: Tour[] = [
  { id: 'inner', title: 'Earth, Moon and Mars', blurb: 'Home, its companion, and the next world we hope to walk on.', stops: [
    { target: 'earth', dwell: 6, caption: 'Earth — oceans, clouds and city lights at true scale.' },
    { target: 'moon', dwell: 6, caption: 'The Moon, 384,400 km away: the same face always turned toward us.' },
    { target: 'mars', dwell: 7, caption: 'Mars — relief from MOLA laser altimetry.' },
    { target: 'phobos', dwell: 5, caption: 'Phobos: observed shape model, reconstructed surface shading.' } ] },
  { id: 'giants', title: 'The giant planets', blurb: 'Bands, storms and rings from Jupiter to Neptune.', stops: [
    { target: 'jupiter', dwell: 7, caption: 'Jupiter — more than twice the mass of all other planets combined.' },
    { target: 'io', dwell: 5, caption: 'Io, the most volcanically active body known.' },
    { target: 'saturn', dwell: 8, caption: 'Saturn, its rings 280,000 km wide and mostly tens of metres thick.' },
    { target: 'uranus', dwell: 6, caption: 'Uranus, tipped 98° on its side.' },
    { target: 'neptune', dwell: 6, caption: 'Neptune — 30 AU out, sunlight 900× fainter than at Earth.' } ] },
  { id: 'moons', title: 'Worlds unlike each other', blurb: 'Why no two moons look alike — and what is observed versus reconstructed.', stops: [
    { target: 'europa', dwell: 5, caption: 'Europa: lineae over an ice shell above a global ocean.' },
    { target: 'callisto', dwell: 5, caption: 'Callisto: among the most heavily cratered surfaces known.' },
    { target: 'enceladus', dwell: 5, caption: 'Enceladus: freshest ice in the Saturn system.' },
    { target: 'iapetus', dwell: 5, caption: 'Iapetus: one hemisphere dark as coal, the other bright as snow.' },
    { target: 'hyperion', dwell: 5, caption: 'Hyperion: porous and sponge-like (reconstructed from Cassini descriptions).' },
    { target: 'miranda', dwell: 5, caption: 'Miranda: coronae and cliffs — a reconstruction; SOL has no map of it yet.' } ] },
  { id: 'small', title: 'Asteroids and comets', blurb: 'Rubble piles, contact binaries and a comet nucleus.', stops: [
    { target: 'vesta', dwell: 5, caption: 'Vesta — Dawn shape model and mosaic.' },
    { target: 'eros', dwell: 5, caption: 'Eros — NEAR Shoemaker laser-altimetry shape.' },
    { target: 'bennu', dwell: 5, caption: 'Bennu — OSIRIS-REx shape; a rubble pile 490 m across.' },
    { target: 'itokawa', dwell: 5, caption: 'Itokawa — bilobed rubble pile (family reconstruction).' },
    { target: 'cg67p', dwell: 6, caption: '67P/Churyumov–Gerasimenko — Rosetta’s comet.' } ] },
  { id: 'outer', title: 'Dwarf planets and the deep outer system', blurb: 'Pluto and beyond, where data thin out.', stops: [
    { target: 'ceres', dwell: 5, caption: 'Ceres — bright Occator deposits in the Dawn mosaic.' },
    { target: 'pluto', dwell: 7, caption: 'Pluto — Sputnik Planitia from New Horizons.' },
    { target: 'charon', dwell: 5, caption: 'Charon — its dark-red north polar cap.' },
    { target: 'haumea', dwell: 5, caption: 'Haumea — elongated by a 3.9-hour spin (no resolved imagery).' },
    { target: 'eris', dwell: 5, caption: 'Eris — one of the most reflective bodies known.' },
    { target: 'sedna', dwell: 5, caption: 'Sedna — very red, on a ~11,000-year orbit.' } ] },
  { id: 'sun', title: 'Our star, up close', blurb: 'Granulation, sunspots and limb darkening.', stops: [
    { target: 'sun', dwell: 8, caption: 'The photosphere: granules about 1,000 km across, evolving over minutes.', distR: 3.2 },
    { target: 'sun', dwell: 6, caption: 'Limb darkening: we see cooler, higher layers toward the edge.', distR: 1.6 },
    { target: 'mercury', dwell: 5, caption: 'Mercury, 0.39 AU from the Sun.' } ] },
  // v3.8: the first true-scale interstellar journey (spec §24). Distances are real; travel is a log-distance time-lapse.
  { id: 'stellar', title: 'To Proxima Centauri and back', blurb: 'Leave the Solar System at true scale: the Sun becomes a star, then the nearest star becomes a place.', stops: [
    { target: 'earth', dwell: 4, caption: 'Home. Every distance on this journey is real.' },
    { target: 'sun', dwell: 6, caption: 'The Sun from 30 AU — Neptune’s distance: still a dazzling point, 900× fainter than at Earth.', distR: 6450 },
    { target: 'star:proxima-centauri', dwell: 9, caption: 'Proxima Centauri, 1.302 pc away (Gaia DR3 parallax 768.07 mas) — a red dwarf we see as a point: its surface is not rendered yet.' },
    { target: 'star:rigil-kentaurus', dwell: 6, caption: 'Alpha Centauri A, ~13,000 AU from Proxima. The Sun is now a 0.4-magnitude star in Cassiopeia.' },
    { target: 'earth', dwell: 6, caption: 'Back home — 268,000 AU in a few seconds of time-lapse.' } ] },
];
