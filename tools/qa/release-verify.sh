#!/bin/bash
# SOL v3.8 release verification. Usage: release/verify.sh <zip>  — writes release/verify-report.md + verify-*.json
# 1 clean extraction  2 per-file SHA-256 vs the git tree at the tagged commit  3 asset-manifest + catalogue shard hashes
# 4 v3.7.1 correction presence (every added line of v3.7.0..v3.7.1 present in the release)  5 npm ci + typecheck + assets +
# tests + production build from the extraction  6 runtime boot of the extraction's build in Chromium (software WebGPU):
# failed requests, HTTP >= 400, page errors, WGSL/GPU errors, frames rendered, and Sun / Saturn / Proxima views.
set -u
ZIP=$(realpath "$1"); W=/workspace/work/sol38; R=$W/release; mkdir -p $R; OUT=$R/verify-report.md
X=/tmp/sol-clean; rm -rf $X; mkdir -p $X; cd $X && unzip -q "$ZIP" || { echo "unzip failed"; exit 1; }
TOP=$(ls $X | head -1); E=$X/$TOP
COMMIT=$(cat $E/docs/RELEASE_COMMIT 2>/dev/null || git -C $W/repo rev-parse HEAD)
echo "# Release verification — $(basename $ZIP)" > $OUT; echo "" >> $OUT
echo "- zip: \`$(basename $ZIP)\` · $(stat -c %s $ZIP) bytes · sha256 \`$(sha256sum $ZIP | cut -d' ' -f1)\`" >> $OUT
echo "- extracted to a fresh directory; release commit \`$COMMIT\`; verified $(date '+%F %H:%M %Z')" >> $OUT
# 2 per-file hashes vs git tree
python3 - "$E" "$W/repo" "$COMMIT" >> $OUT <<'EOF'
import sys, subprocess, hashlib, os
E, repo, c = sys.argv[1:4]
tree = subprocess.check_output(['git', '-C', repo, 'ls-tree', '-r', '-z', c]).split(b'\0')
want = {}
for t in tree:
    if not t: continue
    meta, path = t.split(b'\t', 1); mode, typ, sha = meta.split()
    if typ == b'blob': want[path.decode()] = sha.decode()
have = {}
for root, ds, fs in os.walk(E):
    for f in fs:
        p = os.path.join(root, f); have[os.path.relpath(p, E)] = p
missing = [p for p in want if p not in have]; extra = [p for p in have if p not in want]; bad = []
for p, sha in want.items():
    if p in have:
        data = open(have[p], 'rb').read()
        gsha = hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest()
        if gsha != sha: bad.append(p)
tot = sum(os.path.getsize(have[p]) for p in have)
print(f"\n## 1. Contents vs git tree\n- files in tree {len(want)} · in archive {len(have)} · missing {len(missing)} · extra {len(extra)} · content mismatches {len(bad)} · {tot/1e6:.1f} MB extracted")
for name, L in (('missing', missing), ('extra', extra), ('mismatch', bad)):
    for p in L[:20]: print(f"  - {name}: `{p}`")
# also a full SHA-256 list for independent checking
with open(os.path.join(os.path.dirname(os.path.dirname(E)), 'release-sha256.txt') if False else '/workspace/work/sol38/release/release-sha256.txt', 'w') as fo:
    for p in sorted(have): fo.write(hashlib.sha256(open(have[p], 'rb').read()).hexdigest() + '  ' + p + '\n')
print("- SHA-256 of every extracted file: `release-sha256.txt`")
EOF
# 3 asset manifest + shard hashes
python3 - "$E" >> $OUT <<'EOF'
import sys, json, hashlib, os
E = sys.argv[1]; m = json.load(open(f'{E}/docs/assets/asset-manifest.json')); bad = []; n = 0
for a in m['assets']:
    p = f"{E}/public/{a['path']}"; n += 1
    if not os.path.exists(p) or hashlib.sha256(open(p, 'rb').read()).hexdigest() != a['sha256']: bad.append(a['path'])
ix = json.load(open(f'{E}/public/assets/catalogs/stars/index.json')); sb = []
for s in ix['shards']:
    p = f"{E}/public/assets/catalogs/stars/{s['file']}"
    if hashlib.sha256(open(p, 'rb').read()).hexdigest() != s['sha256']: sb.append(s['id'])
print(f"\n## 2. Runtime assets\n- asset manifest: {n} assets checked, {len(bad)} hash mismatches / missing; non-commercial {len(m['nonCommercial'])}: {', '.join(m['nonCommercial'])}")
print(f"- star catalogue: {len(ix['shards'])} shards, {len(sb)} SHA-256 mismatches")
for b in bad[:20]: print(f"  - bad: `{b}`")
EOF
# 4 v3.7.1 corrections present
python3 - "$E" "$W/repo" >> $OUT <<'EOF'
import sys, subprocess, os
E, repo = sys.argv[1:3]
diff = subprocess.check_output(['git', '-C', repo, 'diff', '-U0', 'v3.7.0', 'v3.7.1']).decode('utf-8', 'replace')
cur = None; added = {}
for ln in diff.split('\n'):
    if ln.startswith('+++ b/'): cur = ln[6:]
    elif ln.startswith('+') and not ln.startswith('+++') and cur:
        s = ln[1:].strip()
        if len(s) > 12: added.setdefault(cur, []).append(s)
miss = {}; tot = 0
for f, lines in added.items():
    p = os.path.join(E, f)
    txt = open(p, encoding='utf-8', errors='replace').read() if os.path.exists(p) else ''
    for s in lines:
        tot += 1
        if s not in txt: miss.setdefault(f, []).append(s)
nm = sum(len(v) for v in miss.values())
print(f"\n## 3. v3.7.1 corrections present in the release\n- {tot} substantive added lines (> 12 chars) in v3.7.0..v3.7.1 across {len(added)} files; {nm} not found verbatim")
for f, v in miss.items():
    print(f"  - `{f}`: {len(v)} line(s) not verbatim, e.g. `{v[0][:110]}`")
EOF
echo "" >> $OUT
# 5 install + check
cd $E
( npm ci --no-audit --no-fund > $R/verify-npm-ci.log 2>&1; echo "npm ci exit $?" ) >> $R/verify-steps.log
for s in typecheck assets test build; do ( timeout 900 npm run $s > $R/verify-$s.log 2>&1; echo "$s exit $?" ) >> $R/verify-steps.log; done
echo "## 4. Install, typecheck, assets, tests, build (from the extraction)" >> $OUT
sed 's/^/- /' $R/verify-steps.log >> $OUT
grep -E "^ℹ (tests|pass|fail)" $R/verify-test.log | sed 's/^/  - /' >> $OUT
grep -E "assets [0-9]+" $R/verify-assets.log | sed 's/^/  - /' >> $OUT
echo "" >> $OUT
echo "verify part A done"
# 6 runtime boot from the extraction's own build (dist/) — software WebGPU
/workspace/work/sol38/setup-env.sh >/dev/null 2>&1
PORT=$((5300 + RANDOM % 500)); python3 -m http.server $PORT --directory $E/dist > /dev/null 2>&1 & SRV=$!; sleep 1
mkdir -p $R/boot; cd $E
node tools/qa/smoke.mjs --software --url "http://localhost:$PORT/?qa-off=small,smallcompute" --script boot38 --out $R/boot --wait 120000 --w 1600 --h 900 > $R/verify-boot.log 2>&1; BE=$?
kill $SRV
python3 - $R/boot/result.json $BE >> $OUT <<'PY'
import json, sys
r = json.load(open(sys.argv[1])); sc = r.get('scenario') or {}
log = r.get('log', [])
fails = [l for l in log if '[requestfailed]' in l]; http = [l for l in log if '[http ' in l]; perr = [l for l in log if '[pageerror]' in l]
print("## 5. Runtime boot from the clean extraction (software WebGPU)")
print(f"- smoke exit {sys.argv[2]} · ready {r.get('ready')} · boot {r.get('bootMs')} ms · adapter {((r.get('state') or {}).get('gpu') or {})}")
print(f"- failed requests {len(fails)} · HTTP ≥ 400 {len(http)} · page errors {len(perr)} · WGSL/GPU errors {len(r.get('gpuErrors', []))}")
print(f"- resources loaded {sc.get('resourceCount')} ({(sc.get('resourceBytes') or 0)/1e6:.1f} MB transferred)")
for v in sc.get('views', []): print(f"- view {v['name']}: found {v['found']}, frames {v['framesRendered']}, selected {v['selected']}, exposure {v['exposureEV']} EV, finite {v['finite']}, catalogue {v.get('catalog')}")
for l in (fails + http + perr)[:20]: print(f"  - `{l[:160]}`")
PY
echo "verify complete: $OUT"
