#!/bin/bash
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
while [ ! -f $Q/cp2sun.done ]; do sleep 20; done
/tmp/snap.sh; cd $R
mkdir -p $Q/cp2-new-preD2; mv $Q/cp2-new/xstar* $Q/cp2-new-preD2/
DPR=1 VIEWS="xstar-proxima-40R,xstar-proxima-8R,xstar-proxima-8R-sci" timeout 1500 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/cp2-new.x --wait 180000 --w 960 --h 540 > $Q/cp2-new-x.log 2>&1
mv $Q/cp2-new.x/result.json $Q/cp2-new.x/result-xstar.json; cp $Q/cp2-new.x/* $Q/cp2-new/; rm -rf $Q/cp2-new.x
echo DONE > $Q/cp2x.done
