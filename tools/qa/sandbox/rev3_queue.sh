#!/bin/bash
# REV3 queue (resumable): waits for rev3-a, then six partial-mosaic views (iteration 4) + Galactic-card UI shots
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
while [ ! -f $Q/rev3-a.done ]; do sleep 15; done
/tmp/snap.sh >/dev/null
[ -f $Q/partial-new4.done ] || { DPR=1 VIEWS="moon381-ariel-1986,moon381-titania-1986,moon381-oberon-1986,partial-triton-north,partial-pluto-south-1988,partial-charon-south-1988" timeout 3000 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/partial-new4 --wait 180000 --w 960 --h 540 > $Q/partial-new4.log 2>&1; echo DONE > $Q/partial-new4.done; }
[ -f $Q/rev3-ui.done ] || { mkdir -p $Q/rev3-ui; SHOTDIR=$Q/rev3-ui/ timeout 900 node tools/qa/galmap_shots.mjs > $Q/rev3-ui.log 2>&1; echo DONE > $Q/rev3-ui.done; }
