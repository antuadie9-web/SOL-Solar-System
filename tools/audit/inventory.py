"""GA-INV: classify every tracked file (git ls-files) and validate binaries structurally. Output: docs/v3.8.1/audit/inventory.json
+ a summary table printed as Markdown. Classes: source-ts, shader-in-ts, test, tool, doc, sci-data, imagery, geometry, font, config, other."""
import json, os, subprocess, struct, zlib, gzip, hashlib
from collections import defaultdict
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', '..'); os.chdir(ROOT)
files = subprocess.run(['git', 'ls-files', '-z'], capture_output=True, text=True).stdout.split('\0')[:-1]
def cls(f):
    e = os.path.splitext(f)[1].lower()
    if f.startswith('tests/'): return 'test'
    if f.startswith('tools/'): return 'tool'
    if f.startswith('src/') and e in ('.ts', '.tsx', '.js'): return 'source'
    if f.startswith('src/') and e == '.json': return 'sci-data (bundled)'
    if f.startswith('docs/') or e in ('.md', '.pdf', '.txt') : return 'doc' if not e in ('.png', '.jpg', '.webp') else 'doc-image'
    if e in ('.jpg', '.jpeg', '.png', '.webp', '.ktx2', '.exr', '.hdr'): return 'imagery'
    if e == '.i16z': return 'terrain DEM tiles'
    if e in ('.glb', '.gltf', '.obj', '.ply'): return 'geometry'
    if e in ('.woff', '.woff2', '.ttf', '.otf'): return 'font'
    if e in ('.bin', '.r8gz', '.gz', '.f32', '.i16', '.u16') or (e == '.json' and 'public/' in f): return 'sci-data (runtime)'
    if e in ('.json', '.yml', '.yaml', '.toml', '.html', '.css', '.cjs', '.mjs', '.ts') or os.path.basename(f).startswith('.'): return 'config/app'
    return 'other'
rows, agg = [], defaultdict(lambda: [0, 0])
bad = []
for f in files:
    if not os.path.exists(f): continue
    sz = os.path.getsize(f); c = cls(f); agg[c][0] += 1; agg[c][1] += sz
    r = {'path': f, 'class': c, 'bytes': sz}
    e = os.path.splitext(f)[1].lower()
    try:
        if e in ('.jpg', '.jpeg', '.png', '.webp'):
            with Image.open(f) as im: im.verify()
            with Image.open(f) as im: r['dims'] = im.size; r['mode'] = im.mode
        elif e == '.glb':
            b = open(f, 'rb').read(12); assert b[:4] == b'glTF', 'magic'; r['glbVersion'], r['glbLen'] = struct.unpack('<II', b[4:12]); assert r['glbLen'] == sz, 'length'
        elif e == '.json':
            json.load(open(f, encoding='utf8'))
        elif e in ('.r8gz', '.gz'):
            with gzip.open(f) as g: n = len(g.read()); r['decoded'] = n
        elif e == '.i16z':
            raw = open(f, 'rb').read()
            try: n = len(zlib.decompress(raw))
            except Exception: n = len(gzip.decompress(raw))
            assert n % 2 == 0, 'odd int16 length'; r['decoded'] = n
        elif e == '.pdf':
            assert open(f, 'rb').read(5) == b'%PDF-', 'pdf magic'
    except Exception as ex:
        r['error'] = str(ex)[:120]; bad.append(r)
    rows.append(r)
os.makedirs('docs/v3.8.1/audit', exist_ok=True)
json.dump({'commit': subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip(), 'files': len(rows), 'byClass': {k: {'files': v[0], 'bytes': v[1]} for k, v in agg.items()}, 'invalid': bad, 'rows': rows}, open('docs/v3.8.1/audit/inventory.json', 'w'), indent=0)
print('| Class | Files | MB |\n|---|---:|---:|')
for k, v in sorted(agg.items(), key=lambda x: -x[1][1]): print(f'| {k} | {v[0]} | {v[1] / 1e6:.1f} |')
print(f'\ninvalid/undecodable: {len(bad)}'); [print(' ', b['path'], b['error']) for b in bad[:20]]
