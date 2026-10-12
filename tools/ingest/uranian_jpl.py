#!/usr/bin/env python3
"""SOL v3.8.1 (AST-381-01) — rights-cleared Voyager 2 maps of Ariel, Titania and Oberon.

Replaces the three Steve Albers mosaics (personal / non-commercial licence, AST-003) with the USGS Voyager-2 mosaics
distributed by NASA/JPL's Solar System Simulator (https://space.jpl.nasa.gov/tmaps/uranus.html, "From the USGS, mosaicked
with Voyager imagery", creator/owner Caltech/JPL/USGS). Rights: JPL Image Use Policy — usable for any purpose including
commercial with the credit "Courtesy NASA/JPL-Caltech" (USGS/Voyager data); no third-party owner is listed.

Registration (verified, not assumed): 1440×720 simple cylindrical, top = +90°, left edge = −180° E, east-positive — the
same as SOL's body-fixed convention. Checked by overlaying the IAU Gazetteer (USGS, planetocentric, +East) centres of
the largest named features: Gertrude, Ursula, Calphurnia, Messina Chasmata (Titania); Kachina Chasmata, Yangoor (Ariel);
Hamlet, Macbeth, Othello, Falstaff, Romeo (Oberon) — all coincide with the mapped structures at zero shift.
Content: clear-filter greyscale (Voyager ISS NA camera), ≈ 4 px/deg (Titania 3.4 km/px, ≈ the best Voyager resolution);
the northern hemispheres were in polar night in 1986 and are pure black (no data). Colour: the greyscale is multiplied by
the body's disc-integrated colour already in the catalogue (labelled; Voyager colour coverage of these moons is partial).
SOL shows the unobserved region as its existing LABELLED procedural reconstruction (catalog noData threshold), so the
reconstruction fraction is re-measured here and written back to the catalogue notes.

Usage: python3 tools/ingest/uranian_jpl.py <dir with ura1vuu2.tif ura3vuu2.tif ura4vuu2.tif>
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = sys.argv[1]
BODIES = {'ariel': ('ura1vuu2.tif', (0.7, 0.7, 0.7)), 'titania': ('ura3vuu2.tif', (0.6, 0.58, 0.56)), 'oberon': ('ura4vuu2.tif', (0.52, 0.48, 0.46))}
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
enc = lambda a: np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.maximum(a, 0), 1 / 2.4) - 0.055)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
report = {}
for name, (f, col) in BODIES.items():
    p = os.path.join(SRC, f)
    g = np.asarray(Image.open(p).convert('L'), dtype=np.float64) / 255.0
    nodata = g < 1.5 / 255
    c = np.array(col) / (0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2])     # luminance-normalised tint
    rgb = lin(g)[..., None] * c[None, None, :]
    rgb[nodata] = 0
    out = os.path.join(ROOT, f'public/assets/tex/{name}.jpg')
    Image.fromarray((np.clip(enc(np.clip(rgb, 0, 1)), 0, 1) * 255 + 0.5).astype(np.uint8)).save(out, quality=95, subsampling=0, optimize=True)
    Y = (lin(np.asarray(Image.open(out).convert('RGB'), dtype=np.float64) / 255.0) @ np.array([0.2126, 0.7152, 0.0722]))
    report[name] = {'source': f, 'sourceSha256': sha(p), 'size': list(Image.open(p).size), 'outSha256': sha(out), 'meanLinearY': float(Y.mean()),
                    'unobservedFraction': round(float(nodata.mean()), 3)}
json.dump(report, open(os.path.join(ROOT, 'docs/assets/provenance/uranian-jpl-v381.json'), 'w'), indent=1)
print(json.dumps(report, indent=1))
