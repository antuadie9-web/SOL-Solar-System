#!/bin/bash
# QA-381-02 lean QA environment (source it). Every served build is an IMMUTABLE git-object snapshot with a blob manifest
# (QA-381-01 rule); every step's wall-clock cost is appended to work/qa/qa-cost.log so optimisation targets measured cost.
#   . tools/qa/sandbox/snaplib.sh
#   qa_tools                      # chromium + vulkan (only when missing)
#   C=$(qa_commit)                # HEAD, or a dangling commit of the uncommitted tracked tree (git stash create) for L1 diagnostics
#   serve_snap $C 4175            # build /tmp/snap-<sha12> once, (re)start vite on the port, verify identity
#   verify_snap /tmp/snap-<sha12> # re-hash before every batch; non-zero = refuse to capture
R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa
PATHS="src public index.html vite.config.ts package.json tsconfig.json"
mkdir -p $Q
qa_cost() { echo "$(date -u +%FT%TZ) $1 ${2}s ${3:-}" >> $Q/qa-cost.log; }
qa_t0() { date +%s.%N; }
qa_dt() { python3 -c "import sys;print(round($(date +%s.%N)-$1,1))"; }
qa_tools() {
  local t=$(qa_t0)
  which chromium >/dev/null 2>&1 && return 0
  sudo -n apt-get update -qq >/dev/null 2>&1; sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y -qq chromium fonts-dejavu-core libvulkan1 mesa-vulkan-drivers >/dev/null 2>&1
  qa_cost tools-install $(qa_dt $t)
}
qa_commit() { local c; c=$(git -C $R stash create 2>/dev/null); [ -z "$c" ] && c=$(git -C $R rev-parse HEAD); echo $c; }
verify_snap() {
  local t=$(qa_t0)
  (cd $1 && cut -d' ' -f2- manifest.txt | git --git-dir=$R/.git hash-object --stdin-paths) > /tmp/snap.hashes || return 1
  diff -q <(cut -d' ' -f1 $1/manifest.txt) /tmp/snap.hashes >/dev/null || { echo "snapshot identity FAILED: $1"; return 1; }
  echo "$(date -u +%FT%TZ) verified $1 ($(wc -l < $1/manifest.txt) files == git blobs)" >> $Q/snapshot-identity.txt
  qa_cost verify $(qa_dt $t) $1
}
serve_snap() {  # commit port
  local c=$(git -C $R rev-parse $1) d t=$(qa_t0); d=/tmp/snap-${c:0:12}
  if [ ! -f $d/manifest.txt ]; then
    rm -rf $d && mkdir -p $d && git -C $R archive $c -- $PATHS | tar -x -C $d
    git -C $R ls-tree -r $c -- $PATHS | awk '{print $3" "$4}' > $d/manifest.tmp && mv $d/manifest.tmp $d/manifest.txt
    ln -sfn $R/node_modules $d/node_modules
    echo "$(date -u +%FT%TZ) snapshot built: $c -> $d" >> $Q/snapshot-identity.txt
    qa_cost snapshot-build $(qa_dt $t) ${c:0:12}
  fi
  # QA-381-05: a server started by an earlier background job dies when that job's process tree is reaped (often a minute
  # into the next job: "Failed to fetch" for every texture, maps stuck at placeholder). Each job owns its own server.
  [ -n "$QA_JOB" ] || export QA_JOB="$$-$(date +%s%N)"
  if [ "$(cat /tmp/port-$2 2>/dev/null)" != "$c $QA_JOB" ] || ! curl -s -o /dev/null localhost:$2/; then
    t=$(qa_t0); local P=$(pgrep -f "[v]ite --port $2"); [ -n "$P" ] && kill $P; sleep 1
    (cd $d && setsid nohup sh -c "npx vite --port $2 --strictPort; echo \"\$(date +%T) vite exit \$?\"" < /dev/null >> /tmp/vite-$2.log 2>&1 &)
    for k in $(seq 60); do curl -s -o /dev/null localhost:$2/ && break; sleep 0.5; done
    echo "$c $QA_JOB" > /tmp/port-$2; qa_cost server-start $(qa_dt $t) "${c:0:12}:$2"
  fi
  verify_snap $d
}
# QA-381-05: build_snap <commit> → echo dir. A PERSISTENT built snapshot (work/qa/snaps/<sha12>, survives /tmp wipes):
# git-archive of PATHS + blob manifest (verified like serve_snap) + `vite build` into dist/ without copying public/.
# Probes serve it in-process: node tools/qa/probe_photometry.mjs --snap $(build_snap $C) ...
build_snap() {
  local c=$(git -C $R rev-parse $1) t=$(qa_t0) d; d=$Q/snaps/${c:0:12}
  if [ ! -f $d/dist/index.html ]; then
    rm -rf $d && mkdir -p $d && git -C $R archive $c -- $PATHS | tar -x -C $d
    git -C $R ls-tree -r $c -- $PATHS | awk '{print $3" "$4}' > $d/manifest.tmp && mv $d/manifest.tmp $d/manifest.txt
    ln -sfn $R/node_modules $d/node_modules
    printf "import base from './vite.config.ts';\nexport default { ...base, build: { ...base.build, copyPublicDir: false, outDir: 'dist' } };\n" > $d/vite.qa.config.mjs
    (cd $d && npx vite build -c vite.qa.config.mjs > build.log 2>&1) || { echo "build FAILED $d" >&2; return 1; }
    echo "$(date -u +%FT%TZ) snapshot built+compiled: $c -> $d" >> $Q/snapshot-identity.txt
    qa_cost snapshot-build-dist $(qa_dt $t) ${c:0:12}
    # keep the 4 newest snapshots
    ls -dt $Q/snaps/*/ 2>/dev/null | tail -n +5 | xargs -r rm -rf
  fi
  verify_snap $d >&2 || return 1
  echo $d
}
