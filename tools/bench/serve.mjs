// SOL benchmark kit — zero-dependency static file server (Node.js built-ins only; no npm install, no network access).
// Serves ./dist (or the folder given as the first argument) on http://127.0.0.1:4173/ — bound to the loopback interface,
// so nothing on your network (or the internet) can connect to it. Stop it with Ctrl+C or by closing its window.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', 'dist'));
const port = +(process.env.PORT || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
if (!fs.existsSync(path.join(root, 'index.html'))) { console.error(`No index.html in ${root}. This package must contain the built app (dist).`); process.exit(1); }
http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  const p = path.normalize(path.join(root, u === '/' ? 'index.html' : u));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(p, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(p).pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log(`SOL is being served from ${root}\nOpen http://localhost:${port}/?bench=1 (benchmark) or http://localhost:${port}/ (normal use). Close this window to stop.`));
