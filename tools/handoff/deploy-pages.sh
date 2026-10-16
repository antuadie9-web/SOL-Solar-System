#!/bin/bash
# Publish origin/main as a static build to the gh-pages branch (GitHub Pages). Never touches master/the lease-held tree.
# Uses a separate worktree; the gh-pages commit is built in the main repo's object DB so existing asset blobs are not re-uploaded.
set -e
W=${SOL_WORK:?set SOL_WORK to the project work dir}; REPO=${SOL_REPO:-$W/src380/sol-solar-system-v3.8-final}; WT=$W/deploy/wt
cd $REPO; git fetch -q origin main
SHA=$(git rev-parse origin/main)
if [ -d $WT ]; then git -C $WT checkout -q --detach $SHA; else git worktree add -q --detach $WT $SHA; fi
cd $WT; [ -e node_modules ] || ln -s $REPO/node_modules node_modules
rm -rf dist; npx vite build > $W/deploy/build.log 2>&1
touch dist/.nojekyll
export GIT_INDEX_FILE=$W/deploy/pages.index; rm -f $GIT_INDEX_FILE
git --work-tree=dist add -A . ; TREE=$(git write-tree); unset GIT_INDEX_FILE
git fetch -q origin gh-pages 2>/dev/null || true; PREV=$(git rev-parse -q --verify origin/gh-pages 2>/dev/null || true)
# parent = the source commit (so existing asset blobs dedupe) + previous pages commit (fast-forward)
C=$(git commit-tree $TREE -p $SHA ${PREV:+-p $PREV} -m "Pages build of ${SHA:0:7}")
timeout 1000 git push -q origin $C:refs/heads/gh-pages
echo "deployed ${SHA:0:7} as $C ($(du -sh dist | cut -f1))"
echo "live: https://antuadie9-web.github.io/SOL-Solar-System/  (Pages rebuild ~1-3 min)"
