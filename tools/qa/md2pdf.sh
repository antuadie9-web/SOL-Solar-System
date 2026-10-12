#!/bin/bash
# md2pdf.sh <md> — pandoc md -> standalone html (images embedded) -> chromium print-to-pdf
MD=$(realpath $1); D=$(dirname $MD); B=$(basename $MD .md)
cat > /tmp/report.css <<'CSS'
@page { size: A4; margin: 14mm 12mm; }
body { font: 10.5pt/1.45 "DejaVu Sans", sans-serif; color: #111; max-width: none; }
h1 { font-size: 17pt; border-bottom: 2px solid #c8962e; padding-bottom: 3px; margin-top: 18px; page-break-after: avoid; }
h2 { font-size: 13.5pt; margin-top: 14px; page-break-after: avoid; } h3 { font-size: 12pt; }
header#title-block-header h1.title { font-size: 22pt; border: none; } p.subtitle { font-size: 12pt; color: #555; } p.date { color: #777; }
table { border-collapse: collapse; width: 100%; font-size: 8.4pt; margin: 6px 0 10px; page-break-inside: auto; }
th, td { border: 1px solid #bbb; padding: 3px 5px; vertical-align: top; } th { background: #f1ead9; } tr { page-break-inside: avoid; }
figure { margin: 10px 0 14px; page-break-inside: avoid; text-align: center; }
figure img, p > img { max-width: 100%; max-height: 225mm; width: auto; height: auto; border: 1px solid #444; }
figure img[src*="data:image/jpeg"], figure img[src*="data:image/png"] { min-width: 60%; }
figcaption { font-size: 9pt; color: #333; margin-top: 4px; text-align: left; }
code { font-size: 8.8pt; background: #f4f4f4; padding: 0 2px; } pre { font-size: 8pt; background: #f4f4f4; padding: 6px; white-space: pre-wrap; }
CSS
cd $D && pandoc "$B.md" -s --embed-resources --css /tmp/report.css --metadata lang=en -o "/tmp/$B.html" 2>/tmp/pandoc-$B.log || { cat /tmp/pandoc-$B.log; exit 1; }
CH=/usr/lib/chromium/chromium
"$CH" --headless --no-sandbox --disable-gpu --no-pdf-header-footer --print-to-pdf="$D/$B.pdf" "file:///tmp/$B.html" > /tmp/chrome-$B.log 2>&1
ls -la "$D/$B.pdf"
