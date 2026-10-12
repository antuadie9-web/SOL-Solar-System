#!/usr/bin/env python3
"""SOL v3.7 ring optical-depth profiles from the PDS Ring-Moon Systems Node (Voyager 2 PPS, VG_2801 EASYDATA/KM001).
Input: tools/ingest/raw/rings/PS1P01{07..14}.TAB (Saturn δ Sco, 72,000–142,500 km), PU1P01XI.TAB (Uranus σ Sgr ingress,
equatorial geometry, 48,000–53,595 km). Columns: radius km, signal, σ, normal τ, τ_lo, τ_hi (70 % CI).
Output: public/assets/rings/<body>_tau_pps_1km.u16 — uint16 LE, τ × 10⁴ per 1 km sample, clamped to [0, cap]
(negative τ = noise below zero opacity → 0; PPS saturates in the B-ring core → cap 4.5, documented) + rings.json manifest."""
import glob, json, hashlib, os
import numpy as np
def read(files):
  rows = []
  for f in sorted(files):
    for line in open(f):
      p = line.split(',')
      if len(p) >= 6: rows.append([float(x) for x in p[:6]])
  a = np.array(rows); a = a[np.argsort(a[:, 0])]
  _, idx = np.unique(a[:, 0], return_index=True); return a[idx]
os.makedirs('public/assets/rings', exist_ok=True)
man = {}
for body, pat, cap in (('saturn', 'tools/ingest/raw/rings/PS1P01*.TAB', 4.5), ('uranus', 'tools/ingest/raw/rings/PU1P01XI.TAB', 4.0)):
  a = read(glob.glob(pat)); r = a[:, 0]; tau = np.clip(a[:, 3], 0, cap)
  assert np.all(np.diff(r) == 1.0), 'expect uniform 1 km grid'
  q = np.round(tau * 1e4).astype('<u2'); fn = f'public/assets/rings/{body}_tau_pps_1km.u16'; q.tofile(fn)
  sat = int((a[:, 3] >= cap).sum())
  def mean(lo, hi): m = (r >= lo) & (r < hi); return round(float(tau[m].mean()), 3) if m.any() else None
  man[body] = dict(file=os.path.basename(fn), r0=float(r[0]), dr=1.0, n=int(len(r)), encoding='uint16 LE, tau*1e4', cap=cap, saturatedSamples=sat,
    sha256=hashlib.sha256(q.tobytes()).hexdigest(),
    regionMeans=dict(C=mean(74658, 91975), B=mean(91975, 117507), CassiniDiv=mean(117507, 122340), A=mean(122340, 136780), Encke=mean(133410, 133735), F=mean(140150, 140250)) if body == 'saturn' else dict(delta=mean(48290, 48310), lam=mean(50020, 50030), eps=mean(51120, 51180)),
    source='PDS Ring-Moon Systems Node, VG_2801 (Voyager 2 PPS), EASYDATA/KM001', licence='NASA/PDS public domain')
  print(body, man[body])
# Uranus: kept for QA only (its equatorial-geometry cut misplaces the eccentric ε ring) — not shipped
if os.path.exists('public/assets/rings/uranus_tau_pps_1km.u16'): os.remove('public/assets/rings/uranus_tau_pps_1km.u16')
man['uranus']['shipped'] = False
json.dump(man, open('public/assets/rings/rings.json', 'w'), indent=1)
