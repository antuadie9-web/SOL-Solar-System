#!/usr/bin/env python3
"""SOL v3.7 review packaging: sorts captured PNG+JSON pairs into the seven review archives (spec §38), writes contact sheets
and SOL_V37_IMAGE_INDEX.md. Usage: python3 tools/qa/package37.py <capture-root> <ui-dir> <before-dir> <v36-qa-dir> <outdir>"""
import sys, os, glob, json, zipfile, re
from PIL import Image, ImageDraw
root, uidir, before, v36qa, out = sys.argv[1:6]
os.makedirs(out, exist_ok=True)
shots = {}
for p in sorted(glob.glob(os.path.join(root, '*', '*.png'))):
    n = os.path.basename(p)[:-4]
    if n == 'final': continue
    shots[n] = p                       # later dirs win (re-captures)
for p in sorted(glob.glob(os.path.join(uidir, '*.png'))):
    n = os.path.basename(p)[:-4]
    if n != 'final': shots[n] = p
ATM_BODIES = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'titan', 'triton', 'pluto', 'io', 'enceladus']
def cat(n):
    if n.startswith('seq-'): return 'SEQ'
    if n.startswith('ui-'): return 'UI'
    if re.match(r'^(sat|jup|ura|nep|chariklo|haumea|quaoar)-', n) or n in ('ring-flythrough', 'saturn-backlit'): return 'RINGS'
    if n.startswith(('moon', 'mars-terrain', 'mars-gale', 'mars-candor', 'mars-olympus', 'mars-jezero', 'mars-orbit')): return 'TERRAIN'
    if any(n.startswith(b + '-') for b in ATM_BODIES) or n in ('mars', 'venus', 'titan', 'jupiter', 'mars-crescent', 'mars-night', 'mars-polar', 'mars-limb'): return 'ATMOS'
    return 'UI'
ARCH = {'RINGS': 'SOL_V37_RING_SYSTEM_IMAGES', 'ATMOS': 'SOL_V37_ATMOSPHERE_IMAGES', 'TERRAIN': 'SOL_V37_TERRAIN_AND_EXPLORATION_IMAGES', 'UI': 'SOL_V37_UI_AND_GENERAL_IMAGES', 'SEQ': 'SOL_V37_DIAGNOSTIC_AND_SEQUENCE_FRAMES'}
groups = {k: [] for k in ARCH}
for n, p in shots.items(): groups[cat(n)].append(n)
def sheet(names, title, fn, cols=4, w=480):
    h = w * 9 // 16; rows = (len(names) + cols - 1) // cols
    S = Image.new('RGB', (cols * w, rows * (h + 18) + 30), (10, 10, 14)); d = ImageDraw.Draw(S); d.text((8, 8), title, fill=(230, 230, 230))
    for i, n in enumerate(names):
        im = Image.open(shots[n]).convert('RGB').resize((w, h)); x, y = (i % cols) * w, 30 + (i // cols) * (h + 18)
        S.paste(im, (x, y + 18)); d.text((x + 4, y + 3), n, fill=(240, 200, 120))
    S.save(fn, quality=86)
def fixmeta(j):
    m = json.load(open(j))
    # v3.7 captures were made from the v3.7 branch before package.json was bumped; the build constant then read 3.6.0
    if m.get('version') in ('3.6.0', None): m['version'] = '3.7.0-pre (v3.7 branch build; build constant read 3.6.0 before the version bump)'
    return json.dumps(m, indent=1)
def meta(n):
    j = shots[n][:-4] + '.json'
    try: return json.load(open(j))
    except Exception: return {}
idx = ['# SOL_V37_IMAGE_INDEX', '', 'Every capture (native 1600×900, Chromium 154 + SwiftShader software WebGPU — not real-GPU evidence), its archive, and key metadata. Each PNG has a sidecar JSON with the full record (camera position/orientation, distance, altitude, FOV, sim time, mode, phase angle, quality, exposure, tone map, LOD, ring tier/source, atmosphere source, enhancement, adapter).', '']
for k, an in ARCH.items():
    names = sorted(groups[k]); 
    if not names: continue
    sh = os.path.join(out, f'{an}_contact.jpg')
    # contact sheets in pages of 24
    pages = [names[i:i + 24] for i in range(0, len(names), 24)]
    sheets = []
    for pi, pg in enumerate(pages):
        f = os.path.join(out, f'{an}_contact_{pi + 1:02d}.jpg'); sheet(pg, f'{an} — page {pi + 1}/{len(pages)} (software WebGPU)', f); sheets.append(f)
    with zipfile.ZipFile(os.path.join(out, an + '.zip'), 'w', zipfile.ZIP_STORED) as z:
        for n in names:
            z.write(shots[n], f'{an}/{n}.png'); j = shots[n][:-4] + '.json'
            if os.path.exists(j): z.writestr(f'{an}/{n}.json', fixmeta(j))
        for f in sheets: z.write(f, f'{an}/{os.path.basename(f)}')
    idx += [f'## {an}.zip — {len(names)} images', '', '| Image | Object | Mode | Distance (km) | Phase ° | Ring tier | Enhancement | Notes |', '|---|---|---|---|---|---|---|---|']
    for n in names:
        m = meta(n); cam = m.get('camera', {}); rg = m.get('rings') or {}; en = m.get('enhancement') or {}
        e = []
        if en.get('rings'): e.append(f"rings ×{en['rings']['gain']:.0f}")
        if en.get('inspect'): e.append('inspection light')
        if en.get('plumes'): e.append('plumes ×4')
        req = m.get('request') or {}
        note = ('jdOff ' + str(req.get('jdOff'))) if isinstance(req, dict) and req.get('jdOff') else ''
        idx.append(f"| {n} | {m.get('object', m.get('selected', ''))} | {m.get('viewingMode', '')} | {cam.get('distanceKm', 0):.4g} | {m.get('phaseAngleDeg', 0) or 0:.1f} | {rg.get('tier', '')} | {', '.join(e)} | {note} |")
    idx.append('')
# before/after: v3.6 (before dir) vs v3.7 same names
pairs = sorted(n for n in (os.path.basename(p)[:-4] for p in glob.glob(os.path.join(before, '*.png'))) if n in shots and n != 'final')
if pairs:
    w, h = 640, 360; S = Image.new('RGB', (2 * w + 30, len(pairs) * (h + 22) + 40), (10, 10, 14)); d = ImageDraw.Draw(S)
    d.text((10, 10), 'SOL v3.6.0 (left) vs v3.7.0 (right) — identical golden37 camera/time/mode, software WebGPU', fill=(230, 230, 230))
    for i, n in enumerate(pairs):
        y = 40 + i * (h + 22); d.text((10, y), n, fill=(240, 200, 120))
        S.paste(Image.open(os.path.join(before, n + '.png')).convert('RGB').resize((w, h)), (10, y + 18)); S.paste(Image.open(shots[n]).convert('RGB').resize((w, h)), (20 + w, y + 18))
    S.save(os.path.join(out, 'v3.6-vs-v3.7-matched.jpg'), quality=86)
    with zipfile.ZipFile(os.path.join(out, 'SOL_V36_V37_BEFORE_AFTER_COMPARISONS.zip'), 'w', zipfile.ZIP_STORED) as z:
        z.write(os.path.join(out, 'v3.6-vs-v3.7-matched.jpg'), 'BEFORE_AFTER/v3.6-vs-v3.7-matched.jpg')
        for n in pairs:
            z.write(os.path.join(before, n + '.png'), f'BEFORE_AFTER/v3.6/{n}.png'); z.write(shots[n], f'BEFORE_AFTER/v3.7/{n}.png')
            j = shots[n][:-4] + '.json'
            if os.path.exists(j): z.writestr(f'BEFORE_AFTER/v3.7/{n}.json', fixmeta(j))
        v35 = os.path.join(v36qa, 'compare', 'v3.5-vs-v3.6-matched.jpg')
        if os.path.exists(v35): z.write(v35, 'BEFORE_AFTER/v3.5-vs-v3.6-matched.jpg')
    idx += [f'## SOL_V36_V37_BEFORE_AFTER_COMPARISONS.zip — {len(pairs)} matched pairs', '', ', '.join(pairs), '']
open(os.path.join(out, 'SOL_V37_IMAGE_INDEX.md'), 'w').write('\n'.join(idx) + '\n')
print({k: len(v) for k, v in groups.items()}, 'pairs', len(pairs))
