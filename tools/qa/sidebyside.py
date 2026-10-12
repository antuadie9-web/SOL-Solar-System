#!/usr/bin/env python3
"""Labelled side-by-side comparison sheets: v3.3 | v3.4 for every view captured in both folders (same harness, epoch,
camera, exposure settle, software adapter).  Usage: python3 tools/qa/sidebyside.py BASE NEW OUT [LABEL_A] [LABEL_B]"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
base, new, out = sys.argv[1:4]
LA = sys.argv[4] if len(sys.argv) > 4 else 'v3.3.0'
LB = sys.argv[5] if len(sys.argv) > 5 else 'v3.4.0'
os.makedirs(out, exist_ok=True)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
except Exception:
    font = ImageFont.load_default()
views = sorted(f for f in os.listdir(new) if f.endswith('.png') and os.path.exists(os.path.join(base, f)))
for f in views:
    a, b = Image.open(os.path.join(base, f)).convert('RGB'), Image.open(os.path.join(new, f)).convert('RGB')
    if a.size != b.size: a = a.resize(b.size)
    W, H = b.size
    c = Image.new('RGB', (W * 2 + 8, H + 40), (20, 20, 24)); c.paste(a, (0, 40)); c.paste(b, (W + 8, 40))
    d = ImageDraw.Draw(c)
    d.text((12, 8), f'{LA}  ·  {f[:-4]}', fill=(230, 230, 230), font=font)
    d.text((W + 20, 8), f'{LB}  ·  {f[:-4]}   (software WebGPU, same camera/epoch)', fill=(230, 230, 230), font=font)
    c.resize((W, (H + 40) // 2)).save(os.path.join(out, f[:-4] + '.jpg'), quality=88)
print(len(views), 'comparison sheets →', out)
