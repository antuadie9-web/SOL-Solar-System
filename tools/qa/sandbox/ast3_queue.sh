#!/bin/bash
# AST-381-03 acceptance queue: matched cp2-tag (:4177) vs current HEAD (:4175) for the six partial-mosaic bodies —
# far (3.2 R, existing views) + PARTIALNEAR (1.7 R at boundary latitude, az 20/70). Resumable: one .done per stage;
# current-build stages are keyed by commit hash so images from different builds are never mixed.
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final; cd $R
H=$(git log -1 --format=%h -- src public);   # last commit touching the build inputs
 [ -z "$(git status --porcelain src public)" ] || { echo "dirty tree"; exit 1; }
[ -x /tmp/snap.sh ] || bash tools/qa/sandbox/setup.sh > $Q/setup.log 2>&1   # sandbox reset wiped /tmp
[ -x /tmp/snap.sh ] || { echo 'setup failed'; exit 1; }
cap() { DPR=1 VIEWS="$3" timeout 4000 node tools/qa/smoke.mjs --software --url "http://localhost:$1/?qa-off=small,smallcompute" --script golden38 --out $Q/$2 --wait 180000 --w 1280 --h 720 > $Q/$2.log 2>&1 && echo "$4" > $Q/$2/BUILD && echo DONE > $Q/$2.done; }
# cp2 baseline = an IMMUTABLE snapshot of the v3.8.1-cp2 tag (owner reviews 2026-10-14): code and every public file are
# extracted from git objects (no links into the mutable working tree). manifest.txt holds "<blob> <path>" for the tag;
# verify_cp2 re-hashes the snapshot before every cp2 batch and refuses to capture if anything differs.
CP2DIR=/tmp/cp2tag-v3
verify_cp2() {
  (cd $CP2DIR && cut -d' ' -f2- manifest.txt | git --git-dir=$R/.git hash-object --stdin-paths) > /tmp/cp2.hashes || return 1
  diff -q <(cut -d' ' -f1 $CP2DIR/manifest.txt) /tmp/cp2.hashes >/dev/null || { echo "cp2 snapshot identity FAILED"; return 1; }
  echo "cp2 snapshot verified: $(wc -l < $CP2DIR/manifest.txt) files == v3.8.1-cp2 blobs ($(date -u +%FT%TZ))" | tee -a $Q/cp2tag-assets.txt
}
if ! curl -s -o /dev/null localhost:4177/ || [ ! -f $CP2DIR/manifest.txt ]; then
  P=$(pgrep -f "[v]ite --port 4177"); [ -n "$P" ] && kill $P; sleep 1
  rm -rf $CP2DIR && mkdir -p $CP2DIR
  git archive v3.8.1-cp2 -- src public index.html vite.config.ts package.json tsconfig.json | tar -x -C $CP2DIR
  git ls-tree -r v3.8.1-cp2 -- src public index.html vite.config.ts package.json tsconfig.json | awk '{print $3" "$4}' > $CP2DIR/manifest.txt.tmp && mv $CP2DIR/manifest.txt.tmp $CP2DIR/manifest.txt
  ln -sfn $R/node_modules $CP2DIR/node_modules   # dependency tree only (three pinned 0.186.1 in both); not an asset
  echo "snapshot built $(date -u +%FT%TZ): git archive v3.8.1-cp2 (f4974e8), extracted from git objects" >> $Q/cp2tag-assets.txt
  (cd $CP2DIR && nohup npx vite --port 4177 --strictPort > /tmp/vite-cp2.log 2>&1 &); sleep 10
fi
/tmp/snap.sh > /dev/null; sleep 5
FAR="moon381-ariel-1986,moon381-titania-1986,moon381-oberon-1986,partial-triton-north,partial-pluto-south-1988,partial-charon-south-1988"
for n in oberon triton charon pluto ariel titania; do NEAR="pnear-$n-az20,pnear-$n-az70"
  [ -f $Q/ast3-$H-$n.done ] || cap 4175 ast3-$H-$n "$NEAR" "current $H"
  [ -f $Q/ast3-cp2-$n.done ] || { verify_cp2 || exit 3; cap 4177 ast3-cp2-$n "$NEAR" "v3.8.1-cp2 f4974e8 (tag assets, immutable snapshot verified)"; }
done
[ -f $Q/ast3-$H-far.done ] || cap 4175 ast3-$H-far "$FAR" "current $H"
[ -f $Q/ast3-cp2-far.done ] || { verify_cp2 || exit 3; cap 4177 ast3-cp2-far "$FAR" "v3.8.1-cp2 f4974e8 (tag assets, immutable snapshot verified)"; }
# completion: every required image of THIS candidate and of the tag baseline, with matching BUILD records
ok=1
for n in oberon triton charon pluto ariel titania; do for az in 20 70; do
  [ -s $Q/ast3-$H-$n/pnear-$n-az$az.png ] || { echo "missing current $n az$az"; ok=0; }
  [ -s $Q/ast3-cp2-$n/pnear-$n-az$az.png ] || { echo "missing cp2 $n az$az"; ok=0; }
done; grep -q "current $H" $Q/ast3-$H-$n/BUILD 2>/dev/null || { echo "BUILD mismatch $n"; ok=0; }; done
for v in ${FAR//,/ }; do [ -s $Q/ast3-$H-far/$v.png ] || { echo "missing current far $v"; ok=0; }; [ -s $Q/ast3-cp2-far/$v.png ] || { echo "missing cp2 far $v"; ok=0; }; done
grep -q "tag assets" $Q/ast3-cp2-far/BUILD 2>/dev/null || { echo "cp2 far not tag-asset build"; ok=0; }
[ $ok = 1 ] && echo ALL > $Q/ast3-$H.done && echo "ACCEPTANCE SET COMPLETE $H"
