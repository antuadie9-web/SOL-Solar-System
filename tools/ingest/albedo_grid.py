#!/usr/bin/env python3
"""SOL v3.8.1 CONT-14f — coarse geometry-weighting grids of every surface colour map.

For each base-tier colour map (sRGB JPEG, same set as texstats_hi.py) computes the LINEAR Rec.709 luminance averaged over
GW×GH equal-angle cells (exact area-weighted mean of all source texels in a cell, rows weighted by cos latitude), divided
by the map's area-weighted mean luminance (the quantity the albedo calibration uses, texstats.json). A cell value of 1
means "map mean". Unobserved mosaic regions (catalogue noData bodies, luminance < threshold) take the value the renderer
draws there: the reconstruction at the observed-part mean → 1.0 relative to the observed mean.

Convention = shader equirect(): u = lon/2π + 0.5 (lon = atan2(y, x) body-fixed), v = lat/π + 0.5, texture flipY → row 0
of the grid is the NORTH edge (+90°). Derived quantity (no fit). Output public/assets/data/albedo_grid.json:
{ "w": GW, "h": GH, "convention": ..., "maps": { name: [GW*GH numbers rounded to 1e-4, row-major north→south] } }
Usage: python3 tools/ingest/albedo_grid.py
"""
import json, os, glob, re
from PIL import Image
import numpy as np
Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
TEX = os.path.join(ROOT, 'public/assets/tex')
GW, GH = 64, 32
SKIP = ('_n', '_night', '_clouds', '_ocean', '_hi', '_recon', '_reconw', '_mask', 'milkyway', 'saturn_ring', 'intro_sun')
cat = open(os.path.join(ROOT, 'src/data/catalog.ts')).read()
nodata = {}
for line in cat.splitlines():
    m = re.search(r"tex: '([a-z_]+)'", line); t = re.search(r"noData: \{[^}]*threshold: ([0-9.]+)", line)
    if m and t: nodata[m.group(1)] = float(t.group(1))
out = {}
for p in sorted(glob.glob(os.path.join(TEX, '*.jpg'))):
    name = os.path.splitext(os.path.basename(p))[0]
    if any(name.endswith(s) or name.startswith(s) for s in SKIP): continue
    im = Image.open(p).convert('RGB')
    W0 = GW * max(1, min(2048, im.size[0]) // GW); im = im.resize((W0, W0 // 2), Image.BOX)
    a = np.asarray(im).astype(np.float64) / 255.0
    Y = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4) @ np.array([0.2126, 0.7152, 0.0722])
    h, w = Y.shape
    lat = np.pi / 2 - (np.arange(h) + 0.5) / h * np.pi           # row 0 = north
    wt = np.repeat(np.cos(lat)[:, None], w, axis=1)
    valid = Y > nodata[name] if name in nodata else np.ones_like(Y, bool)
    mean = (Y * wt)[valid].sum() / wt[valid].sum()
    Yf = np.where(valid, Y, mean)
    sy, sx = h // GH, w // GW
    num = (Yf * wt).reshape(GH, sy, GW, sx).sum(axis=(1, 3)); den = wt.reshape(GH, sy, GW, sx).sum(axis=(1, 3))
    g = num / den / mean
    out[name] = [round(float(x), 4) for x in g.ravel()]
json.dump({'w': GW, 'h': GH, 'convention': 'shader equirect: u=lon/2pi+0.5 (lon=atan2(y,x) body-fixed), row0=north; value = cell mean linear Y709 / map mean (texstats); noData cells = 1', 'maps': out},
          open(os.path.join(ROOT, 'public/assets/data/albedo_grid.json'), 'w'), separators=(',', ':'), sort_keys=True)
print(len(out), 'maps', os.path.getsize(os.path.join(ROOT, 'public/assets/data/albedo_grid.json')), 'bytes')
