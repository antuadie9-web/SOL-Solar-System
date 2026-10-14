#!/bin/bash
# AST-381-03 acceptance queue: matched cp2-tag (:4177) vs current HEAD (:4175) for the six partial-mosaic bodies —
# far (3.2 R, existing views) + PARTIALNEAR (1.7 R at boundary latitude, az 20/70). Resumable: one .done per stage;
# current-build stages are keyed by commit hash so images from different builds are never mixed.
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final; cd $R
H=$(git log -1 --format=%h -- src public);   # last commit touching the build inputs
 [ -z "$(git status --porcelain src public)" ] || { echo "dirty tree"; exit 1; }
cap() { DPR=1 VIEWS="$3" timeout 4000 node tools/qa/smoke.mjs --software --url "http://localhost:$1/?qa-off=small,smallcompute" --script golden38 --out $Q/$2 --wait 180000 --w 1280 --h 720 > $Q/$2.log 2>&1 && echo "$4" > $Q/$2/BUILD && echo DONE > $Q/$2.done; }
if ! curl -s -o /dev/null localhost:4177/; then
  rm -rf /tmp/cp2tag && mkdir -p /tmp/cp2tag && git archive v3.8.1-cp2 -- src index.html vite.config.ts package.json tsconfig.json | tar -x -C /tmp/cp2tag && ln -sfn $R/node_modules /tmp/cp2tag/node_modules
  mkdir -p /tmp/cp2tag/public/assets/tex; for d in $R/public/*; do n=$(basename $d); [ "$n" != assets ] && ln -sfn $d /tmp/cp2tag/public/$n; done; for d in $R/public/assets/*; do n=$(basename $d); [ "$n" != tex ] && ln -sfn $d /tmp/cp2tag/public/assets/$n; done; for f in $R/public/assets/tex/*; do ln -sfn $f /tmp/cp2tag/public/assets/tex/$(basename $f); done
  (cd /tmp/cp2tag && nohup npx vite --port 4177 --strictPort > /tmp/vite-cp2.log 2>&1 &); sleep 10
fi
/tmp/snap.sh > /dev/null; sleep 5
FAR="moon381-ariel-1986,moon381-titania-1986,moon381-oberon-1986,partial-triton-north,partial-pluto-south-1988,partial-charon-south-1988"
for n in ariel titania oberon triton pluto charon; do NEAR="pnear-$n-az20,pnear-$n-az70"
  [ -f $Q/ast3-$H-$n.done ] || cap 4175 ast3-$H-$n "$NEAR" "current $H"
  [ -f $Q/ast3-cp2-$n.done ] || cap 4177 ast3-cp2-$n "$NEAR" "v3.8.1-cp2 f4974e8"
done
[ -f $Q/ast3-$H-far.done ] || cap 4175 ast3-$H-far "$FAR" "current $H"
[ -f $Q/ast3-cp2-far.done ] || cap 4177 ast3-cp2-far "$FAR" "v3.8.1-cp2 f4974e8"
echo ALL > $Q/ast3-$H.done
