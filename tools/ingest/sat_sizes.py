#!/usr/bin/env python3
"""SOL v3.8 (DEF-38-008): sizes for the minor moons that the JPL satellite table ships without a radius.
Inputs (all in tools/ingest/queries/satsize/, fetched 2026-10-11):
  * horizons_satphys.json — JPL Horizons object-data pages (api/horizons.api OBJ_DATA) for every NAIF code in
    public/assets/data/satellites.json: 'Radius (km)' and V(1,0) where JPL publishes them.
  * wiki_Moons_of_{Jupiter,Saturn,Uranus,Neptune}.txt — raw wikitext of the Wikipedia moon lists, whose absolute-
    magnitude column is sourced from the Minor Planet Center natural-satellite data (MPC-NatSats) and whose
    diameters for small irregulars are Sheppard-style estimates from H with an assumed albedo.
Output: src/data/satSizes.json {code: {H, rJPL, rJPLapprox, dList, src}}. Precedence in the renderer: published triaxial
dimensions (smallMoons.ts) > JPL radius (not marked "~") > H with the moon's albedo > JPL "~" radius. The renderer derives the radius from H with the
moon's OWN albedo (measured or dynamical-group prior, src/data/smallMoons.ts): D = 1329 km / sqrt(pV) * 10^(-H/5).
Matching: same planet and semi-major axis within 0.6 % (names are not reliable across provisional designations)."""
import json, re, sys, os
Q = os.path.join(os.path.dirname(__file__), 'queries', 'satsize')
def clean(c):
    c = re.sub(r'<ref[^>]*/>', '', c); return re.sub(r'<ref[^>]*>.*?</ref>', '', c, flags=re.S)
def val(c):
    c = clean(c); m = re.search(r'\{\{(?:dsv|sort)\|([^|}]*)', c); s = m.group(1) if m else c
    s = s.replace('{{val|', '').replace(',', '').replace('−', '-'); m = re.search(r'-?\d+(?:\.\d+)?', s); return float(m.group(0)) if m else None
rows = []
for P in ['Jupiter', 'Saturn', 'Uranus', 'Neptune']:
    t = open(os.path.join(Q, f'wiki_Moons_of_{P}.txt')).read()
    i = t.find('Absolute magnitude#Solar System bodies (H)'); tb = t[i:t.find('\n|}', i)]
    for row in re.split(r'\n\|-', tb)[1:]:
        head, _, body = row.partition('\n'); idm = re.search(r'id="([^"]+)"', head); cells = []
        for line in body.split('\n'):
            if not line.startswith('|'):
                if cells: cells[-1] += ' ' + line
                continue
            for c in line[1:].split('||'):
                cells.append(re.sub(r'^(?:style|class|rowspan|data-sort-value)="[^"]*"\s*\|', '', c.strip()).strip())
        if len(cells) < 8: continue
        rows.append({'planet': P, 'name': idm.group(1) if idm else cells[1], 'H': val(cells[4]), 'D': val(cells[5]), 'a': val(cells[7])})
sats = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'public/assets/data/satellites.json'))
hz = json.load(open(os.path.join(Q, 'horizons_satphys.json')))
out, nomatch = {}, []
for s in sats:
    if s.get('R'): continue
    c = str(s['code']); h = hz.get(c, {})
    cand = [r for r in rows if r['planet'] == s['planet'] and r['a'] and abs(r['a'] - s['a']) / s['a'] < 0.006]
    if len(cand) > 1:   # tie-break on the provisional/IAU name
        key = s['name'].replace('_', ' ').lower(); cand = sorted(cand, key=lambda r: 0 if key in r['name'].lower() else 1)
    r = cand[0] if cand else None
    if not r and not h.get('radius'): nomatch.append(s['name']); continue
    Hl = (r or {}).get('H'); Hl = Hl if Hl is not None and Hl < 50 else None   # 99 = sort placeholder for unmeasured H
    out[c] = {'name': s['name'], 'H': (h.get('V10') if h.get('V10') is not None else Hl),
              'rJPL': h.get('radius'), 'rJPLapprox': bool(h.get('approx')), 'dList': (r or {}).get('D'),
              'src': ('JPL Horizons radius' if h.get('radius') else 'H: ' + ('JPL V(1,0)' if h.get('V10') is not None else 'MPC (Wikipedia list)'))}
json.dump(out, open('src/data/satSizes.json', 'w'), indent=0, sort_keys=True)
print('sized', len(out), 'of', sum(1 for s in sats if not s.get('R')), 'unmatched', nomatch)
