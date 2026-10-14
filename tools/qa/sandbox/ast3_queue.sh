#!/bin/bash
# AST-381-03 acceptance queue: matched cp2-tag (:4177) vs current HEAD (:4175) for the six partial-mosaic bodies —
# far (3.2 R, existing views) + PARTIALNEAR (1.7 R at boundary latitude, az 20/70). Resumable: one .done per stage;
# current-build stages are keyed by commit hash so images from different builds are never mixed.
Q=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/qa; R=/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work/src380/sol-solar-system-v3.8-final; cd $R
H=$(git log -1 --format=%h -- src public);   # last commit touching the build inputs
 [ -z "$(git status --porcelain src public)" ] || { echo "dirty tree"; exit 1; }
[ -x /tmp/snap.sh ] || bash tools/qa/sandbox/setup.sh > $Q/setup.log 2>&1   # sandbox reset wiped /tmp
[ -x /tmp/snap.sh ] || { echo 'setup failed'; exit 1; }
cap() { DPR=1 VIEWS="$3" timeout 4000 node tools/qa/smoke.mjs --software --url "http://localhost:$1/?qa-off=small,smallcompute" --script golden38 --out $Q/$2 --wait 180000 --w 1280 --h 720 > $Q/$2.log 2>&1 && echo "$4" > $Q/$2/BUILD && echo DONE > $Q/$2.done; }
# Both sides are IMMUTABLE git-object snapshots (owner reviews 2026-10-14): cp2 = tag v3.8.1-cp2 on :4177, candidate =
# commit $H on :4175. Code and every public file are extracted with git archive (no links into the mutable working
# tree; node_modules is the only link, three pinned 0.186.1 on both). manifest.txt = "<blob> <path>" of the commit;
# verify_snap re-hashes a snapshot before every capture batch and refuses to capture if anything differs.
PATHS="src public index.html vite.config.ts package.json tsconfig.json"
verify_snap() {  # dir label
  (cd $1 && cut -d' ' -f2- manifest.txt | git --git-dir=$R/.git hash-object --stdin-paths) > /tmp/snap.hashes || return 1
  diff -q <(cut -d' ' -f1 $1/manifest.txt) /tmp/snap.hashes >/dev/null || { echo "$2 snapshot identity FAILED"; return 1; }
  echo "$2 snapshot verified: $(wc -l < $1/manifest.txt) files == git blobs ($(date -u +%FT%TZ))" | tee -a $Q/snapshot-identity.txt
}
serve_snap() {  # commit dir port
  if ! curl -s -o /dev/null localhost:$3/ || [ ! -f $2/manifest.txt ]; then
    P=$(pgrep -f "[v]ite --port $3"); [ -n "$P" ] && kill $P; sleep 1
    if [ ! -f $2/manifest.txt ]; then
      rm -rf $2 && mkdir -p $2 && git archive $1 -- $PATHS | tar -x -C $2
      git ls-tree -r $1 -- $PATHS | awk '{print $3" "$4}' > $2/manifest.tmp && mv $2/manifest.tmp $2/manifest.txt
      ln -sfn $R/node_modules $2/node_modules
      echo "snapshot built $(date -u +%FT%TZ): git archive $1 -> $2" >> $Q/snapshot-identity.txt
    fi
    (cd $2 && setsid nohup npx vite --port $3 --strictPort > /tmp/vite-$3.log 2>&1 &); sleep 10
  fi
}
CP2DIR=/tmp/cp2tag-v3; CANDDIR=/tmp/cand-$H
P=$(pgrep -f "[n]ode /tmp/cand/node_modules/.bin/vite"); [ -n "$P" ] && kill $P   # retire the old working-tree candidate server
serve_snap v3.8.1-cp2 $CP2DIR 4177; serve_snap $H $CANDDIR 4175
verify_cp2() { serve_snap v3.8.1-cp2 $CP2DIR 4177; verify_snap $CP2DIR "v3.8.1-cp2"; }
verify_cand() { serve_snap $H $CANDDIR 4175; verify_snap $CANDDIR "candidate $H"; }
/tmp/snap.sh > /dev/null; sleep 5
FAR="moon381-ariel-1986,moon381-titania-1986,moon381-oberon-1986,partial-triton-north,partial-pluto-south-1988,partial-charon-south-1988"
for n in oberon triton charon pluto ariel titania; do NEAR="pnear-$n-az20,pnear-$n-az70"
  [ -f $Q/ast3-$H-$n.done ] || { verify_cand || exit 3; cap 4175 ast3-$H-$n "$NEAR" "current $H (immutable snapshot verified)"; }
  [ -f $Q/ast3-cp2-$n.done ] || { verify_cp2 || exit 3; cap 4177 ast3-cp2-$n "$NEAR" "v3.8.1-cp2 f4974e8 (tag assets, immutable snapshot verified)"; }
done
[ -f $Q/ast3-$H-far.done ] || { verify_cand || exit 3; cap 4175 ast3-$H-far "$FAR" "current $H (immutable snapshot verified)"; }
[ -f $Q/ast3-cp2-far.done ] || { verify_cp2 || exit 3; cap 4177 ast3-cp2-far "$FAR" "v3.8.1-cp2 f4974e8 (tag assets, immutable snapshot verified)"; }
# completion: every required image of THIS candidate and of the tag baseline, with matching BUILD records
ok=1
for n in oberon triton charon pluto ariel titania; do for az in 20 70; do
  [ -s $Q/ast3-$H-$n/pnear-$n-az$az.png ] || { echo "missing current $n az$az"; ok=0; }
  [ -s $Q/ast3-cp2-$n/pnear-$n-az$az.png ] || { echo "missing cp2 $n az$az"; ok=0; }
done; grep -q "current $H" $Q/ast3-$H-$n/BUILD 2>/dev/null || { echo "BUILD mismatch $n"; ok=0; }; done
for v in ${FAR//,/ }; do [ -s $Q/ast3-$H-far/$v.png ] || { echo "missing current far $v"; ok=0; }; [ -s $Q/ast3-cp2-far/$v.png ] || { echo "missing cp2 far $v"; ok=0; }; done
grep -q "tag assets" $Q/ast3-cp2-far/BUILD 2>/dev/null || { echo "cp2 far not tag-asset build"; ok=0; }
[ $ok = 1 ] && echo ALL > $Q/ast3-$H.done && echo "ACCEPTANCE SET COMPLETE $H"
