#!/usr/bin/env python3
"""SOL v3.8.1 QA (SKY-381-07) — validate the catalogue-star removal from the Gaia EDR3 sky layer.

Checks, all evaluated in SOL's CALIBRATED RADIANCE domain (the domain the renderer composites in):
  L(Y) = L_band · (Y / Y_band)^γ, γ = 0.45 (presentation.ts SKY_CAL; Y = sRGB-decoded Rec.709 luminance of the map),
  surface brightness μ_band = 21.0 mag arcsec⁻² ↔ Y_band.
Note on domains: the ESA map is a display-stretched image, not linear flux; its exact stretch is not published. The
removal itself (replace masked pixels by min(pixel, 7×7 median)) commutes with ANY monotonic stretch, so it is valid in
every domain; the quantitative checks below are reported in SOL's calibrated radiance, i.e. what is actually added to the
rendered sky.
 1. Double counting: for every catalogue star (V ≤ 9.5) the map's excess over its local background inside the mask disc
    is integrated and converted to a magnitude, BEFORE and AFTER removal, and compared with the catalogue V that SOL
    draws as a point source.
 2. Holes: masked pixels that end up darker than 0.7× their local background (after removal).
 3. Halos: excess radiance in an annulus just outside the mask (r 4–6 px) relative to a reference annulus (r 9–12 px).
 4. Seam: luminance discontinuity across the l = ±180° wrap vs ordinary adjacent-column differences.
 5. Colour: chroma (r/Y, b/Y) of masked pixels vs their surrounding ring.
Usage: python3 tools/qa/sky_removal_qa.py <16k source png>   → docs/qa/v3.8.1/sky-removal-qa.json (+ crops png)
"""
import gzip, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = sys.argv[1]; W, H = 8192, 4096; GAMMA = 0.45; MU_BAND = 21.0
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4).astype(np.float32)
meta = json.load(open(os.path.join(ROOT, 'public/assets/data/milkyway_v381.json')))
img = np.asarray(Image.open(SRC).convert('RGB').resize((W, H), Image.LANCZOS), dtype=np.float32) / 255.0
rgb = lin(img); del img
Y0 = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
v = np.frombuffer(gzip.open(os.path.join(ROOT, 'public/', 'assets/' + meta['luma']['file'])).read(), dtype=np.uint8).reshape(H, W)[::-1]
Y1 = np.exp(meta['luma']['lnMin'] + v.astype(np.float32) / 255 * (meta['luma']['lnMax'] - meta['luma']['lnMin']))
Yb = meta['bandMedianY']
L = lambda Y: (np.maximum(Y, 1e-7) / Yb) ** GAMMA                   # radiance in units of the band radiance
bg0 = ndimage.median_filter(Y0, size=7, mode='wrap'); bg1 = ndimage.median_filter(Y1, size=15, mode='wrap')
cat = np.fromfile(os.path.join(ROOT, 'public/assets/data/stars.bin'), dtype=np.float32).reshape(-1, 5).astype(np.float64)
G = np.array([[-0.0548755604162154, -0.8734370902348850, -0.4838350155487132], [0.4941094278755837, -0.4448296299600112, 0.7469822444972189], [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669]])
g = cat[:, :3] @ G.T; l = np.arctan2(g[:, 1], g[:, 0]); b = np.arcsin(np.clip(g[:, 2], -1, 1))
px = np.mod((0.5 - l / (2 * np.pi)) * W, W); py = (0.5 - b / np.pi) * H
V = cat[:, 3]; rad = np.where(V < 4, 3, np.where(V < 7.5, 2, 1))
pix_as2 = (360 * 3600 / W) * (180 * 3600 / H)                          # arcsec² per pixel at b = 0
def disc(r): return [(dx, dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1) if dx * dx + dy * dy <= r * r + 0.5]
def ring(r0, r1): return [(dx, dy) for dy in range(-r1, r1 + 1) for dx in range(-r1, r1 + 1) if r0 * r0 <= dx * dx + dy * dy <= r1 * r1]
rng = np.random.default_rng(7); idx = np.arange(len(V)); sample = np.sort(np.concatenate([idx[V < 6], rng.choice(idx[V >= 6], 6000, replace=False)]))
rows = []
for i in sample:
    x0, y0 = int(round(px[i])), int(round(py[i]))
    if y0 < 15 or y0 > H - 16: continue
    cb = np.cos(b[i]); D = disc(int(rad[i])); A = ring(4, 6); R = ring(9, 12)
    get = lambda Y, pts: np.array([Y[y0 + dy, (x0 + dx) % W] for dx, dy in pts])
    exc0 = np.sum(L(get(Y0, D)) - L(get(bg0, D))) * pix_as2 * cb            # band-radiance·arcsec²
    exc1 = np.sum(L(get(Y1, D)) - L(get(bg1, D))) * pix_as2 * cb
    m0 = MU_BAND - 2.5 * np.log10(exc0) if exc0 > 0 else 99.0
    m1 = MU_BAND - 2.5 * np.log10(exc1) if exc1 > 0 else 99.0
    dd = get(Y1, D); bb = get(bg1, D); holes = float(np.mean(dd < 0.7 * bb))
    halo = float(np.mean(L(get(Y1, A))) / max(np.mean(L(get(Y1, R))), 1e-9))
    rows.append((V[i], m0, m1, holes, halo))
a = np.array(rows)
# reference: the same hole/halo statistics at random sky positions with no catalogue star (natural grain of the map)
refs = []
for k in range(6000):
    x0, y0 = int(rng.integers(0, W)), int(rng.integers(int(H * 0.05), int(H * 0.95)))
    get = lambda Y, pts: np.array([Y[y0 + dy, (x0 + dx) % W] for dx, dy in pts])
    refs.append((float(np.mean(get(Y1, disc(2)) < 0.7 * get(bg1, disc(2)))), float(np.mean(L(get(Y1, ring(4, 6)))) / max(np.mean(L(get(Y1, ring(9, 12)))), 1e-9))))
refs = np.array(refs)
bins = [(-2, 3), (3, 5), (5, 6.5), (6.5, 8), (8, 9.5)]
dc = []
for lo, hi in bins:
    s = a[(a[:, 0] >= lo) & (a[:, 0] < hi)]
    f0 = np.mean([10 ** (-0.4 * (m - v_)) if m < 90 else 0 for v_, m in zip(s[:, 0], s[:, 1])])
    f1 = np.mean([10 ** (-0.4 * (m - v_)) if m < 90 else 0 for v_, m in zip(s[:, 0], s[:, 2])])
    dc.append({'V': f'{lo}–{hi}', 'stars': int(len(s)), 'mapFluxBefore_overCatalogue': round(float(f0), 4), 'mapFluxAfter_overCatalogue': round(float(f1), 4),
               'holeFractionMedian': round(float(np.median(s[:, 3])), 3), 'haloRatioMedian': round(float(np.median(s[:, 4])), 3), 'haloRatioP95': round(float(np.percentile(s[:, 4], 95)), 3)})
# seam: wrap column pair vs neighbouring pairs, |ΔL| median over |b| < 60°
yy = slice(int(H * 0.17), int(H * 0.83))
seam = float(np.median(np.abs(L(Y1[yy, 0]) - L(Y1[yy, W - 1])))); ref = float(np.median(np.abs(L(Y1[yy, 1:W - 1]) - L(Y1[yy, 0:W - 2]))))
# colour: chroma map (2k) at masked stars vs ring
ch = lin(np.asarray(Image.open(os.path.join(ROOT, 'public/assets/tex/milkyway_chroma_2k.jpg')).convert('RGB'), dtype=np.float32) / 255)
chY = ch @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32) + 1e-6
br = ch[..., 2] / ch[..., 0].clip(1e-6)
cx, cy = (px[V < 6] / 4).astype(int) % 2048, np.clip((py[V < 6] / 4).astype(int), 3, 1020)
inner = br[cy, cx]; outer = np.mean([br[np.clip(cy + dy, 0, 1023), (cx + dx) % 2048] for dx, dy in ring(3, 5)], axis=0)
colour = {'bOverR_atBrightStars_median': round(float(np.median(inner)), 4), 'bOverR_ring_median': round(float(np.median(outer)), 4), 'medianAbsLogRatio': round(float(np.median(np.abs(np.log(inner / outer)))), 4)}
out = {'reference_randomPositions': {'holeFractionMedian': round(float(np.median(refs[:, 0])), 3), 'haloRatioMedian': round(float(np.median(refs[:, 1])), 3), 'haloRatioP95': round(float(np.percentile(refs[:, 1], 95)), 3)}, 'id': 'SKY-381-07', 'domain': 'SOL calibrated radiance L = L_band·(Y/Y_band)^0.45, μ_band = 21.0', 'samples': int(len(a)), 'doubleCounting': dc,
       'seam': {'wrapMedianAbsDeltaL': seam, 'adjacentColumnMedianAbsDeltaL': ref, 'ratio': round(seam / ref, 3)}, 'colour': colour}
os.makedirs(os.path.join(ROOT, 'docs/qa/v3.8.1'), exist_ok=True)
json.dump(out, open(os.path.join(ROOT, 'docs/qa/v3.8.1/sky-removal-qa.json'), 'w'), indent=1)
print(json.dumps(out, indent=1))
# visual: Orion/Sirius region before/after, radiance domain
def crop(Y, l0, b0, w, h):
    x0 = int((0.5 - l0 / 360) * W); y0 = int((0.5 - b0 / 180) * H); dx = int(w / 360 * W / 2); dy = int(h / 180 * H / 2)
    c = L(Y[y0 - dy:y0 + dy, x0 - dx:x0 + dx]); c = np.clip(c / np.percentile(c, 99.7), 0, 1) ** 0.8
    return Image.fromarray((c * 255).astype(np.uint8)).resize((640, 360), Image.LANCZOS)
S = Image.new('L', (1280, 720)); S.paste(crop(Y0, 205, -14, 24, 13.5), (0, 0)); S.paste(crop(Y1, 205, -14, 24, 13.5), (640, 0))
S.paste(crop(Y0, 80, 1, 24, 13.5), (0, 360)); S.paste(crop(Y1, 80, 1, 24, 13.5), (640, 360)); S.save('/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa/sheets/sky-removal-crops.png')
