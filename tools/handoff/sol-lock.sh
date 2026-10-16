#!/usr/bin/env bash
# SOL repository lease lock (work tree exclusivity for autonomous sessions).
# usage: sol-lock.sh acquire <owner-id> | beat <owner-id> | release <owner-id> | status
# - acquire is atomic (mkdir). Exit 0 = you own it; exit 1 = held by a live owner → defer/skip; exit 2 = usage.
# - lease = time since the owner's last heartbeat (not since start). Owner must `beat` before every long step
#   (each shell job is ≤ 20 min, so beats are never > ~25 min apart). Stale after STALE_MIN (default 45) without a beat.
# - stale recovery: rename the old dir aside atomically (mv), keep it as evidence, then retry mkdir.
# - legacy compat: a plain-file work/.sol-lock younger than 75 min also counts as held.
# - hard ceiling: a lease older than MAX_H hours (default 6) since acquire is stale even if beats continue (runaway guard).
set -u
W=${SOL_WORK:-/workspace/projects/8d0bae14-e35b-4bd2-a140-a931eb700554/work}
D=${SOL_LOCKDIR:-$W/.sol-lock.d}; LEG=$W/.sol-lock
STALE_MIN=${STALE_MIN:-45}; MAX_H=${MAX_H:-6}
now(){ date +%s; }
age_min(){ echo $(( ( $(now) - $(stat -c %Y "$1") ) / 60 )); }
owner(){ cat "$D/owner" 2>/dev/null | head -1; }
log(){ echo "$(date -u +%FT%TZ) $*" >> "$W/.sol-lock.log"; }
is_stale(){
  [ -d "$D" ] || return 0
  [ -f "$D/beat" ] || { [ $(age_min "$D") -ge 5 ] && return 0 || return 1; }   # half-created dir: 5 min grace
  [ $(age_min "$D/beat") -ge $STALE_MIN ] && return 0
  [ -f "$D/start" ] && [ $(( ( $(now) - $(cat "$D/start") ) / 3600 )) -ge $MAX_H ] && return 0
  return 1
}
cmd=${1:-}; id=${2:-}
case "$cmd" in
  acquire)
    [ -n "$id" ] || exit 2
    if [ -f "$LEG" ] && [ $(age_min "$LEG") -lt 75 ]; then log "acquire $id DEFER legacy-file"; echo "held (legacy file, $(age_min "$LEG") min): $(cat "$LEG")"; exit 1; fi
    # activity guard (covers sessions on the legacy file or a lost beat): live QA jobs or work-tree edits < 20 min old → defer
    R=${SOL_REPO:-$W/src380/sol-solar-system-v3.8-final}
    if [ -z "${SOL_NO_ACTIVITY_GUARD:-}" ] && [ ! -d "$D" ] || is_stale; then
      if [ -z "${SOL_NO_ACTIVITY_GUARD:-}" ]; then
        if ps -eo args | grep -E "probe_photometry|continuity_travel|l1\.sh|_queue\.sh|wpe_reg|titan_l2|mars_[a-z]+\.sh" | grep -vq -e grep -e sol-lock; then log "acquire $id DEFER live QA job"; echo "held (live QA job running)"; exit 1; fi
        if [ -d "$R" ] && [ -n "$(cd "$R" && git status --porcelain 2>/dev/null | awk '{print $2}' | grep -v ephemeris-residuals | while read f; do [ -n "$(find "$f" -newermt '-20 minutes' 2>/dev/null | head -1)" ] && echo "$f"; done | head -1)" ]; then log "acquire $id DEFER recent work-tree edits"; echo "held (uncommitted work-tree edits < 20 min old)"; exit 1; fi
      fi
    fi
    for try in 1 2; do
      if mkdir "$D" 2>/dev/null; then
        echo "$id" > "$D/owner"; now > "$D/start"; touch "$D/beat"; log "acquire $id OK"; echo "acquired by $id"; exit 0
      fi
      if [ "$(owner)" = "$id" ]; then touch "$D/beat"; echo "already owner $id"; exit 0; fi
      if is_stale; then mv "$D" "$D.stale.$(now)" 2>/dev/null && log "acquire $id RECOVERED stale lease of $(cat "$D".stale.*/owner 2>/dev/null | tail -1)"; continue; fi
      log "acquire $id DEFER held by $(owner)"; echo "held by $(owner) (last beat $(age_min "$D/beat") min ago)"; exit 1
    done; exit 1 ;;
  beat)
    [ "$(owner)" = "$id" ] || { echo "NOT OWNER (owner=$(owner)) — stop modifying the work tree"; log "beat $id LOST"; exit 1; }
    touch "$D/beat"; echo ok ;;
  release)
    [ "$(owner)" = "$id" ] || { echo "not owner"; exit 1; }
    rm -rf "$D"; log "release $id"; echo released ;;
  status)
    if [ -d "$D" ]; then echo "lease: owner=$(owner) beat=$(age_min "$D/beat")min stale=$(is_stale && echo yes || echo no)"; else echo "lease: free"; fi
    [ -f "$LEG" ] && echo "legacy file: $(age_min "$LEG") min: $(cat "$LEG")" ; true ;;
  *) exit 2 ;;
esac
