#!/usr/bin/env python3
"""SOL v3.6 high-resolution terrain source fetch (windowed HTTP range reads of public-domain USGS/PDS mosaics).

Writes float32 height grids (metres relative to the body's reference sphere) on SOL's tile sample lattice:
pixel centres at (i + 0.5)/ppd degrees east of lon 0 and south of lat +90 (same convention as dem16.bin).
  Moon: LRO LOLA global LDEM 118 m (256 ppd), USGS Astrogeology, int16 x 0.5 m above 1737.4 km  -> exact lattice copy
  Mars: HRSC-MOLA Blended DEM 200 m v2 (Fergason et al. 2018, USGS), int16 m above the MOLA areoid
        -> resampled (bilinear) to 256/128 ppd and converted to radius-relative heights with the MOLA MEGDR 16 ppd
           areoid (megr - megt), so it is consistent with SOL's MOLA radius base (dem16.bin)
Usage: terrain_fetch.py <region-name>   (see REGIONS)
"""
import sys, time, numpy as np, rasterio
from rasterio.windows import Window
MOON = 'https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif'
MARS = 'https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif'
# name: body, centre lat, centre lon (east, 0-360), tiles (cols, rows), level (ppd = 4*2^L), tile = 240 samples
REGIONS = {
  'hadley':  ('moon', 26.1, 3.6, (8, 8), 6, 'Apollo 15 landing site / Hadley Rille'),
  'tycho':   ('moon', -43.3, 348.8, (8, 8), 6, 'Tycho crater'),
  'gale':    ('mars', -5.4, 137.8, (8, 8), 6, 'Gale crater (Curiosity)'),
  'jezero':  ('mars', 18.4, 77.5, (8, 8), 6, 'Jezero crater (Perseverance)'),
  'candor':  ('mars', -6.5, 287.0, (10, 8), 6, 'Valles Marineris (Candor / Melas Chasma)'),
  'olympus': ('mars', 18.65, 226.2, (7, 7), 5, 'Olympus Mons'),
}
def lattice(region):
  body, lat, lon, (nc, nr), L, _ = REGIONS[region]
  ppd = 4 * 2 ** L; tdeg = 240 / ppd
  c0 = int(np.floor(lon / tdeg - nc / 2 + 0.5)); r0 = int(np.floor((90 - lat) / tdeg - nr / 2 + 0.5))
  return body, L, ppd, c0, r0, nc, nr
def main(region):
  body, L, ppd, c0, r0, nc, nr = lattice(region)
  # samples incl. 1-sample apron on every side
  W, H = nc * 240 + 2, nr * 240 + 2
  lon_c = (c0 * 240 - 1 + np.arange(W) + 0.5) / ppd          # deg east 0..360 (may wrap)
  lat_c = 90 - (r0 * 240 - 1 + np.arange(H) + 0.5) / ppd
  t0 = time.time()
  if body == 'moon':
    with rasterio.open('/vsicurl/' + MOON) as d:
      assert d.width == 92160
      col = ((lon_c + 180) % 360) * 256 - 0.5; row = (90 - lat_c) * 256 - 0.5
      assert ppd == 256
      x0, y0 = int(round(col[0])), int(round(row[0]))
      a = d.read(1, window=Window(x0, y0, W, H)).astype(np.float32)
      a[a == d.nodata] = np.nan; a *= 0.5
  else:
    with rasterio.open('/vsicurl/' + MARS) as d:
      ovr = 1 if ppd >= 256 else 2
      sw, sh = d.width // ovr, d.height // ovr; sppd = sw / 360.0
      col = ((lon_c + 180) % 360) * sppd - 0.5; row = (90 - lat_c) * sppd - 0.5
      x0, x1 = int(np.floor(col.min())) - 1, int(np.ceil(col.max())) + 2
      y0, y1 = int(np.floor(row.min())) - 1, int(np.ceil(row.max())) + 2
      win = Window(x0 * ovr, y0 * ovr, (x1 - x0) * ovr, (y1 - y0) * ovr)
      src = d.read(1, window=win, out_shape=(y1 - y0, x1 - x0)).astype(np.float32)
      nod = d.nodata
      if nod is not None: src[src == nod] = np.nan
      cx, cy = col - x0, row - y0
      ix, iy = np.floor(cx).astype(int), np.floor(cy).astype(int); fx, fy = cx - ix, cy - iy
      a = (src[iy][:, ix] * (1 - fx)[None] * (1 - fy)[:, None] + src[iy][:, ix + 1] * fx[None] * (1 - fy)[:, None]
           + src[iy + 1][:, ix] * (1 - fx)[None] * fy[:, None] + src[iy + 1][:, ix + 1] * fx[None] * fy[:, None])
    # areoid (radius relative to 3396 km) from MOLA MEGDR 16 ppd: megr - megt
    R = np.fromfile('tools/ingest/raw/hires/megr16.img', '>i2').reshape(2880, 5760).astype(np.float32)
    T = np.fromfile('tools/ingest/raw/hires/megt16.img', '>i2').reshape(2880, 5760).astype(np.float32)
    A = R - T
    gx = lon_c * 16 - 0.5; gy = (90 - lat_c) * 16 - 0.5
    jx, jy = np.floor(gx).astype(int), np.clip(np.floor(gy).astype(int), 0, 2878); ux, uy = gx - jx, gy - jy
    ja, jb = jx % 5760, (jx + 1) % 5760
    ar = (A[jy][:, ja] * (1 - ux)[None] * (1 - uy)[:, None] + A[jy][:, jb] * ux[None] * (1 - uy)[:, None]
          + A[jy + 1][:, ja] * (1 - ux)[None] * uy[:, None] + A[jy + 1][:, jb] * ux[None] * uy[:, None])
    a = a + ar
  bad = np.isnan(a).sum()
  np.save(f'tools/ingest/raw/hires/{region}.npy', a.astype(np.float32))
  print(region, body, 'L', L, 'ppd', ppd, 'tiles', c0, r0, nc, nr, 'shape', a.shape, 'nan', int(bad), 'range', float(np.nanmin(a)), float(np.nanmax(a)), 'sec', round(time.time() - t0, 1))
if __name__ == '__main__': main(sys.argv[1])
