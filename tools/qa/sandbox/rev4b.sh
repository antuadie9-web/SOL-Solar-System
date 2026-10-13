#!/bin/bash
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
while [ ! -f $Q/rev4.done ]; do sleep 20; done
[ -f $Q/travel-v3/rings-pan.json ] || timeout 4000 node tools/qa/continuity_travel.mjs --url http://localhost:4175/ --out $Q/travel-v3 --seq rings-pan >> $Q/travel-v3.log 2>&1
echo DONE > $Q/rev4b.done
