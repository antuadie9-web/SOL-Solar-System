#!/bin/bash
# REV4 queue (resumable; sandbox resets are frequent — each unit is skipped once its output exists)
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
/tmp/snap.sh >/dev/null; sleep 12
[ -f $Q/partial-new6.done ] || { DPR=1 VIEWS="moon381-titania-1986,partial-triton-north,partial-pluto-south-1988,partial-charon-south-1988,moon381-oberon-1986,moon381-ariel-1986" timeout 3000 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/partial-new6 --wait 180000 --w 960 --h 540 > $Q/partial-new6.log 2>&1; echo DONE > $Q/partial-new6.done; }
for seq in rings-pan sun-f50-auto; do
  [ -f $Q/travel-v3/$seq.json ] || { rm -rf $Q/travel-v3/$seq; timeout 4000 node tools/qa/continuity_travel.mjs --url http://localhost:4175/ --out $Q/travel-v3 --seq $seq >> $Q/travel-v3.log 2>&1; }
done
echo ALL > $Q/rev4.done
