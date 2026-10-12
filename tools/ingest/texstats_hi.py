#!/usr/bin/env python3
"""SOL v3.5 — per-map highlight statistics for highlight-protected exposure metering (EXP-002).

For every colour map in public/assets/tex (base tier, sRGB JPEG), computes in LINEAR light:
  mean   — mean luminance (same quantity as the existing texstats.json, reproduced as a cross-check)
  p99max — 99th percentile of max(R,G,B)   (what clips first under a tone curve is the brightest CHANNEL, e.g. Io's
           yellow, not luminance)
  p995max, p999max — for diagnostics
Pixels that are pure black "no data" in partial mosaics (Ariel/Titania/Oberon) are excluded via the catalogue threshold
(luminance < 0.006 → excluded) so the statistics describe the observed part only.

Output: public/assets/data/texstats_hi.json. Deterministic. Usage: python3 tools/ingest/texstats_hi.py
"""
import json, os, glob
from PIL import Image
import numpy as np

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
TEX = os.path.join(ROOT, 'public/assets/tex')
SKIP = ('_n', '_night', '_clouds', '_ocean', '_hi', 'milkyway', 'saturn_ring')
out = {}
for p in sorted(glob.glob(os.path.join(TEX, '*.jpg'))):
    name = os.path.splitext(os.path.basename(p))[0]
    if any(name.endswith(s) or name.startswith(s) for s in SKIP):
        continue
    im = Image.open(p).convert('RGB')
    if im.size[0] > 2048:
        im = im.resize((2048, im.size[1] * 2048 // im.size[0]), Image.BILINEAR)
    a = np.asarray(im).astype(np.float64) / 255.0
    l = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    Y = l @ np.array([0.2126, 0.7152, 0.0722])
    # equal-area weighting of an equirectangular map: weight rows by cos(latitude)
    h = l.shape[0]
    lat = (np.arange(h) + 0.5) / h * np.pi - np.pi / 2
    w = np.repeat(np.cos(lat)[:, None], l.shape[1], axis=1)
    valid = Y > 0.006
    mx = l.max(axis=2)
    def wpct(x, q):
        xs, ws = x[valid], w[valid]
        o = np.argsort(xs); c = np.cumsum(ws[o]); c /= c[-1]
        return float(xs[o][np.searchsorted(c, q / 100.0)])
    out[name] = {
        'mean': float((Y * w)[valid].sum() / w[valid].sum()),
        'p99max': wpct(mx, 99.0), 'p995max': wpct(mx, 99.5), 'p999max': wpct(mx, 99.9),
        'validFraction': float(w[valid].sum() / w.sum()),
    }
json.dump(out, open(os.path.join(ROOT, 'public/assets/data/texstats_hi.json'), 'w'), indent=1, sort_keys=True)
for k, v in out.items():
    print(f"{k:16s} mean {v['mean']:.3f}  p99max {v['p99max']:.3f}  ratio {v['p99max'] / max(v['mean'], 1e-4):.2f}")
