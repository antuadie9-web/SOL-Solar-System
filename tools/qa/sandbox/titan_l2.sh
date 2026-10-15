#!/bin/bash
# WP-E Titan L2: matched before/after captures (immutable baseline vs candidate snapshots) + photometry probe.
# usage: tools/qa/sandbox/titan_l2.sh <baseline-commit> <out-dir> [views]
cd "$(dirname "$0")/../../.."
. tools/qa/sandbox/snaplib.sh
B=$1; O=$2; V=${3:-titan-day,titan-terminator,titan-backlit,titan-limb,titan-day-sci,titan-low-altitude}
qa_tools; python3 -c "import numpy, PIL" 2>/dev/null || pip install -q numpy pillow >/dev/null 2>&1
C=$(qa_commit); serve_snap $C 4175 || exit 3; serve_snap $(git rev-parse $B) 4174 || exit 4
mkdir -p $O
[ -f $O/cand.done ] || { t=$(qa_t0); bash tools/qa/sandbox/capv.sh 4175 $O/cand "$V" "" "" 0; qa_cost capture $(qa_dt $t) "titan-l2 cand ${C:0:12}"; touch $O/cand.done; }
[ -f $O/base.done ] || { t=$(qa_t0); bash tools/qa/sandbox/capv.sh 4174 $O/base "$V" "" "" 0; qa_cost capture $(qa_dt $t) "titan-l2 base ${B}"; touch $O/base.done; }
[ -f $O/phot.done ] || { t=$(qa_t0); node tools/qa/probe_photometry.mjs --out $O/phot --bodies titan --alpha 20,60,120,150 --rpx 12,0.45 > $O/phot.log 2>&1; qa_cost run $(qa_dt $t) "titan-l2 photometry ${C:0:12}"; touch $O/phot.done; }
echo all-done
