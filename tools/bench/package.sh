#!/bin/bash
# Build the self-contained benchmark package: pre-built app (dist) + launcher + servers + README. No node_modules.
# usage: tools/bench/package.sh <out.zip>
set -e
R=$(cd "$(dirname "$0")/../.." && pwd); OUT=$(realpath -m "$1"); T=$(mktemp -d)
cd "$R" && npx vite build --outDir "$T/SOL-benchmark/dist" --emptyOutDir --logLevel warn
mkdir -p "$T/SOL-benchmark/tools/bench" "$T/SOL-benchmark/src/qa"
cp tools/bench/RUN-SOL-BENCHMARK-WINDOWS.bat tools/bench/serve.mjs tools/bench/serve.ps1 tools/bench/README.md "$T/SOL-benchmark/tools/bench/"
cp src/qa/bench.ts "$T/SOL-benchmark/src/qa/"; cp tools/bench/README.md "$T/SOL-benchmark/README-BENCHMARK.md"; cp CREDITS.md "$T/SOL-benchmark/"
printf '%s\r\n' '@echo off' 'call "%~dp0tools\bench\RUN-SOL-BENCHMARK-WINDOWS.bat"' > "$T/SOL-benchmark/RUN-SOL-BENCHMARK-WINDOWS.bat"
( cd "$T" && find SOL-benchmark -type f -print0 | sort -z | xargs -0 sha256sum > SOL-benchmark/SHA256SUMS.txt && rm -f "$OUT" && zip -qr -X "$OUT" SOL-benchmark )
rm -rf "$T"; ls -la "$OUT"
