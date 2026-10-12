import sys
from PIL import Image, ImageDraw, ImageFont
# usage: sheet.py out.png title "label::pathA::pathB" ...  (A = v3.8.0 baseline, B = v3.8.1 candidate); env LABELS="A|B" overrides
import os
out, title, rows = sys.argv[1], sys.argv[2], sys.argv[3:]
la, lb = (os.environ.get('LABELS') or 'v3.8.0 (baseline)|v3.8.1 (candidate)').split('|')
W = 760; H = int(W * 9 / 16); pad = 34
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18); fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
S = Image.new('RGB', (2 * W + 30, 66 + len(rows) * (H + pad)), (14, 14, 18)); d = ImageDraw.Draw(S)
d.text((10, 10), title, fill=(235, 235, 240), font=fb)
d.text((10, 40), la, fill=(170, 170, 180), font=f); d.text((W + 20, 40), lb, fill=(240, 200, 140), font=f)
for i, r in enumerate(rows):
    lab, a, b = r.split('::'); y = 66 + i * (H + pad)
    for j, p in enumerate((a, b)):
        try: S.paste(Image.open(p).convert('RGB').resize((W, H), Image.LANCZOS), (10 + j * (W + 10), y))
        except Exception: d.text((10 + j * (W + 10), y + 20), 'missing ' + p, fill=(255, 80, 80), font=f)
    d.text((10, y + H + 4), lab, fill=(200, 200, 205), font=f)
S.save(out); print(out, S.size)
