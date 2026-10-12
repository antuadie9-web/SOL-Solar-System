#!/usr/bin/env python3
"""SOL v3.8 — refine the 3-D positions of the nearest stars from Gaia DR3 parallaxes (spec §21, §24).

Finding (v3.8 audit): the v3.4 stars3d build took GCNS `Dist50` posterior medians that VizieR tabulates to 0.01 pc, so every
star's distance is quantised to 0.01 pc (≈ 2,000 AU) — Proxima Centauri sat at 1.3000 pc instead of 1/ϖ = 1.30197 pc. For a
true-scale interstellar journey that is a 400-AU error in the destination. Within 20 pc every Gaia DR3 parallax with
ϖ/σϖ > 10 gives 1/ϖ distances good to < 1 % (here typically < 0.01 %), so the inverse parallax is used there (no prior needed).

Input : tools/ingest/queries/gaia_dr3_parallax_gt50mas.csv — Gaia Archive TAP query (gaiadr3.gaia_source, parallax > 50 mas AND
        parallax_over_error > 10; 2,626 rows; run 2026-10-10):
        SELECT source_id, ra, dec, parallax, parallax_error, pmra, pmdec, radial_velocity, radial_velocity_error,
               phot_g_mean_mag, bp_rp, ruwe, ref_epoch FROM gaiadr3.gaia_source WHERE parallax > 50 AND parallax_over_error > 10
Match : catalogue row whose J2016 direction is within 5″ and whose distance agrees within 0.02 pc (one Gaia source → one
        row; ambiguous matches skipped). Direction is kept from the row (same astrometry), the distance becomes 1000/ϖ, the
        absolute magnitude is recomputed from G, σd/d = σϖ/ϖ, and flag bit 4 (16) records the refinement.
Output: rewrites the affected shard files, their SHA-256/bytes in index.json, and named-rows.bin (+ sha) consistently.
Credit: Gaia Collaboration, Vallenari et al. 2023, A&A 674, A1 (Gaia DR3); data CC BY-SA 3.0 IGO.
"""
import csv, json, math, hashlib, sys, os
import numpy as np
BASE = 'public/assets/catalogs/stars'
EPS = math.radians(23.4392911)
def ecl_dir(ra, dec):
    ra, dec = math.radians(ra), math.radians(dec)
    x, y, z = math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec)
    return np.array([x, math.cos(EPS) * y + math.sin(EPS) * z, -math.sin(EPS) * y + math.cos(EPS) * z])
def main():
    idx = json.load(open(f'{BASE}/index.json'))
    rows = np.zeros((idx['count'], 10), dtype='<f4')
    for sh in idx['shards']:
        b = np.fromfile(f"{BASE}/{sh['file']}", dtype='<f4').reshape(-1, 10); rows[sh['firstRow']:sh['firstRow'] + len(b)] = b
    d = np.linalg.norm(rows[:, :3].astype(np.float64), axis=1); u = rows[:, :3] / np.maximum(d, 1e-12)[:, None]
    near = np.where(d < 25)[0]
    gaia = list(csv.DictReader(open('tools/ingest/queries/gaia_dr3_parallax_gt50mas.csv')))
    used, changed, report = set(), [], []
    for g in gaia:
        plx = float(g['parallax']); dist = 1000.0 / plx; v = ecl_dir(float(g['ra']), float(g['dec']))
        cosang = u[near] @ v; j = np.argmax(cosang); i = int(near[j])
        sep = math.degrees(math.acos(min(1.0, float(cosang[j])))) * 3600
        if sep > 5 or abs(d[i] - dist) > 0.02 or i in used or not g['phot_g_mean_mag']: continue
        used.add(i)
        old = float(d[i]); G = float(g['phot_g_mean_mag'])
        rows[i, :3] = (u[i] * dist).astype('<f4')
        rows[i, 6] = G - 5 * math.log10(dist / 10)
        rows[i, 8] = float(int(rows[i, 8]) | 16)
        rows[i, 9] = float(g['parallax_error']) / plx
        changed.append(i); report.append((g['source_id'], i, old, dist, sep))
    # rewrite shards
    touched = 0
    for sh in idx['shards']:
        a, n = sh['firstRow'], sh['count']
        if not any(a <= i < a + n for i in changed): continue
        buf = rows[a:a + n].tobytes(); open(f"{BASE}/{sh['file']}", 'wb').write(buf)
        sh['sha256'] = hashlib.sha256(buf).hexdigest(); sh['bytes'] = len(buf); touched += 1
    idx.setdefault('refinements', []).append({'v3.8': f'{len(changed)} rows within 20 pc: distance = 1/parallax from Gaia DR3 (ϖ/σϖ > 10); flag bit 4 (16); tools/ingest/gaia_nearby_refine.py',
                                              'source': 'Gaia DR3 (Gaia Collaboration, Vallenari et al. 2023, A&A 674, A1), Gaia Archive TAP 2026-10-10'})
    json.dump(idx, open(f'{BASE}/index.json', 'w'), indent=1, ensure_ascii=False)
    named = json.load(open(f'{BASE}/named.json')); nrm = json.load(open(f'{BASE}/named-rows.json'))
    for n in named: n['distPc'] = round(float(np.linalg.norm(rows[n['index'], :3].astype(np.float64))), 5)
    nr = np.stack([rows[n['index']] for n in named]).astype('<f4').tobytes()
    open(f'{BASE}/named-rows.bin', 'wb').write(nr); nrm['sha256'] = hashlib.sha256(nr).hexdigest(); nrm['count'] = len(named)
    json.dump(named, open(f'{BASE}/named.json', 'w'), ensure_ascii=False); json.dump(nrm, open(f'{BASE}/named-rows.json', 'w'), ensure_ascii=False)
    os.makedirs('docs/inventory', exist_ok=True)
    with open('docs/inventory/gaia-nearby-refinement-v38.csv', 'w') as f:
        f.write('gaia_dr3_source_id,row,gcns_dist_pc,gaia_inv_parallax_pc,match_sep_arcsec\n')
        for r in report: f.write(f'{r[0]},{r[1]},{r[2]:.5f},{r[3]:.6f},{r[4]:.3f}\n')
    print(f'refined {len(changed)} of {len(gaia)} Gaia sources; shards rewritten {touched}')
if __name__ == '__main__': main()
