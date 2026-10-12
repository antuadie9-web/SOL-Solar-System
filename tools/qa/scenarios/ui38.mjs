// SOL v3.8 UI/UX + accessibility evidence (spec §33–37, §55). Real UI visible; keyboard-only workflows are driven with
// page.keyboard (trusted key events), and an automated audit records: interactive elements without an accessible name,
// pointer targets smaller than 24 px, WCAG contrast of visible text, whether Tab reaches the interface from the viewport,
// whether typing in search moves the camera, and the focus ring of the focused element. Results go to ui38-audit.json.
import fs from 'node:fs'; import path from 'node:path';
const EPOCH_MS = Date.UTC(2026, 9, 8, 12, 0, 0);
export default async function (page, { out }) {
  const shots = [], audit = { steps: [] };
  const settle = (n = 6) => page.evaluate((n) => new Promise(res => { const s = window.__sol, f0 = window.__frames; const chk = () => { s.engine.settleExposure(); window.__frames - f0 >= n ? res(0) : requestAnimationFrame(chk); }; chk(); }), n);
  const snap = async (name, note = '') => {
    await settle(); await page.waitForTimeout(350);
    const meta = await page.evaluate(([name, note]) => { const s = window.__sol, a = document.activeElement;
      return { image: name + '.png', version: window.__solVersion, kind: 'ui', note, selected: s.ui.sel?.id ?? null, viewingMode: s.settings.get('viewMode'), cameraMode: s.engine.rig.mode,
        focused: a && a !== document.body ? { tag: a.tagName, label: a.getAttribute('aria-label') || a.textContent?.trim().slice(0, 60), outline: getComputedStyle(a).outlineStyle + ' ' + getComputedStyle(a).outlineWidth + ' ' + getComputedStyle(a).outlineColor } : null,
        viewport: [innerWidth, innerHeight], limitations: 'Software WebGPU (SwiftShader); UI layout is renderer-independent' }; }, [name, note]);
    await page.screenshot({ path: path.join(out, name + '.png'), timeout: 180000 });
    fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(meta, null, 1)); shots.push(meta); console.error('captured', name);
  };
  await page.evaluate((ms) => { const s = window.__sol; s.clock.paused = true; s.clock.set(ms / 86400000 + 2440587.5 + 69.184 / 86400); s.advance(); }, EPOCH_MS);
  await snap('ui38-01-intro', 'loader/intro after essential scene ready (enter button)');
  await page.evaluate(() => document.querySelector('#loader .ld-enter, #loader .enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.evaluate(() => { document.body.classList.remove('cine'); const s = window.__sol, e = s.sys.get('earth'), r = s.engine.rig; r.flight = null; s.ui.select(e, false); r.mode = 'orbit'; r.target = e; r.dist = r.tDist = 6378 * 4; r.pos = r.orbitPos(e, r.yaw, r.pitch, r.dist); });
  await snap('ui38-02-main-viewport');
  // ── automated accessibility audit of the main view ──
  audit.static = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
    const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('placeholder') || '').trim();
    const inter = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')].filter(vis);
    const unnamed = inter.filter(el => !name(el)).map(el => el.outerHTML.slice(0, 120));
    const small = inter.filter(el => { const w = el.offsetWidth, h = el.offsetHeight; return w < 24 || h < 24; /* layout size: closed overlays are scaled .99 */ }).map(el => ({ el: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40), w: el.offsetWidth, h: el.offsetHeight }));
    // contrast: text colour vs the nearest ancestor background with alpha > 0.5 (viewport behind panels is near-black)
    const lum = (c) => { const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0]; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return [0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]), m[3] ?? 1]; };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, a = +(c.match(/[\d.]+/g)?.[3] ?? 1); if (c !== 'rgba(0, 0, 0, 0)' && a > 0.5) return c; } return 'rgb(5, 7, 12)'; };
    const texts = [...document.querySelectorAll('body *')].filter(el => vis(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1));
    const low = []; let n = 0;
    for (const el of texts) { n++; const [Lf] = lum(getComputedStyle(el).color), [Lb] = lum(bgOf(el)), cr = (Math.max(Lf, Lb) + 0.05) / (Math.min(Lf, Lb) + 0.05); const fs = parseFloat(getComputedStyle(el).fontSize);
      if (cr < (fs >= 18 ? 3 : 4.5)) low.push({ text: el.textContent.trim().slice(0, 40), ratio: +cr.toFixed(2), px: fs, color: getComputedStyle(el).color }); }
    return { interactive: inter.length, unnamed, small: small.slice(0, 40), smallCount: small.length, textNodes: n, lowContrast: low.slice(0, 40), lowContrastCount: low.length,
      reducedMotionRule: [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => r.conditionText?.includes('prefers-reduced-motion')); } catch { return false; } }) };
  });
  // ── keyboard-only workflow ──
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.mouse.click(800, 450);                                       // focus back on the viewport, like a user would
  const tabSeq = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); tabSeq.push(await page.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? (a.getAttribute('aria-label') || a.textContent.trim().slice(0, 30) || a.tagName) : 'BODY'; })); }
  audit.tabFromViewport = { sequence: tabSeq, reachedUI: tabSeq.some(x => x !== 'BODY'), camMode: await page.evaluate(() => window.__sol.engine.rig.mode) };
  await snap('ui38-03-keyboard-focus', 'after 6×Tab from the viewport: focus ring on a toolbar control');
  await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement?.blur?.());
  const pos0 = await page.evaluate(() => [...window.__sol.engine.rig.pos]);
  await page.keyboard.press('Control+K'); await page.waitForTimeout(200);
  await page.keyboard.type('proxima wasd', { delay: 20 }); await page.waitForTimeout(300);
  const pos1 = await page.evaluate(() => [...window.__sol.engine.rig.pos]);
  audit.typingMovesCamera = Math.hypot(pos1[0] - pos0[0], pos1[1] - pos0[1], pos1[2] - pos0[2]) > 1;
  await snap('ui38-04-search-typing', 'Ctrl+K search; typed "proxima wasd" — camera must not move');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace');
  for (let i = 0; i < 1; i++) await page.keyboard.press('Backspace');
  await page.waitForTimeout(300); await snap('ui38-05-search-proxima', 'search result list for "proxima"');
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  audit.searchEnter = await page.evaluate(() => ({ sel: window.__sol.ui.sel?.id ?? null, flying: window.__sol.engine.rig.flying }));
  await page.evaluate(() => { const f = window.__sol.engine.rig.flight; if (f) f.t0 = performance.now() - f.dur * 0.5; });
  await snap('ui38-06-journey-in-flight', 'travel to Proxima Centauri started from search (mid-flight)');
  await page.keyboard.press('KeyW'); await page.waitForTimeout(200);
  audit.cancelByKey = await page.evaluate(() => ({ flying: window.__sol.engine.rig.flying }));
  await page.evaluate(() => { const s = window.__sol, p = s.sys.get('star:proxima-centauri'); s.ui.select(p, true); const f = s.engine.rig.flight; if (f) f.t0 = performance.now() - f.dur * 1.01; });
  await settle(12); await snap('ui38-07-proxima-inspector', 'arrived near Proxima Centauri: inspector + Galactic context');
  await page.keyboard.press('KeyM'); await page.waitForTimeout(200); await snap('ui38-08-galmap-toggle', 'M toggles the Galactic context card');
  await page.keyboard.press('Home'); await page.waitForTimeout(300);
  audit.home = await page.evaluate(() => ({ sel: window.__sol.ui.sel?.id ?? null, flying: window.__sol.engine.rig.flying, to: window.__sol.engine.rig.flight?.to?.id ?? null }));
  await page.evaluate(() => { const f = window.__sol.engine.rig.flight; if (f) f.t0 = performance.now() - f.dur * 1.01; });
  await settle(10);
  await page.keyboard.press('Comma'); await page.waitForTimeout(300); await snap('ui38-09-settings-keyboard', 'settings opened with "," (keyboard)');
  await page.keyboard.press('Escape'); await page.keyboard.press('Shift+Slash'); await page.waitForTimeout(300); await snap('ui38-10-help-shortcuts', '? opens the shortcut sheet');
  await page.keyboard.press('Escape'); await page.keyboard.press('KeyJ'); await page.waitForTimeout(300); await snap('ui38-11-journeys', 'J: journeys (incl. the stellar journey tour) and bookmarks');
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100);
  audit.reducedMotion = await page.evaluate(() => ({ matches: matchMedia('(prefers-reduced-motion: reduce)').matches, sampleTransition: getComputedStyle(document.querySelector('.panel') || document.body).transitionDuration }));
  await page.keyboard.press('KeyR'); await page.waitForTimeout(200);
  audit.freeFlightKey = await page.evaluate(() => window.__sol.engine.rig.mode);
  await page.keyboard.press('KeyR');
  fs.writeFileSync(path.join(out, 'ui38-audit.json'), JSON.stringify(audit, null, 1));
  return { shots: shots.map(s => s.image), audit };
}
