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
# cp2 baseline = the v3.8.1-cp2 TAG for code AND runtime assets (owner review 2026-10-14: the old build symlinked the
# working tree's public/, so cp2 captures of Ariel/Oberon/Titania used post-cp2 colour maps and texstats). Every public
# file of the tag is linked from the working tree only when its git blob hash is identical, otherwise extracted from the
# tag; files added after cp2 are absent. The resolution is written to $Q/cp2tag-assets.txt.
CP2DIR=/tmp/cp2tag-v2
if ! curl -s -o /dev/null localhost:4177/ || [ ! -f $CP2DIR/.verified ]; then
  P=$(pgrep -f "[v]ite --port 4177"); [ -n "$P" ] && kill $P; sleep 1
  rm -rf $CP2DIR && mkdir -p $CP2DIR && git archive v3.8.1-cp2 -- src index.html vite.config.ts package.json tsconfig.json | tar -x -C $CP2DIR && ln -sfn $R/node_modules $CP2DIR/node_modules
  : > $Q/cp2tag-assets.txt
  git ls-tree -r v3.8.1-cp2 -- public | while read -r mode type blob path; do
    mkdir -p "$CP2DIR/$(dirname "$path")"
    if [ -f "$path" ] && [ "$(git hash-object "$path")" = "$blob" ]; then ln -sfn "$R/$path" "$CP2DIR/$path"
    else git cat-file blob "$blob" > "$CP2DIR/$path"; echo "extracted-from-tag $path" >> $Q/cp2tag-assets.txt; fi
  done
  echo "linked (identical blob): $(git ls-tree -r v3.8.1-cp2 -- public | wc -l) tag files minus extracted" >> $Q/cp2tag-assets.txt
  touch $CP2DIR/.verified
  (cd $CP2DIR && nohup npx vite --port 4177 --strictPort > /tmp/vite-cp2.log 2>&1 &); sleep 10
fi
/tmp/snap.sh > /dev/null; sleep 5
FAR="moon381-ariel-1986,moon381-titania-1986,moon381-oberon-1986,partial-triton-north,partial-pluto-south-1988,partial-charon-south-1988"
for n in oberon triton charon pluto ariel titania; do NEAR="pnear-$n-az20,pnear-$n-az70"
  [ -f $Q/ast3-$H-$n.done ] || cap 4175 ast3-$H-$n "$NEAR" "current $H"
  [ -f $Q/ast3-cp2-$n.done ] || cap 4177 ast3-cp2-$n "$NEAR" "v3.8.1-cp2 f4974e8 (tag assets, verified blobs)"
done
[ -f $Q/ast3-$H-far.done ] || cap 4175 ast3-$H-far "$FAR" "current $H"
[ -f $Q/ast3-cp2-far.done ] || cap 4177 ast3-cp2-far "$FAR" "v3.8.1-cp2 f4974e8 (tag assets, verified blobs)"
# completion: every required image of THIS candidate and of the tag baseline, with matching BUILD records
ok=1
for n in oberon triton charon pluto ariel titania; do for az in 20 70; do
  [ -s $Q/ast3-$H-$n/pnear-$n-az$az.png ] || { echo "missing current $n az$az"; ok=0; }
  [ -s $Q/ast3-cp2-$n/pnear-$n-az$az.png ] || { echo "missing cp2 $n az$az"; ok=0; }
done; grep -q "current $H" $Q/ast3-$H-$n/BUILD 2>/dev/null || { echo "BUILD mismatch $n"; ok=0; }; done
for v in ${FAR//,/ }; do [ -s $Q/ast3-$H-far/$v.png ] || { echo "missing current far $v"; ok=0; }; [ -s $Q/ast3-cp2-far/$v.png ] || { echo "missing cp2 far $v"; ok=0; }; done
grep -q "tag assets" $Q/ast3-cp2-far/BUILD 2>/dev/null || { echo "cp2 far not tag-asset build"; ok=0; }
[ $ok = 1 ] && echo ALL > $Q/ast3-$H.done && echo "ACCEPTANCE SET COMPLETE $H"
