#!/bin/bash
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
while [ ! -f $Q/cp2x.done ]; do sleep 20; done
cd $R; mkdir -p $Q/cp2b-new-preRim; mv $Q/cp2b-new/moon381-*-1986.* $Q/cp2b-new-preRim/
DPR=1 VIEWS="moon381-ariel-1986,moon381-titania-1986,moon381-oberon-1986" timeout 1500 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/cp2b-new.u --wait 180000 --w 960 --h 540 > $Q/cp2b-new-u.log 2>&1
mv $Q/cp2b-new.u/result.json $Q/cp2b-new.u/result-uranian.json; cp $Q/cp2b-new.u/* $Q/cp2b-new/; rm -rf $Q/cp2b-new.u
echo DONE > $Q/cp2u.done
