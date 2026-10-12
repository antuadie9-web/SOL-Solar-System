// Bundles each tests/**/*.test.ts with esbuild (JSON + TS) and runs them with node:test. Non-zero exit on any failure.
import { build } from 'esbuild';
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const files = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.test.ts')) files.push(p); } };
walk('tests'); const only = process.argv[2]; const sel = only ? files.filter(f => f.includes(only)) : files;
fs.mkdirSync('.cache/tests', { recursive: true });
const outs = [];
for (const f of sel) { const o = `.cache/tests/${f.replace(/[\/\\]/g, '_').replace(/\.ts$/, '.cjs')}`; await build({ entryPoints: [f], bundle: true, platform: 'node', format: 'cjs', outfile: o, loader: { '.json': 'json' }, logLevel: 'warning', define: { 'import.meta.env': '{}' } }); outs.push(o); }
const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...outs], { stdio: 'inherit' });
process.exit(r.status ?? 1);
