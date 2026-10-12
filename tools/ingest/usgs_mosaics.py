#!/usr/bin/env python3
"""SOL v3.4 — reproducible ETL for public-domain USGS Astrogeology global mosaics (replaces the personal/non-commercial
Steve Albers mosaics flagged as AST-003).

Source bucket (USGS Astrogeology Science Center, served via planetarymaps.usgs.gov → asc-pds-services S3):
    https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/<name>.tif   (+ .lbl ISIS label, + .tif.md5)

What it does, per body (all steps deterministic, no manual edits):
 1. verify the download against the published .md5;
 2. read the ISIS label (projection, CenterLongitude, LongitudeDirection, Min/MaxLongitude) and re-index the columns to
    SOL's canonical body-fixed equirectangular convention: top row = +90° lat, left column = 180° W (−180° E),
    centre column = 0°, east-positive (src/render/shaderlib.ts `equirect`). For every label here this is a pure circular
    column shift — never a flip;
 3. cross-check the georeference against the v3.3 map it replaces by circular cross-correlation of the luminance
    (reported in the provenance JSON; a non-zero best shift beyond ±1.5° fails the run);
 4. resample with area averaging (PIL BOX, then LANCZOS) to the delivered tiers: base 2048×1024 and hi
    min(8192, native) × half — 8192 is the WebGPU default maxTextureDimension2D, not an art cap;
 5. greyscale sources are colourised with a documented, *inferred* tint (`COLOUR` below): luminance is observed, the hue
    is the body's disc-integrated colour (or a two-end-member ramp for bodies with strongly bimodal colour units).
    This is labelled `colour: inferred` in the manifest;
 6. pixels with value 0 (GDAL_NODATA = 0, unobserved) are reported as a coverage fraction and kept black so the runtime
    no-data / reconstruction path (catalog `noData`) can label them;
 7. write JPEG q92 + docs/assets/provenance/<body>.json (source URL, md5, label facts, transform, correlation, coverage).

Usage: python3 tools/ingest/usgs_mosaics.py --raw /path/to/downloads [--only europa,pluto]
"""
import argparse, hashlib, json, os, re, sys, datetime
import numpy as np
import tifffile
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(ROOT, 'public', 'assets', 'tex')
PROV = os.path.join(ROOT, 'docs', 'assets', 'provenance')
STRETCH = {'iapetus': 14.0}
# Triton's Voyager colour mosaic carries filter-misregistration colour noise (pastel rainbow fringes after white
# balance); keep 40 % of its chroma (documented, colour status stays 'observed, desaturated')
DESAT = {'triton': 0.4}
FLOOR = 10 / 255   # observed pixels are lifted to ≥ this (sRGB) so the runtime noData test (black = unobserved) never fires on dark terrain
BUCKET = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/'

# body → (USGS product, mission credit, colour treatment)
BODIES = {
    'europa':    ('Europa_Voyager_GalileoSSI_global_mosaic_500m', 'NASA/JPL/USGS — Voyager & Galileo SSI', ('tint', (0.86, 0.80, 0.70))),
    'ganymede':  ('Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m', 'NASA/JPL/USGS — Voyager & Galileo SSI (colour mosaic)', ('rgb', (0.60, 0.56, 0.50))),
    'io':        ('Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km', 'NASA/JPL/USGS — Galileo SSI & Voyager (colour merge)', ('rgb', (0.88, 0.80, 0.45))),
    'enceladus': ('Enceladus_Cassini_mosaic_global_110m', 'NASA/JPL-Caltech/Space Science Institute/USGS — Cassini ISS', ('tint', (0.95, 0.96, 0.98))),
    'tethys':    ('Tethys_Cassini_mosaic_global_293m', 'NASA/JPL-Caltech/Space Science Institute/USGS — Cassini ISS', ('tint', (0.93, 0.93, 0.92))),
    'dione':     ('Dione_Cassini_Voyager_mosaic_global_154m', 'NASA/JPL-Caltech/Space Science Institute/USGS — Cassini ISS & Voyager', ('tint', (0.90, 0.89, 0.87))),
    'rhea':      ('Rhea_Cassini_Voyager_mosaic_global_417m', 'NASA/JPL-Caltech/Space Science Institute/USGS — Cassini ISS & Voyager', ('tint', (0.90, 0.89, 0.86))),
    # Iapetus: two-tone — dark Cassini Regio is reddish-brown (Cassini ISS/VIMS colour), bright terrain near-neutral white
    # The USGS mosaic is photometrically flattened (dark/bright large-scale ratio ≈ 5.5 measured); Iapetus' measured
    # normal albedos are ≈0.02–0.05 (Cassini Regio) vs ≈0.5–0.6 (trailing side) (Squyres et al. 1984; Blackburn et al.
    # 2011) → the LOW-FREQUENCY luminance is re-stretched to a 5th/95th-percentile ratio of 14 (STRETCH); detail untouched.
    'iapetus':   ('Iapetus_Cassini_Voyager_mosaic_global_783m', 'NASA/JPL-Caltech/Space Science Institute/USGS — Cassini ISS & Voyager', ('ramp', (0.56, 0.42, 0.32), (0.96, 0.95, 0.93))),
    'triton':    ('Triton_Voyager2_ClrMosaic_GlobalFill_600m', 'NASA/JPL/USGS — Voyager 2 (colour mosaic, global fill)', ('rgb', (0.85, 0.80, 0.76))),
    # Pluto: dark equatorial tholin units (Cthulhu) are deep red-brown; bright N₂/CH₄ ice (Sputnik Planitia) pale cream
    'pluto':     ('Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit', 'NASA/JHUAPL/SwRI/LPI/USGS — New Horizons LORRI & MVIC', ('ramp', (0.36, 0.17, 0.10), (1.0, 0.94, 0.85))),
    'charon':    ('Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit', 'NASA/JHUAPL/SwRI/LPI/USGS — New Horizons LORRI & MVIC', ('ramp', (0.45, 0.30, 0.24), (0.86, 0.85, 0.84))),
    'ceres':     ('Ceres_Dawn_FC_DLR_global_20ppd_Oct2015', 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA — Dawn Framing Camera (DLR mosaic, via USGS)', ('tint', (0.84, 0.82, 0.80))),
    'vesta':     ('Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd', 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA — Dawn Framing Camera HAMO (via USGS)', ('tint', (0.86, 0.82, 0.76))),
}
# Non-USGS public products (no ISIS label): explicit, documented georeference.
EXTRA = {
    # NASA/JPL-Caltech/SSI PIA17214 "Mimas Global Map – June 2017" (unlabelled), simple cylindrical 16 px/deg, 5760×2880.
    # Georeference verified: Herschel's central peak (IAU Gazetteer 1.38°S, 111.76°W) falls at column ≈ 68° from the left
    # edge, i.e. the map is already in SOL's canonical layout (left = 180°W, centre = 0°, east-positive) → no shift.
    'mimas': {'file': 'PIA17214_unlabeled.png', 'url': 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/p/i/a/1/PIA17214_unlabeled.png',
              'page': 'https://science.nasa.gov/resource/mimas-global-map-june-2017/', 'sha256': 'f8ffa667b2c35ec890973ea3300a33d3ee506f596b53d3818cdfee56943e038b',
              'credit': 'NASA/JPL-Caltech/Space Science Institute (PIA17214)', 'licence': 'NASA/JPL image use policy: may be used for any purpose without prior permission; credit required',
              'colour': ('tint', (0.86, 0.86, 0.85)), 'label': {'ProjectionName': 'SimpleCylindrical', 'CenterLongitude': '0', 'LongitudeDirection': 'PositiveEast (display), verified via Herschel', 'MinimumLongitude': '-180', 'MaximumLongitude': '180'}},
}

def label(path):
    t = open(path, encoding='latin-1').read()
    g = lambda k: (re.search(r'\b' + k + r'\s*=\s*([^\s<]+)', t) or [None, None])[1]
    return {k: g(k) for k in ['ProjectionName', 'CenterLongitude', 'LongitudeDirection', 'MinimumLongitude', 'MaximumLongitude', 'LatitudeType', 'Samples', 'Lines', 'Bands', 'PixelResolution', 'Scale']}

def to_canonical(img, lab):
    """Circular column shift so that column u ↔ east longitude −180 + 360u."""
    W = img.shape[1]
    lmin, lmax = float(lab['MinimumLongitude']), float(lab['MaximumLongitude'])
    span = lmax - lmin
    assert abs(span - 360) < 1e-6, 'expected a global 360° map'
    pw = lab['LongitudeDirection'].lower().startswith('positivewest')
    # longitude (east) of the left edge of column 0
    east0 = -lmax if pw else lmin           # PW: leftmost column carries the maximum west longitude
    # canonical left edge is −180 E: shift so the source column at east = −180 lands at index 0
    shift_deg = ((-180.0 - east0) % 360.0)
    shift = int(round(shift_deg / 360.0 * W)) % W
    return np.roll(img, -shift, axis=1), {'direction': 'positive-west' if pw else 'positive-east', 'leftEdgeEastDeg': east0, 'columnShift': shift, 'shiftDeg': shift_deg}

def srgb_to_lin(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)

def lin_to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)

def stretch_lowfreq(grey01, target):
    """Re-stretch the large-scale (≈3°) luminance contrast to a target p95/p5 ratio; returns (new grey, info)."""
    from PIL import ImageFilter
    lin = srgb_to_lin(grey01.astype(np.float32))
    H, W = lin.shape
    lp = np.asarray(Image.fromarray(lin, mode='F').resize((720, 360), Image.BOX), dtype=np.float32)
    x = np.arange(-9, 10); g = np.exp(-0.5 * (x / 3.0) ** 2); g /= g.sum()      # σ = 3 px = 1.5°
    lp = sum(w * np.roll(lp, int(o), axis=1) for o, w in zip(x, g))                # wrap in longitude
    pad = np.pad(lp, ((9, 9), (0, 0)), mode='edge')
    lp = sum(w * pad[9 + int(o):9 + int(o) + 360] for o, w in zip(x, g)).astype(np.float32)
    obs = lp[lp > 1e-3]
    r0 = float(np.percentile(obs, 95) / np.percentile(obs, 5))
    k = np.log(target) / np.log(r0) - 1
    med = float(np.median(np.log(obs)))
    gain = np.exp(k * (np.log(np.maximum(lp, 1e-3)) - med)).astype(np.float32)
    gain = np.asarray(Image.fromarray(gain, mode='F').resize((W, H), Image.BILINEAR), dtype=np.float32)
    out = lin * gain
    band = out[H // 6: 5 * H // 6]                                 # ±60°: polar fill/smear excluded from the white point
    out = out / max(1e-6, float(np.percentile(band[band > 0], 98)))
    return lin_to_srgb(out), {'ratioBefore': round(r0, 2), 'ratioAfter': target, 'exponent': round(float(k), 3), 'scaleDeg': 3}

def colourise(grey01, how):
    """grey01: display-referred (sRGB-encoded, as distributed) 0..1 greyscale. Returns sRGB float RGB."""
    if how[0] == 'tint':
        t = np.array(how[1])
        lin = srgb_to_lin(grey01)[..., None] * (t / t.max())
        return lin_to_srgb(lin)
    if how[0] == 'ramp':
        dark, bright = np.array(how[1]), np.array(how[2])
        lin = srgb_to_lin(grey01)
        # endmember weight from the map's own luminance distribution (robust 5th/95th percentiles of the observed part)
        obs = lin[lin > 0]
        lo, hi = np.percentile(obs, 5), np.percentile(obs, 95)
        w = np.clip((lin - lo) / max(1e-6, hi - lo), 0, 1)[..., None]
        hue = dark * (1 - w) + bright * w
        hue = hue / hue.max(axis=-1, keepdims=True)
        return lin_to_srgb(lin[..., None] * hue)
    raise ValueError(how)

def lum(rgb):
    return srgb_to_lin(rgb) @ np.array([0.2126, 0.7152, 0.0722])

def correlate(new_lum, old_path):
    if not os.path.exists(old_path):
        return None
    old = np.asarray(Image.open(old_path).convert('L').resize((720, 360), Image.BOX), dtype=np.float64)
    nw = np.asarray(Image.fromarray((np.clip(new_lum, 0, 1) * 255).astype(np.uint8)).resize((720, 360), Image.BOX), dtype=np.float64)
    band = slice(60, 300)                       # ±60° latitude: avoid polar fill / smears
    a = old[band] - old[band].mean(1, keepdims=True); b = nw[band] - nw[band].mean(1, keepdims=True)
    A, B = np.fft.fft(a, axis=1), np.fft.fft(b, axis=1)
    xc = np.real(np.fft.ifft(A * np.conj(B), axis=1)).sum(0)
    k = int(np.argmax(xc)); k = k - 720 if k > 360 else k
    r0 = float(np.corrcoef(a.ravel(), b.ravel())[0, 1])
    return {'bestShiftDeg': k * 0.5, 'corrAtZero': round(r0, 3), 'note': 'positive = new map must move east to match v3.3'}

def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 22), b''):
            h.update(chunk)
    return h.hexdigest()

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 22), b''):
            h.update(chunk)
    return h.hexdigest()

def run(body, raw):
    if body in EXTRA:
        e = EXTRA[body]; src = os.path.join(raw, e['file'])
        assert sha256(src) == e['sha256'], f'{body}: sha256 mismatch'
        prod, credit, how, lab, want = e['file'], e['credit'], e['colour'], e['label'], e['sha256']
        a = np.asarray(Image.open(src).convert('L')); xf = {'columnShift': 0, 'note': 'already canonical (verified by named feature)'}
    else:
        prod, credit, how = BODIES[body]
        tif, lbl, md5f = (os.path.join(raw, prod + s) for s in ('.tif', '.lbl', '.tif.md5'))
        want = open(md5f).read().split()[0]
        got = md5(tif)
        assert want == got, f'{body}: md5 mismatch {got} != {want}'
        lab = label(lbl)
        a = tifffile.imread(tif)
        if a.ndim == 3 and a.shape[0] in (3, 4):
            a = np.moveaxis(a[:3], 0, -1)
        a, xf = to_canonical(a, lab)
    import gc; gc.collect()
    nodata = (a == 0) if a.ndim == 2 else np.all(a == 0, axis=-1)
    rowfrac = nodata.mean(axis=1)                       # per-row unobserved fraction (memory-light)
    wl = np.cos(np.radians(np.linspace(90, -90, a.shape[0])))
    cover = 1 - float((rowfrac * wl).sum() / wl.sum())
    H0, W0 = a.shape[:2]
    out = {}; stinfo = None; wb = None
    hiW = min(8192, W0 - W0 % 2)
    for tier, W in (('hi', hiW), ('base', 2048)):
        H = W // 2
        im = Image.fromarray(a)
        # two-step: area average to 2× then Lanczos (anti-aliased, keeps crater rims crisp)
        if W0 > 2 * W:
            im = im.resize((2 * W, 2 * H), Image.BOX)
        im = im.resize((W, H), Image.LANCZOS)
        arr = np.asarray(im, dtype=np.float32) / np.float32(255.0)
        nd = np.asarray(Image.fromarray(nodata.astype(np.uint8) * 255).resize((W, H), Image.BOX)) > 127
        if body in STRETCH and arr.ndim == 2:
            arr, stinfo = stretch_lowfreq(arr, STRETCH[body])
        if arr.ndim == 3 and len(how) > 1:
            # white balance: mission colour mosaics are filter composites with arbitrary per-channel stretch; scale the
            # channels (linear light) so the observed-area mean matches the disc-integrated colour (catalog colour)
            lin = srgb_to_lin(arr); m = lin[~np.all(arr == 0, axis=-1)].reshape(-1, 3).mean(0)
            t = np.array(how[1], dtype=np.float32); g = (t / t.mean()) / (m / m.mean())
            arr = lin_to_srgb(lin * g.astype(np.float32)); wb = [round(float(x), 3) for x in g]
        rgb = arr if arr.ndim == 3 else colourise(arr, how)
        if body in DESAT:
            L3 = (rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))[..., None]
            rgb = L3 + (rgb - L3) * DESAT[body]
        rgb = np.maximum(rgb, FLOOR)
        rgb[nd] = 0
        name = body + ('_hi' if tier == 'hi' else '')
        path = os.path.join(TEX, name + '.jpg')
        Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path, quality=92, optimize=True, subsampling=0)
        L = lum(np.clip(rgb, 0, 1))
        latw = np.cos(np.radians(np.linspace(90, -90, H)))
        out[tier] = {'file': 'assets/tex/' + name + '.jpg', 'size': [W, H], 'sha256': sha256(path), 'meanLinearLum': float((L.mean(axis=1) * latw).sum() / latw.sum())}
        if tier == 'base':
            corr = correlate(L ** (1 / 2.2), os.path.join(ROOT, '.cache', 'v33tex', body + '.jpg'))
        del rgb, arr, L
    prov = {
        'object_id': body, 'source_url': EXTRA[body]['url'] if body in EXTRA else BUCKET + prod + '.tif', 'label_url': EXTRA[body]['page'] if body in EXTRA else BUCKET + prod + '.lbl', 'checksum': want,
        'retrieval_date': datetime.date.today().isoformat(), 'producer': 'NASA/JPL' if body in EXTRA else 'USGS Astrogeology Science Center', 'attribution': credit,
        'license': EXTRA[body]['licence'] if body in EXTRA else 'U.S. public domain (USGS-produced product of NASA mission data); credit requested',
        'commercial': 'yes', 'original_wavelength': 'visible (clear/broadband; colour products: mission colour filters merged by USGS)',
        'projection': lab.get('ProjectionName'), 'label': lab, 'native_size': [W0, H0], 'transform': xf,
        'colour': ('observed (mission colour mosaic), white-balanced to the disc-integrated colour ' + str(how[1])) if how[0] == 'rgb' else f'inferred — greyscale observed luminance × {how[0]} {how[1:]} (documented in tools/ingest/usgs_mosaics.py)',
        'observed_coverage_fraction': round(cover, 4), 'georeference_check_vs_v3_3': corr, 'tiers': out,
        'white_balance_gains_linear': wb,
        'desaturation_keep': DESAT.get(body), 'observed_floor_srgb': FLOOR,
        'albedo_stretch': (stinfo if body in STRETCH else None),
        'resampling': 'BOX to 2× then LANCZOS; sRGB 8-bit JPEG q92 4:4:4',
    }
    if corr and abs(corr['bestShiftDeg']) > 1.5:
        prov['WARNING'] = 'georeference disagrees with the v3.3 map; inspect before shipping'
    os.makedirs(PROV, exist_ok=True)
    json.dump(prov, open(os.path.join(PROV, body + '.json'), 'w'), indent=1)
    return prov

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--raw', required=True); ap.add_argument('--only', default='')
    o = ap.parse_args()
    for b in (o.only.split(',') if o.only else [*BODIES, *EXTRA]):
        p = run(b, o.raw)
        print(b, p['native_size'], 'cover', p['observed_coverage_fraction'], 'geo', p['georeference_check_vs_v3_3'], p.get('WARNING', ''), flush=True)
