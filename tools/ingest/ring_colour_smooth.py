#!/usr/bin/env python3
"""SOL v3.8 (PERF-008): precompute the smoothed Saturn ring colour once, offline.
v3.7 ran this in the browser inside engine.getView('saturn'): drawImage + getImageData on a 2-D canvas forced a synchronous
GPU readback — 9.6–12.2 s of main-thread time on the software adapter (cpuprofile, docs/qa/v3.8) the first time Saturn was
resolved. Same algorithm as src/render/ringSystem.ts smoothRingColour(): alpha-weighted box of ±300 km over the middle row,
1024 samples between 69,570 and 140,240 km; output RGBA8 (sRGB colour, alpha = coverage). Input: assets/tex/saturn_ring.png
(Solar System Scope, CC BY 4.0 — colour only, never optical depth)."""
from PIL import Image
im = Image.open('public/assets/tex/saturn_ring.png').convert('RGBA'); w, h = im.size
px = [im.getpixel((x, h // 2)) for x in range(w)]
N, box = 1024, 300; kmPer = (140240 - 69570) / w; k = max(1, round(box / kmPer / 2))
out = bytearray()
for i in range(N):
    x = int((i + 0.5) / N * w); r = g = b = a = 0.0
    for j in range(max(0, x - k), min(w - 1, x + k) + 1):
        A = px[j][3] / 255; r += px[j][0] * A; g += px[j][1] * A; b += px[j][2] * A; a += A
    s = 1 / a if a > 1e-3 else 0
    out += bytes([min(255, int(r * s)), min(255, int(g * s)), min(255, int(b * s)), min(255, int(a / (2 * k + 1) * 255))])
open('public/assets/tex/saturn_ring_colour_1024.rgba', 'wb').write(out); print(len(out), 'bytes')
