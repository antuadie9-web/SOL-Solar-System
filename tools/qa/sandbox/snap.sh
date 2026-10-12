#!/bin/bash
# snapshot the candidate working tree into /tmp/cand and (re)start a dev server on :4175 (no hot reload during captures)
R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
P=$(pgrep -f "node /tmp/cand/node_modules/.bin/vite"); [ -n "$P" ] && kill $P; sleep 1
rm -rf /tmp/cand/src; mkdir -p /tmp/cand
cp -r $R/src $R/index.html $R/vite.config.ts $R/package.json $R/tsconfig.json /tmp/cand/
ln -sfn $R/public /tmp/cand/public; ln -sfn $R/node_modules /tmp/cand/node_modules
cd /tmp/cand && (nohup npx vite --port 4175 --strictPort > /tmp/vite-cand.log 2>&1 &)
sleep 4; tail -1 /tmp/vite-cand.log
