#!/bin/bash
# Markdown → standalone HTML (pandoc, images embedded) → PDF (headless Chromium). usage: md2pdf.sh in.md out.pdf
set -e; IN=$(realpath "$1"); OUT=$(realpath -m "$2"); D=$(dirname "$IN"); H=$(mktemp --suffix=.html)
cd "$D" && pandoc "$IN" -s --embed-resources --css "$(dirname "$(realpath "$0")")/report.css" -o "$H" --metadata lang=en
chromium --headless=new --no-sandbox --disable-gpu --no-pdf-header-footer --print-to-pdf="$OUT" "file://$H" 2>/dev/null
rm -f "$H"; ls -la "$OUT"
