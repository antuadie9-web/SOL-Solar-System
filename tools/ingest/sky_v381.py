#!/usr/bin/env python3
"""SOL v3.8.1 (SKY-381-04) — observational Galactic sky layer from the ESA Gaia EDR3 all-sky colour map (reproducible).

Root cause of the v3.5–3.8.0 "muddy, flat, brownish" Milky Way (WP-C): the runtime layer was the Gaia DR2 4096×2048 map
passed through a 5×5 MEDIAN filter + 3×3 box blur (tools/ingest/sky_diffuse.py) — an effective resolution of ≈ 20–25′,
which erased the small-scale dust-lane structure that makes the Galactic band read as real. It was also sampled with
implicit mip selection (seam at the anticentre) and desaturated 50 % at runtime.

Source (verified 2026-10-12): ESA/Gaia/DPAC, "The colour of the sky from Gaia's Early Data Release 3 – equirectangular
projection", 16000×8000 PNG (Gaia_EDR3_flux_cartesian_16k.png), CC BY-SA 3.0 IGO, acknowledgement A. Moitinho.
https://sci.esa.int/web/gaia/-/the-colour-of-the-sky-from-gaia-s-early-data-release-3-equirectangular-projection
Projection: Galactic equirectangular, l = 0 at the image centre, l increasing to the LEFT — verified identical to the DR2
map already used by SOL (normalised cross-correlation 0.995 at zero shift, no flip).

What it is (and is not): a projected map of the integrated brightness and colour of ~1.8 billion Gaia sources. It is an
OBSERVED 2-D image of the sky as seen from the Solar System — not 3-D Galactic geometry. Its colour is a display
rendition of Gaia BP/RP fluxes (not a calibrated visible-light spectrum), so SOL keeps the existing DERIVED surface-
brightness calibration (presentation.ts SKY_CAL) and only uses the map's relative luminance and chroma.

Processing:
 1. Lanczos downsample 16000 → 8192×4096 (2.64′ per pixel at the equator).
 2. Catalogue-matched star removal ONLY (no blur of the diffuse light): every star SOL draws individually from its
    directional catalogue (public/assets/data/stars.bin, 99,049 Hipparcos–Tycho stars, V ≤ 9.5) is located in the map
    (ICRS → Galactic, IAU/Hipparcos matrix) and a disc of radius 1–3 px (by magnitude) is replaced by min(map, 7×7
    median background). Fainter stars stay in the map as unresolved light — exactly the light SOL does not draw — so the
    layers neither double-count nor leave holes. Dark structure (dust lanes) is never brightened by construction.
    (A generic outlier detector was tried first and rejected: at 2.6′/px the Gaia map is grainy everywhere and it masked
    68 % of all pixels, i.e. it degenerated into the median blur this release removes.)
 3. Luminance (linear, sRGB-decoded, Rec.709 weights) is log-encoded to 8 bits over [lnMin, lnMax] with a deterministic
    triangular dither → milkyway_luma_8k.bin.gz (raw r8, gzip; decoded in the browser with DecompressionStream).
 4. Chroma: the cleaned colour image Box-downsampled to 2048×1024 sRGB JPEG (colour varies slowly; structure lives in the
    luminance) → milkyway_chroma_2k.jpg.
 5. JSON with the encoding range, the same band/pole luminance statistics as v3.5 (for the runtime calibration), the
    removed flux fraction and SHA-256 of every output.

Usage: python3 tools/ingest/sky_v381.py /path/to/Gaia_EDR3_flux_cartesian_16k.png   (Pillow, numpy, scipy)
"""
import gzip, hashlib, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tools/ingest/raw/Gaia_EDR3_flux_cartesian_16k.png')
OUT_L = os.path.join(ROOT, 'public/assets/tex/milkyway_luma_8k.bin.gz')
OUT_C = os.path.join(ROOT, 'public/assets/tex/milkyway_chroma_2k.jpg')
META = os.path.join(ROOT, 'public/assets/data/milkyway_v381.json')
W, H = 8192, 4096

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
def lin(a): return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4).astype(np.float32)
def enc(a): return np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.maximum(a, 0), 1 / 2.4) - 0.055)

src_sha = sha(SRC)
img = Image.open(SRC).convert('RGB').resize((W, H), Image.LANCZOS)
rgb = lin(np.asarray(img, dtype=np.float32) / 255.0)
del img
Y = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
bg = ndimage.median_filter(Y, size=7, mode='wrap')
cat = np.fromfile(os.path.join(ROOT, 'public/assets/data/stars.bin'), dtype=np.float32).reshape(-1, 5).astype(np.float64)
G = np.array([[-0.0548755604162154, -0.8734370902348850, -0.4838350155487132], [0.4941094278755837, -0.4448296299600112, 0.7469822444972189], [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669]])
g = cat[:, :3] @ G.T
l = np.arctan2(g[:, 1], g[:, 0]); b = np.arcsin(np.clip(g[:, 2], -1, 1))
px = np.mod((0.5 - l / (2 * np.pi)) * W, W); py = (0.5 - b / np.pi) * H     # image row 0 = b +90°
rad = np.where(cat[:, 3] < 4, 3, np.where(cat[:, 3] < 7.5, 2, 1))
mask = np.zeros((H, W), bool)
for r in (1, 2, 3):
    sel = rad == r; xs, ys = np.round(px[sel]).astype(int), np.round(py[sel]).astype(int)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r + 0.5: mask[np.clip(ys + dy, 0, H - 1), np.mod(xs + dx, W)] = True
Yc = np.where(mask, np.minimum(Y, bg), Y).astype(np.float32)
scale = np.where(Y > 1e-6, Yc / np.maximum(Y, 1e-6), 1.0).astype(np.float32)
rgb *= scale[..., None]
removed = float(1 - Yc.sum() / Y.sum()); masked = float(mask.mean())
# statistics (same definitions as tools/ingest/sky_diffuse.py so SKY_CAL keeps its meaning)
band = Yc[int(H * 0.47):int(H * 0.53)]
pole = np.concatenate([Yc[:int(H * 0.08)].ravel(), Yc[int(H * 0.92):].ravel()])
floor = float(max(np.percentile(Yc, 0.01), 1e-5))
lnMin, lnMax = float(np.log(floor)), float(np.log(max(Yc.max(), floor * 10)))
v = (np.log(np.maximum(Yc, floor)) - lnMin) / (lnMax - lnMin) * 255.0
rng = np.random.default_rng(381)
v = np.clip(np.round(v + (rng.random(v.shape, dtype=np.float32) - rng.random(v.shape, dtype=np.float32)) * 0.5), 0, 255).astype(np.uint8)
# row 0 of the GPU texture = bottom of the image (b = −90°) to match flipY'd image textures (uv.y = b/π + 0.5)
raw = np.ascontiguousarray(v[::-1]).tobytes()
with gzip.GzipFile(OUT_L, 'wb', compresslevel=9, mtime=0) as f: f.write(raw)
chroma = Image.fromarray((np.clip(enc(rgb), 0, 1) * 255 + 0.5).astype(np.uint8)).resize((2048, 1024), Image.BOX)
chroma.save(OUT_C, quality=93, subsampling=0, optimize=True)
meta = {
  'id': 'SKY-381-04', 'version': '3.8.1',
  'source': {'title': "The colour of the sky from Gaia's Early Data Release 3 – equirectangular projection", 'file': os.path.basename(SRC),
             'url': 'https://sci.esa.int/web/gaia/-/the-colour-of-the-sky-from-gaia-s-early-data-release-3-equirectangular-projection',
             'credit': 'ESA/Gaia/DPAC; CC BY-SA 3.0 IGO. Acknowledgement: A. Moitinho', 'licence': 'CC BY-SA 3.0 IGO (share-alike applies to these derivatives)',
             'retrieved': '2026-10-12', 'sha256': src_sha, 'size': [16000, 8000]},
  'evidence': 'OBSERVED (projected 2-D integrated-light map; display colour of Gaia BP/RP, not a calibrated V-band spectrum)',
  'projection': 'Galactic equirectangular, l=0 at centre, l increasing to the left; texture row 0 = b −90°',
  'method': 'Lanczos 16k→8192×4096; the 99,049 catalogue stars SOL draws (V ≤ 9.5) masked at their positions (r 1–3 px) and replaced by min(map, 7×7 median); no blur; dark structure untouched; luminance log-encoded r8 + triangular dither; chroma 2048×1024 sRGB',
  'luma': {'file': 'tex/milkyway_luma_8k.bin.gz', 'width': W, 'height': H, 'format': 'r8 log-encoded, gzip', 'lnMin': lnMin, 'lnMax': lnMax, 'sha256': sha(OUT_L)},
  'chroma': {'file': 'tex/milkyway_chroma_2k.jpg', 'width': 2048, 'height': 1024, 'sha256': sha(OUT_C)},
  'removedFluxFraction': removed, 'maskedPixelFraction': masked,
  'bandMedianY': float(np.median(band)), 'poleMedianY': float(np.median(pole)), 'p50Y': float(np.percentile(Yc, 50)), 'p99Y': float(np.percentile(Yc, 99)),
}
json.dump(meta, open(META, 'w'), indent=1)
print(json.dumps(meta, indent=1))
