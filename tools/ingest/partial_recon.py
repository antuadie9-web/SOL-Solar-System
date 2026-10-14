#!/usr/bin/env python3
"""SOL v3.8.1 (AST-381-03, owner review REV2-02) — reconstruction guide fields for partial mosaics.

Problem: on Ariel/Titania/Oberon (and the same shared shader path on Triton, Pluto, Charon) the labelled reconstruction of
the unobserved region met the observed map at a hard edge with a different mean albedo, a different texture frequency and
a different contrast, which made the boundary the most conspicuous feature of the body.

This tool writes (1024×512, equirectangular, same registration as the colour map):
  <body>_recon.jpg  = low-frequency COLOUR guide (sRGB): normalised convolution of the observed colour (rim excluded) with
      a Gaussian of SIGMA_DEG (longitude wraps) — the observed regional colour/albedo carried smoothly into the gap,
      relaxed toward the body's observed mean colour with distance (RELAX_DEG): regional continuity only.
  <body>_reconw.jpg = reconstruction weight w ∈ [0, 1]: 0 on every observed pixel (observed data are never altered),
      rising smoothly from the boundary to 1 over FEATHER_DEG inside the unobserved region.
(iteration 1 stored luminance only, so Pluto/Charon/Triton reconstructions came out grey against red/brown terrain.)
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
EDGE_RELAX_DEG = 4.0   # iteration 7: guide relaxes from the observed edge colour to the regional guide
RIM_DEG = 2.0    # rim of the observed region excluded from the guide statistics (low-sun / terminator-darkened pixels)
for name, thr in BODIES.items():
    src = os.path.join(ROOT, f'public/assets/tex/{name}.jpg')
    im = np.asarray(Image.open(src).convert('RGB').resize((W, H), Image.LANCZOS), float) / 255.0
    rgb = lin(im); Y = rgb @ np.array([0.2126, 0.7152, 0.0722])
    obs = ndimage.binary_erosion(Y > lin(np.array(thr)) * 1.0 + 1e-4, iterations=1)
    tiled = np.concatenate([~obs, ~obs, ~obs], axis=1)
    d = ndimage.distance_transform_edt(tiled)[:, W:2 * W] * (180.0 / H)                    # deg from data (in the gap)
    tiledo = np.concatenate([obs, obs, obs], axis=1)
    din = ndimage.distance_transform_edt(tiledo)[:, W:2 * W] * (180.0 / H)                 # deg from the gap (inside data)
    w = np.clip(d / FEATHER_DEG, 0, 1); w = w * w * (3 - 2 * w); w[obs] = 0
    core = obs & (din > RIM_DEG)
    # iteration 5: multi-scale normalised convolution (3.5°, 10°, 25°; weights 1, 0.05, 0.0025) so the guide decays
    # smoothly from the local regional colour into a wide-area continuation — iteration 4 switched to a constant mean
    # ≈10° from the data, which drew a band; the far value is the observed colour near the boundary, not the global mean
    band = core & (din < RIM_DEG + 12.0)
    gm = rgb[band].mean(0) if band.sum() > 100 else rgb[core].mean(0)
    gm_global = rgb[core].mean(0)
    num = np.zeros_like(rgb); den = np.zeros(Y.shape)
    for sdeg, wgt in [(SIGMA_DEG, 1.0), (10.0, 0.05), (25.0, 0.0025)]:
        sg = sdeg * H / 180.0; src = band if sdeg > SIGMA_DEG else core
        den += wgt * gauss_wrap(src.astype(float), sg)
        for k in range(3): num[..., k] += wgt * gauss_wrap(np.where(src, rgb[..., k], 0.0), sg)
    eps = 1e-6
    guide = (num + gm * eps) / (den + eps)[..., None]
    # iteration 7 (boundary continuity): the regional guide is built from the observed CORE (rim > 2° excluded), but on
    # Pluto and Charon the last ~4° of observed data are 25–40 % darker than the core (median by distance from the gap:
    # Pluto 0.34 → 0.20, Charon 0.51 → 0.39; Triton/Titania < 3 %), so the gap started 40 % brighter than the observed
    # pixels beside it — the "lighter band" along the boundary. The guide now STARTS at the observed edge colour (normalised
    # convolution, 0.35°, of the pixels the renderer actually shows — mask eroded 0.4° exactly like *_mask.jpg) and relaxes
    # to the regional guide over EDGE_RELAX_DEG. Same rule for every body; observed pixels are untouched (w = 0 there).
    shown = ndimage.binary_erosion(obs, iterations=max(1, int(round(0.4 * H / 180))))
    sg = 0.35 * H / 180.0
    eden = gauss_wrap(shown.astype(float), sg)
    edge = np.stack([gauss_wrap(np.where(shown, rgb[..., k], 0.0), sg) for k in range(3)], -1) / np.maximum(eden, 1e-6)[..., None]
    # beyond the blur reach the edge field is undefined: propagate the nearest valid value
    valid = eden > 1e-3
    idx = ndimage.distance_transform_edt(np.concatenate([~valid] * 3, axis=1), return_distances=False, return_indices=True)
    iy, ix = idx[0][:, W:2 * W], idx[1][:, W:2 * W] % W
    edge = edge[iy, ix]
    t = np.clip(d / EDGE_RELAX_DEG, 0, 1); t = (t * t * (3 - 2 * t))[..., None]
    guide = edge * (1 - t) + guide * t
    guide[obs] = rgb[obs]                                      # never used on observed pixels (w = 0); keeps the JPEG smooth
    # contrast statistics of the observed core: fine (≲2 px) and mid (1°–6° band, difference of Gaussians), relative
    hp = Y - gauss_wrap(np.where(obs, Y, 0.0), 2.0) / np.maximum(gauss_wrap(obs.astype(float), 2.0), 1e-6)
    s1, s6 = H / 180.0, 6 * H / 180.0
    b1 = gauss_wrap(np.where(obs, Y, 0), s1) / np.maximum(gauss_wrap(obs.astype(float), s1), 1e-6)
    b6 = gauss_wrap(np.where(obs, Y, 0), s6) / np.maximum(gauss_wrap(obs.astype(float), s6), 1e-6)
    mY = max(float(np.mean(Y[core])), 1e-6)
    rel = float(np.std(hp[core]) / mY); mid = float(np.std((b1 - b6)[core]) / mY)
    Image.fromarray((np.clip(enc(np.clip(guide, 0, 1)), 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(ROOT, f'public/assets/tex/{name}_recon.jpg'), quality=95, subsampling=0)
    Image.fromarray((np.clip(w, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(ROOT, f'public/assets/tex/{name}_reconw.jpg'), quality=95)
    stats[name] = {'observedMeanLinRGB': [round(float(x), 5) for x in gm_global], 'boundaryZoneMeanLinRGB': [round(float(x), 5) for x in gm], 'smallScaleRelContrast': round(rel, 4), 'midScaleRelContrast_1to6deg': round(mid, 4),
                   'feather_deg': FEATHER_DEG, 'sigma_deg': SIGMA_DEG, 'relax_deg': RELAX_DEG, 'rimExcluded_deg': RIM_DEG, 'edgeRelax_deg': EDGE_RELAX_DEG, 'unobservedFraction_at_1024': round(float((~obs).mean()), 4)}
    # non-fabrication check on the WRITTEN file: the weight must be ~0 wherever the source map has data
    wr = np.asarray(Image.open(os.path.join(ROOT, f'public/assets/tex/{name}_reconw.jpg')).convert('L'), float) / 255.0
    stats[name]['maxWeightOnObserved'] = round(float(wr[ndimage.binary_erosion(obs, iterations=2)].max()), 4)
    assert stats[name]['maxWeightOnObserved'] < 0.03, name
    print(name, stats[name])
# iteration 4: data masks at EXACTLY the colour map's resolution (base, and hi tier where it exists). The shader divides the
# filtered colour by the identically filtered mask (normalised bilinear/trilinear), so observed edge texels are no longer
# darkened by their black no-data neighbours (the thin dark outline) — observed pixels are never re-encoded.
for name, thr in BODIES.items():
    for suf in ['', '_hi']:
        src = os.path.join(ROOT, f'public/assets/tex/{name}{suf}.jpg')
        if not os.path.exists(src): continue
        g = np.asarray(Image.open(src).convert('L'), float) / 255.0
        # rim pixels of the source mosaics are darkened (low-Sun / terminator photometry, JPEG ringing against the black
        # fill): rendered as a thin dark line along every boundary in iteration 5 even with normalised filtering. The data
        # mask therefore excludes a 0.4° rim (iteration 6) — those pixels are treated as unobserved, never altered.
        rim_px = max(1, int(round(0.4 * g.shape[0] / 180)))
        valid = ndimage.binary_opening(g > max(thr, 1.5 / 255), iterations=1)
        # iteration 8d (ast3 acceptance): isolated sub-threshold pixels INSIDE the observed area (Voyager reseau/dropout
        # specks, a few genuinely near-black texels) were holes in the mask, and the 0.4° rim erosion grew each speck into a
        # ~0.8° disc of reconstruction colour — the dotted lines seen on Triton/Charon/Oberon. Holes enclosed by data and
        # smaller than 0.3° across are part of the observed area (their few source pixels stay as they are; they are
        # sub-pixel at every view where the hi map is resident). The large unobserved region is unaffected.
        lab, nl = ndimage.label(~valid)
        if nl:
            area = ndimage.sum(np.ones_like(g), lab, index=np.arange(1, nl + 1))
            dmax = 0.3 * g.shape[0] / 180
            small = np.zeros(nl + 1, bool); small[1:] = area < np.pi * (dmax / 2) ** 2
            # never fill a component touching the top/bottom rows (the polar unobserved caps)
            edge = np.unique(np.concatenate([lab[0], lab[-1]])); small[edge] = False
            filled = small[lab]; valid = valid | filled
            stats[name]['specksFilled' + suf] = int(small.sum()); stats[name]['speckPixels' + suf] = int(filled.sum())
        m = ndimage.binary_erosion(valid, iterations=rim_px)
        Image.fromarray((m * 255).astype(np.uint8)).save(os.path.join(ROOT, f'public/assets/tex/{name}_mask{suf}.jpg'), quality=98)
        stats[name]['mask' + suf] = list(g.shape)
json.dump(stats, open(os.path.join(ROOT, 'docs/assets/provenance/partial-recon-v381.json'), 'w'), indent=1)
