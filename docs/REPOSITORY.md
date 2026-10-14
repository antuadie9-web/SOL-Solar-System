# SOL repository workflow

- Remote (private): https://github.com/antuadie9-web/SOL-Solar-System — default branch `main` = local `master`.
- Tags: `v3.8.0-supplied` (untouched owner baseline), `v3.8.1-cp1`, `v3.8.1-cp2` (annotated, f4974e8; never moved).
- Push with `tools/git/push.sh` after every verified commit group and before any long QA run (sandbox resets every
  ~40–60 min). No force pushes, no history rewriting, no tag moves.
- Large binaries: every tracked file is < 50 MB (largest 29.6 MB, checkpoint-2 PDF); history has no blob > 40 MB, so no
  LFS migration was needed (a migration would rewrite history). New files > 50 MB (release ZIP, raw Gaia 16k PNG,
  videos) go to GitHub release assets, or Git LFS for files that must be versioned in-tree.
- Not committed: `node_modules/`, `dist/`, `.cache/`, `qa-out/`, `tools/ingest/raw/` (raw source downloads; URLs are
  recorded in the ingest scripts), QA capture working sets (`work/qa/`, outside the repo), generated archives.
