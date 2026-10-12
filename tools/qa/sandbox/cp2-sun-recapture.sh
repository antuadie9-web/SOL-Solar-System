#!/bin/bash
# after SUN-381-06: re-capture the candidate Sun set (pre-fix captures kept in cp2-new-preSUN06)
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
while [ ! -f $Q/cp2rem.done ]; do sleep 20; done
/tmp/snap.sh; cd $R
mkdir -p $Q/cp2-new-preSUN06; for f in $Q/cp2-new/sun*; do mv "$f" $Q/cp2-new-preSUN06/; done
V=$(ls $Q/cp2-new-preSUN06/*.png | xargs -n1 basename | sed 's/.png$//' | paste -sd,)
DPR=1 VIEWS="$V" timeout 3000 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/cp2-new.sun --wait 180000 --w 960 --h 540 > $Q/cp2-new-sun.log 2>&1
mv $Q/cp2-new.sun/result.json $Q/cp2-new.sun/result-sun.json; cp $Q/cp2-new.sun/* $Q/cp2-new/; rm -rf $Q/cp2-new.sun
echo DONE > $Q/cp2sun.done
