#!/bin/bash
# TI-03 diagnostic: titan-backlit with post effects removed one at a time (candidate HEAD snapshot)
cd "$(dirname "$0")/../../.."
. tools/qa/sandbox/snaplib.sh
qa_tools; python3 -c "import numpy, PIL" 2>/dev/null || pip install -q numpy pillow >/dev/null 2>&1
C=$(qa_commit); serve_snap $C 4175 || exit 3
O=../../qa/ti03; mkdir -p $O
for k in none bloom glare bloom,glare; do
  [ -f $O/$k.done ] && continue
  q=","$k; [ $k = none ] && q=""
  t=$(qa_t0); bash tools/qa/sandbox/capv.sh 4175 $O/$k titan-backlit "$q" "" 0; qa_cost capture $(qa_dt $t) "ti03 $k ${C:0:12}"; touch $O/$k.done
done
echo all-done
