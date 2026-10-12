// Interface captures and interaction checks (spec §10 UI acceptance). Software adapter → functional evidence only.
// Each step drives the real UI through DOM events/keyboard (not internal calls) where practical, then screenshots.
import path from 'node:path';
const EPOCH_MS = Date.UTC(2026, 9, 8, 12, 0, 0);
const AU = 149597870.7;
async function settle(page, frames = 3) {
  await page.evaluate(async (n) => { const s = window.__sol, f0 = window.__frames; await new Promise(res => { const chk = () => { s.engine.settleExposure(); return window.__frames - f0 >= n ? res(0) : requestAnimationFrame(chk); }; chk(); }); }, frames);
}
export default async function (page, { out }) {
  const shots = [], checks = {};
  const shot = async (name) => { const file = path.join(out, `ui-${name}.png`); await page.screenshot({ path: file, timeout: 180000 }); shots.push(file); console.error('captured ui', name); };
  await page.evaluate((ms) => { const s = window.__sol; document.querySelector('#loader .ld-enter, #loader .enter')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    s.settings.set('onboarded', true); s.clock.paused = true; s.clock.set(ms / 86400000 + 2440587.5 + 69.184 / 86400); s.advance(); }, EPOCH_MS);
  await page.waitForTimeout(1500);
  // 1. Saturn selected via the search palette (keyboard path)
  await page.keyboard.press('Control+k'); await page.keyboard.type('Saturn'); await page.waitForTimeout(150);
  checks.paletteOpen = await page.evaluate(() => document.querySelector('#palette')?.classList.contains('open'));
  await page.keyboard.press('Enter');
  await page.evaluate(() => { const s = window.__sol, b = s.sys.get('saturn'), r = s.engine.rig; r.flight = null; const [y, p] = r.niceAngles(b); r.yaw = r.tYaw = y; r.pitch = r.tPitch = p; r.dist = r.tDist = b.radius * 7; r.pos = r.orbitPos(b, y, p, r.dist); r.setTarget(b); });
  await settle(page); checks.selected = await page.evaluate(() => window.__sol.ui.sel?.id);
  await shot('saturn-inspector');
  // 2. Evidence tab
  await page.click('#inspector .tabs [data-tab=evidence]'); await settle(page, 1); await shot('evidence-tab');
  // 3. Guides popover in scientific mode (keyboard G, then click mode)
  await page.keyboard.press('g'); await page.click('#overlays [data-gm=science]');
  checks.guideMode = await page.evaluate(() => window.__sol.settings.get('guideMode'));
  await settle(page); await shot('guides-science');
  await page.keyboard.press('Escape');
  // 4. Atlas
  await page.keyboard.press('n'); await settle(page, 1); await shot('atlas');
  await page.keyboard.press('Escape');
  // 5. Settings → The Sun
  await page.keyboard.press(','); await page.click('#settings [data-s=sun]'); await settle(page, 1); await shot('settings-sun');
  checks.settingsOpen = await page.evaluate(() => document.querySelector('#settings')?.classList.contains('open'));
  await page.keyboard.press('Escape');
  // 6. Journeys
  await page.keyboard.press('j'); await settle(page, 1); await shot('journeys');
  await page.keyboard.press('Escape');
  // 7. Interrupt: start travel to Jupiter, then wheel → flight must cancel within the same frame
  checks.flightCancel = await page.evaluate(async () => { const s = window.__sol; s.ui.select(s.sys.get('jupiter'), true); const was = s.engine.rig.flying;
    document.querySelector('#gl').dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })); return { was, after: s.engine.rig.flying }; });
  // 8. System overview, clean guides
  await page.evaluate((AU) => { const s = window.__sol; s.settings.set('guideMode', 'clean'); s.ui.select(null); const r = s.engine.rig, sun = s.sys.sun; r.flight = null; r.target = sun; r.yaw = r.tYaw = -1.2; r.pitch = r.tPitch = 0.55; r.dist = r.tDist = 42 * AU; r.pos = r.orbitPos(sun, -1.2, 0.55, 42 * AU); r.setTarget(sun); }, AU);
  await page.waitForTimeout(600); await settle(page); await shot('system-overview');
  checks.noPageErrors = true;
  return { shots, checks };
}
