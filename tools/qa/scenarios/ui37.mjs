// SOL v3.7 UI evidence set (spec §36): interface states captured with the real UI visible (no cinematic hide).
import path from 'node:path';
import fs from 'node:fs';
const EPOCH_MS = Date.UTC(2026, 9, 8, 12, 0, 0);
const STEPS = [
  ['ui-overview', async (s) => { s.ui.select(s.sys.get('earth'), false); s.engine.rig.goTo(s.sys.get('earth'), { dur: 0.01 }); }],
  ['ui-search', async (s) => { s.ui.openPalette(); const i = document.querySelector('#palette input'); i.value = 'sat'; s.ui.searchPalette('sat'); }],
  ['ui-inspector-saturn-rings', async (s) => { s.ui.closePalette?.(); const b = s.sys.get('saturn'); s.ui.select(b, false); s.engine.rig.goTo(b, { dur: 0.01 }); s.ui.tab = 'physical'; s.ui.renderPane(); await new Promise(r => setTimeout(r, 300)); const t = document.querySelector('#inspector table.rings'); t?.scrollIntoView({ block: 'center' }); }],
  ['ui-inspector-uranus-rings', async (s) => { const b = s.sys.get('uranus'); s.ui.select(b, false); s.engine.rig.goTo(b, { dur: 0.01 }); s.ui.tab = 'physical'; s.ui.renderPane(); await new Promise(r => setTimeout(r, 300)); document.querySelector('#inspector table.rings')?.scrollIntoView({ block: 'center' }); }],
  ['ui-inspector-mars-atmosphere', async (s) => { const b = s.sys.get('mars'); s.ui.select(b, false); s.engine.rig.goTo(b, { dur: 0.01 }); s.ui.tab = 'physical'; s.ui.renderPane(); await new Promise(r => setTimeout(r, 300)); [...document.querySelectorAll('#inspector .kicker')].find(k => /Atmosphere/.test(k.textContent))?.scrollIntoView({ block: 'start' }); }],
  ['ui-provenance-evidence', async (s) => { const b = s.sys.get('moon'); s.ui.select(b, false); s.engine.rig.goTo(b, { dur: 0.01 }); s.ui.tab = 'evidence'; s.ui.renderPane(); }],
  ['ui-settings-graphics-rings-atmospheres', async (s) => { s.ui.openSettings(); s.ui.setTab = 'graphics'; s.ui.paintSettings(); await new Promise(r => setTimeout(r, 200)); [...document.querySelectorAll('#settings h3')].find(h => /Rings/.test(h.textContent))?.scrollIntoView({ block: 'start' }); }],
  ['ui-settings-graphics-top', async (s) => { s.ui.setTab = 'graphics'; s.ui.paintSettings(); await new Promise(r => setTimeout(r, 200)); document.querySelector('#settings h3')?.scrollIntoView({ block: 'start' }); }],
  ['ui-journeys', async (s) => { s.ui.closeSettings(); s.ui.openPanel('journeys'); }],
  ['ui-camera-help', async (s) => { s.ui.openPanel(null); s.ui.action('help'); }],
  ['ui-diagnostics', async (s) => { s.ui.action('help'); s.settings.set('showDiagnostics', true); s.settings.set('showFps', true); }],
  ['ui-mode-badge-ring-enhancement', async (s) => { s.settings.set('showDiagnostics', false); const b = s.sys.get('jupiter'); s.ui.select(b, false); s.engine.rig.goTo(b, { dur: 0.01, dist: 700000 }); }],
  ['ui-ring-labels-saturn', async (s) => { s.settings.set('ringLabels', true); const b = s.sys.get('saturn'); s.ui.select(b, false); s.engine.rig.goTo(b, { dur: 0.01, dist: 600000 }); }],
];
export default async function (page, { out }) {
  await page.evaluate((ms) => { const s = window.__sol; document.querySelector('#loader .enter, #loader .ld-enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    s.clock.paused = true; s.clock.set(ms / 86400000 + 2440587.5 + 69.184 / 86400); s.advance(); document.body.classList.remove('cine'); }, EPOCH_MS);
  const shots = [];
  for (const [name, fn] of STEPS) {
    await page.evaluate(`(${fn.toString()})(window.__sol)`);
    await page.evaluate(() => new Promise(res => { const s = window.__sol, f0 = window.__frames; const chk = () => { s.engine.settleExposure(); window.__frames - f0 >= 6 ? res(0) : requestAnimationFrame(chk); }; chk(); }));
    await page.waitForTimeout(400);
    const meta = await page.evaluate((name) => { const s = window.__sol, e = s.engine; return { image: name + '.png', version: window.__solVersion, kind: 'ui', selected: s.ui.sel?.id ?? null, viewingMode: s.settings.get('viewMode'), enhancement: e.enhancement, simJdTT: s.sys.jd, adapter: e.diagnostics().adapter, resolution: [innerWidth * devicePixelRatio, innerHeight * devicePixelRatio], limitations: 'Software WebGPU (SwiftShader) capture' }; }, name);
    const file = path.join(out, `${name}.png`); await page.screenshot({ path: file, timeout: 180000 });
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(meta, null, 1)); shots.push({ name, file }); console.error('captured', name);
  }
  return { shots };
}
