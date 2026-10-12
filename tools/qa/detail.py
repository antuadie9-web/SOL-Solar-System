#!/usr/bin/env python3
"""SOL v3.6 — resolved-detail metric for terrain / close-range captures.
hf_energy: RMS of (luma − 2-px Gaussian blur) over the lower 55 % of the frame (ground, not sky/stars), 0–255 scale (fine structure actually on screen);
mf_energy: RMS of (2-px blur − 8-px blur) (mid-scale relief: craters, ridges, shadows).
Usage: python3 tools/qa/detail.py DIR [DIR2 ...]  → prints rows and writes DIR/detail.json"""
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter
for d in sys.argv[1:]:
    rows = []
    for f in sorted(os.listdir(d)):
        if not f.endswith('.png') or f == 'final.png': continue
        im = Image.open(os.path.join(d, f)).convert('L')
        a = np.asarray(im, dtype=np.float32)
        b2 = np.asarray(im.filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)
        b8 = np.asarray(im.filter(ImageFilter.GaussianBlur(8)), dtype=np.float32)
        h = a.shape[0]; y0 = int(h * 0.45); a, b2, b8 = a[y0:], b2[y0:], b8[y0:]
        r = dict(view=f[:-4], hf_energy=round(float(np.sqrt(((a - b2) ** 2).mean())), 3), mf_energy=round(float(np.sqrt(((b2 - b8) ** 2).mean())), 3), mean=round(float(a.mean()), 1))
        rows.append(r); print(d, r)
    json.dump(rows, open(os.path.join(d, 'detail.json'), 'w'), indent=1)
