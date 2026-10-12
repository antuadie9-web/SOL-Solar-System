#!/usr/bin/env python3
"""SOL v3.5 — derive the diffuse Milky Way layer from the ESA/Gaia DR2 all-sky map (reproducible).

Why: the Gaia sky map (public/assets/tex/milkyway.jpg, CC BY-SA 3.0 IGO, ESA/Gaia/DPAC) is a star-density/brightness
image in which individual bright stars are visible as dots. SOL also draws ~99k catalogue stars (Hipparcos–Tycho
directional layer) and 335,865 3D stars (GCNS + Hipparcos) as point sources, so using the map unchanged double-counts
every resolved bright star (spec v3.5 §9 "avoid visually double-counting the same stars across layers").

What: a 5×5 median filter (≈0.44° at 4096 px width) removes point-like residue while preserving the diffuse band, the
bulge and the dust lanes (which are many pixels wide), followed by a 3×3 box blur to suppress median-filter blockiness.
The result is the UNRESOLVED (diffuse) Galactic light only. It is written as milkyway_diffuse.jpg (sRGB, q=94) and a
small JSON with the luminance percentiles the runtime calibration uses.

Usage: python3 tools/ingest/sky_diffuse.py  (needs Pillow + numpy; deterministic output)
"""
import json, hashlib, os
from PIL import Image, ImageFilter
import numpy as np

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'public/assets/tex/milkyway.jpg')
DST = os.path.join(ROOT, 'public/assets/tex/milkyway_diffuse.jpg')
META = os.path.join(ROOT, 'public/assets/data/milkyway_diffuse.json')

def lin(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)

def lum(img):
    a = np.asarray(img.convert('RGB')).astype(np.float64) / 255.0
    return lin(a) @ np.array([0.2126, 0.7152, 0.0722])

src = Image.open(SRC).convert('RGB')
med = src.filter(ImageFilter.MedianFilter(size=5)).filter(ImageFilter.BoxBlur(1))
med.save(DST, quality=94, subsampling=0, optimize=True)
Y0, Y1 = lum(src), lum(med)
h = Y1.shape[0]
band = Y1[int(h * 0.47):int(h * 0.53)]
pole = np.concatenate([Y1[:int(h * 0.08)].ravel(), Y1[int(h * 0.92):].ravel()])
meta = {
    'source': 'assets/tex/milkyway.jpg (ESA/Gaia/DPAC Gaia DR2 all-sky map, CC BY-SA 3.0 IGO)',
    'method': '5x5 median filter + 3x3 box blur (point-source residue removed; diffuse light kept)',
    'size': list(src.size),
    'removedFluxFraction': float(1 - Y1.sum() / Y0.sum()),
    'bandMedianY': float(np.median(band)), 'poleMedianY': float(np.median(pole)),
    'p50Y': float(np.percentile(Y1, 50)), 'p99Y': float(np.percentile(Y1, 99)),
    'sha256': hashlib.sha256(open(DST, 'rb').read()).hexdigest(),
}
json.dump(meta, open(META, 'w'), indent=1)
print(json.dumps(meta, indent=1))
