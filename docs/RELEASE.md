# SOL v3.8.0 — release record

- Archive: `sol-solar-system-v3.8-final.zip` (single consolidated application; produced with `git archive` of tag `v3.8.0`).
- History: tag `v3.7.0` = owner upload (a3b47dc) · branch `v3.7.1` = corrective-only line · master/tag `v3.8.0` = this release.
- Excluded from the archive (rebuildable): `node_modules/`, `dist/`, `.cache/`, `tools/ingest/raw/` (raw download cache; the
  query results needed to rebuild derived data are committed under `tools/ingest/queries/`).
- Install & run: Node.js 20+, `npm ci`, `npm run check` (typecheck + asset check + tests + build), `npm run dev` or
  `npm run build && npm run preview`. Desktop Chrome with hardware WebGPU required.
- External/streamed assets: none. Every runtime file is in `public/assets/` and listed with SHA-256 in
  `docs/assets/asset-manifest.json`; star shards are additionally hash-checked at load (`catalogs/stars/index.json`).
- Verification: `tools/qa/release-verify.sh <zip>` (clean extraction → per-file hashes vs git tree → asset/shard hashes →
  v3.7.1 correction presence → npm ci/typecheck/assets/tests/build → Chromium boot of the extraction's own build). Results of
  the run on the delivered archive: `RELEASE_VERIFICATION.md` (delivered beside the ZIP).
- v3.7.1 → v3.8 correction presence: of 9,185 substantive lines added on the `v3.7.1` branch, all but 15 appear verbatim in
  v3.8. The 15 are superseded, not lost: version/generated stamps (package.json, asset-manifest count, ephemeris-residuals
  timestamp); the back-port comments and the `BodyView` field line in `engine.ts` (v3.8 has the same code with v3.8 comment
  wording and one extra field, `warmFrames`); the earlier `pointerleave` handler in `ui.ts` (replaced by the fuller DEF-38-012
  fix); and QA-harness view definitions that v3.8 re-tuned.
