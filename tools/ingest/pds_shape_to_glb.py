#!/usr/bin/env python3
"""SOL v3.8: convert a PDS vertex-facet ("ver*q.tab") shape model into a minimal binary glTF (positions + triangle indices).
Coordinates are kept in the source body-fixed frame and kilometres (the engine centres and normalises the mesh and
scales it by the catalogue radii); normals are computed at load. Usage: pds_shape_to_glb.py in.tab out.glb
Format: "Nv Nf" (or "Nv", then after the vertices a line "Nf"), Nv lines "i x y z" (km), Nf lines "i v1 v2 v3" (1-based)."""
import sys, struct, json
src, dst = sys.argv[1], sys.argv[2]
L = [l for l in open(src).read().split('\n') if l.strip()]; h = L[0].split()
if len(h) >= 2: nv, nf = int(h[0]), int(h[1]); fo = 1 + nv          # "Nv Nf" header (Itokawa PDS3; Thomas Saturn moons PDS4)
else: nv = int(h[0]); nf = int(L[1 + nv].split()[0]); fo = 2 + nv   # "Nv" … "Nf" (Phoebe PDS4)
# v3.8.1: Thomas et al. Saturn small-moon "*_plt.tab" (urn:nasa:pds:saturn_satellite_shape_models) has NO index column:
# vertex lines "x y z" (km) and 0-based facet lines "v1 v2 v3"
plt = len(L[1].split()) == 3
V = [tuple(map(float, (L[1 + i].split() if plt else L[1 + i].split()[1:4]))) for i in range(nv)]
F = [tuple(int(x) - (0 if plt else 1) for x in (L[fo + j].split() if plt else L[fo + j].split()[1:4])) for j in range(nf)]
assert all(0 <= k < nv for f in F for k in f), 'facet index out of range'
pos = b''.join(struct.pack('<3f', *v) for v in V); idx = b''.join(struct.pack('<3I', *f) for f in F)
mn = [min(v[k] for v in V) for k in range(3)]; mx = [max(v[k] for v in V) for k in range(3)]
pad = lambda b, c=b'\0': b + c * ((4 - len(b) % 4) % 4)
binb = pad(pos) + pad(idx)
gl = {'asset': {'version': '2.0', 'generator': 'SOL tools/ingest/pds_shape_to_glb.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0}],
      'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1}]}],
      'buffers': [{'byteLength': len(binb)}],
      'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': len(pos), 'target': 34962}, {'buffer': 0, 'byteOffset': len(pad(pos)), 'byteLength': len(idx), 'target': 34963}],
      'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': nv, 'type': 'VEC3', 'min': mn, 'max': mx}, {'bufferView': 1, 'componentType': 5125, 'count': nf * 3, 'type': 'SCALAR'}]}
js = pad(json.dumps(gl).encode(), b' ')
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binb), 0x004E4942) + binb
open(dst, 'wb').write(out); print(dst, nv, 'vertices', nf, 'faces', 'extent km', [round(b - a, 4) for a, b in zip(mn, mx)])
