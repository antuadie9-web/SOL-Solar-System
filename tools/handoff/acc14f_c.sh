cd /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
. tools/qa/sandbox/snaplib.sh
qa_tools; C=$(qa_commit); S=$(build_snap $C) || exit 3; O=../../qa/c14f-acc; mkdir -p $O
run(){ [ -f $O/$1.done ] && return; timeout 600 node tools/qa/probe_photometry.mjs --snap $S --out $O/$1 "${@:2}" > $O/$1.log 2>&1; rc=$?; echo "$(date +%T) $1 rc=$rc snap=${S##*/}" >> $O/rc.log; [ $rc = 0 ] && touch $O/$1.done; }
[ -n "$BATCH" ] && . "$BATCH"
