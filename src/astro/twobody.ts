// Universal-variable two-body propagation (Battin / Vallado "KEPLER" algorithm). Valid for every conic
// (elliptic, parabolic, hyperbolic). Units: km, s, km³/s². Pure float64; no allocation-free guarantees.
import { V3 } from './vec';

function stumpff(z: number): [number, number] {
  if (z > 1e-8) { const s = Math.sqrt(z); return [(1 - Math.cos(s)) / z, (s - Math.sin(s)) / (s * z)]; }
  if (z < -1e-8) { const s = Math.sqrt(-z); return [(Math.cosh(s) - 1) / -z, (Math.sinh(s) - s) / (s * -z)]; }
  return [0.5 - z / 24 + z * z / 720, 1 / 6 - z / 120 + z * z / 5040];
}
/** Propagate state (r0, v0) by dt seconds under gravitational parameter mu. Returns [r, v]. */
export function propagate(r0: V3, v0: V3, mu: number, dt: number): [V3, V3] {
  if (dt === 0) return [[...r0] as V3, [...v0] as V3];
  const r0n = Math.hypot(r0[0], r0[1], r0[2]), v02 = v0[0] * v0[0] + v0[1] * v0[1] + v0[2] * v0[2];
  const rv = r0[0] * v0[0] + r0[1] * v0[1] + r0[2] * v0[2], sqmu = Math.sqrt(mu);
  const alpha = 2 / r0n - v02 / mu; // 1/a
  let x = Math.abs(alpha) > 1e-12 ? sqmu * dt * alpha : sqmu * dt / r0n;
  if (alpha < -1e-12) { // hyperbolic initial guess
    const a = 1 / alpha, s = Math.sign(dt);
    x = s * Math.sqrt(-a) * Math.log((-2 * mu * alpha * dt) / (rv + s * Math.sqrt(-mu * a) * (1 - r0n * alpha)));
    if (!Number.isFinite(x)) x = sqmu * dt / r0n;
  }
  let c2 = 0, c3 = 0, r = r0n, z = 0;
  for (let k = 0; k < 100; k++) {
    z = x * x * alpha; [c2, c3] = stumpff(z);
    r = x * x * c2 + rv / sqmu * x * (1 - z * c3) + r0n * (1 - z * c2);
    const F = x * x * x * c3 + rv / sqmu * x * x * c2 + r0n * x * (1 - z * c3) - sqmu * dt;
    const dx = F / r; x -= dx;
    if (Math.abs(dx) < 1e-12 * Math.max(1, Math.abs(x))) break;
  }
  z = x * x * alpha; [c2, c3] = stumpff(z);
  r = x * x * c2 + rv / sqmu * x * (1 - z * c3) + r0n * (1 - z * c2);
  const f = 1 - x * x / r0n * c2, g = dt - x * x * x / sqmu * c3;
  const gd = 1 - x * x / r * c2, fd = sqmu / (r * r0n) * x * (z * c3 - 1);
  return [
    [f * r0[0] + g * v0[0], f * r0[1] + g * v0[1], f * r0[2] + g * v0[2]],
    [fd * r0[0] + gd * v0[0], fd * r0[1] + gd * v0[1], fd * r0[2] + gd * v0[2]],
  ];
}
