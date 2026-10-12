#!/bin/bash
# cp2 regression set (also the WP-E/F/H "before" set): v3.8.1 cp2 candidate vs v3.8.0
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
while [ ! -f $Q/cp2u2.done ]; do sleep 20; done
cd $R
V="earth-day,earth-limb,earth-sunset-limb,mars-day,mars-limb,venus-terminator,venus-limb,titan-limb,jupiter-day,jupiter-limb,saturn-day,sat-overview,sat-backlit,ura-overview,nep-overview,moon-hadley-ground,mars-jezero-ground,enceladus-plume-backlit,io-plumes-limb,sun-close,triton-limb,pluto-haze-backlit"
DPR=1 VIEWS="$V" timeout 3600 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/reg-new --wait 180000 --w 960 --h 540 > $Q/reg-new.log 2>&1
DPR=1 VIEWS="$V" timeout 3600 node tools/qa/smoke.mjs --software --url "http://localhost:4174/?qa-off=small,smallcompute" --script golden38 --out $Q/reg-base --wait 180000 --w 960 --h 540 > $Q/reg-base.log 2>&1
echo DONE > $Q/reg.done
