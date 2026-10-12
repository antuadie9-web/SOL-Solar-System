#!/usr/bin/env python3
"""SOL v3.5 — measured visual QA metrics for golden captures (spec v3.5 §29 "measured reference scenes").

Per capture (PNG, sRGB 8-bit):
  disc_px      pixels belonging to resolved bodies (display luminance above a background threshold, connected to the
               brightest region by a coarse flood test is NOT attempted — simple threshold on a 5x5-smoothed image)
  clip_pct     % of disc pixels with any channel >= 250  (EXP-002 clipping metric; v3.4 audit used "near-clipped")
  disc_p50     median luma of disc pixels
  bg_mean      mean luma (0-255) of non-disc pixels — the sky (Milky Way + stars) visibility
  stars        count of isolated local maxima in the background brighter than bg+18 (point-source visibility)
  dark_detail  for discs: std-dev of luma in the darkest 30 % of disc pixels (> ~2 means night-side structure is visible)
  sun_spots    (sun views only) fraction of disc pixels darker than 0.80 x the local radial limb-darkening profile —
               AUD-07 evidence check: a capture can only be described as showing sunspots when this is > 0.0005
Usage: python3 tools/qa/metrics.py DIR [DIR2 ...]  → prints a table and writes DIR/metrics.json
"""
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter

def analyse(path, name):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    luma = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    sm = np.asarray(im.convert('L').filter(ImageFilter.BoxBlur(2))).astype(np.float32)
    disc = sm > 22
    out = {'view': name, 'disc_px': int(disc.sum())}
    if disc.sum() > 50:
        dl = luma[disc]
        out['clip_pct'] = round(float((a[disc].max(axis=1) >= 250).mean() * 100), 3)
        out['disc_p50'] = round(float(np.median(dl)), 1)
        lo = np.sort(dl)[: max(10, int(len(dl) * 0.3))]
        out['dark_detail'] = round(float(lo.std()), 2)
    else:
        out.update(clip_pct=0.0, disc_p50=0.0, dark_detail=0.0)
    bg = ~np.asarray(Image.fromarray(disc.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))).astype(bool)
    out['bg_mean'] = round(float(luma[bg].mean()) if bg.any() else 0.0, 2)
    # stars: local maxima in a 3x3 window, brighter than local background + 18
    L = luma
    pad = np.pad(L, 1, mode='edge')
    neigh = np.max(np.stack([pad[1 + dy:1 + dy + L.shape[0], 1 + dx:1 + dx + L.shape[1]] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]), axis=0)
    base = np.asarray(Image.fromarray(np.clip(L, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(7))).astype(np.float32)
    peaks = (L > neigh) & (L > base + 18) & bg
    out['stars'] = int(peaks.sum())
    if name.startswith('sun') and 'eclipse' not in name and disc.sum() > 2000:
        ys, xs = np.nonzero(sm > 0.5 * sm.max())
        cy, cx = ys.mean(), xs.mean(); R = max(1.0, np.sqrt(len(ys) / np.pi))
        yy, xx = np.indices(L.shape); r = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2) / R
        inside = r < 0.92
        if inside.sum() > 500:
            bins = np.clip((r[inside] * 40).astype(int), 0, 39)
            prof = np.array([np.median(L[inside][bins == k]) if (bins == k).any() else 0 for k in range(40)])
            exp = prof[bins]
            out['sun_spots'] = round(float((L[inside] < 0.80 * exp).mean()), 5)
            out['sun_disc_R_px'] = round(float(R), 1)
    return out

for d in sys.argv[1:]:
    rows = []
    for f in sorted(os.listdir(d)):
        if f.endswith('.png') and f != 'final.png':
            rows.append(analyse(os.path.join(d, f), f[:-4]))
    json.dump(rows, open(os.path.join(d, 'metrics.json'), 'w'), indent=1)
    print(f'\n{d}')
    print(f"{'view':24s} {'clip%':>7s} {'p50':>6s} {'dark σ':>7s} {'sky':>6s} {'stars':>6s} {'spots':>8s}")
    for r in rows:
        print(f"{r['view']:24s} {r['clip_pct']:7.3f} {r['disc_p50']:6.1f} {r['dark_detail']:7.2f} {r['bg_mean']:6.2f} {r['stars']:6d} {str(r.get('sun_spots', '')):>8s}")
