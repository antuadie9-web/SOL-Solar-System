#!/bin/bash
# REV3 verification batch: partial six (iter 5), ring meter v2, Sun cap (hand-over + far), auto exposure
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
/tmp/snap.sh >/dev/null
cap() { [ -f $Q/$1.done ] && return; DPR=1 VIEWS="$2" timeout 4000 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/$1 --wait 180000 --w 960 --h 540 > $Q/$1.log 2>&1; echo DONE > $Q/$1.done; }
cap partial-new5 "moon381-ariel-1986,moon381-titania-1986,moon381-oberon-1986,partial-triton-north,partial-pluto-south-1988,partial-charon-south-1988"
cap rings-t2 "sat-A-close,sat-nearfield-A,sat-B-close,moon381-atlas-ph70"
cap glare-t3 "glare-1AU-f20-auto,glare-1p52AU-f20-auto,glare-2p5AU-f20-auto,glare-5AU-f20-auto,glare-0p6AU-f50-auto,glare-1AU-f50-auto,glare-1p52AU-f50-auto,glare-2p5AU-f50-auto,glare-5AU-f50-auto,glare-10AU-f50-auto,glare-100AU-f50-auto,glare-1000AU-f50-auto"
echo ALL > $Q/rev3-q4.done
