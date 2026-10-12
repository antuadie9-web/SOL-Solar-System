#!/usr/bin/env python3
"""SOL v3.8.1 (AST-381-03, owner review REV2-02) — reconstruction guide fields for partial mosaics.

Problem: on Ariel/Titania/Oberon (and the same shared shader path on Triton, Pluto, Charon) the labelled reconstruction of
the unobserved region met the observed map at a hard edge with a different mean albedo, a different texture frequency and
a different contrast, which made the boundary the most conspicuous feature of the body.

This tool writes public/assets/tex/<body>_recon.jpg (1024×512, equirectangular, same registration as the colour map):
  R = reconstruction weight w ∈ [0, 1]: 0 on every observed pixel (observed data are never altered), rising smoothly
      from the boundary to 1 over FEATHER_DEG inside the unobserved region (distance transform on the sphere-ish grid).
  G = low-frequency albedo guide (sRGB-encoded linear luminance relative to the map): normalised convolution of the
      observed luminance with a Gaussian of SIGMA_DEG (longitude wraps), i.e. the observed regional albedo carried
      smoothly into the unobserved region; relaxed toward the body's observed mean with distance (RELAX_DEG), so nothing
      beyond regional continuity is extrapolated.
  B = 0.
Statistics (observed small-scale relative contrast, used to match the procedural detail amplitude) go to
docs/assets/provenance/partial-recon-v381.json. No observational data are fabricated: w = 0 wherever the source has data.
usage: python3 tools/ingest/partial_recon.py
"""
import json, os
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
W, H = 1024, 512
FEATHER_DEG, SIGMA_DEG, RELAX_DEG = 5.0, 3.5, 35.0   # REV2-02 iteration 2: finer regional guide (6° → 3.5°), wider feather
BODIES = {'ariel': 0.0018 * 0 + 1.5 / 255, 'titania': 1.5 / 255, 'oberon': 1.5 / 255, 'triton': 3 / 255, 'pluto': 3 / 255, 'charon': 3 / 255}
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
enc = lambda a: np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.clip(a, 0, None), 1 / 2.4) - 0.055)
def gauss_wrap(a, sig_px):  # Gaussian blur, wrapping in longitude, reflecting at the poles
    return ndimage.gaussian_filter(a, sigma=sig_px, mode=('reflect', 'wrap'))
stats = {}
for name, thr in BODIES.items():
    src = os.path.join(ROOT, f'public/assets/tex/{name}.jpg')
    im = np.asarray(Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS), float) / 255.0
    Y = lin(im) @ np.array([0.2126, 0.7152, 0.0722])
    obs = ndimage.binary_erosion(Y > lin(np.array(thr)) * 1.0 + 1e-4, iterations=1)
    # distance (deg) from the observed region, longitude-wrap handled by tiling
    tiled = np.concatenate([~obs, ~obs, ~obs], axis=1)
    d = ndimage.distance_transform_edt(tiled)[:, W:2 * W] * (180.0 / H)
    lat = (0.5 - (np.arange(H) + 0.5) / H) * np.pi
    w = np.clip(d / FEATHER_DEG, 0, 1); w = w * w * (3 - 2 * w); w[obs] = 0
    # low-frequency guide by normalised convolution
    sig = SIGMA_DEG * H / 180.0
    num = gauss_wrap(np.where(obs, Y, 0.0), sig); den = gauss_wrap(obs.astype(float), sig)
    ext = np.where(den > 1e-3, num / np.maximum(den, 1e-6), np.nan)
    gmean = float(Y[obs].mean())
    # far from data (or where even the wide kernel saw nothing) relax toward the observed global mean
    relax = np.clip(d / RELAX_DEG, 0, 1); ext = np.where(np.isnan(ext), gmean, ext); guide = ext * (1 - relax) + gmean * relax
    guide[obs] = gauss_wrap(np.where(obs, Y, 0.0), sig / 3)[obs] / np.maximum(gauss_wrap(obs.astype(float), sig / 3)[obs], 1e-6)
    # observed small-scale relative contrast (high-pass std / local mean), the target amplitude for reconstruction detail
    hp = Y - gauss_wrap(np.where(obs, Y, 0.0), 2.0) / np.maximum(gauss_wrap(obs.astype(float), 2.0), 1e-6)
    core = ndimage.binary_erosion(obs, iterations=4)
    rel = float(np.std(hp[core]) / max(np.mean(Y[core]), 1e-6))
    out = np.zeros((H, W, 3)); out[..., 0] = w; out[..., 1] = enc(np.clip(guide, 0, 1))
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(ROOT, f'public/assets/tex/{name}_recon.jpg'), quality=95, subsampling=0)
    stats[name] = {'observedMeanLinY': round(gmean, 5), 'smallScaleRelContrast': round(rel, 4), 'feather_deg': FEATHER_DEG, 'sigma_deg': SIGMA_DEG, 'relax_deg': RELAX_DEG,
                   'unobservedFraction_at_1024': round(float((~obs).mean()), 4)}
    print(name, stats[name])
json.dump(stats, open(os.path.join(ROOT, 'docs/assets/provenance/partial-recon-v381.json'), 'w'), indent=1)
