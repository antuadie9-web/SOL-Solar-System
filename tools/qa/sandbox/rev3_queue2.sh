#!/bin/bash
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
while [ ! -f $Q/rev3-ui.done ]; do sleep 15; done
/tmp/snap.sh >/dev/null
[ -f $Q/rings-t1.done ] || { DPR=1 VIEWS="sat-A-close,sat-nearfield-A,sat-cassini-division,sat-overview,sat-edgeon,moon381-atlas-ph70" timeout 2400 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/rings-t1 --wait 180000 --w 960 --h 540 > $Q/rings-t1.log 2>&1; echo DONE > $Q/rings-t1.done; }
