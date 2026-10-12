// Major planets: VSOP87B (Bretagnon & Francou 1988) heliocentric ecliptic J2000 — arc-second accuracy over millennia.
import { planetposition } from 'astronomia';
import mercury from 'astronomia/data/vsop87Bmercury';
import venus from 'astronomia/data/vsop87Bvenus';
import earth from 'astronomia/data/vsop87Bearth';
import mars from 'astronomia/data/vsop87Bmars';
import jupiter from 'astronomia/data/vsop87Bjupiter';
import saturn from 'astronomia/data/vsop87Bsaturn';
import uranus from 'astronomia/data/vsop87Buranus';
import neptune from 'astronomia/data/vsop87Bneptune';
import { AU } from './constants';
import { V3 } from './vec';
const data: Record<string, any> = { mercury, venus, earth, mars, jupiter, saturn, uranus, neptune };
const P: Record<string, any> = {};
for (const k in data) P[k] = new planetposition.Planet(data[k]);
// Standish (JPL) mean elements, Table 2a — used only for drawing smooth reference orbits & displaying elements.
export const MEAN_ELEMENTS: Record<string, number[]> = {
  // a, e, I, L, ϖ, Ω  and rates per century
  mercury: [0.38709843, 0.20563661, 7.00559432, 252.25166724, 77.45771895, 48.33961819, 0, 0.00002123, -0.00590158, 149472.67486623, 0.15940013, -0.12214182],
  venus: [0.72332102, 0.00676399, 3.39777545, 181.97970850, 131.76755713, 76.67261496, -0.00000026, -0.00005107, 0.00043494, 58517.81560260, 0.05679648, -0.27274174],
  earth: [1.00000018, 0.01673163, -0.00054346, 100.46691572, 102.93005885, -5.11260389, -0.00000003, -0.00003661, -0.01337178, 35999.37306329, 0.31795260, -0.24123856],
  mars: [1.52371243, 0.09336511, 1.85181869, -4.56813164, -23.91744784, 49.71320984, 0.00000097, 0.00009149, -0.00724757, 19140.29934243, 0.45223625, -0.26852431],
  jupiter: [5.20248019, 0.04853590, 1.29861416, 34.33479152, 14.27495244, 100.29282654, -0.00002864, 0.00018026, -0.00322699, 3034.90371757, 0.18199196, 0.13024619],
  saturn: [9.54149883, 0.05550825, 2.49424102, 50.07571329, 92.86136063, 113.63998702, -0.00003065, -0.00032044, 0.00451969, 1222.11494724, 0.54179478, -0.25015002],
  uranus: [19.18797948, 0.04685740, 0.77298127, 314.20276625, 172.43404441, 73.96250215, -0.00020455, -0.00001550, -0.00180155, 428.49512595, 0.09266985, 0.05739699],
  neptune: [30.06952752, 0.00895439, 1.77005520, 304.22289287, 46.68158724, 131.78635853, 0.00006447, 0.00000818, 0.00022400, 218.46515314, 0.01009938, -0.00606302],
};
export function planetHelio(id: string, jdTT: number): V3 {
  const p = P[id].position2000(jdTT); // { lon, lat, range } (rad, AU)
  const L = p.lon, B = p.lat, r = p.range * AU, cB = Math.cos(B);
  return [r * cB * Math.cos(L), r * cB * Math.sin(L), r * Math.sin(B)];
}
export function meanElements(id: string, jdTT: number) {
  const m = MEAN_ELEMENTS[id], T = (jdTT - 2451545) / 36525;
  const a = m[0] + m[6] * T, e = m[1] + m[7] * T, I = m[2] + m[8] * T, L = m[3] + m[9] * T, w = m[4] + m[10] * T, O = m[5] + m[11] * T;
  return { a, e, i: I, node: O, peri: w - O, M: L - w, L, varpi: w };
}
