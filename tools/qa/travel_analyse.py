#!/usr/bin/env python3
"""SOL v3.8.1 CONT-381 continuity analysis of continuity_travel.mjs output.
Sun sequences: per imaged step, linear-light glare energy G outside 2× disc radius and the centre-region light C (within 2×
disc radius, ≥ 3 px), plus EV / halo from the per-step log. Flags any step-to-step increase of displayed total (C + G) while
the Sun recedes, and the largest single-step log ratio (popping).
usage: travel_analyse.py <dir> [seq ...]"""
import json, math, os, sys
import numpy as np
from PIL import Image
d = sys.argv[1]; seqs = sys.argv[2:] or [s[:-5] for s in sorted(os.listdir(d)) if s.endswith('.json') and s.startswith('sun')]
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
report = {}
for seq in seqs:
    rows = json.load(open(os.path.join(d, seq + '.json')))
    out = []
    for r in rows:
        f = os.path.join(d, seq, f"{r['i']:03d}.png")
        if not os.path.exists(f): continue
        a = lin(np.asarray(Image.open(f).convert('RGB'), float) / 255) @ np.array([0.2126, 0.7152, 0.0722])
        H, W = a.shape; yy, xx = np.mgrid[0:H, 0:W]; rr = np.hypot(yy - H / 2, xx - W / 2)
        rpx = (r.get('sunGlare') or {}).get('rpx') or 0
        # sky reference = MEAN per-pixel light (stars and Milky Way included) in the 0.40–0.48 H annulus, subtracted per pixel:
        # v1 used the median, so the star field (constant with distance) read as a ~2k glare plateau
        rc = max(2 * rpx, 3); bg = float(a[(rr > 0.40 * H) & (rr < 0.48 * H)].mean())
        C = float((a[rr <= rc] - bg).sum()); G = float((a[(rr > rc) & (rr < 0.30 * H)] - bg).sum())
        out.append({'i': r['i'], 'au': round(r['au'], 3), 'rpx': rpx, 'ev': r['ev'], 'halo': (r.get('sunGlare') or {}).get('halo'), 'C': round(C, 1), 'G': round(G, 1), 'T': round(C + G, 1)})
    ups = [(o['au'], round(o['T'] / p['T'], 2)) for p, o in zip(out, out[1:]) if o['T'] > p['T'] * 1.05 and p['T'] > 20]
    jump = max((abs(math.log(o['T'] / p['T'])), o['au']) for p, o in zip(out, out[1:]) if p['T'] > 20 and o['T'] > 20)
    report[seq] = {'rows': out, 'increases_gt5pct': ups, 'max_step_logratio': round(jump[0], 3), 'at_au': jump[1]}
    print(seq, 'increases>5%:', ups, ' max |Δln T| per imaged step:', round(jump[0], 3), 'at', jump[1], 'AU')
    for o in out: print('  ', o)
json.dump(report, open(os.path.join(d, 'continuity-report.json'), 'w'), indent=1)
