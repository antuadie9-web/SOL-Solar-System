#!/bin/bash
# Checkpoint-2 remaining captures; resumable (skips views already captured). Writes $Q/cp2rem.done
R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final; Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa
cd $R
run() { # port outdir views [timeout]
  local todo=""; for v in ${3//,/ }; do [ -f $2/$v.png ] || todo="$todo,$v"; done; todo=${todo#,}; [ -z "$todo" ] && return
  mkdir -p $2; DPR=1 VIEWS="$todo" timeout ${4:-3000} node tools/qa/smoke.mjs --software --url "http://localhost:$1/?qa-off=small,smallcompute" --script golden38 --out "$2.part" --wait 180000 --w 960 --h 540 >> "$2.log" 2>&1
  [ -f $2.part/result.json ] && mv $2.part/result.json $2.part/result-$(date +%s).json; cp $2.part/*.png $2.part/*.json $2/ 2>/dev/null; rm -rf $2.part
}
B="moon381-janus-ph70,moon381-epimetheus-ph70,moon381-prometheus-ph70,moon381-pan-ph70,moon381-atlas-ph70,moon381-hyperion-ph70,moon381-ariel-1986,moon381-titania-1986,moon381-oberon-1986"
run 4175 $Q/cp2b-new "$B"
run 4174 $Q/cp2b-base "$B"
run 4174 $Q/cp2-base "xstar-proxima-8R" 420
run 4174 $Q/cp2-base "xstar-proxima-8R-sci" 420
node tools/qa/intro_shots.mjs >> $Q/intro.log 2>&1
echo DONE > $Q/cp2rem.done
