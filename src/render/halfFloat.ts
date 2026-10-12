// IEEE-754 binary16 encoder used for LUT textures built off the main thread (atmoWorker). Handles subnormals and rounds
// half-to-even; values are clamped to 65000 like lutTexture(). Kept dependency-free so the worker bundle stays small.
const _f = new Float32Array(1), _u = new Uint32Array(_f.buffer);
export function toHalf16(v: number): number {
  _f[0] = Math.min(65000, v); const x = _u[0], s = (x >>> 16) & 0x8000, ex = (x >>> 23) & 0xff, m = x & 0x7fffff;
  if (ex === 0xff) return s | 0x7c00 | (m ? 0x200 : 0);
  const e = ex - 127 + 15;
  if (e >= 31) return s | 0x7c00;
  if (e <= 0) {                                   // subnormal half (or signed zero)
    if (e < -10) return s;
    const mm = m | 0x800000, shift = 14 - e, h = mm >>> shift, rem = mm & ((1 << shift) - 1), halfway = 1 << (shift - 1);
    return s | (h + ((rem > halfway || (rem === halfway && (h & 1))) ? 1 : 0));
  }
  const h = (e << 10) | (m >>> 13), rem = m & 0x1fff;
  return s | (h + ((rem > 0x1000 || (rem === 0x1000 && (h & 1))) ? 1 : 0));
}
