// IAU WGCCRE 2015 (Archinal et al. 2018) rotation models → body-fixed → ecliptic J2000 rotation matrix.
import { DEG, J2000 } from './constants';
import { M3, mulMM, rotZ, rotY, transpose } from './vec';
import { poleFrameEq, EQ2ECL } from './frames';
export interface RotModel { (d: number, T: number): [number, number, number] } // α0, δ0, W (deg)
const s = (x: number) => Math.sin(x * DEG), c = (x: number) => Math.cos(x * DEG);
const lin = (a0: number, aT: number, d0: number, dT: number, w0: number, wd: number): RotModel => (d, T) => [a0 + aT * T, d0 + dT * T, w0 + wd * d];
export const ROT: Record<string, RotModel> = {
  sun: lin(286.13, 0, 63.87, 0, 84.176, 14.1844),
  mercury: lin(281.0103, -0.0328, 61.4155, -0.0049, 329.5988, 6.1385108),
  venus: lin(272.76, 0, 67.16, 0, 160.20, -1.4813688),
  earth: lin(0, -0.641, 90, -0.557, 190.147, 360.9856235),   // d is UT1-based for Earth (see bodyRotation)
  moon: (d, T) => {
    const E = [0, 125.045 - 0.0529921 * d, 250.089 - 0.1059842 * d, 260.008 + 13.0120009 * d, 176.625 + 13.3407154 * d, 357.529 + 0.9856003 * d,
      311.589 + 26.4057084 * d, 134.963 + 13.0649930 * d, 276.617 + 0.3287146 * d, 34.226 + 1.7484877 * d, 15.134 - 0.1589763 * d,
      119.743 + 0.0036096 * d, 239.961 + 0.1643573 * d, 25.053 + 12.9590088 * d];
    const a = 269.9949 + 0.0031 * T - 3.8787 * s(E[1]) - 0.1204 * s(E[2]) + 0.0700 * s(E[3]) - 0.0172 * s(E[4]) + 0.0072 * s(E[6]) - 0.0052 * s(E[10]) + 0.0043 * s(E[13]);
    const de = 66.5392 + 0.0130 * T + 1.5419 * c(E[1]) + 0.0239 * c(E[2]) - 0.0278 * c(E[3]) + 0.0068 * c(E[4]) - 0.0029 * c(E[6]) + 0.0009 * c(E[7]) + 0.0008 * c(E[10]) - 0.0009 * c(E[13]);
    const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.5610 * s(E[1]) + 0.1208 * s(E[2]) - 0.0642 * s(E[3]) + 0.0158 * s(E[4]) + 0.0252 * s(E[5]) - 0.0066 * s(E[6])
      - 0.0047 * s(E[7]) - 0.0046 * s(E[8]) + 0.0028 * s(E[9]) + 0.0052 * s(E[10]) + 0.0040 * s(E[11]) + 0.0019 * s(E[12]) - 0.0044 * s(E[13]);
    return [a, de, W];
  },
  mars: lin(317.269202, -0.10927547, 54.432516, -0.05827105, 176.049863, 350.891982443297),
  jupiter: lin(268.056595, -0.006499, 64.495303, 0.002413, 284.95, 870.5360000),
  // Saturn: IAU pole; rotation 10 h 33 min 38 s from ring seismology (Mankovich et al. 2019) instead of Voyager System III
  saturn: lin(40.589, -0.036, 83.537, -0.004, 38.90, 818.1306),
  // v3.8: Phoebe (IAU WGCCRE 2015, Archinal et al. 2018) — v3.7 drew it synchronous although it spins in 9.27 h
  phoebe: lin(356.90, 0, 77.80, 0, 178.58, 931.639),
  uranus: lin(257.311, 0, -15.175, 0, 203.81, -501.1600928),
  neptune: (d, T) => { const N = 357.85 + 52.316 * T; return [299.36 + 0.70 * s(N), 43.46 - 0.51 * c(N), 249.978 + 541.1397757 * d - 0.48 * s(N)]; },
  pluto: lin(132.993, 0, -6.163, 0, 302.695, 56.3625225),
  charon: lin(132.993, 0, -6.163, 0, 122.695, 56.3625225),
  ceres: lin(291.418, 0, 66.764, 0, 170.650, 952.1532),
  vesta: lin(309.031, 0, 42.235, 0, 285.39, 1617.3329428),
  phobos: lin(317.67071657, -0.10844326, 52.88627266, -0.06134706, 35.18774440, 1128.84475928),
  deimos: lin(316.65705808, -0.10518014, 53.50992033, -0.05979094, 79.39932954, 285.16188899),
  io: lin(268.05, -0.009, 64.50, 0.003, 200.39, 203.4889538),
  europa: lin(268.08, -0.009, 64.51, 0.003, 36.022, 101.3747235),
  ganymede: lin(268.20, -0.009, 64.57, 0.003, 44.064, 50.3176081),
  callisto: lin(268.72, -0.009, 64.83, 0.003, 259.51, 21.5710715),
  mimas: lin(40.66, -0.036, 83.52, -0.004, 333.46, 381.9945550),
  enceladus: lin(40.66, -0.036, 83.52, -0.004, 6.32, 262.7318996),
  tethys: lin(40.66, -0.036, 83.52, -0.004, 8.95, 190.6979085),
  dione: lin(40.66, -0.036, 83.52, -0.004, 357.6, 131.5349316),
  rhea: lin(40.38, -0.036, 83.55, -0.004, 235.16, 79.6900478),
  titan: lin(39.4827, 0, 83.4279, 0, 186.5855, 22.5769768),
  iapetus: lin(318.16, -3.949, 75.03, -1.143, 355.2, 4.5379572),
  miranda: lin(257.43, 0, -15.08, 0, 30.70, -254.6906892),
  ariel: lin(257.43, 0, -15.10, 0, 156.22, -142.8356681),
  umbriel: lin(257.43, 0, -15.10, 0, 108.05, -86.8688923),
  titania: lin(257.43, 0, -15.10, 0, 77.74, -41.3514316),
  oberon: lin(257.43, 0, -15.10, 0, 6.77, -26.7394932),
  triton: (d, T) => {
    const N = 177.85 + 52.316 * T;
    const a = 299.36 - 32.35 * s(N) - 6.28 * s(2 * N) - 2.08 * s(3 * N) - 0.74 * s(4 * N) - 0.28 * s(5 * N) - 0.11 * s(6 * N) - 0.07 * s(7 * N) - 0.02 * s(8 * N) - 0.01 * s(9 * N);
    const de = 41.17 + 22.55 * c(N) + 2.10 * c(2 * N) + 0.55 * c(3 * N) + 0.16 * c(4 * N) + 0.05 * c(5 * N) + 0.02 * c(6 * N) + 0.01 * c(7 * N);
    const W = 296.53 - 61.2572637 * d + 22.25 * s(N) + 6.73 * s(2 * N) + 2.05 * s(3 * N) + 0.74 * s(4 * N) + 0.28 * s(5 * N) + 0.11 * s(6 * N) + 0.05 * s(7 * N) + 0.02 * s(8 * N) + 0.01 * s(9 * N);
    return [a, de, W];
  },
};
// Matrix taking body-fixed vectors to ecliptic J2000.
// Earth: IAU 1976 precession × GMST (IAU 1982) — the terrestrial frame placed exactly in J2000 coordinates.
export function earthRotation(jdTT: number, jdUT: number): M3 {
  const T = (jdTT - J2000) / 36525, as = DEG / 3600;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * as;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * as;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * as;
  const P = mulMM(rotZ(z), mulMM(rotY(-th), rotZ(zeta)));     // J2000 → mean of date (column-vector convention)
  const Tu = (jdUT - J2000) / 36525;
  const gmst = ((280.46061837 + 360.98564736629 * (jdUT - J2000) + 0.000387933 * Tu * Tu - Tu * Tu * Tu / 38710000) % 360) * DEG;
  // terrestrial → mean-of-date: Rz(gmst); mean-of-date → J2000: Pᵀ
  return mulMM(EQ2ECL, mulMM(transpose(P), rotZ(gmst)));
}
export function rotationMatrix(model: RotModel, jdTT: number, jdUT?: number): M3 {
  const d = (jdUT ?? jdTT) - J2000, T = (jdTT - J2000) / 36525;
  const [a, de, W] = model(d, T);
  return mulMM(EQ2ECL, mulMM(poleFrameEq(a, de), rotZ((W % 360) * DEG)));
}
// Generic model from pole + period (hours, negative = retrograde)
export function simpleRot(raDeg: number, decDeg: number, periodH: number, W0 = 0): RotModel {
  const wd = 360 * 24 / periodH;
  return (d: number) => [raDeg, decDeg, W0 + wd * d];
}
