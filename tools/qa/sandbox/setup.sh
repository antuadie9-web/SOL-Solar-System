#!/bin/bash
# Recreate the ephemeral QA environment (the sandbox root and /tmp can be reset between sessions). Outputs go to the
# persistent work/qa directory. Servers: baseline v3.8.0-supplied :4174 (with its original Uranian maps/stats), candidate :4175.
R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
which chromium >/dev/null || (sudo -n apt-get update -qq; sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y -qq chromium fonts-dejavu-core libvulkan1 mesa-vulkan-drivers poppler-utils >/dev/null 2>&1)
python3 -c "import scipy" 2>/dev/null || pip install -q scipy 2>/dev/null
mkdir -p /workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa/sheets
B=/tmp/base
if [ ! -e $B/src ]; then mkdir -p $B; cd $R && git archive v3.8.0-supplied -- src index.html vite.config.ts package.json tsconfig.json | tar -x -C $B
  mkdir -p $B/public/assets/tex $B/public/assets/data; ln -sfn $R/node_modules $B/node_modules
  for d in $R/public/*; do n=$(basename $d); [ "$n" != assets ] && ln -sfn $d $B/public/$n; done
  for d in $R/public/assets/*; do n=$(basename $d); [ "$n" != tex ] && [ "$n" != data ] && ln -sfn $d $B/public/assets/$n; done
  for f in $R/public/assets/tex/* $R/public/assets/data/*; do ln -sfn $f $B/public/assets/$(basename $(dirname $f))/$(basename $f); done
  for f in tex/ariel.jpg tex/titania.jpg tex/oberon.jpg data/texstats.json data/texstats_hi.json; do rm -f $B/public/assets/$f; git -C $R show v3.8.0-supplied:public/assets/$f > $B/public/assets/$f; done
fi
pgrep -f "vite --port 4174" >/dev/null || (cd $B && nohup npx vite --port 4174 --strictPort > /tmp/vite-base.log 2>&1 &)
cp $R/tools/qa/sandbox/snap.sh $R/tools/qa/sandbox/capv.sh $R/tools/qa/sandbox/sheet.py /tmp/; chmod +x /tmp/*.sh
/tmp/snap.sh
