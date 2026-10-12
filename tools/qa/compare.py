#!/usr/bin/env python3
"""Visual regression check: compare a capture folder against docs/qa/golden-software (or another baseline).
Metric per view: mean absolute difference (0–255) and fraction of pixels differing by > 24. Fails (exit 1) when a view
exceeds the thresholds. Baselines are SOFTWARE-adapter captures (functional regression only); recapture them on the
target GPU for look regression.  Usage: python3 tools/qa/compare.py qa-out/golden [docs/qa/golden-software] [--mad 6] [--frac 0.03]"""
import sys, os
from PIL import Image, ImageChops
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = {sys.argv[i][2:]: float(sys.argv[i + 1]) for i in range(1, len(sys.argv) - 1) if sys.argv[i].startswith('--')}
new, base = args[0], args[1] if len(args) > 1 else 'docs/qa/golden-software'
mad_t, frac_t = opt.get('mad', 6.0), opt.get('frac', 0.03)
fail = 0
for f in sorted(os.listdir(base)):
    p = os.path.join(new, f)
    if not os.path.exists(p): print(f'{f:24s} MISSING'); fail += 1; continue
    a, b = Image.open(p).convert('L'), Image.open(os.path.join(base, f)).convert('L')
    if a.size != b.size: b = b.resize(a.size)
    d = list(ImageChops.difference(a, b).getdata()); mad = sum(d) / len(d); frac = sum(1 for x in d if x > 24) / len(d)
    ok = mad <= mad_t and frac <= frac_t; fail += not ok
    print(f'{f:24s} MAD {mad:6.2f}  >24: {frac*100:5.2f} %  {"ok" if ok else "REGRESSION"}')
sys.exit(1 if fail else 0)
