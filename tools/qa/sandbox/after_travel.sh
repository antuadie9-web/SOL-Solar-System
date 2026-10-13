#!/bin/bash
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
while [ ! -f $Q/travel-new.done ]; do sleep 20; done
/tmp/snap.sh >/dev/null; sleep 8
[ -f $Q/partial-new6.done ] || { DPR=1 VIEWS="moon381-titania-1986,partial-triton-north,partial-pluto-south-1988,partial-charon-south-1988,moon381-oberon-1986,moon381-ariel-1986" timeout 3000 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/partial-new6 --wait 180000 --w 960 --h 540 > $Q/partial-new6.log 2>&1; echo DONE > $Q/partial-new6.done; }
[ -f $Q/travel-v3.done ] || { timeout 4000 node tools/qa/continuity_travel.mjs --url http://localhost:4175/ --out $Q/travel-v3 --seq sun-f20-auto > $Q/travel-v3.log 2>&1; echo DONE > $Q/travel-v3.done; }
