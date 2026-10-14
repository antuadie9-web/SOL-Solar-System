# QA-381-02: scene-linear integrated signal from an 8-bit capture: sRGB decode, then the inverse of three's Khronos PBR
# Neutral tone map. Neutral subtracts an offset set by the MIN channel (x_min − 6.25·x_min² below 0.08, else 0.04) from all
# channels, then compresses the max channel above 0.76 (newPeak = 1 − d²/(peak + d − 0.76), d = 0.24) with a small
# desaturation (ignored here: < 2 % on these captures). Plain sRGB sums under-weight dim pixels several-fold.
import numpy as np
from PIL import Image
S, D = 0.76, 0.24
def lin(v): v = v / 255; return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
def inv_neutral(y):
  y = np.clip(y, 0, 0.999)
  p = y.max(-1, keepdims=True)
  pk = np.where(p > S, D * D / (1 - p) - D + S, p)           # undo the shoulder on the peak channel
  y = y * np.where(p > 0, pk / np.maximum(p, 1e-12), 1)
  ym = y.min(-1, keepdims=True)
  xm = np.where(ym < 0.04, np.sqrt(ym / 6.25), ym + 0.04)    # min channel: y = 6.25x² (x < 0.08) or x − 0.04
  return y + (xm - ym)                                       # same offset added back to every channel
def scene(f): return inv_neutral(lin(np.asarray(Image.open(f).convert('RGB')).astype(float)))
def isum(f): a = scene(f).mean(2); return float((a - np.median(a)).clip(0).sum())
def peak8(f): return int(np.asarray(Image.open(f).convert('RGB')).max())
