#!/usr/bin/env python3
"""SOL v3.6 terrain tile pyramid builder (reusable for any body with an equirectangular DEM).

Lattice: level L has ppd = 4 * 2^L samples per degree; pixel centres at (i + 0.5)/ppd deg east of lon 0 and south of
lat +90 (nested: a level-L sample is the mean of its 2x2 level-(L+1) children). A tile is 240 x 240 samples
(60 / 2^L degrees) plus a 1-sample apron on every side (stored 242 x 242), so bilinear sampling never crosses a tile.
Storage: gzip(int16 LE metres relative to refRadiusKm), public/assets/terrain/<body>/t/<L>/<row>_<col>.i16z
  L0..L2 (4, 8, 16 ppd) are GLOBAL, built from the 16 ppd OBSERVED grid (LOLA LDEM_16 / MOLA MEGDR radius).
  L3..L6 (32 .. 256 ppd) exist only around regions fetched by terrain_fetch.py; coarser region levels are block means
  of the high-resolution data, with the 16 ppd grid (bilinear) filling any part of a tile outside the region.
Usage: terrain_tiles.py <body>
"""
import sys, os, gzip, json, hashlib, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from terrain_fetch import REGIONS, lattice, MOON, MARS
T = 240
BODY = {
  'moon': dict(ref=1737.4, src16='https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img', hi=MOON,
               hiNote='LRO LOLA global LDEM 118 m (256 ppd), USGS Astrogeology 2014 — exact lattice copy'),
  'mars': dict(ref=3396.0, src16='https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megr90n000eb.img', hi=MARS,
               hiNote='HRSC-MOLA Blended DEM 200 m v2 (Fergason, Hare & Laura 2018, USGS) — bilinear resample to 256/128 ppd, areoid heights converted to radius with MOLA MEGDR 16 ppd (megr − megt)'),
}
def main(body):
  B = BODY[body]
  g16 = np.fromfile(f'tools/ingest/raw/dem16/{body}.bin', '<i2').reshape(2880, 5760).astype(np.float32)
  out = f'public/assets/terrain/{body}'
  levels = {}
  def write(L, r, c, a):
    d = f'{out}/t/{L}'; os.makedirs(d, exist_ok=True)
    q = np.clip(np.round(a), -32768, 32767).astype('<i2')
    assert q.shape == (T + 2, T + 2)
    with open(f'{d}/{r}_{c}.i16z', 'wb') as f: f.write(gzip.compress(q.tobytes(), 9, mtime=0))
    levels.setdefault(L, []).append([r, c])
  def apron_grid(G, L):
    # G: full global grid at level L (rows 180*ppd/... ) -> tiles with wrap in lon, clamp in lat
    nr, nc = 3 * 2 ** L, 6 * 2 ** L
    P = np.concatenate([G[:, -1:], G, G[:, :1]], 1); P = np.concatenate([P[:1], P, P[-1:]], 0)
    for r in range(nr):
      for c in range(nc): write(L, r, c, P[r * T:r * T + T + 2, c * T:c * T + T + 2])
  # global levels
  g8 = g16.reshape(1440, 2, 2880, 2).mean((1, 3)); g4 = g8.reshape(720, 2, 1440, 2).mean((1, 3))
  for L, G in ((0, g4), (1, g8), (2, g16)): apron_grid(G, L)
  def g16_at(lat, lon):   # bilinear on the 16 ppd grid, lat/lon arrays (deg)
    gx = (lon % 360) * 16 - 0.5; gy = np.clip((90 - lat) * 16 - 0.5, 0, 2879 - 1e-6)
    jx, jy = np.floor(gx).astype(int), np.floor(gy).astype(int); ux, uy = gx - jx, gy - jy
    jy1 = np.minimum(jy + 1, 2879); a, b = jx % 5760, (jx + 1) % 5760
    return (g16[jy][:, a] * (1 - ux)[None] * (1 - uy)[:, None] + g16[jy][:, b] * ux[None] * (1 - uy)[:, None]
            + g16[jy1][:, a] * (1 - ux)[None] * uy[:, None] + g16[jy1][:, b] * ux[None] * uy[:, None])
  regions = []
  hi = {n: (lattice(n), np.load(f'tools/ingest/raw/hires/{n}.npy')) for n, v in REGIONS.items() if v[0] == body and os.path.exists(f'tools/ingest/raw/hires/{n}.npy')}
  for n, ((_, Lr, ppd, c0, r0, nc, nr), a) in hi.items():
    core = a[1:-1, 1:-1]
    # consistency against the 16 ppd OBSERVED base: block means at 16 ppd vs the base grid (same lattice)
    f = 2 ** (Lr - 2); h16 = core.reshape(core.shape[0] // f, f, core.shape[1] // f, f).mean((1, 3))
    gr0, gc0 = r0 * T // f, c0 * T // f
    base = g16[gr0:gr0 + h16.shape[0], :][:, [(gc0 + i) % 5760 for i in range(h16.shape[1])]]
    dif = h16 - base
    regions.append(dict(name=n, label=REGIONS[n][5], level=Lr, ppd=ppd, tileRow0=r0, tileCol0=c0, tileRows=nr, tileCols=nc,
      latN=90 - r0 * T / ppd, latS=90 - (r0 + nr) * T / ppd, lonW=c0 * T / ppd, lonE=(c0 + nc) * T / ppd,
      vs16ppd=dict(meanM=round(float(dif.mean()), 1), rmsM=round(float(np.sqrt((dif ** 2).mean())), 1), p99absM=round(float(np.percentile(np.abs(dif), 99)), 1))))
    print(n, 'vs 16ppd base: mean', regions[-1]['vs16ppd'])
    for L in range(3, Lr + 1):
      k = 2 ** (Lr - L); ppdL = 4 * 2 ** L
      # level-L tile set intersecting the region
      tr0, tr1 = (r0 * T // k) // T, -(-((r0 + nr) * T // k) // T)
      tc0, tc1 = (c0 * T // k) // T, -(-((c0 + nc) * T // k) // T)
      for r in range(tr0, tr1):
        for c in range(tc0, tc1):
          ys = r * T - 1 + np.arange(T + 2); xs = c * T - 1 + np.arange(T + 2)
          lat = 90 - (ys + 0.5) / ppdL; lon = (xs + 0.5) / ppdL
          tile = g16_at(lat, lon)
          # overlay block means of the region data (region core in level-L samples)
          hy0, hx0 = r0 * T // k, c0 * T // k
          ry, rx = ys - hy0, xs - hx0
          m = (ry >= 0) & (ry < core.shape[0] // k); mx = (rx >= 0) & (rx < core.shape[1] // k)
          if k == 1:
            # level of the region itself: the apron comes from the fetched apron samples
            sub = a[(ys - hy0 + 1).clip(0, a.shape[0] - 1)][:, (xs - hx0 + 1).clip(0, a.shape[1] - 1)]
            m = (ys - hy0 >= -1) & (ys - hy0 <= core.shape[0]); mx = (xs - hx0 >= -1) & (xs - hx0 <= core.shape[1])
          else:
            blk = core.reshape(core.shape[0] // k, k, core.shape[1] // k, k).mean((1, 3))
            sub = blk[ry.clip(0, blk.shape[0] - 1)][:, rx.clip(0, blk.shape[1] - 1)]
          w = m[:, None] & mx[None, :]
          tile = np.where(w, sub, tile)
          write(L, r, c, tile)
  allb = b''.join(open(f'{out}/t/{L}/{r}_{c}.i16z', 'rb').read() for L in sorted(levels) for r, c in sorted(levels[L]))
  man = dict(body=body, format='tile-pyramid/1', encoding='gzip int16 LE metres relative to refRadiusKm', refRadiusKm=B['ref'], tileSamples=T, apron=1,
    lattice='level L: ppd = 4*2^L; pixel centres (i+0.5)/ppd deg east of 0E and south of 90N; tile (row, col) covers samples [row*240, row*240+240) with a 1-sample apron',
    path='t/{L}/{row}_{col}.i16z',
    levels=[dict(level=L, ppd=4 * 2 ** L, globalCoverage=L <= 2, tiles=len(levels[L]), list=None if L <= 2 else sorted(levels[L])) for L in sorted(levels)],
    regions=regions,
    sources=[dict(levels='0-2', url=B['src16'], note='16 ppd global grid (observed laser altimetry); L0/L1 are 2x2 block means'), dict(levels='3-6 (regions)', url=B['hi'], note=B['hiNote'])],
    license='NASA/USGS/PDS — public domain', truth='OBSERVED (gridded altimetry / stereo-photogrammetry blend); no synthetic relief',
    sha256=hashlib.sha256(allb).hexdigest(), bytes=len(allb))
  json.dump(man, open(f'{out}/tiles.json', 'w'), indent=1)
  print(body, {L: len(v) for L, v in levels.items()}, 'MB', round(len(allb) / 2 ** 20, 1))
if __name__ == '__main__': main(sys.argv[1])
