#!/bin/bash
# REV2 capture queue (resumable: each stage skipped when its .done exists). Stages: cp2tag server, rev2-new, rev2-cp2,
# partial-new2 (+UI shots), rings-pre.
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final; cd $R
cap() { DPR=1 VIEWS="$3" timeout 4000 node tools/qa/smoke.mjs --software --url "http://localhost:$1/?qa-off=small,smallcompute" --script golden38 --out $Q/$2 --wait 180000 --w 960 --h 540 > $Q/$2.log 2>&1; echo DONE > $Q/$2.done; }
if [ ! -f $Q/rev2-cp2.done ] && ! curl -s -o /dev/null localhost:4177/; then
  rm -rf /tmp/cp2tag && mkdir -p /tmp/cp2tag && git archive v3.8.1-cp2 -- src index.html vite.config.ts package.json tsconfig.json | tar -x -C /tmp/cp2tag && ln -sfn $R/node_modules /tmp/cp2tag/node_modules
  mkdir -p /tmp/cp2tag/public/assets/tex; for d in $R/public/*; do n=$(basename $d); [ "$n" != assets ] && ln -sfn $d /tmp/cp2tag/public/$n; done; for d in $R/public/assets/*; do n=$(basename $d); [ "$n" != tex ] && ln -sfn $d /tmp/cp2tag/public/assets/$n; done; for f in $R/public/assets/tex/*; do ln -sfn $f /tmp/cp2tag/public/assets/tex/$(basename $f); done
  (cd /tmp/cp2tag && nohup npx vite --port 4177 --strictPort > /tmp/vite-cp2.log 2>&1 &); sleep 10
fi
V1="moon381-janus-ph70,moon381-epimetheus-ph70,moon381-prometheus-ph70,moon381-pan-ph70,moon381-atlas-ph70,moon381-hyperion-ph70,moon381-helene,moon381-telesto,moon381-calypso,moon381-pandora,venus-terminator,venus-limb,titan-limb,titan-terminator,mars-limb,earth-limb,jupiter-limb"
V2="moon381-ariel-1986,moon381-titania-1986,moon381-oberon-1986,partial-triton-north,partial-pluto-south-1988,partial-charon-south-1988,xstar-proxima-8R,xstar-proxima-8R-sci"
V3="sat-overview,sat-edgeon,sat-sunlit-oblique,sat-backlit,sat-ringshadow-on-planet,sat-planetshadow-on-rings,sat-A-close,sat-B-close,sat-nearfield-A,sat-cassini-division,sat-epoch2026,ura-overview,nep-overview,jup-forward-scatter"
/tmp/snap.sh > /dev/null
[ -f $Q/rev2-new.done ] || cap 4175 rev2-new "$V1"
[ -f $Q/partial-new2.done ] || cap 4175 partial-new2 "$V2"
[ -f $Q/rev2-ui.done ] || { mkdir -p $Q/rev2-ui; SHOTDIR=$Q/rev2-ui/ node tools/qa/intro_shots.mjs > $Q/intro2.log 2>&1; SHOTDIR=$Q/rev2-ui/ node tools/qa/galmap_shots.mjs > $Q/galmap2.log 2>&1; echo DONE > $Q/rev2-ui.done; }
[ -f $Q/rev2-cp2.done ] || cap 4177 rev2-cp2 "$V1"
[ -f $Q/rings-pre.done ] || cap 4175 rings-pre "$V3"
echo ALL > $Q/rev2-queue.done
