import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
// v3.8: build id (git commit) for screenshot metadata and the diagnostics overlay; 'unknown' outside a git checkout
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'unknown'; } })();
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
  base: './',
  define: { __SOL_VERSION__: JSON.stringify(pkg.version), __SOL_COMMIT__: JSON.stringify(commit) },
  build: { target: 'esnext', outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 4000 },
  server: { port: 5173, open: true },
  preview: { port: 4173 },
});
