#!/usr/bin/env python3
"""Machine-readable source / asset / science-data inventory (master spec §0 discipline item 1).
Writes docs/inventory/{files,textures,models,data,source}.json. Re-run after any asset change:  python3 tools/validate/inventory.py
Texture coverage: fraction of pixels darker than 15/255 (mean RGB) on a 512-px downsample — a NO-DATA indicator to
investigate, not proof that a surface is dark."""
import hashlib, json, os, re, struct
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SKIP = {'node_modules', 'dist', '.cache', 'qa-out', '.git'}
out = lambda name, obj: json.dump(obj, open(os.path.join(ROOT, 'docs/inventory', name), 'w'), indent=1)
files = []
for d, dirs, fs in os.walk(ROOT):
    dirs[:] = [x for x in dirs if x not in SKIP]
    for f in fs:
        p = os.path.join(d, f); rel = os.path.relpath(p, ROOT)
        h = hashlib.sha256(open(p, 'rb').read()).hexdigest()
        files.append({'path': rel, 'bytes': os.path.getsize(p), 'sha256': h})
files.sort(key=lambda x: x['path']); out('files.json', {'count': len(files), 'totalBytes': sum(f['bytes'] for f in files), 'files': files})
# textures
tex = []
for f in sorted(os.listdir(os.path.join(ROOT, 'public/assets/tex'))):
    p = os.path.join(ROOT, 'public/assets/tex', f); im = Image.open(p); w, h = im.size
    sm = im.convert('RGB'); sm.thumbnail((512, 256)); px = list(sm.getdata())
    dark = sum(1 for r, g, b in px if (r + g + b) / 3 < 15) / len(px)
    mean = [round(sum(c[i] for c in px) / len(px), 1) for i in range(3)]
    tex.append({'file': f, 'w': w, 'h': h, 'mode': im.mode, 'bytes': os.path.getsize(p), 'estGpuMiB_rgba8_mips': round(w * h * 4 * 4 / 3 / 2**20, 1), 'nearBlackFraction': round(dark, 3), 'meanRGB': mean})
out('textures.json', {'count': len(tex), 'estGpuMiBAll': round(sum(t['estGpuMiB_rgba8_mips'] for t in tex), 1), 'textures': tex})
# GLB models: parse the JSON chunk only
models = []
for f in sorted(os.listdir(os.path.join(ROOT, 'public/assets/models'))):
    b = open(os.path.join(ROOT, 'public/assets/models', f), 'rb').read()
    ln = struct.unpack('<I', b[12:16])[0]; g = json.loads(b[20:20 + ln])
    prims = [p for m in g.get('meshes', []) for p in m['primitives']]
    verts = sum(g['accessors'][p['attributes']['POSITION']]['count'] for p in prims)
    models.append({'file': f, 'meshes': len(g.get('meshes', [])), 'primitives': len(prims), 'nodes': len(g.get('nodes', [])), 'materials': len(g.get('materials', [])),
                   'textures': len(g.get('textures', [])), 'vertices': verts, 'hasUV': any('TEXCOORD_0' in p['attributes'] for p in prims), 'hasNormals': all('NORMAL' in p['attributes'] for p in prims),
                   'generator': g.get('asset', {}).get('generator'), 'copyright': g.get('asset', {}).get('copyright')})
cat = open(os.path.join(ROOT, 'src/data/catalog.ts')).read()
wired = set(re.findall(r"model: '([^']+)'", cat))
for m in models: m['wiredInCatalog'] = m['file'][:-4] in wired
out('models.json', {'count': len(models), 'models': models})
# data schemas
data = {}
dd = os.path.join(ROOT, 'public/assets/data')
for f in sorted(os.listdir(dd)):
    p = os.path.join(dd, f)
    if os.path.isdir(p): continue
    e = {'bytes': os.path.getsize(p)}
    if f.endswith('.bin'):
        stride = {'stars.bin': 5, 'smallbodies.bin': 10}.get(f); n = os.path.getsize(p) // 4
        e.update({'type': 'float32 records', 'stride': stride, 'records': n // stride if stride else None,
                  'fields': {'stars.bin': ['x', 'y', 'z (ICRS unit vector)', 'V mag', 'B−V'], 'smallbodies.bin': ['a AU', 'e', 'i deg', 'Ω deg', 'ω deg', 'M deg', 'epoch (JD−2451545)', 'H', 'diameter km', 'class']}.get(f)})
    else:
        j = json.load(open(p)); e.update({'type': type(j).__name__, 'entries': len(j) if hasattr(j, '__len__') else None})
    src = open(os.path.join(ROOT, 'src/main.ts')).read()
    e['loadedAtRuntime'] = f in src
    data[f] = e
out('data.json', data)
# source modules
src = []
for d, dirs, fs in os.walk(os.path.join(ROOT, 'src')):
    for f in fs:
        p = os.path.join(d, f); t = open(p).read()
        src.append({'path': os.path.relpath(p, ROOT), 'lines': t.count('\n') + 1, 'tsNocheck': '@ts-nocheck' in t, 'imports': sorted(set(re.findall(r"from '([^']+)'", t)))})
src.sort(key=lambda x: x['path']); out('source.json', {'count': len(src), 'tsNocheck': [s['path'] for s in src if s['tsNocheck']], 'modules': src})
print('files', len(files), 'textures', len(tex), 'models', len(models), 'source', len(src))
