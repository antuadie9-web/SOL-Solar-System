#!/bin/bash
cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
timeout 9000 node tools/qa/continuity_travel.mjs --url http://localhost:4175/ --out ../../qa/travel-new ${1:+--seq $1} > ../../qa/travel-new.log 2>&1
echo DONE > ../../qa/travel-new.done
