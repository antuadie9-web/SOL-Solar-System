#!/bin/bash
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
while [ ! -f $Q/rev2-queue.done ]; do sleep 20; done
/tmp/snap.sh >/dev/null
V=$(node -e "import('./tools/qa/scenarios/views381.mjs').then(m=>console.log(m.GLAREAUDIT.map(v=>v[0]).join(',')))")
[ -f $Q/glare-post2.done ] || { DPR=1 VIEWS="$V" timeout 4000 node tools/qa/smoke.mjs --software --url "http://localhost:4175/?qa-off=small,smallcompute" --script golden38 --out $Q/glare-post2 --wait 180000 --w 960 --h 540 > $Q/glare-post2.log 2>&1; echo DONE > $Q/glare-post2.done; }
