#!/bin/bash
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
while [ ! -f $Q/rev4.done ]; do sleep 20; done
/tmp/snap.sh >/dev/null; sleep 12
[ -f $Q/travel-v3/rings-pan.json ] || { rm -rf $Q/travel-v3/rings-pan; timeout 4000 node tools/qa/continuity_travel.mjs --url http://localhost:4175/ --out $Q/travel-v3 --seq rings-pan >> $Q/travel-v3.log 2>&1; }
[ -f $Q/partial-new7.done ] || { DPR=1 VIEWS="moon381-titania-1986,partial-triton-north,partial-pluto-south-1988,partial-charon-south-1988" timeout 3000 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/partial-new7 --wait 180000 --w 960 --h 540 > $Q/partial-new7.log 2>&1; echo DONE > $Q/partial-new7.done; }
echo DONE > $Q/rev4c.done
