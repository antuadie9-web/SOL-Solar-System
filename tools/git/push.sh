#!/bin/bash
# SOL: safe push to the shared source of truth (origin = github.com/antuadie9-web/SOL-Solar-System, branch main).
# Never forces. Refuses any tracked file > 50 MB (GitHub warns at 50, rejects at 100): large binaries go to a GitHub
# release asset or Git LFS instead. Pushes master → main and any new tags, then verifies the remote head.
set -e; cd "$(dirname "$0")/../.."
big=$(git ls-files -z | xargs -0 du -b 2>/dev/null | awk '$1 > 50000000 {print $2}')
[ -z "$big" ] || { echo "refusing: files > 50 MB: $big"; exit 1; }
git push origin master:main
git push origin --tags
r=$(git ls-remote origin refs/heads/main | cut -f1); l=$(git rev-parse master)
[ "$r" = "$l" ] && echo "remote main = $l" || { echo "MISMATCH remote $r local $l"; exit 1; }
