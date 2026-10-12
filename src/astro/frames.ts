// Reference frames. Internal world frame: ecliptic & equinox J2000 (x → ♈, z → north ecliptic pole), km.
import { EPS0, DEG } from './constants';
import { V3, M3, rotX, mulMV, mulMM, rotZ, fromCols, norm, cross } from './vec';
export const EQ2ECL: M3 = rotX(-EPS0);    // ICRF/J2000 equatorial → ecliptic
export const ECL2EQ: M3 = rotX(EPS0);
export const eqToEcl = (v: V3): V3 => mulMV(EQ2ECL, v);
export const radecToVec = (raDeg: number, decDeg: number): V3 => {
  const a = raDeg * DEG, d = decDeg * DEG, c = Math.cos(d);
  return [c * Math.cos(a), c * Math.sin(a), Math.sin(d)];
};
// ICRS → Galactic (Hipparcos definition, IAU 1958 re-expressed for ICRS)
export const EQ2GAL: M3 = [
  -0.0548755604162154, -0.8734370902348850, -0.4838350155487132,
  0.4941094278755837, -0.4448296299600112, 0.7469822444972189,
  -0.8676661490190047, -0.1980763734312015, 0.4559837761750669,
];
// Basis whose z axis is the pole (α, δ) and x axis is that plane's ascending node on the ICRF equator (IAU convention).
export function poleFrameEq(raDeg: number, decDeg: number): M3 {
  const a = raDeg * DEG, d = decDeg * DEG;
  // R = Rz(α + 90°) · Rx(90° − δ)
  return mulMM(rotZ(a + Math.PI / 2), rotX(Math.PI / 2 - d));
}
// world(ecliptic) → three.js scene axes (y up = ecliptic north): (x, y, z)_scene = (X, Z, −Y)
export const toScene = (v: V3, o: { x: number; y: number; z: number }) => { o.x = v[0]; o.y = v[2]; o.z = -v[1]; return o; };
export const SCENE_FROM_ECL: M3 = [1, 0, 0, 0, 0, 1, 0, -1, 0];
export function basisFromPoleNode(pole: V3, ref: V3): M3 {
  const z = norm(pole), x = norm(cross(ref, z)), y = cross(z, x);
  return fromCols(x, y, z);
}
