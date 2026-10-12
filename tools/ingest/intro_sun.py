#!/usr/bin/env python3
"""SOL v3.8.1 (UX-381-02, REV2-06) — observed solar disc for the intro anchor.
Source: NASA SDO/HMI Quick-Look Continuum (617.3 nm), 2026-09-21 15:11:15 TAI, 1024×1024
(https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMII.jpg; NASA/SDO data — public domain, courtesy NASA/SDO and the
HMI science team). OBSERVED sunspots/faculae of that date; quick-look product (not science-calibrated).
Processing: remove the caption, fit the disc (threshold), convert the 617-nm limb profile to SOL's white-light per-channel
limb darkening (same quadratic coefficients as sun.ts) by multiplying each channel by I_c(μ)/I_617(μ), neutral-warm grade
[1, 0.965, 0.915] (SUN-381-05), sRGB, 1024² → public/assets/tex/intro_sun_hmi.jpg (q90).
usage: intro_sun.py <hmi jpg>"""
import sys, os, json, hashlib
import numpy as np
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
src = sys.argv[1]
g = np.asarray(Image.open(src).convert('L'), float) / 255.0
g[990:, :] = 0                                         # caption strip
m = g > 0.08; ys, xs = np.nonzero(m); cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2; R = ((ys.max() - ys.min()) + (xs.max() - xs.min())) / 4
yy, xx = np.mgrid[0:g.shape[0], 0:g.shape[1]]; r = np.hypot(yy - cy, xx - cx) / R
mu = np.sqrt(np.clip(1 - r * r, 0, 1)); om, om2 = 1 - mu, 1 - mu * mu
LD = lambda a, b: np.clip(1 - a * om - b * om2, 0.05, None)
i617 = LD(0.50, 0.19)                                  # ≈617 nm (interpolated between SOL's 650/550 coefficients)
# the quick-look JPEG is linearly scaled: read as linear, its centre-to-limb profile (0.39 at r = 0.95) matches the 617-nm
# limb darkening (≈0.45–0.55); read as sRGB it would give 0.15 (far too dark)
lin = g.copy()
centre = np.median(lin[r < 0.2])
out = np.zeros(g.shape + (3,))
for k, (a, b) in enumerate([(0.48, 0.18), (0.58, 0.20), (0.70, 0.20)]):
    out[..., k] = lin / centre * LD(a, b) / i617 * [1.0, 0.965, 0.915][k] * 0.72   # exposed so the centre sits at ≈0.86 display (sRGB), leaving tonal room for limb darkening and faculae
edge = np.clip((1.0 - r) / 0.004, 0, 1); out *= edge[..., None]
enc = np.where(out <= 0.0031308, out * 12.92, 1.055 * np.power(np.clip(out, 0, None), 1 / 2.4) - 0.055)
dst = os.path.join(ROOT, 'public/assets/tex/intro_sun_hmi.jpg')
Image.fromarray((np.clip(enc, 0, 1) * 255 + 0.5).astype(np.uint8)).save(dst, quality=90, optimize=True)
meta = {'source': 'NASA SDO/HMI Quick-Look Continuum 617.3 nm', 'observed': '2026-09-21T15:11:15 TAI', 'url': 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMII.jpg',
        'sha256': hashlib.sha256(open(src, 'rb').read()).hexdigest(), 'disc': {'cx': cx, 'cy': cy, 'R': R}, 'bytes': os.path.getsize(dst)}
json.dump(meta, open(os.path.join(ROOT, 'docs/assets/provenance/intro-sun-hmi.json'), 'w'), indent=1); print(meta)
