#!/usr/bin/env python3
"""SOL v3.8.1 (STAR-J01) — measure the star's centroid in rendered frames (tools/qa/scenarios/stars381.mjs output).
Centroid = intensity-weighted mean of linearised pixel values above 3× the crop's median background, in CSS pixels
(device pixels / dpr). Reports per distance: frame-to-frame step RMS and max, and peak-to-peak excursion.
Usage: star_centroids.py <dir> [<dir> ...]   → prints a table, writes <dir>/centroids.json"""
import json, os, sys, glob, re
import numpy as np
from PIL import Image
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
for d in sys.argv[1:]:
    meta = json.load(open(os.path.join(d, 'stars381.json')))
    rows = {}
    for f in meta['frames']:
        a = lin(np.asarray(Image.open(os.path.join(d, f['file'])).convert('RGB'), float) / 255) @ np.array([0.2126, 0.7152, 0.0722])
        dpr = f.get('dpr', 1); bgv = np.median(a); w = np.clip(a - 3 * bgv - 1e-4, 0, None)
        # restrict to the brightest connected region around the maximum (ignore unrelated stars)
        # search only near the aim point (crop centre): UI panels or unrelated stars elsewhere in the crop are ignored
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]; cc = a.shape[0] / 2
        near = (yy - cc) ** 2 + (xx - cc) ** 2 < (40 * dpr) ** 2
        y0, x0 = np.unravel_index(np.where(near, a, -1).argmax(), a.shape)
        w = w * ((yy - y0) ** 2 + (xx - x0) ** 2 < (12 * dpr) ** 2)
        cx, cy = (w * xx).sum() / w.sum() / dpr, (w * yy).sum() / w.sum() / dpr
        rows.setdefault(f['D'], []).append((cx, cy))
    out = {}
    for D, pts in rows.items():
        p = np.array(pts); st = np.hypot(*np.diff(p, axis=0).T)
        off = np.hypot(*(p - 120).T)
        out[str(D)] = {'frames': len(p), 'offsetFromAimPx_mean': round(float(off.mean()), 3), 'offsetFromAimPx_max': round(float(off.max()), 3), 'stepRmsPx': round(float(np.sqrt((st ** 2).mean())), 3), 'stepMaxPx': round(float(st.max()), 3),
                       'peakToPeakPx': round(float(np.hypot(*(p.max(0) - p.min(0)))), 3), 'meanOffsetFromCentrePx': [round(float(x), 2) for x in p.mean(0) - 120]}
    json.dump(out, open(os.path.join(d, 'centroids.json'), 'w'), indent=1)
    print(d, json.dumps(out))
