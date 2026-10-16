// QA-381-05: in-process static server for an IMMUTABLE built snapshot (tools/qa/sandbox/snaplib.sh build_snap). The QA
// sandbox reaps detached processes and wipes /tmp every 15–60 min; a vite dev server started by an earlier job died in the
// middle of probe sessions ("Failed to fetch" for every texture requested after it → maps stuck at placeholder and samples
// rejected). The server now lives inside the probe process, serving <snap>/dist (the vite build) and then <snap>/public
// (assets are not copied into dist). Its lifetime is the probe's.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.gz': 'application/gzip' };
export async function startSnapServer(snap) {
  const roots = [path.join(snap, 'dist'), path.join(snap, 'public')];
  if (!fs.existsSync(path.join(roots[0], 'index.html'))) throw new Error('snapshot has no dist/index.html: ' + snap);
  const stats = { requests: 0, missing: [] };
  const srv = http.createServer((req, res) => {
    stats.requests++;
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    for (const r of roots) {
      const f = path.join(r, p); if (!f.startsWith(r)) break;
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] ?? 'application/octet-stream', 'content-length': fs.statSync(f).size, 'cache-control': 'no-store' });
        fs.createReadStream(f).pipe(res); return;
      }
    }
    stats.missing.push(p); res.writeHead(404); res.end();      // a real 404 (vite dev served index.html for missing files)
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}/`, stats, close: () => srv.close() };
}
