#!/usr/bin/env python3
"""SOL v3.8.1 REV2-01 (SUN-381-07) — solar glare audit table from glare-* captures.
For every view: distance, FOV, exposure mode, Sun radius (device px), scene EV, glare halo/veil amplitudes (diagnostics) and
IMAGE measurements in linear light: G = integrated luminance outside 2× the disc radius (the glare the viewer sees, in
units of 'full-white pixels'), S = the part of it on the 4 spike axes (|Δx| or |Δy| < 2 px or the diagonals), and the
irradiance F ∝ 1/r² for comparison. Under FIXED exposure a physical PSF gives G ∝ F (until clipping).
usage: glare_audit.py <dir> → <dir>/glare-audit.json + prints a table"""
import json, os, re, sys
import numpy as np
from PIL import Image
d = sys.argv[1]
lin = lambda a: np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
rows = []
shots = {}
for rf in [x for x in os.listdir(d) if x.startswith('result') and x.endswith('.json')]:
    for sh in json.load(open(os.path.join(d, rf)))['scenario']['shots']: shots[sh['name']] = sh
for f in sorted(os.listdir(d)):
    m = re.match(r'glare-([0-9p]+)AU-f(\d+)-(auto|fixed)\.png', f)
    if not m: continue
    au = float(m.group(1).replace('p', '.')); fov = int(m.group(2)); mode = m.group(3)
    j = json.load(open(os.path.join(d, f[:-4] + '.json')))
    sg = (shots.get(f[:-4], {}).get('diag') or {}).get('sunGlare') or {}
    a = lin(np.asarray(Image.open(os.path.join(d, f)).convert('RGB'), float) / 255) @ np.array([0.2126, 0.7152, 0.0722])
    H, W = a.shape; cy, cx = H / 2, W / 2; yy, xx = np.mgrid[0:H, 0:W]; r = np.hypot(yy - cy, xx - cx)
    rd = max(sg.get('rpx', 1.0), 1.0)
    out = r > 2 * rd + 3
    spike = out & ((np.abs(yy - cy) < 2) | (np.abs(xx - cx) < 2) | (np.abs(np.abs(yy - cy) - np.abs(xx - cx)) < 2))
    bg = np.median(a[r > 0.45 * H])
    G = float(np.clip(a[out] - bg, 0, None).sum()); S = float(np.clip(a[spike] - bg, 0, None).sum())
    r50 = float(np.sqrt(((a - bg) > 0.5).sum() / np.pi))      # radius of the ≥ 50 % white blob (px)
    rows.append({'au': au, 'fov': fov, 'mode': mode, 'rpx': sg.get('rpx'), 'EV': j.get('exposureEV'), 'halo': sg.get('halo'), 'veil': sg.get('veil'),
                 'F_rel': round(1 / au ** 2, 3), 'G': round(G, 1), 'spikeFrac': round(S / max(G, 1e-9), 3), 'blob50_px': round(r50, 1)})
rows.sort(key=lambda r: (r['mode'], r['fov'], r['au']))
json.dump(rows, open(os.path.join(d, 'glare-audit.json'), 'w'), indent=1)
print(f"{'mode':5} {'fov':>3} {'AU':>5} {'rpx':>6} {'EV':>7} {'halo':>7} {'F':>6} {'G':>9} {'spk':>5} {'blob':>5}")
for r in rows: print(f"{r['mode']:5} {r['fov']:>3} {r['au']:>5} {r['rpx']!s:>6} {r['EV']!s:>7} {r['halo']!s:>7} {r['F_rel']:>6} {r['G']:>9} {r['spikeFrac']:>5} {r['blob50_px']:>5}")
