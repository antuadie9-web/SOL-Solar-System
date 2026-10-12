import { test } from 'node:test';
import { RING_SYSTEMS } from '../../src/data/rings';
import { ringTau, buildProfileLOD } from '../../src/render/ringSystem';
test('encke', () => {
  const S: any = RING_SYSTEMS.saturn; console.log('profile', S.profile && { r0: S.profile.r0, n: S.profile.n, dr: S.profile.dr });
  let prof: any = null; try { prof = (S as any).__prof; } catch {}
  for (const r of [133300, 133450, 133584, 133700, 133800, 136505, 137000]) for (const fw of [0.01, 1, 20, 200]) console.log(r, fw, ringTau(S, r, fw, prof).map(x => x.toFixed(3)).join(' '));
});
