#!/bin/bash
# usage: capv.sh PORT OUTDIR VIEWS QAOFF_EXTRA [MODE] [SKYWAIT] [W H DPR]
cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
DPR="${9:-1}" SKYWAIT="$6" MODE="$5" VIEWS="$3" timeout 3000 node tools/qa/smoke.mjs --software --url "http://localhost:$1/?qa-off=small,smallcompute$4" --script golden38 --out "$2" --wait 180000 --w "${7:-1280}" --h "${8:-720}" > "$2.log" 2>&1
echo "done rc=$?" >> "$2.log"
