# Catalogue queries (reproducible inputs for tools/ingest/gaia.mjs)

GCNS (Gaia Catalogue of Nearby Stars, 100 pc) — VizieR TAP sync, ~70 s:
```
curl -s https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync --data-urlencode REQUEST=doQuery --data-urlencode LANG=ADQL \
  --data-urlencode FORMAT=csv --data-urlencode MAXREC=400000 --data-urlencode 'QUERY=SELECT GaiaEDR3, RA_ICRS, DE_ICRS, Plx, e_Plx, pmRA, pmDE, RV, "Gmag", BPmag, RPmag, RUWE, GCNSprob, WDprob, Dist16, Dist50, Dist84 FROM "J/A+A/649/A6/table1c" WHERE GCNSprob > 0.38' -o gcns.csv
```
Hipparcos bright stars (van Leeuwen 2007):
```
curl -s https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync --data-urlencode REQUEST=doQuery --data-urlencode LANG=ADQL \
  --data-urlencode FORMAT=csv --data-urlencode 'QUERY=SELECT HIP, RArad, DErad, Plx, e_Plx, pmRA, pmDE, Hpmag, "B-V" FROM "I/311/hip2" WHERE Hpmag < 6.5 AND Plx > 0' -o hip_bright.csv
```
Optional Gaia DR3 bright-star tier (Gaia Archive async TAP; a full-table scan that can queue for hours):
`SELECT source_id, ra, dec, parallax, parallax_error, pmra, pmdec, radial_velocity, phot_g_mean_mag, bp_rp, ruwe, teff_gspphot FROM gaiadr3.gaia_source WHERE phot_g_mean_mag < 9 AND parallax > 0.1 AND parallax_over_error > 5 AND parallax <= 10`

Then: `node tools/ingest/gaia.mjs gcns.csv hip_bright.csv [gaia_bright.csv]`
