#!/bin/bash
# WP-E shared-change regression (MS similarity scaling + limb meter): Venus/Mars/Earth/Jupiter + Titan backlit.
# usage: wpe_reg.sh <baseline-commit> <out-dir>   (resumable; run until it prints all-done)
cd "$(dirname "$0")/../../.."
. tools/qa/sandbox/snaplib.sh
B=$1; O=$2
V=venus-day,venus-terminator,venus-backlit,mars-day,mars-terminator,mars-backlit,mars-jezero-ground,earth-terminator,earth-limb,earth-sunset-limb,jupiter-day,jupiter-terminator,titan-backlit
qa_tools; python3 -c "import numpy, PIL" 2>/dev/null || pip install -q numpy pillow >/dev/null 2>&1
C=$(qa_commit); mkdir -p $O
if [ ! -f $O/cand.done ]; then serve_snap $C 4175 || exit 3; t=$(qa_t0); bash tools/qa/sandbox/capv.sh 4175 $O/cand "$V" "" "" 0; qa_cost capture $(qa_dt $t) "wpe-reg cand ${C:0:12}"; touch $O/cand.done; exit 0; fi
if [ ! -f $O/base.done ]; then serve_snap $(git rev-parse $B) 4174 || exit 4; t=$(qa_t0); bash tools/qa/sandbox/capv.sh 4174 $O/base "$V" "" "" 0; qa_cost capture $(qa_dt $t) "wpe-reg base ${B}"; touch $O/base.done; exit 0; fi
if [ ! -f $O/phot.done ]; then serve_snap $C 4175 || exit 3; t=$(qa_t0); node tools/qa/probe_photometry.mjs --out $O/phot --bodies venus,mars,jupiter --alpha 30,120,150 --rpx 12,0.45 > $O/phot.log 2>&1; qa_cost run $(qa_dt $t) "wpe-reg photometry ${C:0:12}"; touch $O/phot.done; exit 0; fi
echo all-done
