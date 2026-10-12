// Notable real events — the time console can jump straight to them with a matching viewpoint.
import { jdFromCalendar } from '../astro/time';
export interface SkyEvent { title: string; date: string; jd: number; target: string; from?: string; view?: 'from' | 'target'; distMul?: number; dist?: number; rate?: number; note: string }
const E = (title: string, y: number, m: number, d: number, hh: number, mm: number, target: string, note: string, o: Partial<SkyEvent> = {}): SkyEvent =>
  ({ title, date: `${String(d).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`, jd: jdFromCalendar(y, m, d, hh, mm), target, note, ...o });
export const EVENTS: SkyEvent[] = [
  E('Total solar eclipse', 2026, 8, 12, 17, 46, 'earth', 'the Moon’s umbra crosses Greenland, Iceland and Spain', { from: 'moon', view: 'from', distMul: 14, rate: 120 }),
  E('Partial lunar eclipse', 2026, 8, 28, 4, 13, 'moon', '93% of the Moon dips into Earth’s umbra', { dist: 9000, rate: 120 }),
  E('BepiColombo arrives at Mercury', 2026, 11, 21, 0, 0, 'mercury', 'ESA–JAXA orbit insertion', { rate: 600 }),
  E('Annular solar eclipse', 2027, 2, 6, 16, 0, 'earth', 'a “ring of fire” over South America and Africa', { from: 'moon', view: 'from', distMul: 14, rate: 120 }),
  E('Mars at opposition', 2027, 2, 19, 15, 0, 'mars', 'Mars at its brightest in the 2027 apparition', { rate: 3600 }),
  E('Total solar eclipse — the eclipse of the century', 2027, 8, 2, 10, 7, 'earth', 'totality lasts 6 min 23 s at Luxor, Egypt', { from: 'moon', view: 'from', distMul: 14, rate: 120 }),
  E('Total lunar eclipse', 2028, 12, 31, 16, 52, 'moon', 'the Moon turns copper-red in Earth’s shadow', { dist: 9000, rate: 120 }),
  E('Apophis passes Earth', 2029, 4, 13, 21, 46, 'apophis', '32,000 km above the surface — closer than geostationary satellites', { dist: 6, rate: 60 }),
  E('Transit of Mercury', 2032, 11, 13, 8, 54, 'mercury', 'Mercury silhouetted against the Sun', { rate: 120 }),
  E('Halley’s Comet at perihelion', 2061, 7, 28, 0, 0, 'halley', 'the comet’s next return to the inner Solar System', { dist: 4e6, rate: 21600 }),
  E('3I/ATLAS at perihelion', 2025, 10, 29, 11, 35, 'atlas3i', 'the interstellar comet’s closest approach to the Sun', { dist: 3e6, rate: 21600 }),
  E('Saturn’s rings edge-on', 2025, 3, 23, 12, 0, 'saturn', 'Earth crosses Saturn’s ring plane', { rate: 3600 }),
  E('Great conjunction of Jupiter and Saturn', 2020, 12, 21, 18, 20, 'jupiter', 'the closest since 1623 — 6.1 arcminutes apart', { rate: 3600 }),
  E('New Horizons flies past Pluto', 2015, 7, 14, 11, 49, 'pluto', 'the first close look at Pluto and Charon', { rate: 600 }),
  E('Total lunar eclipse', 2026, 3, 3, 11, 33, 'moon', 'totality lasted 58 minutes', { dist: 9000, rate: 120 }),
];
