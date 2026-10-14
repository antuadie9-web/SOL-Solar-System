#!/bin/bash
# QA-381-02 Level-1 runner: recover the environment (tools, immutable snapshot of HEAD or of the uncommitted tracked tree,
# server on :4175, identity check), then run one QA command against it, logging every phase's cost to work/qa/qa-cost.log.
# usage: tools/qa/sandbox/l1.sh <label> <command...>      (the command reaches the build at http://localhost:4175/)
cd "$(dirname "$0")/../../.."
. tools/qa/sandbox/snaplib.sh
L=$1; shift
qa_tools; python3 -c "import numpy, PIL" 2>/dev/null || { t=$(qa_t0); pip install -q numpy pillow >/dev/null 2>&1; qa_cost pip $(qa_dt $t); }
C=$(qa_commit); serve_snap $C 4175 || exit 3
t=$(qa_t0); "$@" > $Q/$L.log 2>&1; rc=$?
qa_cost run $(qa_dt $t) "$L ${C:0:12} rc=$rc"; echo "rc=$rc build=${C:0:12}"
