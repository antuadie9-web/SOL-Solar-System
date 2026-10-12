#!/bin/bash
# Recreate the ephemeral QA environment (/tmp is wiped between sessions). Run from anywhere.
R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
which chromium >/dev/null || (sudo -n apt-get update -qq; sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y -qq chromium fonts-dejavu-core libvulkan1 mesa-vulkan-drivers poppler-utils)
python3 -c "import scipy" 2>/dev/null || pip install -q scipy
mkdir -p /tmp/qa/sheets /tmp/base
if [ ! -e /tmp/base/src ]; then cd $R && git archive v3.8.0-supplied -- src index.html vite.config.ts package.json tsconfig.json | tar -x -C /tmp/base; ln -sfn $R/public /tmp/base/public; ln -sfn $R/node_modules /tmp/base/node_modules; fi
pgrep -f "vite --port 4174" >/dev/null || (cd /tmp/base && nohup npx vite --port 4174 --strictPort > /tmp/vite-base.log 2>&1 &)
cp $R/tools/qa/sandbox/snap.sh $R/tools/qa/sandbox/capv.sh $R/tools/qa/sandbox/sheet.py /tmp/ ; chmod +x /tmp/*.sh
/tmp/snap.sh
