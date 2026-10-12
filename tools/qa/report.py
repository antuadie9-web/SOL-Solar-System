#!/usr/bin/env python3
"""Matched v3.4 → v3.5 metric table (markdown) from two metrics.json files (tools/qa/metrics.py).
Usage: python3 tools/qa/report.py BASE/metrics.json NEW/metrics.json [NEW2/metrics.json ...]"""
import sys, json
base = {r['view']: r for r in json.load(open(sys.argv[1]))}
new = {}
for p in sys.argv[2:]:
    for r in json.load(open(p)): new[r['view']] = r
print('| View | clip % v3.4 → v3.5 | disc median v3.4 → v3.5 | sky mean v3.4 → v3.5 | stars v3.4 → v3.5 |')
print('|---|---|---|---|---|')
for v in sorted(new):
    n = new[v]; b = base.get(v)
    f = lambda k, d=1: (f"{b[k]:.{d}f} → {n[k]:.{d}f}" if b else f"— → {n[k]:.{d}f}")
    s = (f"{b['stars']} → {n['stars']}" if b else f"— → {n['stars']}")
    print(f"| {v} | {f('clip_pct', 3)} | {f('disc_p50')} | {f('bg_mean', 2)} | {s} |")
