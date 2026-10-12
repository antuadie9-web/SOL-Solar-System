// SOL v3.3 interface — a complete redesign (spec §10 "Full UI/UX and product design replacement", §13).
//
// Structure (all semantic HTML; the WebGPU canvas never re-renders the DOM per frame):
//   Top bar ......... brand · hierarchical breadcrumb (Universe › Milky Way › Solar System › … › body) · search · tools
//   Atlas (left) .... hierarchical catalogue with filters and live counts
//   Inspector (right) identity, evidence badges, live telemetry, Physical / Orbit / Spin / Evidence sections
//   Timeline (bottom) epoch in UTC/TT/TDB, play/reverse/rate rail, events, validity of the focused body's ephemeris
//   Telemetry (b-l) . camera mode, altitude, true-scale ruler, reference frame
//   Guides (b-r) .... clean / focused / system / scientific / everything + legend
//   Journeys ........ guided tours, bookmarks (persisted), recent targets, back/home
//   Settings ........ searchable: graphics, Sun, scene, guides, camera, time & units, accessibility, data & credits
//   Onboarding ...... first-run coach marks (dismissible, never shown again)
// Updates are throttled: per-frame work is limited to label/marker transforms; text panels refresh at 4 Hz.
import { ATMOSPHERES } from '../data/atmospheres';
import { RING_SYSTEMS } from '../data/rings';
import * as L from 'lucide';
import type { Engine } from '../render/engine';
import { pixelRatioFor } from '../render/engine';
import { SolarSystem, Body, conicPos } from '../astro/system';
import { Clock, RATES, rateLabel } from '../core/clock';
import { Settings, DEFAULTS } from '../core/settings';
import { calendar, ttToUtc, utcToTT, jdFromCalendar, jdFromDate, ttToTdb, timeScaleStatus } from '../astro/time';
import { AU, C_KMS, DEG, GM_SUN } from '../astro/constants';
import { sub, len, norm, scale, dot, mulMtV } from '../astro/vec';
import { EVENTS } from '../data/events';
import { CLASS_NAMES } from '../render/smallbodies';
import { GUIDE_MODES, guideExtras, type GuideMode } from '../render/guides';
import { SUN_LOOKS, type SunLook } from '../render/sun';
import { visualProfile, TIER_LABEL } from '../render/identity';
import { MODE_INFO, VIEW_MODES, type ViewMode } from '../render/presentation';
import { colourTruth } from '../data/mapTruth';
import { GalMap } from './galmap';
import { fmt, fmtDist, fmtDur, sci, splitU, niceLength, hex, MONTHS, esc } from './format';
import { Store } from './store';
import { TOURS, type Tour } from './tours';
export { fmtDist } from './format';

const ic = (n: keyof typeof L, size = 18) => { const el = (L as any).createElement((L as any)[n]); el.setAttribute('width', size); el.setAttribute('height', size); el.setAttribute('aria-hidden', 'true'); return el.outerHTML; };
const h = (tag: string, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const $ = (s: string, r: ParentNode = document) => r.querySelector(s) as HTMLElement;
const $$ = (s: string, r: ParentNode = document) => [...r.querySelectorAll(s)] as HTMLElement[];
const KIND_LABEL: Record<string, string> = { xstar: 'Star', star: 'Star', planet: 'Planet', dwarf: 'Dwarf planet', moon: 'Moon', asteroid: 'Asteroid', comet: 'Comet', tno: 'Trans-Neptunian object' };
const FACTS = ['Every distance and every size here is true to scale.', 'Light from the Sun takes 8 minutes 20 seconds to reach Earth.', 'Saturn’s rings span 280,000 km yet are typically tens of metres thick.',
  'Jupiter’s Great Red Spot is wider than Earth.', 'A day on Venus is longer than its year.', 'Olympus Mons on Mars is nearly three times the height of Everest.',
  'Neptune’s winds reach about 2,100 km/h.', '94,523 catalogued asteroids and Kuiper Belt objects move live on your GPU.', 'Observed, reconstructed and modelled surfaces are always labelled.'];

/** v3.8 loader: a TRUTHFUL stage list instead of a file-count percentage (spec §34). Each stage shows its real state and
 *  measured duration; the app becomes interactive as soon as the essential scene is ready and optional layers keep
 *  streaming afterwards (reported in the HUD, not by holding the user here). */
type StageKey = 'gpu' | 'data' | 'scene' | 'shaders' | 'live';
const STAGES: [StageKey, string][] = [['gpu', 'WebGPU validation'], ['data', 'Essential astronomical data'], ['scene', 'Primary scene resources'], ['shaders', 'Renderer & shader preparation'], ['live', 'Interactive — optional layers stream in the background']];
class Loader {
  el: HTMLElement; private factI = 0; private factT: any; onEnter?: () => void; onResume?: () => void; private t0: Record<string, number> = {};
  /** v3.8.1 (UX-381-01) "Into the Universe" intro. Composition: deep black, a resolved white-light solar limb as the visual
   *  anchor (SVG; neutral photosphere with the measured per-channel limb darkening — the same physics as the renderer),
   *  the SOL wordmark, a one-line purpose, a primary "Begin exploration", an optional "Resume <last target>", and the
   *  TRUTHFUL stage ledger (real work only). Repeat visitors can skip the intro (enters as soon as the scene is ready).
   *  No particles, no autoplay media, no mandatory animation; reduced-motion removes the slow limb drift. */
  constructor(resumeName?: string | null) {
    const skip = (() => { try { return localStorage.getItem('sol.skipIntro') === '1'; } catch { return false; } })();
    this.el = h('div', '', `
      <div class="ld-limb" aria-hidden="true">${solarLimb()}</div>
      <div class="ld" role="dialog" aria-modal="true" aria-labelledby="ld-title" aria-describedby="ld-purpose">
        <p class="ld-kicker">Scientific atlas · true scale · native WebGPU</p>
        <h1 id="ld-title">SOL</h1>
        <p class="ld-sub" id="ld-purpose">The Solar System and its stellar neighbourhood, from measured positions, sizes and light.</p>
        <div class="ld-actions">
          <button class="ld-enter btn btn-primary" aria-describedby="ld-status">Begin exploration</button>
          ${resumeName ? `<button class="ld-resume btn" aria-describedby="ld-status">Resume · ${esc(resumeName)}</button>` : ''}
        </div>
        <label class="ld-skip"><input type="checkbox" ${skip ? 'checked' : ''}> Skip this screen next time</label>
        <div class="ld-ledger" id="ld-status">
          <ol class="ld-stages" id="ld-stages" aria-live="polite">${STAGES.map(([k, l]) => `<li data-st="${k}" class="pending"><i aria-hidden="true"></i><span class="sl">${l}</span><span class="sd num"></span></li>`).join('')}</ol>
          <div class="ld-meta"><span class="lbl">Checking for native WebGPU</span><span class="pct num"></span></div>
        </div>
        <p class="ld-fact" aria-live="polite"></p>
      </div>
      <p class="ld-foot">v${typeof __SOL_VERSION__ !== 'undefined' ? __SOL_VERSION__ : ''} · desktop Chrome · Sun: NASA SDO/HMI, 2026-09-21 (observed) · imagery: NASA, ESA/Gaia/DPAC, USGS — see Credits</p>`);
    this.el.id = 'loader'; document.body.appendChild(this.el);
    $('.ld-enter', this.el).onclick = () => this.onEnter?.();
    const rb = this.el.querySelector('.ld-resume') as HTMLButtonElement | null; if (rb) rb.onclick = () => this.onResume?.();
    const cb = $('.ld-skip input', this.el) as HTMLInputElement; cb.onchange = () => { try { localStorage.setItem('sol.skipIntro', cb.checked ? '1' : '0'); } catch { /* storage blocked */ } };
    this.skip = skip;
    this.cycle();
    this.stage('gpu', 'active');
  }
  skip = false;
  cycle() { const f = $('.ld-fact', this.el); if (!f) return; f.classList.remove('on'); setTimeout(() => { f.textContent = FACTS[this.factI++ % FACTS.length]; f.classList.add('on'); }, 500); this.factT = setTimeout(() => this.cycle(), 5600); }
  show() { }
  /** set a stage's state; `detail` is real information (adapter, file count, megabytes), never an invented percentage */
  stage(k: StageKey, state: 'pending' | 'active' | 'done' | 'failed' | 'skipped', detail?: string) {
    const li = $(`[data-st=${k}]`, this.el); if (!li) return;
    if (state === 'active' && !this.t0[k]) this.t0[k] = performance.now();
    li.className = state;
    const dur = state === 'done' && this.t0[k] ? `${Math.round(performance.now() - this.t0[k])} ms` : '';
    $('.sd', li).textContent = [detail, dur].filter(Boolean).join(' · ');
    if (state === 'active') $('.lbl', this.el).textContent = STAGES.find(s => s[0] === k)![1] + (detail ? ` — ${detail}` : '');
  }
  progress(label: string, d: number, t: number) { $('.lbl', this.el).textContent = label; $('.pct', this.el).textContent = `${d} / ${t} files`; }
  ready() {
    this.stage('live', 'done'); $('.lbl', this.el).textContent = 'Ready — interactive'; $('.pct', this.el).textContent = '';
    this.el.classList.add('is-ready'); const b = $('.ld-enter', this.el); b.classList.add('show'); this.el.querySelector('.ld-resume')?.classList.add('show');
    if (this.skip && !QA_HARNESS()) { setTimeout(() => this.onEnter?.(), 60); return; }   // fast bypass for repeat users
    setTimeout(() => b.focus(), 50);
  }
  fail(t: string, m: string) {
    clearTimeout(this.factT); this.el.classList.add('failed');
    const act = $('.ld-stages li.active', this.el); if (act) act.className = 'failed';
    $('.ld-meta', this.el).style.display = 'none'; $('.ld-enter', this.el).style.display = 'none';
    $('.ld-fact', this.el).outerHTML = `<div class="ld-fail" role="alert"><b>${esc(t)}</b><span>${esc(m)}</span><button class="btn" onclick="location.reload()">Reload</button></div>`;
    setTimeout(() => (this.el.querySelector('.ld-fail .btn') as HTMLButtonElement | null)?.focus(), 50);
  }
  hide() { clearTimeout(this.factT); this.el.classList.add('gone'); setTimeout(() => this.el.remove(), 1400); }
}
/** Last visited target from the persisted recent list, as a readable label (catalogue not loaded yet at intro time). */
function resumeLabel(): string | null {
  try { const r = JSON.parse(localStorage.getItem('sol.recent.v1') || '[]'); const id = Array.isArray(r) ? r[0] : null; if (typeof id !== 'string' || id === 'earth') return null;
    const n = id.replace(/^star:/, '').replace(/^sat\d+$/, 'last moon').replace(/-/g, ' '); return n.charAt(0).toUpperCase() + n.slice(1); } catch { return null; }
}
/** Harness/QA runs never auto-skip the intro (screenshots of the loader stay reproducible). */
const QA_HARNESS = () => /qa-|bench/.test(location.search);
/** v3.8.1 intro anchor: the limb of a resolved Sun in white light. Radial profile from the same per-channel quadratic
 *  limb-darkening law as sun.ts (Neckel & Labs fits; I(μ)/I₀ at ≈650/550/450 nm), sampled into SVG gradient stops; a
 *  soft angular glare outside the limb. Neutral (sunlight = white balance) with the gentle 'natural' grade. */
function solarLimb() {
  // REV2-06: the anchor is now the OBSERVED Sun — NASA SDO/HMI quick-look continuum of 2026-09-21 15:11 TAI (sunspots and
  // faculae of that day), converted to SOL's white-light limb-darkening law (tools/ingest/intro_sun.py). The previous
  // gradient-only disc read as featureless. 134 kB JPEG, decoded off the critical path; the gradient below is its placeholder.
  const stops: string[] = [];
  for (let i = 0; i <= 10; i++) {
    const r = i / 10, mu = Math.sqrt(Math.max(0, 1 - r * r)), om = 1 - mu, om2 = 1 - mu * mu;
    const ch = [[0.48, 0.18], [0.58, 0.20], [0.70, 0.20]].map(([a, b]) => Math.max(0.05, 1 - a * om - b * om2));
    const tint = [1.0, 0.965, 0.915], k = 0.72;
    const c = ch.map((x, j) => Math.round(255 * Math.min(1, Math.pow(x * tint[j] * k, 1 / 2.2))));
    stops.push(`<stop offset="${(r * 100).toFixed(0)}%" stop-color="rgb(${c.join(',')})"/>`);
  }
  return `<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice"><defs>
    <radialGradient id="ldDisc" cx="500" cy="500" r="420" gradientUnits="userSpaceOnUse">${stops.join('')}</radialGradient>
    <radialGradient id="ldGlare" cx="500" cy="500" r="540" gradientUnits="userSpaceOnUse"><stop offset="0.76" stop-color="#fff6e8" stop-opacity=".16"/><stop offset="0.82" stop-color="#fff2e0" stop-opacity=".04"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <clipPath id="ldClip"><circle cx="500" cy="500" r="420"/></clipPath></defs>
    <circle cx="500" cy="500" r="540" fill="url(#ldGlare)"/><circle cx="500" cy="500" r="420" fill="url(#ldDisc)"/>
    <image href="assets/tex/intro_sun_hmi.jpg" x="38.6" y="38.6" width="922.8" height="922.8" clip-path="url(#ldClip)" preserveAspectRatio="none" decoding="async"/></svg>`;
}
/** SOL brand mark: a limb-darkened disc inside an orbit ellipse (pure SVG, no raster). */
function solMark(size: number) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100"><defs><radialGradient id="smk" cx=".42" cy=".4" r=".62"><stop offset="0" stop-color="#fff7e6"/><stop offset=".55" stop-color="#f5cf8f"/><stop offset="1" stop-color="#b9702f"/></radialGradient></defs>
    <ellipse cx="50" cy="50" rx="46" ry="17" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1" transform="rotate(-18 50 50)"/>
    <circle cx="50" cy="50" r="19" fill="url(#smk)"/><circle cx="88" cy="40" r="2.6" fill="currentColor" opacity=".9"/></svg>`;
}

type Panel = 'atlas' | 'overlays' | 'journeys' | null;
export class UI {
  canvas: HTMLCanvasElement; loader = new Loader(resumeLabel()); root!: HTMLElement;
  engine!: Engine; sys!: SolarSystem; clock!: Clock; settings!: Settings; names: [string, number][] = [];
  sel: Body | null = null; hover: Body | null = null; following = true;
  labels = new Map<string, HTMLElement>(); reticle!: HTMLElement; tip!: HTMLElement; diag!: HTMLPreElement;
  tab = 'overview'; store = new Store(); private lastInfo = 0; private fpsAcc = 0; private fpsN = 0;
  galmap!: GalMap;
  private panel: Panel = null; private history: string[] = []; private tour: { t: Tour; i: number; timer: any } | null = null;
  constructor() { this.canvas = h('canvas') as HTMLCanvasElement; this.canvas.id = 'gl'; this.canvas.setAttribute('aria-label', 'Interactive 3D view of the Solar System'); document.body.prepend(this.canvas); }
  attach(engine: Engine, sys: SolarSystem, clock: Clock, settings: Settings, names: [string, number][]) {
    this.engine = engine; this.sys = sys; this.clock = clock; this.settings = settings; this.names = names;
    this.diag = document.createElement('pre'); this.diag.id = 'diag'; this.diag.setAttribute('aria-label', 'Rendering diagnostics'); this.diag.hidden = !settings.get('showDiagnostics');
    this.build(); this.bindInput(); document.body.appendChild(this.diag);
    this.galmap = new GalMap(document.body);   // v3.8 Galactic context (M)
    engine.rig.reducedMotion = !!settings.get('reducedMotion'); engine.rig.sensitivity = settings.get('sensitivity') as number; engine.rig.inertia = settings.get('inertia') as number;
    this.applyA11y();
    settings.on((k, v) => {
      if (k === 'reducedMotion') { engine.rig.reducedMotion = !!v; this.applyA11y(); }
      if (k === 'showDiagnostics') this.diag.hidden = !v;
      if (k === 'uiScale' || k === 'highContrast') this.applyA11y();
      if (k === 'guideMode' || k === 'orbits') this.paintGuideDock();
      if (k === 'showFps') $('#fps').hidden = !v;
    });
    this.loader.onEnter = () => this.enter();
    this.loader.onResume = () => { const id = this.store.recent[0], b = id ? this.sys.get(id) : null; this.enter(); if (b && b.id !== 'earth') setTimeout(() => this.select(b, true), 600); };
  }
  applyA11y() {
    const r = document.documentElement;
    r.style.setProperty('--ui-scale', String(this.settings.get('uiScale') ?? 1));
    r.classList.toggle('hc', !!this.settings.get('highContrast'));
    r.classList.toggle('rm', !!this.settings.get('reducedMotion'));
  }
  enter() {
    this.loader.hide();
    document.body.classList.add('ready');
    const e = this.engine, earth = this.sys.get('earth')!;
    e.rig.pos = [earth.pos[0] + 2.6e7, earth.pos[1] - 1.8e7, earth.pos[2] + 9e6];
    e.rig.setTarget(earth);
    e.rig.goTo(earth, { dur: 6.0, onDone: () => { if (!this.settings.get('onboarded')) this.onboarding(); } });
    this.select(earth, false);
  }
  // ── DOM ─────────────────────────────────────────────────────────────────
  build() {
    const root = this.root = h('div'); root.id = 'ui'; document.body.appendChild(root);
    document.body.appendChild(h('div', 'vignette'));
    root.innerHTML = `
      <div id="labels" aria-hidden="true"><div class="reticle"><i></i><i></i><i></i><i></i></div></div>
      <header id="topbar" class="reveal">
        <div class="brand" aria-label="SOL">${solMark(26)}<span>SOL</span></div>
        <nav class="crumbs" aria-label="Location in the universe"></nav>
        <button class="search" aria-label="Search (Ctrl K)">${ic('Search', 15)}<span>Search worlds, moons, 94,523 small bodies…</span><kbd>Ctrl K</kbd></button>
        <div class="tools" role="toolbar" aria-label="Tools">
          <button class="tb" data-act="atlas" aria-label="Atlas (N)" data-tip="Atlas · N">${ic('PanelLeft')}</button>
          <button class="tb" data-act="overlays" aria-label="Guides and layers (G)" data-tip="Guides & layers · G">${ic('Layers')}</button>
          <button class="tb" data-act="journeys" aria-label="Journeys and bookmarks (J)" data-tip="Journeys & bookmarks · J">${ic('Route')}</button>
          <span class="sep" aria-hidden="true"></span>
          <button class="tb" data-act="free" aria-label="Free flight (R)" data-tip="Free flight · R">${ic('Rocket')}</button>
          <button class="tb" data-act="shot" aria-label="Capture image (P)" data-tip="Capture · P">${ic('Aperture')}</button>
          <button class="tb" data-act="cine" aria-label="Hide interface (H)" data-tip="Cinematic · H">${ic('Eye')}</button>
          <button class="tb" data-act="settings" aria-label="Settings (,)" data-tip="Settings · ,">${ic('SlidersHorizontal')}</button>
          <button class="tb" data-act="help" aria-label="Keyboard and mouse controls (?)" data-tip="Controls · ?">${ic('Keyboard')}</button>
        </div>
      </header>
      <aside id="atlas" class="panel side left" aria-label="Atlas"><header><h2>Atlas</h2><span class="meta num" id="atlascount"></span><button class="tb sm close" aria-label="Close atlas">${ic('X', 16)}</button></header>
        <div class="filter"><input type="search" placeholder="Filter" aria-label="Filter the atlas"></div><div class="chips" role="tablist"></div><div class="tree" role="tree"></div></aside>
      <aside id="overlays" class="panel pop" aria-label="Guides and layers"></aside>
      <aside id="journeys" class="panel pop" aria-label="Journeys and bookmarks"></aside>
      <section id="inspector" class="panel side right" aria-label="Object inspector" aria-live="polite"></section>
      <div id="timeline" class="reveal" role="group" aria-label="Time">
        <button class="when" aria-haspopup="dialog" aria-label="Set date and time"><span class="d num"></span><span class="t num"></span></button>
        <button class="scale-sw" data-ts-cycle aria-label="Time scale: UTC — activate to switch to TT, then TDB" data-tip="Time scale · UTC → TT → TDB">UTC</button>
        <div class="ctl">
          <button class="tb" data-t="reverse" aria-label="Reverse time (\\)" data-tip="Reverse · \\">${ic('Repeat', 16)}</button>
          <button class="tb" data-t="slower" aria-label="Slower ([)" data-tip="Slower · [">${ic('ChevronsLeft', 16)}</button>
          <button class="play" data-t="play" aria-label="Play or pause (Space)"></button>
          <button class="tb" data-t="faster" aria-label="Faster (])" data-tip="Faster · ]">${ic('ChevronsRight', 16)}</button>
        </div>
        <div class="rail" role="slider" tabindex="0" aria-label="Simulation rate" aria-valuemin="0" aria-valuemax="${RATES.length - 1}"><div class="track"></div></div>
        <div class="rate num"></div>
        <button class="now" data-t="now">Now</button>
        <div class="validity" title="Source of the focused body’s position at this epoch"></div>
        <div class="datepop panel" role="dialog" aria-label="Jump to a date"><label class="kicker">Jump to date (UTC)<input type="datetime-local" step="1"></label><div class="kicker">Events</div><div class="evs"></div></div>
      </div>
      <div id="viewmode" class="reveal" role="radiogroup" aria-label="Viewing mode">${VIEW_MODES.map(m => `<button role="radio" data-vm="${m}" title="${MODE_INFO[m].note.replace(/"/g, '&quot;')}">${MODE_INFO[m].label}</button>`).join('')}<span class="vm-note" aria-live="polite"></span></div>
      <div id="tele" class="reveal" aria-live="off"><div class="tmode"></div><div class="ctruth"></div><div class="alt num"></div><div class="ruler"><i></i><span class="num"></span></div><div class="frame"></div></div>
      <div id="guidedock" class="reveal" role="radiogroup" aria-label="Orbit guides"></div>
      <div id="tourbar" class="panel" hidden><div class="tt"></div><div class="cap"></div><div class="acts"><button class="btn sm" data-tour="next">Next</button><button class="btn sm ghost" data-tour="stop">End tour</button></div></div>
      <div id="fps" class="num" hidden></div>
      <div id="tip" role="tooltip"></div>
      <div id="toasts" aria-live="polite" role="status"></div>`;
    this.reticle = $('.reticle', root); this.tip = $('#tip', root);
    document.body.appendChild(this.buildPalette()); document.body.appendChild(this.buildSettings()); document.body.appendChild(this.buildHelp());
    document.body.appendChild(h('div', 'flash'));
    $$('#topbar .tb').forEach(b => b.onclick = () => this.action(b.dataset.act!));
    $('#topbar .search').onclick = () => this.openPalette();
    $('#atlas .close').onclick = () => this.openPanel(null);
    this.buildAtlas(); this.buildOverlays(); this.buildJourneys(); this.buildTime(); this.paintGuideDock();
    $('#fps').hidden = !this.settings.get('showFps');
    $$('#tourbar [data-tour]').forEach(b => b.onclick = () => b.dataset.tour === 'next' ? this.tourNext() : this.stopTour());
    // tooltips for icon buttons
    root.addEventListener('pointerover', e => { const t = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null; if (t) this.showTip(t); });
    root.addEventListener('pointerout', e => { if ((e.target as HTMLElement).closest('[data-tip]')) this.tip.classList.remove('on'); });
  }
  showTip(t: HTMLElement) {
    const r = t.getBoundingClientRect(); this.tip.dataset.btn = '1'; this.tip.innerHTML = `<div class="n">${esc(t.dataset.tip!)}</div>`;
    const below = r.top < 120; this.tip.style.transform = `translate3d(${Math.round(r.left + r.width / 2)}px, ${Math.round(below ? r.bottom + 10 : r.top - 10)}px, 0) translate(-50%, ${below ? '0' : '-100%'})`; this.tip.classList.add('on');
  }
  openPanel(p: Panel) {
    this.panel = this.panel === p ? null : p;
    for (const id of ['atlas', 'overlays', 'journeys'] as const) { const el = $('#' + id); el.classList.toggle('open', this.panel === id); $(`#topbar [data-act=${id}]`)?.setAttribute('aria-pressed', String(this.panel === id)); }
    if (this.panel === 'atlas') setTimeout(() => ($('#atlas .filter input') as HTMLInputElement).focus(), 60);
    if (this.panel === 'journeys') this.buildJourneys();
    if (this.panel === 'overlays') this.buildOverlays();
  }
  action(a: string) {
    if (a === 'atlas' || a === 'overlays' || a === 'journeys') this.openPanel(a);
    if (a === 'settings') this.openSettings();
    if (a === 'help') $('#help').classList.toggle('open');
    if (a === 'cine') document.body.classList.toggle('cine');
    if (a === 'shot') this.screenshot();
    if (a === 'free') this.toggleFree();
  }
  toggleFree() {
    const r = this.engine.rig;
    if (r.mode === 'free') { if (this.sel) r.setTarget(this.sel); this.toast('Orbit camera'); }
    else { r.toFree(); this.toast('Free flight — WASD to move, Q/E down/up, Shift to boost, right-drag to look'); }
    $('[data-act=free]').classList.toggle('on', r.mode === 'free'); $('[data-act=free]').setAttribute('aria-pressed', String(r.mode === 'free'));
  }
  async screenshot() {
    const fl = $('.flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    await new Promise(r => requestAnimationFrame(r));
    this.canvas.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); const c = calendar(ttToUtc(this.clock.jd)); a.download = `sol-${this.sel?.id ?? 'view'}-${c.year}${String(c.month).padStart(2, '0')}${String(c.day).padStart(2, '0')}.png`; a.click(); }, 'image/png');
    this.toast('Image captured');
  }
  toast(msg: string, ms = 3400) {
    const t = h('div', 'toast', esc(msg)); $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 500); }, ms);
  }
  // ── atlas ───────────────────────────────────────────────────────────────
  atlasFilter = 'all'; atlasQuery = '';
  buildAtlas() {
    const f = $('#atlas .chips');
    const opts = [['all', 'All'], ['planet', 'Planets'], ['moon', 'Moons'], ['dwarf', 'Dwarfs'], ['small', 'Small bodies'], ['stars', 'Stars']];
    f.innerHTML = opts.map(([k, l]) => `<button class="chip ${k === 'all' ? 'on' : ''}" role="tab" aria-selected="${k === 'all'}" data-f="${k}">${l}</button>`).join('');
    $$('.chip', f).forEach(c => c.onclick = () => { this.atlasFilter = c.dataset.f!; $$('.chip', f).forEach(x => { x.classList.toggle('on', x === c); x.setAttribute('aria-selected', String(x === c)); }); this.renderTree(); });
    const inp = $('#atlas .filter input') as HTMLInputElement; inp.oninput = () => { this.atlasQuery = inp.value.trim().toLowerCase(); this.renderTree(); };
    this.renderTree();
  }
  renderTree() {
    $('#atlascount').textContent = `${fmt(this.sys.bodies.length + (this.engine.small?.n ?? 0))} objects`;
    const tree = $('#atlas .tree'); tree.innerHTML = '';
    const sun = this.sys.sun, F = this.atlasFilter, Q = this.atlasQuery;
    const match = (b: Body) => !Q || b.name.toLowerCase().includes(Q);
    const item = (b: Body, depth = 0): HTMLElement | null => {
      const kids = b.children.filter(c => c.kind === 'moon' && (c.radius > 30 || c.def.tex || c.def.model));
      const minor = b.children.filter(c => c.kind === 'moon' && !kids.includes(c));
      const shownKids = Q ? kids.filter(match) : kids;
      if (Q && !match(b) && !shownKids.length) return null;
      const wrap = h('div', 'node');
      const tier = b.kind === 'xstar' ? '' : visualProfile(b.def).tier;
      const it = h('button', 'it' + (this.sel === b ? ' sel' : ''), `<span class="tw">${kids.length ? ic('ChevronRight', 12) : ''}</span><span class="orb" style="--c:${hex(b.def.color)}"></span><span class="nm">${esc(b.name)}</span>${tier ? `<span class="tier t${tier}" title="${TIER_LABEL[tier as 'A']}">${tier}</span>` : ''}<span class="cnt num">${kids.length + minor.length || ''}</span>`);
      it.dataset.id = b.id; it.setAttribute('role', 'treeitem'); it.style.setProperty('--d', String(depth));
      it.onclick = (e) => { if ((e.target as HTMLElement).closest('.tw') && kids.length) { wrap.classList.toggle('open'); return; } this.select(b, true); };
      it.onmouseenter = () => { this.engine.hover = b; }; it.onmouseleave = () => { if (this.engine.hover === b) this.engine.hover = null; };
      wrap.appendChild(it);
      if (kids.length) {
        const kd = h('div', 'kids'); const inner = h('div');
        for (const k of shownKids) { const n = item(k, depth + 1); if (n) inner.appendChild(n); }
        if (minor.length && !Q) { const more = h('button', 'it more', `<span class="tw"></span><span class="nm">${minor.length} smaller moons</span>`); more.style.setProperty('--d', String(depth + 1)); more.onclick = () => { more.remove(); for (const k of minor) { const n = item(k, depth + 1); if (n) inner.appendChild(n); } }; inner.appendChild(more); }
        kd.appendChild(inner); wrap.appendChild(kd);
        if (Q || (this.sel && (this.sel.parent === b))) wrap.classList.add('open');
      }
      return wrap;
    };
    const group = (title: string, list: Body[]) => {
      const nodes = list.map(b => item(b)).filter(Boolean) as HTMLElement[]; if (!nodes.length) return;
      const g = h('div', 'grp', `<div class="gh">${title}<span class="num">${nodes.length}</span></div>`); nodes.forEach(n => g.appendChild(n)); tree.appendChild(g);
    };
    const all = this.sys.bodies;
    if (F === 'all' || F === 'planet') { group('Star', [sun]); group('Planets', all.filter(b => b.kind === 'planet')); }
    if (F === 'all' || F === 'dwarf') group('Dwarf planets', all.filter(b => b.kind === 'dwarf'));
    if (F === 'moon') for (const p of all.filter(b => b.kind === 'planet' || b.kind === 'dwarf')) group(`Moons of ${p.name}`, p.children.filter(c => c.kind === 'moon'));
    if (F === 'all' || F === 'small') { group('Asteroids', all.filter(b => b.kind === 'asteroid')); group('Trans-Neptunian objects', all.filter(b => b.kind === 'tno')); group('Comets', all.filter(b => b.kind === 'comet')); }
    if (F === 'stars' || (F === 'all' && Q)) { group('Nearby stars (Gaia DR3 / Hipparcos)', all.filter(b => b.kind === 'xstar' && !b.info.dsoKind)); group('Deep-sky reference objects', all.filter(b => b.kind === 'xstar' && !!b.info.dsoKind)); }
    if (!tree.children.length) tree.innerHTML = `<p class="empty">Nothing matches “${esc(Q)}”. Try the search (Ctrl K) for the 94,523 catalogued small bodies.</p>`;
  }
  markTree() { $$('#atlas .it').forEach(e => e.classList.toggle('sel', e.dataset.id === this.sel?.id)); }
  // ── overlays & guides ───────────────────────────────────────────────────
  buildOverlays() {
    const p = $('#overlays'), mode = (this.settings.get('guideMode') as GuideMode) || 'clean';
    const rows: [string, string, keyof typeof L][] = [['orbits', 'Orbit guides', 'Orbit'], ['labels', 'Labels', 'Tag'], ['asteroids', 'Asteroids & Kuiper Belt', 'Sparkles'], ['cometTails', 'Comet comae & tails', 'Wind'],
      ['atmospheres', 'Atmospheres', 'CloudSun'], ['clouds', 'Earth clouds', 'Cloud'], ['cityLights', 'City lights', 'Lightbulb'], ['rings', 'Rings', 'CircleDashed'],
      ['stars', 'Stars', 'Star'], ['milkyWay', 'Milky Way panorama', 'Telescope'], ['constellations', 'Constellations', 'Spline'], ['ecliptic', 'Ecliptic plane', 'Ruler'], ['markUnknown', 'Mark unobserved terrain', 'ScanSearch'], ['asteroidColors', 'Colour small bodies by population', 'Palette']];
    p.innerHTML = `<header><h2>Guides & layers</h2></header>
      <div class="kicker">Orbit guides</div>
      <div class="modes" role="radiogroup" aria-label="Guide mode">${GUIDE_MODES.map(m => `<button role="radio" aria-checked="${m.id === mode}" class="mode ${m.id === mode ? 'on' : ''}" data-gm="${m.id}"><b>${m.label}</b><span>${m.hint}</span></button>`).join('')}</div>
      <div class="legend" aria-label="Legend">
        <div><i class="lg conic"></i>Osculating orbit — a snapshot of the orbit at this epoch</div>
        ${guideExtras(mode).trajectory ? '<div><i class="lg traj"></i>Ephemeris trajectory — where the body actually goes (±½ orbit)</div>' : ''}
        ${guideExtras(mode).landmarks ? '<div><i class="lg pe"></i>Periapsis <i class="lg ap"></i>Apoapsis <i class="lg node"></i>Nodes</div>' : ''}
        ${guideExtras(mode).axis ? '<div><i class="lg axis"></i>Spin axis (north solid) and equator</div>' : ''}
      </div>
      <div class="kicker">Scene layers</div>
      <div class="layers">${rows.map(([k, l, i]) => `<button class="li" role="switch" aria-checked="${!!this.settings.get(k)}" data-k="${k}"><span class="ic">${ic(i, 16)}</span><span class="l">${l}</span><span class="sw ${this.settings.get(k) ? 'on' : ''}"></span></button>`).join('')}</div>`;
    $$('[data-gm]', p).forEach(b => b.onclick = () => { this.settings.set('guideMode', b.dataset.gm!); if (!this.settings.get('orbits')) this.settings.set('orbits', true); this.buildOverlays(); });
    $$('.li', p).forEach(r => r.onclick = () => { const k = r.dataset.k!; const v = this.settings.toggle(k); $('.sw', r).classList.toggle('on', !!v); r.setAttribute('aria-checked', String(!!v)); });
  }
  paintGuideDock() {
    const d = $('#guidedock'); if (!d) return; const mode = (this.settings.get('guideMode') as GuideMode) || 'clean', on = !!this.settings.get('orbits');
    const short: Record<string, string> = { clean: 'Clean', focused: 'Focus', system: 'System', science: 'Science', everything: 'All' };
    d.innerHTML = `<span class="kicker">Guides</span>` + GUIDE_MODES.map(m => `<button role="radio" aria-checked="${on && m.id === mode}" aria-label="${m.label} guides: ${m.hint}" class="${on && m.id === mode ? 'on' : ''}" data-gm="${m.id}" data-tip="${m.label} — ${m.hint}">${short[m.id]}</button>`).join('') + `<button role="radio" aria-checked="${!on}" class="${!on ? 'on' : ''}" data-gm="off">Off</button>`;
    $$('[data-gm]', d).forEach(b => b.onclick = () => { const v = b.dataset.gm!; if (v === 'off') this.settings.set('orbits', false); else { this.settings.set('orbits', true); this.settings.set('guideMode', v); } if (this.panel === 'overlays') this.buildOverlays(); });
  }
  // ── journeys, bookmarks, history ───────────────────────────────────────
  buildJourneys() {
    const p = $('#journeys'), bm = this.store.bookmarks, rec = this.store.recent.map(id => this.sys.get(id)).filter(Boolean) as Body[];
    p.innerHTML = `<header><h2>Journeys</h2></header>
      <div class="kicker">Guided tours</div>
      <div class="tours">${TOURS.map(t => `<button class="tour" data-tour="${t.id}"><b>${t.title}</b><span>${t.blurb}</span><em class="num">${t.stops.length} stops</em></button>`).join('')}</div>
      <p class="note">Travel between stops is a time-lapse camera flight; distances and sizes are never altered.</p>
      <div class="kicker row">Bookmarks <button class="btn sm" data-bm="add">${ic('BookmarkPlus', 14)}Save this view</button></div>
      <div class="bms">${bm.length ? bm.map(b => `<div class="bm"><button class="go" data-bmgo="${b.id}"><b>${esc(b.name)}</b><span class="num">${fmtDist(b.dist)} · ${this.fmtDate(b.jdTT)}</span></button><button class="tb sm" data-bmdel="${b.id}" aria-label="Delete bookmark ${esc(b.name)}">${ic('Trash2', 14)}</button></div>`).join('') : '<p class="empty">No bookmarks yet. Saved views keep the target, camera and date.</p>'}</div>
      ${rec.length ? `<div class="kicker">Recent</div><div class="recent">${rec.map(b => `<button class="chip" data-recent="${b.id}">${esc(b.name)}</button>`).join('')}</div>` : ''}
      <div class="row-btns"><button class="btn sm" data-nav="back">${ic('Undo2', 14)}Back</button><button class="btn sm" data-nav="home">${ic('House', 14)}Home</button><button class="btn sm" data-nav="system">${ic('Orbit', 14)}Solar System</button></div>`;
    $$('[data-tour]', p).forEach(b => b.onclick = () => this.startTour(TOURS.find(t => t.id === b.dataset.tour)!));
    $('[data-bm=add]', p).onclick = () => this.addBookmark();
    $$('[data-bmgo]', p).forEach(b => b.onclick = () => this.gotoBookmark(b.dataset.bmgo!));
    $$('[data-bmdel]', p).forEach(b => b.onclick = () => { this.store.removeBookmark(b.dataset.bmdel!); this.buildJourneys(); });
    $$('[data-recent]', p).forEach(b => b.onclick = () => this.select(this.sys.get(b.dataset.recent!)!, true));
    $$('[data-nav]', p).forEach(b => b.onclick = () => { const k = b.dataset.nav; if (k === 'back') this.back(); if (k === 'home') this.home(); if (k === 'system') this.overview(48); });
  }
  fmtDate(jdTT: number) { const c = calendar(ttToUtc(jdTT)); return `${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${c.year}`; }
  addBookmark() {
    const r = this.engine.rig, t = r.target ?? this.sys.get('earth')!;
    const bm = this.store.addBookmark({ name: `${t.name} · ${this.fmtDate(this.clock.jd)}`, target: t.id, yaw: r.yaw, pitch: r.pitch, dist: Math.max(r.dist, 1e-3), fov: r.fov, jdTT: this.clock.jd });
    this.toast(bm ? `Saved “${bm.name}”` : 'Could not save this view'); this.buildJourneys();
  }
  gotoBookmark(id: string) {
    const b = this.store.bookmarks.find(x => x.id === id); if (!b) return; const t = this.sys.get(b.target); if (!t) { this.toast('That bookmark’s object is not loaded'); return; }
    this.clock.set(b.jdTT); this.clock.paused = true; this.clock.emit();
    const r = this.engine.rig; this.select(t, false); r.goTo(t, { dist: b.dist, onDone: () => { r.tYaw = b.yaw; r.tPitch = b.pitch; r.tFov = b.fov; } });
    this.toast(`${b.name} (time paused at the saved date)`);
  }
  back() { this.history.pop(); const id = this.history.pop(); const b = id ? this.sys.get(id) : null; if (b) this.select(b, true); else this.toast('Nothing to go back to'); }
  home() { const e = this.sys.get('earth')!; this.select(e, true); }
  startTour(t: Tour) { this.stopTour(true); this.tour = { t, i: -1, timer: null }; this.openPanel(null); $('#tourbar').hidden = false; this.tourNext(); }
  tourNext() {
    const T = this.tour; if (!T) return; clearTimeout(T.timer);
    T.i++; while (T.i < T.t.stops.length && !this.sys.get(T.t.stops[T.i].target)) T.i++;
    if (T.i >= T.t.stops.length) { this.stopTour(); this.toast(`Tour complete: ${T.t.title}`); return; }
    const s = T.t.stops[T.i], b = this.sys.get(s.target)!;
    $('#tourbar .tt').innerHTML = `<span class="kicker">${esc(T.t.title)} · ${T.i + 1}/${T.t.stops.length}</span>`; $('#tourbar .cap').textContent = s.caption;
    this.select(b, false);
    this.engine.rig.goTo(b, { dist: s.distR ? Math.max(b.radii[0], b.radius) * s.distR : undefined, onDone: () => { if (this.tour === T) T.timer = setTimeout(() => this.tourNext(), s.dwell * 1000 * (this.settings.get('reducedMotion') ? 1.5 : 1)); } });
  }
  stopTour(silent = false) { if (!this.tour) return; clearTimeout(this.tour.timer); this.tour = null; $('#tourbar').hidden = true; if (!silent) this.toast('Tour ended'); }
  // ── time ────────────────────────────────────────────────────────────────
  timeScale: 'utc' | 'tt' | 'tdb' = 'utc';
  buildTime() {
    const t = $('#timeline');
    $$('[data-t]', t).forEach(b => b.onclick = (e) => {
      const k = b.dataset.t; e.stopPropagation();
      if (k === 'slower') this.clock.slower(); if (k === 'faster') this.clock.faster(); if (k === 'play') this.clock.toggle(); if (k === 'reverse') this.clock.setRate(-this.clock.rate);
      if (k === 'now') { this.clock.now(); this.toast('Synchronised to the present moment'); }
    });
    // v3.8 a11y: the three 24 × 13 px UTC/TT/TDB chips were below the 24 × 24 px minimum target (WCAG 2.2 SC 2.5.8) and
    // too dense to enlarge in place; one 40 × 24 px button now cycles the time scale and announces it.
    $$('[data-ts-cycle]', t).forEach(b => b.onclick = () => { const o = ['utc', 'tt', 'tdb'] as const; this.timeScale = o[(o.indexOf(this.timeScale as any) + 1) % 3] as any; this.updateTimeUI(); });
    const rail = $('.rail', t), track = $('.track', rail);
    RATES.forEach((r, i) => { const tk = h('i', 'tk' + (Math.abs(r) === 1 ? ' m' : '')); tk.style.left = `${(i / (RATES.length - 1)) * 100}%`; track.appendChild(tk); });
    track.appendChild(h('i', 'kn'));
    const setFromX = (x: number) => { const r = rail.getBoundingClientRect(); const i = Math.round(Math.max(0, Math.min(1, (x - r.left) / r.width)) * (RATES.length - 1)); this.clock.setRate(RATES[i]); };
    rail.onpointerdown = (e) => { setFromX(e.clientX); const mv = (ev: PointerEvent) => setFromX(ev.clientX); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); };
    rail.onkeydown = (e) => { if (e.key === 'ArrowRight') { this.clock.faster(); e.preventDefault(); } if (e.key === 'ArrowLeft') { this.clock.slower(); e.preventDefault(); } };
    const pop = $('.datepop', t);
    $('.when', t).onclick = (e) => { e.stopPropagation(); pop.classList.toggle('open'); const c = calendar(ttToUtc(this.clock.jd)); ($('input', pop) as HTMLInputElement).value = `${String(c.year).padStart(4, '0')}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}T${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}:${String(c.s).padStart(2, '0')}`; };
    pop.onclick = e => e.stopPropagation();
    ($('input', pop) as HTMLInputElement).onchange = (e) => {
      const v = (e.target as HTMLInputElement).value; const m = v.match(/(-?\d+)-(\d+)-(\d+)T(\d+):(\d+)(?::(\d+))?/); if (!m) return;
      this.clock.set(utcToTT(jdFromCalendar(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0)))); this.toast('Moved to the chosen date');
    };
    const evs = $('.evs', pop);
    for (const ev of EVENTS) { const b = h('button', '', `<span>${esc(ev.title)}</span><span class="num">${ev.date}</span>`); b.onclick = () => { pop.classList.remove('open'); this.runEvent(ev); }; evs.appendChild(b); }
    document.addEventListener('click', () => pop.classList.remove('open'));
    this.clock.listeners.add(() => this.updateTimeUI());
    this.updateTimeUI();
  }
  runEvent(ev: typeof EVENTS[number]) {
    this.clock.set(utcToTT(ev.jd)); this.clock.rate = ev.rate ?? 60; this.clock.paused = false; this.clock.emit();
    const target = this.sys.get(ev.target)!; const from = ev.from ? this.sys.get(ev.from) : null;
    this.sys.update(this.clock.jd, ev.jd);
    if (from && ev.view === 'from') {
      const dir = norm(sub(target.pos, from.pos)); const r = this.engine.rig; r.flight = null; r.target = from;
      r.pos = [from.pos[0] - dir[0] * from.radius * (ev.distMul ?? 3), from.pos[1] - dir[1] * from.radius * (ev.distMul ?? 3), from.pos[2] - dir[2] * from.radius * (ev.distMul ?? 3)];
      r.setTarget(from); this.select(target, false);
    } else this.select(target, true, ev.dist);
    this.toast(`${ev.title} — ${ev.note}`, 6000);
  }
  private lastTimeKey = '';
  updateTimeUI() {
    const jd = this.timeScale === 'utc' ? ttToUtc(this.clock.jd) : this.timeScale === 'tdb' ? ttToTdb(this.clock.jd) : this.clock.jd;
    const c = calendar(jd); const yr = c.year <= 0 ? `${1 - c.year} BCE` : `${c.year}`;
    const key = `${c.year}${c.month}${c.day}${c.h}${c.m}${c.s}|${this.clock.paused}|${this.clock.rate}|${this.timeScale}`;
    if (key === this.lastTimeKey) return; this.lastTimeKey = key;
    $('#timeline .when .d').textContent = `${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${yr}`;
    $('#timeline .when .t').textContent = `${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}:${String(c.s).padStart(2, '0')} ${this.timeScale.toUpperCase()}`;
    $$('#timeline [data-ts-cycle]').forEach(b => { const L = String(this.timeScale).toUpperCase(), nx = { UTC: 'TT', TT: 'TDB', TDB: 'UTC' }[L] ?? 'UTC'; if (b.textContent !== L) b.textContent = L; b.setAttribute('aria-label', `Time scale: ${L} — activate to switch to ${nx}`); });
    $('#timeline .rate').textContent = this.clock.paused ? 'Paused' : rateLabel(this.clock.rate);
    const play = $('#timeline .play'); play.innerHTML = this.clock.paused ? ic('Play', 18) : ic('Pause', 18); play.setAttribute('aria-pressed', String(!this.clock.paused));
    const i = RATES.indexOf(this.clock.rate); ($('#timeline .kn')).style.left = `${(Math.max(0, i) / (RATES.length - 1)) * 100}%`;
    $('#timeline .rail').setAttribute('aria-valuenow', String(Math.max(0, i))); $('#timeline .rail').setAttribute('aria-valuetext', this.clock.paused ? 'Paused' : rateLabel(this.clock.rate));
    const live = !this.clock.paused && this.clock.rate === 1 && Math.abs(this.clock.jd - utcToTT(jdFromDate(new Date()))) < 2 / 86400;
    const now = $('#timeline .now'); now.classList.toggle('live', live); now.textContent = live ? 'Live' : 'Now';
    const st = timeScaleStatus(ttToUtc(this.clock.jd)); $('#timeline .when').title = st.note;
  }
  // ── selection & inspector ──────────────────────────────────────────────
  select(b: Body | null, fly = true, dist?: number) {
    this.sel = b; this.engine.selected = b;
    this.markTree(); this.crumbs();
    const ins = $('#inspector');
    if (!b) { ins.classList.remove('open'); return; }
    if (this.history[this.history.length - 1] !== b.id) this.history.push(b.id); if (this.history.length > 50) this.history.shift();
    this.store.pushRecent(b.id);
    // v3.8: deep-sky objects beyond the streamed 3-D catalogue are not navigable yet (arriving would show empty space)
    if (fly && b.info?.navigable === '0') { this.toast(`${b.name} is ${b.info.distance} — beyond SOL’s 100-pc stellar catalogue. Not navigable yet (Gaia DR3 tiles, v3.9).`, 6000); fly = false; }
    if (fly) { this.engine.rig.goTo(b, { dist }); this.reticle.classList.remove('pulse'); void this.reticle.offsetWidth; this.reticle.classList.add('pulse'); }
    this.renderInfo(); ins.classList.add('open');
  }
  crumbs() {
    const c = $('#topbar .crumbs'); const chain: Body[] = [];
    let b: Body | null = this.sel; while (b) { chain.unshift(b); b = b.parent; }
    const isStar = this.sel?.kind === 'xstar';
    const fixed = `<button class="cr dis" disabled title="Universe atlas — planned (programme stages U1–U6)">Universe</button><span class="sep">${ic('ChevronRight', 12)}</span><button class="cr" data-galmap="1" title="Galactic context — the Sun’s place in the Milky Way (model) · M">Milky Way</button><span class="sep">${ic('ChevronRight', 12)}</span>`;
    const sys = isStar ? `<button class="cr" data-ov="1">Solar neighbourhood</button>` : `<button class="cr ${!this.sel || this.sel.kind === 'star' ? '' : ''}" data-ov="1">Solar System</button>`;
    const rest = (isStar ? [this.sel!] : chain.filter(x => x.kind !== 'star')).map(x => `<span class="sep">${ic('ChevronRight', 12)}</span><button class="cr ${x === this.sel ? 'cur' : ''}" data-id="${x.id}" ${x === this.sel ? 'aria-current="location"' : ''}>${esc(x.name)}</button>`).join('');
    c.innerHTML = fixed + sys + rest;
    $$('button[data-id]', c).forEach(bt => bt.onclick = () => this.select(this.sys.get(bt.dataset.id!)!, true));
    $$('button[data-ov]', c).forEach(bt => bt.onclick = () => this.overview(48));
    $$('button[data-galmap]', c).forEach(bt => bt.onclick = () => { this.galmap.auto = false; this.galmap.toggle(); });
  }
  renderInfo() {
    const b = this.sel!; const d = b.def, ins = $('#inspector');
    ins.style.setProperty('--c', hex(d.color));
    const parent = b.parent && b.parent.kind !== 'star' ? ` of ${b.parent.name}` : '';
    const kindL = b.sbdbClass && b.kind !== 'dwarf' ? b.sbdbClass : KIND_LABEL[b.kind] + parent;
    const prof = b.kind === 'xstar' ? null : visualProfile(d);
    const badges = b.kind === 'xstar' ? `<span class="badge obs">Position observed</span><span class="badge der">Radius derived</span>`
      : `<span class="badge t${prof!.tier}" title="${esc(prof!.basis)}">${TIER_LABEL[prof!.tier]}</span><span class="badge eph" title="Position source at this epoch">${esc(b.ephemTier())}</span>`;
    ins.innerHTML = `
      <header class="hero"><div class="kicker">${esc(kindL)}</div><h2>${esc(b.name)}</h2><p class="tag">${esc(d.subtitle)}</p><div class="badges">${badges}</div><button class="tb sm close" aria-label="Close inspector">${ic('X', 16)}</button></header>
      <div class="acts">
        <button class="btn btn-primary" data-a="go">${ic('Navigation', 15)}Travel</button>
        <button class="btn ${this.following ? 'on' : ''}" data-a="follow" aria-pressed="${this.following}">${ic('LocateFixed', 15)}Follow</button>
        <button class="btn ${this.engine.rig.surfaceLock ? 'on' : ''}" data-a="lock" aria-pressed="${this.engine.rig.surfaceLock}">${ic('Globe', 15)}Co-rotate</button>
        <button class="btn" data-a="bm" aria-label="Bookmark this view">${ic('Bookmark', 15)}</button>
      </div>
      <div class="tabs" role="tablist">${['overview', 'physical', 'orbit', 'rotation', 'evidence'].map(t => `<button role="tab" data-tab="${t}">${{ overview: 'Overview', physical: 'Physical', orbit: 'Orbit', rotation: 'Spin', evidence: 'Evidence' }[t]}</button>`).join('')}<span class="ink"></span></div>
      <div class="pane" role="tabpanel"></div>`;
    $('.close', ins).onclick = () => this.select(null);
    $$('[data-a]', ins).forEach(x => x.onclick = () => {
      const a = x.dataset.a;
      if (a === 'go') this.engine.rig.goTo(b);
      if (a === 'follow') { this.following = !this.following; x.classList.toggle('on', this.following); x.setAttribute('aria-pressed', String(this.following)); if (this.following) this.engine.rig.setTarget(b); }
      if (a === 'lock') { const r = this.engine.rig; r.surfaceLock = !r.surfaceLock; if (r.surfaceLock) r.captureLock(); x.classList.toggle('on', r.surfaceLock); this.toast(r.surfaceLock ? `Co-rotating with ${b.name}` : 'Inertial view'); }
      if (a === 'bm') this.addBookmark();
    });
    $$('.tabs button', ins).forEach(t => t.onclick = () => { this.tab = t.dataset.tab!; this.renderPane(); });
    this.renderPane();
  }
  /** v3.7: atmosphere taxonomy + ring-system component table (scientific provenance; also the ring selector — a row click
   *  flies the camera above that ring). */
  scienceSections(b: Body) {
    let h = '';
    const A = ATMOSPHERES[b.id];
    if (A) h += `<div class="kicker">Atmosphere · ${esc(A.cls)}</div>` + this.rows([['Composition', esc(A.composition)], ['Surface pressure', esc(A.surfacePressure)], ...(A.scaleHeightKm ? [['Scale height', `${fmt(A.scaleHeightKm, 1)} km`]] as [string, string][] : []), ['Clouds / plumes', esc(A.clouds)], ['Rendered as', esc(A.render)], ['Sources', esc(A.sources)]]);
    const R = RING_SYSTEMS[b.id];
    if (R) {
      const comps = [...R.narrow.map(n => ({ n: n.name, r: n.r, w: n.width, t: n.tau, st: n.status, src: n.source })), ...R.broad.map(c => ({ n: c.name, r: (c.rIn + c.rOut) / 2, w: c.rOut - c.rIn, t: c.tau, st: c.status, src: c.source }))].sort((a, c) => a.r - c.r);
      const sat = b.id === 'saturn' ? `<p class="note">Main rings (C, B, Cassini Division, A, Encke &amp; Keeler gaps, F core): measured normal optical depth, ${esc(R.profile!.source)}.</p>` : '';
      h += `<div class="kicker">Ring system · ${comps.length + (b.id === 'saturn' ? 7 : 0)} components</div>${sat}<table class="rings"><thead><tr><th>Ring</th><th>Radius</th><th>Width</th><th>τ</th><th>Data</th></tr></thead><tbody>${comps.map(c => `<tr data-ring-r="${c.r}" title="${esc(c.src)}" tabindex="0"><td>${esc(c.n)}</td><td>${fmt(c.r, 0)} km</td><td>${fmt(c.w, c.w < 10 ? 1 : 0)} km</td><td>${c.t < 1e-3 ? c.t.toExponential(0) : fmt(c.t, 3)}</td><td><span class="badge ${c.st === 'MEASURED' || c.st === 'PROFILE' ? 'obs' : 'der'}">${esc(c.st.toLowerCase())}</span></td></tr>`).join('')}</tbody></table>`
        + `<p class="note">${R.notes.map(esc).join(' ')}</p>`;
      setTimeout(() => $$('tr[data-ring-r]').forEach(tr => tr.onclick = tr.onkeydown = (ev: any) => { if (ev.type === 'keydown' && ev.key !== 'Enter') return; this.engine.flyToRing(b, parseFloat(tr.dataset.ringR!)); this.toast(`Flying above ${tr.children[0].textContent} (${b.name})`); }), 0);
    }
    return h;
  }
  rows(rows: [string, string][]) { return `<dl class="rows">${rows.map(([k, v]) => `<div class="r"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`; }
  renderPane() {
    const b = this.sel!; if (!b) return;
    const ins = $('#inspector'); const pane = $('.pane', ins);
    $$('.tabs button', ins).forEach(t => { t.classList.toggle('on', t.dataset.tab === this.tab); t.setAttribute('aria-selected', String(t.dataset.tab === this.tab)); });
    const on = $(`.tabs button[data-tab=${this.tab}]`, ins), ink = $('.tabs .ink', ins);
    requestAnimationFrame(() => { ink.style.transform = `translateX(${on.offsetLeft}px)`; ink.style.width = on.offsetWidth + 'px'; });
    const d = b.def;
    if (b.kind === 'xstar' && this.tab !== 'overview') {
      const dKm = len(sub(b.pos, this.engine.rig.pos)), dSun = len(b.pos);
      if (b.info.dsoKind) {
        const rowsD: [string, string][] = this.tab === 'physical' ? [['Distance', b.info.distance], ['Distance from camera', fmtDist(dKm, this.settings.get('units') as string)], ['Extent', b.info.radiusNote], ['Navigable', b.info.navigable === '1' ? 'Yes — inside the 100-pc catalogue' : 'Not yet (beyond the streamed catalogue)']]
          : this.tab === 'evidence' ? [['Position', 'OBSERVED — ICRS centre'], ['Distance', b.info.distance], ['Appearance', 'NOT RENDERED — labelled marker only (no volumetric model in v3.8)'], ['Source', b.info.source]]
          : [['Motion', 'Static centre (internal motions and Galactic orbit not modelled)']];
        pane.innerHTML = this.rows(rowsD); return;
      }
      const rows: [string, string][] = this.tab === 'physical'
        ? [['Distance from Sun', `${fmt(dSun / 3.0857e13, 3)} pc · ${fmt(dSun / 9.4607e12, 3)} ly`], ['Distance from camera', fmtDist(dKm, this.settings.get('units') as string)],
           ['Absolute magnitude (V)', b.info.absMag ? `${b.info.absMag} (derived from catalogue ${b.info.absMagSrc})` : '—'], ['Effective temperature', b.info.teff ?? '—'], [b.info.rSunMeasured === '1' ? 'Radius (measured)' : 'Radius (estimated)', b.info.radiusNote ?? '—'], ['Close-range view', 'Resolved disc when within reach: measured/estimated radius, V-band surface brightness from M_V and R, Planck colour, representative limb darkening — no surface features are invented'], ['Distance uncertainty', b.info.distErr ?? '—']]
        : this.tab === 'orbit' ? [['Motion', 'Linear space motion from catalogue proper motion' + (b.info.hasRV === '1' ? ' and radial velocity' : ' (no radial velocity: tangential only)')], ['Reference epoch', 'J2016.0'], ['Galactic orbit', 'Not modelled yet (Phase 9)']]
        : this.tab === 'evidence' ? [['Position', 'OBSERVED — catalogue astrometry'], ['Distance', 'DERIVED from parallax'], ['Radius', 'DERIVED from M and Teff (no bolometric correction)'], ['Appearance', 'Point source (photometric PSF); resolved stellar surfaces are a later phase'], ['Source', b.info.source ?? 'Gaia DR3']]
        : [['Rotation', 'Not modelled — no resolved stellar surface in this phase']];
      pane.innerHTML = this.rows(rows); return;
    }
    if (this.tab === 'overview') {
      pane.innerHTML = `<div class="live" id="livegrid"></div><p class="desc">${esc(d.desc || `${b.name} is one of the known moons of ${b.parent?.name}. Its orbit comes from JPL’s planetary-satellite ephemerides; no spacecraft has resolved its surface, so its appearance here is a labelled reconstruction.`)}</p>
        ${d.facts ? `<ul class="facts">${d.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
        <div class="kicker">True-scale comparison</div>${this.sizeCompare(b)}`;
      this.updateLive(true);
    } else if (this.tab === 'physical') {
      const R = b.radius, g = b.GM ? b.GM / (R * R) * 1000 : 0, vesc = b.GM ? Math.sqrt(2 * b.GM / R) : 0, rho = b.GM ? b.GM / 6.674e-20 / (4 / 3 * Math.PI * R ** 3) / 1e12 : 0;
      pane.innerHTML = this.rows([
        ['Mean radius', `${fmt(R, R < 10 ? 3 : 1)} km`],
        ...(b.info?.sizeSource ? [['Size source', b.info.sizeSource] as [string, string]] : []),
        ...(b.info?.shape ? [['Shape', b.info.shape] as [string, string]] : []),
        ...(b.radii[0] !== b.radii[2] ? [['Dimensions', `${fmt(b.radii[0] * 2, 1)} × ${fmt(b.radii[1] * 2, 1)} × ${fmt(b.radii[2] * 2, 1)} km`] as [string, string]] : []),
        ...(b.GM ? [['Mass', sci(b.GM / 6.6743e-20) + ' kg'], ['Surface gravity', `${fmt(g, 3)} m/s²`], ['Escape velocity', `${fmt(vesc, 3)} km/s`], ['Mean density', `${fmt(rho, 3)} g/cm³`]] as [string, string][] : []),
        ['Geometric albedo', fmt(d.albedo, 3)],
        ...(d.atmo ? [['Atmosphere scale height', `${fmt(d.atmo.rayleighH, 1)} km`]] as [string, string][] : []),
        ...(d.stats ?? []),
        ...(b.info.designation ? [['Designation', b.info.designation]] as [string, string][] : []),
        ...(b.info.note ? [['Note', b.info.note]] as [string, string][] : []),
        ...(b.info.mapCoverage ? [['Map coverage', b.info.mapCoverage]] as [string, string][] : []),
      ]) + this.scienceSections(b);
    } else if (this.tab === 'orbit') {
      if (!b.orbitEl || !b.parent) { pane.innerHTML = `<p class="desc">The Sun sits near the barycentre of the Solar System, wobbling by about one solar diameter as the planets — mostly Jupiter and Saturn — tug on it. It orbits the centre of the Milky Way roughly once every 230 million years.</p>`; return; }
      const { el, mu } = b.orbitEl(this.sys.jd);
      const a = el.a, e = el.e, P = e < 1 ? 2 * Math.PI * Math.sqrt(Math.abs(a) ** 3 / (mu || GM_SUN)) : Infinity, isSun = b.parent.kind === 'star';
      pane.innerHTML = `<canvas class="mini-orbit" aria-label="Orbit diagram"></canvas>` + this.rows([
        ['Orbits', b.parent.name], ['Semi-major axis', e < 1 ? fmtDist(a) + (isSun ? ` (${fmt(a / AU, 4)} AU)` : '') : '— (hyperbolic)'], ['Eccentricity', fmt(e, 5)],
        ['Periapsis', fmtDist(Math.abs(a) * Math.abs(1 - e))], ...(e < 1 ? [['Apoapsis', fmtDist(a * (1 + e))]] as [string, string][] : []),
        ['Inclination', `${fmt(el.i / DEG, 3)}°${isSun ? ' to ecliptic' : ''}`], ['Ascending node', `${fmt(((el.node / DEG) % 360 + 360) % 360, 3)}°`], ['Argument of periapsis', `${fmt(((el.peri / DEG) % 360 + 360) % 360, 3)}°`],
        ['Orbital period', isFinite(P) ? fmtDur(P) : 'Unbound — leaving the Solar System'],
        ['Mean orbital speed', e < 1 ? `${fmt(2 * Math.PI * a / P, 3)} km/s` : `v∞ ≈ ${fmt(Math.sqrt((mu || GM_SUN) / Math.abs(a)), 1)} km/s`],
        ['Position source', b.ephemTier()], ['Frame', 'Heliocentric ecliptic J2000 (parent-relative for moons)'],
        ['Drawn guide', `Osculating conic at this epoch${e >= 1 ? ' (open arc)' : ''} — a snapshot, not the long-term path`],
      ]);
      this.drawMiniOrbit($('.mini-orbit', pane) as HTMLCanvasElement, b);
    } else if (this.tab === 'rotation') {
      const m = b.rotModel ? b.rotModel(this.sys.jd - 2451545, (this.sys.jd - 2451545) / 36525) : null;
      const per = b.rotModel ? (() => { const a = b.rotModel!(0, 0)[2], c = b.rotModel!(1, 0)[2]; return 360 / Math.abs(c - a) * 24 * (Math.sign(c - a) < 0 ? -1 : 1); })() : null;
      const pole = mulMtV([1, 0, 0, 0, 1, 0, 0, 0, 1], [b.rot[2], b.rot[5], b.rot[8]]);
      const orbN = b.parent ? (() => { const v = this.sys.velocity(b, this.sys.jd, b.parent!); const r = b.rel; return norm([r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]]); })() : [0, 0, 1];
      const obl = Math.acos(Math.max(-1, Math.min(1, dot(pole as any, orbN as any)))) / DEG;
      const placeholder = !!d.pole && d.pole[0] === 0 && d.pole[1] === 90;
      pane.innerHTML = this.rows([
        ['Model', b.id === 'earth' ? 'IAU 1976 precession + GMST (UT1≈UTC)' : b.rotModel ? (placeholder ? 'Placeholder pole (not measured)' : 'IAU WGCCRE 2015 / literature') : 'Assumed synchronous (not measured)'],
        ...(m ? [['North pole RA', `${fmt(((m[0] % 360) + 360) % 360, 3)}°`], ['North pole Dec', `${fmt(m[1], 3)}°`]] as [string, string][] : []),
        ...(per ? [['Rotation period', `${fmtDur(Math.abs(per) * 3600)}${per < 0 ? ' (retrograde)' : ''}`]] as [string, string][] : [['Rotation period', 'Equal to orbital period']] as [string, string][]),
        ['Obliquity to orbit', `${fmt(obl, 2)}°`],
        ...(b.kind === 'star' ? [['Differential rotation', 'Snodgrass & Ulrich (1990): 14.71° − 2.40° sin²φ − 1.79° sin⁴φ per day']] as [string, string][] : []),
      ]) + `<p class="note">Turn on Scientific guides to draw the spin axis and equator.</p>`;
    } else {
      // evidence: per-property truth labels, visual profile, assets, model content
      const v = this.engine.views.get(b.id), p = visualProfile(d);
      const shape = v?.modelInfo ? `${v.modelInfo.meshes} mesh${v.modelInfo.meshes > 1 ? 'es' : ''}, ${fmt(v.modelInfo.triangles)} triangles · UVs ${v.modelInfo.hasUV ? 'yes' : 'no'} · authored normals ${v.modelInfo.hasNormals ? 'yes' : 'no'} · embedded texture ${v.modelInfo.textured ? 'yes' : 'no'}` : v?.shapeStats ? `Generated “${v.shapeStats.family}” family · ${fmt(v.shapeStats.craters)} craters, ${v.shapeStats.facets} facets, ${v.shapeStats.boulders} boulders (seed ${p.seed})` : d.model ? 'Shape model (loads when resolved)' : 'Ellipsoid at measured radii';
      const sunNote = b.kind === 'star' ? [['Photosphere', 'Limb darkening MEASURED (Neckel & Labs 1994); granulation, spots, faculae SIMULATED statistically — not this date’s Sun'], ['Corona', 'Brightness MEASURED profile (Baumbach); streamer structure SIMULATED'], ['Display grade', SUN_LOOKS[(this.settings.get('sunLook') as SunLook) || 'natural'].label]] as [string, string][] : [];
      pane.innerHTML = `<div class="tierbox t${p.tier}"><b>${TIER_LABEL[p.tier]}</b><span>Tier ${p.tier} of the content policy</span></div>` + this.rows([
        ['Position', b.ephemTier()],
        ['Size', b.def.radii ? 'Measured triaxial radii' : 'Measured mean radius'],
        ['Shape', `${p.shape === 'model' ? 'OBSERVED shape model' : p.shape === 'ellipsoid' ? 'Ellipsoid' : 'RECONSTRUCTED family'} — ${shape}`],
        ['Map colour', (() => { const ct = colourTruth(d.tex, !d.tex); return `${esc(ct.label)}${ct.detail ? ` — ${esc(ct.detail)}` : ''}`; })()],
        ['Lighting', 'Sunlight: physical direction & irradiance. Planetshine: physical (unshadowed). Inspection light (Exploration/Cinematic only): presentation, not sunlight.'],
        ['Surface', p.surface === 'mapped' ? (d.noData ? `Mapped where imaged; ${Math.round(d.noData.fraction * 100)} % reconstructed (${esc(d.noData.note)})` : 'Mapped (global mosaic)') : `RECONSTRUCTED “${p.surface}” family — not imagery of this body`],
        ...sunNote,
        ['Why this look', esc(p.basis)],
        ...(p.sources.length ? [['Sources', p.sources.map(esc).join('<br>')]] as [string, string][] : []),
      ]);
    }
  }
  sizeCompare(b: Body) {
    const ref = b.radius > 3000 ? this.sys.get('earth')! : this.sys.get('moon')!;
    const big = Math.max(b.radius, ref.radius), s = (r: number) => Math.max(2, 64 * r / big);
    return `<div class="scale-cmp"><figure><div class="b" style="width:${s(b.radius)}px;height:${s(b.radius)}px;--c:${hex(b.def.color)}"></div><figcaption>${esc(b.name)}</figcaption></figure>
      <figure><div class="b" style="width:${s(ref.radius)}px;height:${s(ref.radius)}px;--c:${hex(ref.def.color)}"></div><figcaption>${ref.name}</figcaption></figure>
      <span class="ratio">${b === ref ? '' : `${fmt(b.radius / ref.radius, b.radius / ref.radius < 0.1 ? 4 : 2)}× ${ref.name}’s radius`}</span></div>`;
  }
  drawMiniOrbit(cv: HTMLCanvasElement, b: Body) {
    const W = cv.width = cv.clientWidth * 2, H = cv.height = cv.clientHeight * 2, ctx = cv.getContext('2d')!;
    const o = this.engine.ensureOrbit(b); if (!o) return;
    const P = o.pts; let mx = 0; for (let k = 0; k < P.length; k += 3) mx = Math.max(mx, Math.abs(P[k]), Math.abs(P[k + 2]));
    const s = Math.min(W, H) * 0.42 / mx;
    ctx.strokeStyle = 'rgba(176,196,222,.6)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k < P.length; k += 3) { const x = W / 2 + P[k] * s, y = H / 2 + P[k + 2] * s; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = '#f2c98a'; ctx.beginPath(); ctx.arc(W / 2, H / 2, 6, 0, 7); ctx.fill();
    const r = b.rel; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(W / 2 + r[0] * s, H / 2 - r[1] * s, 7, 0, 7); ctx.fill();
  }
  updateLive(force = false) {
    const b = this.sel; if (!b) return; const g = document.getElementById('livegrid'); if (!g) return; void force;
    const cam = this.engine.rig.pos, rel = sub(b.pos, cam), d = len(rel), earth = this.sys.get('earth')!;
    const dSun = len(b.pos), dEarth = len(sub(b.pos, earth.pos));
    const v = b === this.sys.sun ? [0, 0, 0] : this.sys.velocity(b, this.sys.jd, b.parent ?? undefined);
    const ang = 2 * Math.atan(b.radius / d) / DEG;
    let mag = 0;
    if (b.kind === 'star') mag = -26.74 - 5 * Math.log10(AU / d);
    // v3.8 DEF-38-011: catalogue stars were run through the reflected-light formula (Proxima from 50 AU read +26.3 mag).
    // m = M + 5·log10(d / 10 pc) with the catalogue absolute magnitude.
    else if (b.kind === 'xstar' && b.info?.absMag !== undefined) mag = parseFloat(b.info.absMag) + 5 * Math.log10(d / 3.0856775814913673e14);
    else { const toSun = sub(this.sys.sun.pos, b.pos), alpha = Math.acos(Math.max(-1, Math.min(1, dot(norm(toSun), norm(scale(rel, -1)))))); const ph = (Math.sin(alpha) + (Math.PI - alpha) * Math.cos(alpha)) / Math.PI;
      const F = b.albedo * (2 / 3) * Math.pow(b.radius / d, 2) / Math.pow(dSun / AU, 2) * ph; mag = -26.74 - 2.5 * Math.log10(Math.max(F, 1e-40)); }
    const cells: [string, string, string][] = [
      ['From camera', ...splitU(fmtDist(d - b.radius))], ['From Sun', ...splitU(fmtDist(dSun))],
      ['From Earth', ...splitU(b === earth ? '—' : fmtDist(dEarth))], ['Light time', fmtDur(dEarth / C_KMS), ''],
      ['Speed', fmt(len(v as any), 3), 'km/s'], ['Apparent size', ang > 1 ? fmt(ang, 2) : ang * 60 > 1 ? fmt(ang * 60, 2) : fmt(ang * 3600, 2), ang > 1 ? '°' : ang * 60 > 1 ? '′' : '″'],
      ['Magnitude', (mag >= 0 ? '+' : '') + fmt(mag, 2), 'V mag'], ['Phase', (b.kind === 'star' || b.kind === 'xstar') ? '—' : fmt(phaseIllum(b, cam, this.sys) * 100, 1), (b.kind === 'star' || b.kind === 'xstar') ? '' : '% lit'],
    ];
    g.innerHTML = cells.map(([k, v, u]) => `<div class="c"><div class="k">${k}</div><div class="v num">${v}<small>${u}</small></div></div>`).join('');
  }
  // ── search / command palette ────────────────────────────────────────────
  private palIdx = 0; private palRows: { label: string; type: string; sec: string; run: () => void }[] = [];
  buildPalette() {
    const p = h('div', 'overlay', `<div class="panel palette" role="dialog" aria-modal="true" aria-label="Search and commands"><div class="q">${ic('Search', 18)}<input placeholder="Search the Solar System or type a command…" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="palres" aria-autocomplete="list"><kbd>Esc</kbd></div><div class="res" id="palres" role="listbox"></div><div class="foot"><span><kbd>↑</kbd><kbd>↓</kbd> choose</span><span><kbd>↵</kbd> travel</span><span class="grow"></span><span>Planets · moons · dwarf planets · 94,523 asteroids & TNOs · comets · nearby stars</span></div></div>`);
    p.id = 'palette';
    p.onclick = (e) => { if (e.target === p) this.closePalette(); };
    const inp = $('input', p) as HTMLInputElement;
    inp.oninput = () => this.searchPalette(inp.value);
    inp.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { this.palIdx = Math.min(this.palRows.length - 1, this.palIdx + 1); this.paintPal(inp.value.trim().toLowerCase()); e.preventDefault(); }
      if (e.key === 'ArrowUp') { this.palIdx = Math.max(0, this.palIdx - 1); this.paintPal(inp.value.trim().toLowerCase()); e.preventDefault(); }
      if (e.key === 'Enter') { this.palRows[this.palIdx]?.run(); this.closePalette(); }
      if (e.key === 'Escape') this.closePalette();
    };
    return p;
  }
  private palReturn: HTMLElement | null = null;
  openPalette() { this.palReturn = document.activeElement as HTMLElement; const p = $('#palette'); p.classList.add('open'); const i = $('input', p) as HTMLInputElement; i.value = ''; this.searchPalette(''); i.focus(); }
  closePalette() { $('#palette').classList.remove('open'); this.palReturn?.focus?.(); }
  searchPalette(q: string) {
    const ql = q.trim().toLowerCase(); const rows: typeof this.palRows = [];
    const score = (n: string) => { const s = n.toLowerCase(); if (!ql) return 1; if (s === ql) return 100; if (s.startsWith(ql)) return 50; const i = s.indexOf(ql); if (i >= 0) return 30 - i * 0.1; let j = 0; for (const ch of s) if (ch === ql[j]) j++; return j === ql.length ? 5 : 0; };
    if (!ql) for (const id of this.store.recent.slice(0, 5)) { const b = this.sys.get(id); if (b) rows.push({ label: b.name, type: b.sbdbClass ?? KIND_LABEL[b.kind], sec: 'Recent', run: () => this.select(b, true) }); }
    // v3.8 DEF-38-010: the priority bonus was added BEFORE the match filter, so every high-priority body passed with a
    // zero text score — searching "proxima" listed Sun, Earth, Jupiter… first and Enter flew to the Sun. Filter on the
    // text score, then rank; catalogue stars are ranked together with Solar-System bodies when they match better.
    const bodies = this.sys.bodies.filter(b => b.kind !== 'xstar').map(b => ({ b, t: score(b.name) })).filter(x => x.t > 0).map(x => ({ b: x.b, t: x.t, s: x.t + (x.b.def.priority ?? 0) * 0.05 })).sort((a, b) => b.s - a.s).slice(0, ql ? 14 : 8);
    const bestBody = bodies.length ? bodies[0].t : 0;
    const starFirst = ql.length >= 2 ? this.sys.bodies.filter(b => b.kind === 'xstar' && score(b.name) > Math.max(bestBody, 5)).sort((a, b) => score(b.name) - score(a.name)).slice(0, 6) : [];
    for (const b of starFirst) rows.push({ label: b.name, type: b.def.subtitle, sec: b.info?.dsoKind ? 'Deep-sky reference objects' : 'Stars', run: () => this.select(b, true) });
    for (const { b } of bodies) rows.push({ label: b.name, type: (b.sbdbClass ?? KIND_LABEL[b.kind]) + (b.parent && b.parent.kind !== 'star' ? ` · ${b.parent.name}` : ''), sec: 'Solar System', run: () => this.select(b, true) });
    if (ql.length >= 2) {
      const stars = this.sys.bodies.filter(b => b.kind === 'xstar' && b.name.toLowerCase().includes(ql) && !starFirst.includes(b)).slice(0, 6);
      for (const b of stars) rows.push({ label: b.name, type: b.def.subtitle, sec: 'Stars', run: () => this.select(b, true) });
      let c = 0;
      for (const [nm, idx] of this.names) { if (c >= 12) break; if (nm.toLowerCase().includes(ql)) { rows.push({ label: nm, type: CLASS_NAMES[this.engine.small.record(idx).cls] ?? 'Minor planet', sec: 'Minor planets (JPL SBDB)', run: () => this.promote(nm, idx) }); c++; } }
    }
    const cmds: [string, () => void][] = [['Go to the present moment', () => this.clock.now()], ['Pause / resume time', () => this.clock.toggle()], ['Guides: clean', () => this.setGuides('clean')], ['Guides: scientific', () => this.setGuides('science')], ['Guides: everything', () => this.setGuides('everything')], ['Toggle constellations', () => this.flip('constellations')],
      ['Toggle labels', () => this.flip('labels')], ['Free flight camera', () => this.toggleFree()], ['Capture image', () => this.screenshot()], ['Cinematic mode (hide interface)', () => this.action('cine')], ['Open settings', () => this.openSettings()], ['Save a bookmark of this view', () => this.addBookmark()],
      ['Overview of the inner planets', () => this.overview(3.5)], ['Overview of the planetary system', () => this.overview(48)], ['The Kuiper Belt and beyond', () => this.overview(160)], ['View: Scientific', () => this.setViewMode('scientific')], ['View: Exploration', () => this.setViewMode('exploration')], ['View: Cinematic', () => this.setViewMode('cinematic')], ['Sun look: natural', () => this.settings.set('sunLook', 'natural')], ['Sun look: cinematic', () => this.settings.set('sunLook', 'cinematic')], ['Sun look: scientific', () => this.settings.set('sunLook', 'scientific')],
      ...TOURS.map(t => [`Tour: ${t.title}`, () => this.startTour(t)] as [string, () => void])];
    for (const [l, f] of cmds) if (!ql || l.toLowerCase().includes(ql)) rows.push({ label: l, type: 'Command', sec: 'Commands', run: f });
    this.palRows = rows; this.palIdx = 0; this.paintPal(ql);
  }
  setGuides(m: GuideMode) { this.settings.set('orbits', true); this.settings.set('guideMode', m); this.toast(`Guides: ${GUIDE_MODES.find(x => x.id === m)!.label}`); }
  paintPal(ql = '') {
    const res = $('#palette .res'); let last = ''; let html = '';
    this.palRows.forEach((r, i) => {
      if (r.sec !== last) { html += `<div class="sec" role="presentation">${r.sec}</div>`; last = r.sec; }
      const lab = ql ? esc(r.label).replace(new RegExp(`(${ql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'), '<b>$1</b>') : esc(r.label);
      html += `<button class="row ${i === this.palIdx ? 'act' : ''}" role="option" aria-selected="${i === this.palIdx}" id="pal-${i}" data-i="${i}"><span class="nm">${lab}</span><span class="ty">${esc(r.type)}</span></button>`;
    });
    res.innerHTML = html || `<div class="sec">No matches</div>`;
    ($('#palette input') as HTMLElement).setAttribute('aria-activedescendant', `pal-${this.palIdx}`);
    $$('.row', res).forEach(x => x.onclick = () => { this.palRows[+x.dataset.i!].run(); this.closePalette(); });
    res.querySelector('.act')?.scrollIntoView({ block: 'nearest' });
  }
  flip(k: string) { const v = this.settings.toggle(k); this.toast(`${k[0].toUpperCase() + k.slice(1)} ${v ? 'on' : 'off'}`); if (this.panel === 'overlays') this.buildOverlays(); }
  overview(au: number) {
    const sun = this.sys.sun, r = this.engine.rig; r.target = sun;
    r.goTo(sun, { dist: au * AU }); this.select(null, false); this.crumbs();
    setTimeout(() => { r.tPitch = 0.5; }, 100);
  }
  promote(name: string, idx: number) {
    const id = 'mp' + idx; let b = this.sys.get(id);
    if (!b) {
      const r = this.engine.small.record(idx);
      const diam = r.diam || 1329 / Math.sqrt(0.12) * Math.pow(10, -r.H / 5);
      const rad = Math.max(0.05, diam / 2);
      b = new Body({ id, name: name.replace(/^\d+\s+/, '').replace(/^\((.*)\)$/, '$1') || name, kind: r.cls === 6 ? 'tno' : 'asteroid', radius: rad, radii: [rad * 1.25, rad, rad * 0.8], albedo: 0.12,
        color: [0.55, 0.52, 0.48], periodH: 6 + (idx % 13), pole: [idx * 37 % 360, (idx * 13 % 160) - 80], subtitle: `${CLASS_NAMES[r.cls]} · H ${r.H.toFixed(1)}`,
        desc: `${name} is one of 94,523 catalogued bodies from JPL’s Small-Body Database. Its orbit is computed from osculating elements; its shape is a representative reconstruction${r.diam ? ` at its measured ${fmt(r.diam, 1)} km diameter` : ` sized from its absolute magnitude (assumed albedo 0.12)`} — not an image of this object.` });
      b.parent = this.sys.sun; this.sys.sun.children.push(b);
      const q = r.a * (1 - r.e), n = 0.01720209895 / Math.pow(r.a, 1.5) / DEG, tp = r.epoch - r.ma / n;
      b.ephem = (jd) => conicPos(q * AU, r.e, r.i, r.om, r.w, tp, jd);
      b.orbitEl = () => ({ el: { a: r.a * AU, e: r.e, i: r.i * DEG, node: r.om * DEG, peri: r.w * DEG, M: 0 }, frame: [1, 0, 0, 0, 1, 0, 0, 0, 1], mu: GM_SUN });
      b.rotModel = (d: number) => [b!.def.pole![0], b!.def.pole![1], 360 * 24 / b!.def.periodH! * d];
      b.ephemTier = () => 'two-body from SBDB elements (rounded, ≈10⁵ km)';
      b.sbdbClass = CLASS_NAMES[r.cls]; b.H = r.H; b.info.designation = name;
      this.sys.add(b); this.sys.update(this.clock.jd, ttToUtc(this.clock.jd));
    }
    this.select(b, true);
  }
  // ── settings ────────────────────────────────────────────────────────────
  setTab = 'graphics'; setQuery = '';
  buildSettings() {
    const secs: [string, string, keyof typeof L][] = [['graphics', 'Graphics', 'MonitorCog'], ['sun', 'The Sun', 'Sun'], ['scene', 'Scene', 'Layers'], ['guides', 'Guides', 'Orbit'], ['camera', 'Camera', 'Camera'], ['time', 'Time & units', 'Clock'], ['access', 'Accessibility', 'Accessibility'], ['about', 'Data & credits', 'Info']];
    const s = h('div', 'overlay', `<div class="panel settings" role="dialog" aria-modal="true" aria-labelledby="set-title"><aside><h2 id="set-title">Settings</h2>
      <input type="search" class="setq" placeholder="Search settings" aria-label="Search settings">
      <nav>${secs.map(([k, l, i]) => `<button data-s="${k}">${ic(i, 16)}${l}</button>`).join('')}</nav>
      <span class="grow"></span><button data-s="reset" class="ghost">${ic('RotateCcw', 16)}Restore defaults</button></aside><main tabindex="-1"></main><button class="tb sm close" aria-label="Close settings">${ic('X', 16)}</button></div>`);
    s.id = 'settings'; s.onclick = (e) => { if (e.target === s) this.closeSettings(); };
    $('.close', s).onclick = () => this.closeSettings();
    $$('aside nav button, aside [data-s=reset]', s).forEach(b => b.onclick = () => { const k = b.dataset.s!; if (k === 'reset') { this.settings.reset(); this.toast('Defaults restored'); } else { this.setTab = k; this.setQuery = ''; ($('.setq', s) as HTMLInputElement).value = ''; } this.paintSettings(); });
    ($('.setq', s) as HTMLInputElement).oninput = (e) => { this.setQuery = (e.target as HTMLInputElement).value.trim().toLowerCase(); this.paintSettings(); };
    setTimeout(() => this.paintSettings());
    return s;
  }
  openSettings() { $('#settings').classList.add('open'); this.paintSettings(); setTimeout(() => ($('#settings .setq') as HTMLElement).focus(), 40); }
  closeSettings() { $('#settings').classList.remove('open'); }
  syncSettingsUI() { if (document.getElementById('settings')?.classList.contains('open')) this.paintSettings(); }
  private settingsHTML(tab: string) {
    const sw = (k: string, t: string, d: string) => `<div class="set" data-text="${(t + ' ' + d).toLowerCase()}"><div class="l"><b>${t}</b><span>${d}</span></div><button class="sw ${this.settings.get(k) ? 'on' : ''}" role="switch" aria-checked="${!!this.settings.get(k)}" aria-label="${t}" data-sw="${k}"></button></div>`;
    const rg = (k: string, t: string, d: string, mn: number, mx: number, st: number, f = (v: number) => fmt(v, 2), log = false) => {
      const v = this.settings.get(k) as number; const pos = log ? (Math.log(v) - Math.log(mn)) / (Math.log(mx) - Math.log(mn)) : (v - mn) / (mx - mn);
      return `<div class="set" data-text="${(t + ' ' + d).toLowerCase()}"><div class="l"><b>${t}</b><span>${d}</span></div><div class="rng"><input type="range" min="0" max="1000" value="${pos * 1000}" aria-label="${t}" data-rg="${k}" data-mn="${mn}" data-mx="${mx}" data-st="${st}" data-log="${log ? 1 : 0}" style="--p:${pos * 100}%"><output class="o num">${f(v)}</output></div></div>`;
    };
    const sg = (k: string, t: string, d: string, opts: [string, string][]) => `<div class="set" data-text="${(t + ' ' + d).toLowerCase()}"><div class="l"><b>${t}</b><span>${d}</span></div><div class="seg" role="radiogroup" aria-label="${t}">${opts.map(([v, l]) => `<button role="radio" aria-checked="${String(this.settings.get(k)) === v}" class="${String(this.settings.get(k)) === v ? 'on' : ''}" data-sg="${k}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
    if (tab === 'graphics') return `<h3>Rendering</h3>
      ${sg('quality', 'Quality preset', 'Detail budget: atmosphere samples, terrain error, procedural mesh density. Never changes sizes, distances or identities.', [['medium', 'Balanced'], ['high', 'High'], ['ultra', 'Showcase']])}
      ${rg('renderScale', 'Render resolution', 'Relative to your display. Higher is sharper; lower is faster.', 0.5, 1, 0.05, v => `${Math.round(v * 100)}%`)}
      ${sw('hiTextures', 'Stream full-resolution surfaces', 'Load the highest-resolution maps (up to 8192 × 4096) as you approach a world.')}
      ${sg('textureBudgetMiB', 'Texture memory budget', 'Estimated GPU memory for surface maps; the least recently used are evicted first. Applies after reload.', [['768', '768 MB'], ['1536', '1.5 GB'], ['3072', '3 GB'], ['6144', '6 GB']])}
      <h3>Viewing mode</h3>
      ${sg('viewMode', 'Mode', 'Presentation only — positions, sizes, rotations, phases and the direction and strength of sunlight are identical in all three. Key V cycles.', VIEW_MODES.map(m => [m, MODE_INFO[m].label]))}
      <p class="note">${esc(MODE_INFO[(this.settings.get('viewMode') as ViewMode) || 'exploration'].note)}</p>
      ${sw('nightInspect', 'Night-side inspection light', 'Exploration & Cinematic: a faint fill on unlit hemispheres so terrain and maps stay readable. Labelled on screen whenever it is visible; it is not sunlight and never appears in Scientific mode.')}
      ${rg('inspectLevel', 'Inspection light level', 'Relative to the mode default (Exploration ≈ 3 % of local sunlight).', 0.25, 4, 0.05, v => `${fmt(v, 2)}×`, true)}
      ${rg('skyEV', 'Night-sky exposure', 'Exposure offset of the sky layers only (stars, Milky Way, unresolved worlds, airglow) — like the star-brightness control, a presentation offset in every mode.', -3, 3, 0.1, v => `${v >= 0 ? '+' : ''}${fmt(v, 1)} EV`)}
      ${sw('planetshine', 'Planetshine', 'Physical secondary light reflected by a nearby world: earthshine on the Moon, Saturnshine on its moons, moonlight on Earth.')}
      <h3>Rings &amp; atmospheres (v3.7)</h3>
      ${sw('ringEnhance', 'Faint-ring visibility enhancement', 'Exploration & Cinematic: brightens intrinsically faint ring systems (Jupiter, Neptune, Uranus dust) by a labelled gain. Optical depth, radii and geometry are never changed; Scientific mode always shows physical brightness.')}
      ${sw('ringLabels', 'Ring-region labels', 'Scientific overlay naming the major rings, gaps and arcs of the selected ring system.')}
      ${sw('plumes', 'Plumes', 'Io’s volcanic umbrellas and Enceladus’ south-polar jets (representative geometry from Voyager, Galileo, New Horizons, Cassini).')}
      ${sw('multiScatter', 'Atmospheric multiple scattering', 'Hillaire 2020 multiple-scattering term (twilight, limb glow). Off = single scattering only, for comparison.')}
      ${sw('airglow', 'Airglow', 'Earth’s ≈95 km nightglow layer (calibrated to ≈22 mag arcsec⁻² at the zenith; Leinert et al. 1998).')}
      ${sw('modeBadge', 'Show mode selector', 'The Scientific · Exploration · Cinematic control and its labels at the top of the view.')}
      <h3>Camera & optics</h3>
      ${sw('autoExposure', 'Physical auto-exposure', 'The camera adapts like an eye: stars vanish when a sunlit world fills the view and return in darkness.')}
      ${rg('ev', 'Exposure compensation', 'Brighten or darken the adapted exposure.', -4, 4, 0.1, v => `${v >= 0 ? '+' : ''}${fmt(v, 1)} EV`)}
      ${sw('bloom', 'Bloom', 'Light scattering inside the lens for sources far above display white.')}
      ${rg('bloomStrength', 'Bloom strength', '', 0.05, 1.2, 0.01)}
      ${sw('glare', 'Camera glare', 'Wide-angle glare around the Sun; dims when eclipsed and when the disc fills the view.')}
      ${sw('lensSpikes', 'Diffraction spikes (stylised)', 'Optional lens-aperture starburst in Exploration — a presentation effect, not physical light. Always on in Cinematic, never in Scientific.')}
      ${sg('toneMap', 'Tone mapping', 'How scene-linear light becomes display colour. Neutral (Khronos PBR) keeps surface colours faithful; AgX is softer and desaturates bright regions.', [['neutral', 'Neutral'], ['agx', 'AgX']])}
      <h3>Diagnostics</h3>
      ${sw('showFps', 'Show frame rate', '')}
      ${sw('showDiagnostics', 'Diagnostics overlay', 'WebGPU adapter, frame-time percentiles, texture residency and network queue.')}`;
    if (tab === 'sun') return `<h3>Photosphere</h3>
      ${sg('sunLook', 'Look', 'Display grading only — radiometry, exposure and lighting are identical in all three.', Object.entries(SUN_LOOKS).map(([k, v]) => [k, v.label]))}
      <p class="note">${esc(SUN_LOOKS[(this.settings.get('sunLook') as SunLook) || 'natural'].note)}</p>
      ${sg('sunDetail', 'Surface detail', 'Granulation and spot detail. Lower values cost less GPU time when the Sun fills the view.', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']])}
      ${sw('prominences', 'Prominences', 'Simulated H-alpha prominences at the limb. Physically about 4 millionths of the disc in white light (visible only in eclipse, as in the Scientific look); Natural and Cinematic show them brighter, as an H-alpha-sensitive camera would.')}
      ${sw('corona', 'Solar corona', 'Physical brightness (Baumbach profile, a millionth of the disc) — visible when the disc is eclipsed. Streamer structure is simulated.')}
      <p class="note">Granulation, sunspot groups and faculae are a statistically simulated active Sun, not the Sun of the displayed date. Limb darkening follows Neckel & Labs (1994); rotation follows the Carrington frame with Snodgrass & Ulrich differential rotation.</p>`;
    if (tab === 'scene') return `<h3>Sky</h3>
      ${sw('stars', 'Stars', 'Hipparcos–Tycho stars as point sources; Gaia DR3 / Hipparcos stars in 3D beyond 1,000 AU.')}
      ${rg('starBrightness', 'Star brightness', '1 = physically calibrated flux (v3.4 defaulted to a hidden 3×).', 0.25, 16, 0.05, v => `${fmt(v, 2)}×`, true)}
      ${sw('milkyWay', 'Milky Way diffuse light', 'ESA Gaia all-sky map with point sources removed (so catalogue stars are not counted twice), calibrated to ≈21 mag arcsec⁻² in the Galactic band. A 2D sky layer — not the 3D Milky Way, which is a later phase.')}
      ${rg('skyBrightness', 'Milky Way brightness', 'Your multiplier on the calibrated Gaia EDR3 sky (μ ≈ 21 mag/arcsec² in the band). The mode adds a labelled presentation gain: Scientific ×1 (calibrated), Exploration ×1.4, Cinematic ×1.6.', 0.1, 6, 0.05, v => `${fmt(v, 2)}×`, true)}
      ${sw('constellations', 'Constellation figures', 'IAU constellations drawn on the celestial sphere.')}
      <h3>Worlds</h3>
      ${sw('atmospheres', 'Atmospheres', 'Rayleigh + Mie single scattering, ray-marched per pixel, with per-world constituents.')}
      ${sw('clouds', 'Earth clouds', 'Global cloud cover with ground shadows.')}
      ${sw('cityLights', 'City lights', 'NASA Black Marble night lights on Earth’s dark side.')}
      ${sw('rings', 'Planetary rings', 'Saturn, Uranus, Neptune and Jupiter.')}
      ${sw('ringParticles', 'Ring particles up close', 'Within ~90 m of Saturn’s ring plane: individual 0.2–5 m icy particles (a⁻³ size law, density from the local optical depth, Keplerian shear), seen as a co-orbiting observer would. No self-gravity wakes or collisions yet.')}
      ${sw('terrain', 'Terrain relief (Moon, Mars)', 'LOLA / MOLA altimetry grids as 3D relief below ~1.6 radii.')}
      ${sw('markUnknown', 'Mark unobserved terrain', 'Faint graticule where a world was never imaged and SOL shows a reconstruction.')}
      <h3>Small bodies</h3>
      ${sw('asteroids', 'Asteroids & Kuiper Belt', '94,523 real objects propagated on the GPU every frame.')}
      ${rg('asteroidBoost', 'Small-body visibility', '1 = physically correct (most are far too faint to see). Higher values are an explicit visibility enhancement.', 1, 100000000, 1, v => `${fmt(v, 0)}×`, true)}
      ${sw('asteroidColors', 'Colour by population', 'Main belt, NEOs, Trojans, centaurs and TNOs.')}
      ${sw('cometTails', 'Comet comae & tails', 'Dust and ion tails from radiation pressure and the solar wind.')}
      ${rg('cometBoost', 'Comet brightness', '1 = physical surface brightness.', 1, 100000, 1, v => `${fmt(v, 0)}×`, true)}`;
    if (tab === 'guides') return `<h3>Orbit and axis guides</h3>
      ${sw('orbits', 'Show guides', 'Explanatory overlays — not physical objects.')}
      ${sg('guideMode', 'Mode', 'Clean shows only what you select. Scientific adds nodes, apsides, spin axes, trajectories and the ecliptic.', GUIDE_MODES.map(m => [m.id, m.label] as [string, string]))}
      ${rg('orbitOpacity', 'Guide opacity', '', 0.1, 1.5, 0.01)}
      ${sw('trajectory', 'Ephemeris trajectory', 'Amber: where the selected body actually goes over ±half an orbit, versus the osculating snapshot (scientific and everything modes).')}
      ${sw('orbitMarkers', 'Orbit landmarks', 'Periapsis, apoapsis and node markers on the selected orbit (scientific and everything modes).')}
      ${sw('orbitTrails', 'Direction of motion', 'Fade each orbit behind its body.')}
      ${sw('ecliptic', 'Ecliptic plane', 'The plane of Earth’s orbit (always on in scientific mode).')}
      <h3>Labels</h3>
      ${sw('labels', 'Labels', 'Names of visible bodies, decluttered by importance.')}
      ${rg('labelDensity', 'Label density', '', 0.3, 2.5, 0.05, v => `${fmt(v, 2)}×`)}
      <p class="note">Guide vertices are sent to the GPU as double-precision pairs relative to the camera, so lines stay still at every distance.</p>`;
    if (tab === 'camera') return `<h3>Controls</h3>
      ${rg('sensitivity', 'Pointer sensitivity', '', 0.3, 3, 0.05, v => `${fmt(v, 2)}×`)}
      ${rg('inertia', 'Camera inertia', 'How long motion glides after you let go.', 0.3, 3, 0.05, v => `${fmt(v, 2)}×`)}
      ${rg('fov', 'Field of view', 'Vertical field of view.', 10, 100, 1, v => `${fmt(v, 0)}°`)}
      ${sw('reducedMotion', 'Reduced motion', 'Shorter, gentler travel and no interface animation. Follows your operating-system preference by default.')}`;
    if (tab === 'time') return `<h3>Units</h3>${sg('units', 'Distance units', '', [['metric', 'Metric'], ['imperial', 'Imperial']])}
      <h3>Time scales</h3><p class="note">The simulation runs in TT; ephemerides are evaluated in TDB; the timeline can display UTC (IERS leap-second table, TAI−UTC = 37 s since 2017), TT or TDB. Before 1972 ΔT is modelled; future leap seconds after mid-2027 are unknown.</p>`;
    if (tab === 'access') return `<h3>Display</h3>
      ${rg('uiScale', 'Interface scale', 'Scales all interface text and controls.', 0.85, 1.5, 0.05, v => `${Math.round(v * 100)}%`)}
      ${sw('highContrast', 'High contrast', 'Opaque panels, stronger borders and brighter secondary text.')}
      ${sw('reducedMotion', 'Reduced motion', 'Shorter, gentler travel and no interface animation.')}
      <h3>Keyboard</h3><p class="note">Every action has a keyboard path: Tab moves between controls, Ctrl K opens search, ? lists all shortcuts. Scientific values in the inspector are plain text for screen readers.</p>`;
    return `<div class="credits">
      <h3>Ephemerides</h3><p>2000–2050: JPL Horizons state vectors (DE441 and JPL satellite solutions) for the planets, major moons, the Pluto system and selected comets, interpolated. Outside that window: VSOP87B planets, ELP/MPP02 Moon, Lieske E5 Galilean moons, two-body propagation for other moons. Asteroids and comets: JPL SBDB osculating elements, two-body.</p>
      <h3>Imagery</h3><p>See CREDITS.md and docs/assets/asset-manifest.json for every file’s source, licence and coverage. Most moon maps are U.S.-public-domain USGS Astrogeology mosaics (v3.4); the Ariel, Titania and Oberon maps still carry personal/non-commercial terms and are flagged there.</p>
      <h3>Shape models</h3><p>NASA 3D Resources: Phobos, Deimos, Eros, Vesta, Bennu, Arrokoth, Toutatis, Kleopatra, Geographos, Golevka, Mithra. ESA/Rosetta/MPS OSIRIS: comet 67P. Bodies without spacecraft shapes use labelled family reconstructions.</p>
      <h3>Engine</h3><p>three.js r186 WebGPURenderer (native WebGPU only — no WebGL path), TSL and WGSL; double-precision camera-relative rendering with a reversed depth buffer.</p></div>`;
  }
  paintSettings() {
    const s = $('#settings'), main = $('main', s);
    $$('aside nav button', s).forEach(b => b.classList.toggle('on', !this.setQuery && b.dataset.s === this.setTab));
    if (this.setQuery) {
      const all = ['graphics', 'sun', 'scene', 'guides', 'camera', 'time', 'access'].map(t => this.settingsHTML(t)).join('');
      const tmp = h('div', '', all); const hits = $$('.set', tmp).filter(x => (x.dataset.text ?? '').includes(this.setQuery));
      main.innerHTML = `<h3>Results for “${esc(this.setQuery)}”</h3>` + (hits.length ? hits.map(x => x.outerHTML).join('') : '<p class="empty">No settings match.</p>');
    } else main.innerHTML = this.settingsHTML(this.setTab);
    $$('[data-sw]', main).forEach(b => b.onclick = () => { const k = b.dataset.sw!; const v = !!this.settings.toggle(k); b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); });
    $$('[data-sg]', main).forEach(b => b.onclick = () => { const k = b.dataset.sg!, v = b.dataset.v!; this.settings.set(k, typeof DEFAULTS[k] === 'number' ? +v : v); this.paintSettings(); if (k === 'quality') this.toast('Procedural meshes rebuild at the new density next time a body resolves'); });
    $$('[data-rg]', main).forEach(r => {
      const el = r as HTMLInputElement, k = el.dataset.rg!, mn = +el.dataset.mn!, mx = +el.dataset.mx!, lg = el.dataset.log === '1', o = el.parentElement!.querySelector('.o')!;
      el.oninput = () => {
        const t = +el.value / 1000; let v = lg ? Math.exp(Math.log(mn) + (Math.log(mx) - Math.log(mn)) * t) : mn + (mx - mn) * t;
        const st = +el.dataset.st!; if (!lg) v = Math.round(v / st) * st;
        this.settings.set(k, v); el.style.setProperty('--p', `${t * 100}%`);
        o.textContent = k === 'renderScale' || k === 'uiScale' ? `${Math.round(v * 100)}%` : k === 'ev' ? `${v >= 0 ? '+' : ''}${fmt(v, 1)} EV` : k === 'fov' ? `${fmt(v, 0)}°` : ['asteroidBoost', 'cometBoost'].includes(k) ? `${fmt(v, 0)}×` : `${fmt(v, 2)}${['starBrightness', 'skyBrightness', 'labelDensity', 'sensitivity', 'inertia'].includes(k) ? '×' : ''}`;
        if (k === 'fov') this.engine.rig.tFov = v; if (k === 'sensitivity') this.engine.rig.sensitivity = v; if (k === 'inertia') this.engine.rig.inertia = v;
        if (k === 'renderScale') { this.engine.renderer.setPixelRatio(pixelRatioFor(v)); this.engine.resize(); }
      };
    });
  }
  buildHelp() {
    const keys: [string, string][] = [['Left drag', 'Orbit the target'], ['Right drag', 'Look around'], ['Scroll', 'Zoom (logarithmic, down to the surface)'], ['Click', 'Select'], ['Double-click', 'Travel to object'], ['Ctrl / ⌘ K', 'Search everything'],
      ['Space', 'Pause / resume time'], ['[  ]', 'Slower / faster time'], ['\\', 'Reverse time'], ['Backspace', 'Back to the present'], ['R', 'Free flight (WASD · Q/E · Shift)'], ['Tab', 'Move keyboard focus through the interface'], ['F', 'Travel to selection'], ['U', 'Back to previous target'], ['Home', 'Return to Earth'],
      ['G', 'Guides & layers'], ['J', 'Journeys & bookmarks'], ['B', 'Bookmark this view'], ['N', 'Atlas'], ['M', 'Galactic context (model map)'], ['O', 'Guides on / off'], ['L', 'Labels'], ['C', 'Constellations'], ['H', 'Hide interface'], ['P', 'Capture image'], [',', 'Settings'], ['Esc', 'Close / deselect / end tour'], ['1 – 8', 'Mercury … Neptune'], ['0', 'The Sun']];
    const p = h('div', 'overlay', `<div class="panel help" role="dialog" aria-modal="true" aria-labelledby="help-title"><h2 id="help-title">Controls</h2><dl class="grid">${keys.map(([k, v]) => `<div><dt>${v}</dt><dd><kbd>${k}</kbd></dd></div>`).join('')}</dl><p class="note">Any drag, scroll or key interrupts a camera flight immediately.</p></div>`);
    p.id = 'help'; p.onclick = () => p.classList.remove('open'); return p;
  }
  onboarding() {
    const steps = [['Drag to orbit, scroll to zoom', 'Everything is at true scale — zoom from a 500-metre asteroid to the whole planetary system.', 'Move3d'],
      ['Search anything', 'Press Ctrl K for planets, moons and 94,523 catalogued small bodies. Double-click any object to travel.', 'Search'],
      ['Know what is real', 'Every body carries an evidence badge: observed, observed + reconstructed, modelled or representative.', 'BadgeCheck'],
      ['Clean guides by default', 'Orbit guides follow your selection. Switch to Scientific for nodes, apsides and spin axes.', 'Orbit']] as [string, string, keyof typeof L][];
    let i = 0; const el = h('div', 'coach panel', ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Getting started'); document.body.appendChild(el);
    const paint = () => { const [t, d, icn] = steps[i]; el.innerHTML = `<div class="ic">${ic(icn, 22)}</div><div class="tx"><b>${t}</b><span>${d}</span></div><div class="dots">${steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div><div class="acts"><button class="btn sm ghost" data-c="skip">Skip</button><button class="btn sm btn-primary" data-c="next">${i < steps.length - 1 ? 'Next' : 'Start exploring'}</button></div>`;
      $$('[data-c]', el).forEach(b => b.onclick = () => { if (b.dataset.c === 'next' && i < steps.length - 1) { i++; paint(); } else { el.classList.add('out'); setTimeout(() => el.remove(), 400); this.settings.set('onboarded', true); } }); ($('[data-c=next]', el)).focus(); };
    paint(); requestAnimationFrame(() => el.classList.add('in'));
  }
  // ── input ───────────────────────────────────────────────────────────────
  bindInput() {
    const cv = this.canvas, rig = this.engine.rig;
    let drag: null | { b: number; x: number; y: number; moved: number } = null;
    const interrupt = () => { if (this.tour) this.stopTour(); };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    // the pointer leaving the canvas (e.g. onto the search palette) also ends the hover: otherwise the card stayed 'on'
    // with no position to re-pick from (stale 'Earth' card beside Proxima in final-ui3/ui4)
    cv.addEventListener('pointerleave', () => { this.lastHover = null; if (!this.tip.dataset.btn) this.tip.classList.remove('on'); if (this.hover) { this.hover = null; this.engine.hover = null; } });
    cv.addEventListener('pointerdown', e => { drag = { b: e.button, x: e.clientX, y: e.clientY, moved: 0 }; cv.setPointerCapture(e.pointerId); cv.classList.add('dragging'); if (this.panel === 'overlays' || this.panel === 'journeys') this.openPanel(null); });
    cv.addEventListener('pointermove', e => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
        if (rig.flying) { if (drag.moved < 4) return; rig.cancelFlight(); interrupt(); }
        if (drag.b === 0) rig.rotate(dx, dy); else if (drag.b === 2) { if (rig.mode === 'free') rig.rotate(dx, dy); else rig.look(dx, dy); }
      } else this.hoverAt(e.clientX, e.clientY);
    });
    cv.addEventListener('pointercancel', () => { drag = null; cv.classList.remove('dragging'); });
    cv.addEventListener('pointerup', e => {
      cv.classList.remove('dragging'); try { cv.releasePointerCapture(e.pointerId); } catch { }
      if (drag && drag.moved < 4 && drag.b === 0) { const b = this.pick(e.clientX, e.clientY); if (b) this.select(b, false); }
      drag = null;
    });
    cv.addEventListener('dblclick', e => { const b = this.pick(e.clientX, e.clientY); if (b) this.select(b, true); });
    cv.addEventListener('wheel', e => { e.preventDefault(); if (rig.flying) { rig.cancelFlight(); interrupt(); } rig.zoom(e.deltaY * (e.deltaMode === 1 ? 33 : 1)); }, { passive: false });
    window.addEventListener('keydown', e => {
      const tgt = e.target as HTMLElement; if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') { if (e.key === 'Escape') (tgt as HTMLInputElement).blur(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); this.openPalette(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // a modal overlay (search, settings, help) owns the keyboard except Escape
      if (document.querySelector('.overlay.open') && e.key !== 'Escape') return;
      rig.keys.add(e.code);
      const k = e.key;
      if (k === ' ' && tgt.tagName !== 'BUTTON') { e.preventDefault(); if (rig.mode !== 'free') this.clock.toggle(); }
      if (k === ']') this.clock.faster(); if (k === '[') this.clock.slower(); if (k === '\\') this.clock.setRate(-this.clock.rate);
      if (k === 'Backspace') this.clock.now();
      if (k === 'v' || k === 'V') { const i = VIEW_MODES.indexOf((this.settings.get('viewMode') as ViewMode) || 'exploration'); this.setViewMode(VIEW_MODES[(i + (k === 'V' ? 2 : 1)) % 3]); }
      // v3.8 DEF-38-006 (accessibility, spec §37): Tab on the page body toggled free flight and swallowed the key, so
      // keyboard users could never Tab into the interface from the viewport. Tab now always moves focus; free flight is R.
      if ((k === 'r' || k === 'R') && tgt.tagName !== 'BUTTON') this.toggleFree();
      if (k === 'Escape') {
        if (this.tour) { this.stopTour(); return; }
        const open = document.querySelector('.overlay.open, .panel.pop.open, #atlas.open');
        document.querySelectorAll('.overlay.open').forEach(x => x.classList.remove('open'));
        if (this.panel) this.openPanel(null);
        if (!open) this.select(null);
        document.body.classList.remove('cine');
      }
      if (rig.mode === 'free') return;
      if (rig.flying && ['w', 'a', 's', 'd'].includes(k)) { rig.cancelFlight(); interrupt(); }
      if (k === 'f' && this.sel) rig.goTo(this.sel);
      if (k === 'o') this.flip('orbits'); if (k === 'l') this.flip('labels'); if (k === 'c') this.flip('constellations');
      if (k === 'n') this.openPanel('atlas'); if (k === 'g') this.openPanel('overlays'); if (k === 'j') this.openPanel('journeys'); if (k === 'b') this.addBookmark();
      if (k === 'h') this.action('cine'); if (k === 'p') this.screenshot(); if (k === '?') this.action('help'); if (k === ',') this.openSettings();
      if (k === 'u') this.back(); if (k === 'Home') this.home();
      if (k === 'm') { this.galmap.auto = false; this.galmap.toggle(); }
      const pl = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
      if (/^[0-8]$/.test(k)) this.select(this.sys.get(pl[+k])!, true);
    });
    window.addEventListener('keyup', e => rig.keys.delete(e.code));
    window.addEventListener('blur', () => rig.keys.clear());
  }
  pick(x: number, y: number): Body | null {
    let best: Body | null = null, bs = 1e9;
    for (const b of this.sys.bodies) {
      const s = this.engine.screen.get(b.id); if (!s || !s.vis) continue;
      const d = Math.hypot(s.x - x, s.y - y), rad = Math.max(10, s.r);
      if (d < rad) { const sc = d / rad - (b.def.priority ?? 0) * 0.002 + (s.r > 4 ? -0.5 : 0) + s.dist * 1e-15; if (sc < bs) { bs = sc; best = b; } }
    }
    return best;
  }
  private lastHover: [number, number] | null = null; private hoverTick = 0;
  hoverAt(x: number, y: number) {
    this.lastHover = [x, y];
    const b = this.pick(x, y);
    if (b !== this.hover) { this.hover = b; this.engine.hover = b; }
    if (b) {
      const s = this.engine.screen.get(b.id)!; delete this.tip.dataset.btn;
      this.tip.innerHTML = `<div class="n">${esc(b.name)}</div><div class="s">${esc(b.sbdbClass ?? KIND_LABEL[b.kind])}${b.parent && b.parent.kind !== 'star' ? ' of ' + esc(b.parent.name) : ''}</div><div class="m num">${fmtDist(s.dist)}</div>`;
      this.tip.style.transform = `translate3d(${x + 18}px, ${y + 14}px, 0)`; this.tip.classList.add('on');
    } else this.tip.classList.remove('on');
  }
  // ── per frame ───────────────────────────────────────────────────────────
  frame(dt: number) {
    // v3.8 DEF-38-012: the hover card was refreshed only on pointer movement, so after a flight it kept naming whatever
    // body had been under the (still) pointer — e.g. "Earth" floating beside Proxima Centauri. Re-pick a few times a second.
    // (time-based, every 250 ms: a frame count is far too slow on low frame rates)
    if (!this.lastHover && this.tip.classList.contains('on') && !this.tip.dataset.btn) this.tip.classList.remove('on');
    if (this.lastHover && this.tip.classList.contains('on') && performance.now() - this.hoverTick > 250) { this.hoverTick = performance.now(); this.hoverAt(this.lastHover[0], this.lastHover[1]); }
    const now = performance.now();
    this.updateTimeUI();
    this.updateLabels();
    if (now - this.lastInfo > 250) { this.lastInfo = now; this.updateLive(); this.updateTele(); if (!this.diag.hidden) this.paintDiag(); }
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 0.5) { $('#fps').textContent = `${Math.round(this.fpsN / this.fpsAcc)} fps`; this.fpsAcc = 0; this.fpsN = 0; }
    const rig = this.engine.rig;
    if (this.sel && this.following && rig.mode === 'orbit' && !rig.flying && rig.target !== this.sel) rig.setTarget(this.sel);
  }
  paintDiag() {
    const d: any = this.engine.diagnostics(), a = d.adapter ?? {};
    this.diag.textContent = [`backend   ${d.backend}${a.fallback ? ' · SOFTWARE ADAPTER (QA)' : ''}`, `adapter   ${[a.vendor, a.architecture, a.description].filter(Boolean).join(' · ') || 'n/a'}`,
      `frame     median ${d.frame.medianMs} ms · p95 ${d.frame.p95Ms} · p99 ${d.frame.p99Ms} · cpu ${d.frame.cpuMs} ms`, `draws     ${d.drawCalls} · views ${d.views} · orbits ${d.orbits} · LOD ${JSON.stringify(d.lod ?? {})}`,
      `terrain   ${d.terrain ? `${d.terrain.patches} patches · ${d.terrain.cached} cached · ${d.terrain.built} built` : '—'}`,
      `textures  ${d.textures.residentMiB}/${d.textures.budgetMiB} MiB est. · base ${d.textures.base} · hi ${d.textures.hi} · loading ${d.textures.loading.length}`,
      `network   ${d.net.requests} req · ${(d.net.bytes / 1048576).toFixed(1)} MiB · in flight ${d.net.inFlight} · queued ${d.net.queued} · failed ${d.net.failures}`,
      `exposure  ${d.exposureEV} EV · target ${this.engine.rig.target?.name ?? '—'} · ${this.engine.rig.target?.ephemTier() ?? ''}`,
      `camera    ${this.engine.rig.sm.mode} · history ${this.engine.rig.sm.history.length} · rejected ${this.engine.rig.sm.rejected.length} · detail ${d.detail ?? '—'}`,
      `catalogs  ${Object.entries(this.engine.catalogStreams).map(([k, st]) => `${k} ${JSON.stringify(st.counts())}`).join(' · ') || '—'}`,
      `rings     ${this.engine.ringFieldState.active ? `near-field ON · τ ${this.engine.ringFieldState.tau} · ${this.engine.ringFieldState.count} particles` : 'near-field off'}`].join('\n');
  }
  updateTele() {
    const rig = this.engine.rig, t = rig.target, el = $('#tele');
    const modeL = rig.flying ? 'Travelling' : rig.mode === 'free' ? 'Free flight' : this.tour ? 'Tour' : rig.surfaceLock ? 'Co-rotating' : 'Orbit';
    $('.tmode', el).innerHTML = `<span class="dot"></span><span>${modeL}${t ? ` · <b>${esc(t.name)}</b>` : ''}</span>`;
    // v3.5 AUD-05: colour provenance of the target's map, always visible next to its name
    const ct = t && t.kind !== 'star' && t.kind !== 'xstar' ? colourTruth(t.def.tex, !!(t.def.procedural || !t.def.tex)) : null;
    const ce = $('.ctruth', el); ce.className = 'ctruth ' + (ct?.cls ?? ''); ce.textContent = ct && ct.cls !== 'observed' ? ct.label : '';
    this.updateViewMode();
    this.galmap?.update(rig.pos as any, this.sys.bodies.filter(b => b.kind === 'xstar'), t);
    const sunD = len(rig.pos);
    // v3.8: beyond the planetary system the Sun distance reads in ly/pc (v3.7 printed e.g. "268,000.000 AU from the Sun")
    const sunS = sunD < 2000 * AU ? `${fmt(sunD / AU, 3)} AU from the Sun` : `${fmtDist(sunD)} from the Sun`;
    $('.alt', el).textContent = t ? `${t.kind === 'xstar' ? 'Distance' : 'Altitude'} ${fmtDist(len(sub(rig.pos, t.pos)) - (t.kind === 'xstar' ? 0 : t.radius), this.settings.get('units') as string)} · ${sunS}` : sunS;
    const dist = t ? len(sub(rig.pos, t.pos)) : sunD, kmPerPx = dist * this.engine.pxAng, nice = niceLength(kmPerPx * 110);
    ($('.ruler i', el)).style.width = `${(nice / kmPerPx).toFixed(1)}px`; $('.ruler span', el).textContent = fmtDist(nice, this.settings.get('units') as string);
    $('.frame', el).textContent = `${t && t.parent && t.parent.kind !== 'star' ? `${t.parent.name}-centred` : 'Heliocentric'} ecliptic J2000 · camera-relative float64 · true scale`;
    const v = $('#timeline .validity'); const tier = t?.ephemTier() ?? '';
    const warn = /extrapolat|approximate|rounded|two-body/i.test(tier);
    v.className = 'validity ' + (warn ? 'warn' : 'ok'); v.innerHTML = t ? `${warn ? ic('TriangleAlert', 13) : ic('CircleCheck', 13)}<span>${esc(tier)}</span>` : '';
  }
  /** v3.5 viewing-mode control + the always-visible enhancement label (spec §6: the viewer must know which mode is
   *  active, and an inspection enhancement is never described as sunlight). */
  private vmBound = false;
  updateViewMode() {
    const root = document.getElementById('viewmode'); if (!root) return;
    const m = (this.settings.get('viewMode') as ViewMode) || 'exploration';
    if (!this.vmBound) { this.vmBound = true; $$('[data-vm]', root).forEach(b => b.onclick = () => this.setViewMode(b.dataset.vm as ViewMode)); }
    $$('[data-vm]', root).forEach(b => { const on = b.dataset.vm === m; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    const e = this.engine.enhancement, notes: string[] = [];
    if (m !== 'scientific' && e.inspect) notes.push('Night side: inspection light (not sunlight)');
    if (m !== 'scientific' && e.skyDecoupled) notes.push('Sky: dark-adapted exposure');
    if (m !== 'scientific' && e.rings) notes.push(`Rings: brightness ×${e.rings.gain >= 10 ? Math.round(e.rings.gain) : e.rings.gain.toFixed(1)} (enhanced, optical depth unchanged)`);
    if (m !== 'scientific' && e.plumes && this.sel?.id === e.plumes) notes.push(`Plumes: brightness ×${e.plumeGain.toFixed(e.plumeGain < 10 ? 1 : 0)} (enhanced — physical in Scientific)`);
    if (m === 'scientific') notes.push('One physical camera');
    const n = $('.vm-note', root), txt = notes.join(' · ');
    if (n.textContent !== txt) n.textContent = txt;
    root.hidden = this.settings.get('modeBadge') === false;
  }
  setViewMode(m: ViewMode) {
    if (!VIEW_MODES.includes(m)) return;
    this.settings.set('viewMode', m); this.toast(`${MODE_INFO[m].label} view — ${MODE_INFO[m].note.split('. ')[0]}.`);
  }
  private marks = new Map<string, HTMLElement>();
  updateOrbitMarks() {
    const mode = (this.settings.get('guideMode') as GuideMode) || 'clean';
    const want = this.sel && this.settings.get('orbits') && this.settings.get('orbitMarkers') && guideExtras(mode).landmarks ? this.engine.orbitLandmarks(this.sel) : [];
    // v3.7 scientific ring-region overlay (off by default: no label clutter in the standard scene)
    if (this.sel && this.settings.get('ringLabels')) want.push(...this.engine.ringLabelAnchors(this.sel).map(m => ({ ...m, key: 'ring ' + m.key })));
    const seen = new Set<string>();
    for (const m of want) {
      const p = this.engine.project(m.pos); if (!p.vis) continue;
      let el = this.marks.get(m.key);
      if (!el) { el = document.createElement('div'); el.className = 'omark ' + m.key; el.setAttribute('role', 'img'); document.body.appendChild(el); this.marks.set(m.key, el); }
      el.setAttribute('aria-label', `${m.label} of ${this.sel!.name}`); el.dataset.l = m.label;
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`; seen.add(m.key);
    }
    for (const [k, el] of this.marks) el.hidden = !seen.has(k);
  }
  private chromeCache: { t: number; r: DOMRect[] } = { t: -1e9, r: [] };
  chromeRects(): DOMRect[] {
    const now = performance.now(); if (now - this.chromeCache.t < 500) return this.chromeCache.r;
    const r = ['#topbar', '#timeline', '#guidedock'].map(q => document.querySelector(q) as HTMLElement | null).filter((e): e is HTMLElement => !!e && e.offsetParent !== null).map(e => e.getBoundingClientRect());
    this.chromeCache = { t: now, r }; return r;
  }
  updateLabels() {
    this.updateOrbitMarks();
    const show = !!this.settings.get('labels'), wrap = $('#labels');
    const W = this.engine.W, H = this.engine.H, dens = this.settings.get('labelDensity') as number;
    const cand: { b: Body; s: any; pr: number }[] = [];
    // resolved discs that can hide labels of objects behind them (v3.2 drew e.g. Gonggong's label across Earth)
    const discs: { x: number; y: number; r: number; d: number; id: string }[] = [];
    for (const b of this.sys.bodies) { const s = this.engine.screen.get(b.id); if (s && s.vis && s.r > 3 && s.z <= 1) discs.push({ x: s.x, y: s.y, r: s.r, d: s.dist, id: b.id }); }
    const occluded = (b: Body, s: any) => discs.some(o => o.id !== b.id && o.d < s.dist - b.radius && Math.hypot(s.x - o.x, s.y - o.y) < o.r * 0.98);
    for (const b of this.sys.bodies) {
      const s = this.engine.screen.get(b.id); if (!s || !s.vis || s.z > 1) continue;
      if (s.x < -50 || s.y < -50 || s.x > W + 50 || s.y > H + 50) continue;
      if (occluded(b, s)) continue;
      const par = b.parent && b.parent.kind !== 'star' ? this.engine.screen.get(b.parent.id) : null;
      if (b !== this.sel && b !== this.hover && b.kind !== 'planet' && s.r < 1.5 && s.bright < 0.03 && !(b.kind === 'dwarf' && s.dist < 60 * 1.496e8)) continue;
      let pr = (b.def.priority ?? 20) + Math.log2(1 + s.r) * 8;
      if (b.kind === 'moon' && par) { const sep = Math.hypot(s.x - par.x, s.y - par.y); if (sep < 16 && b !== this.sel) continue; pr += Math.min(20, Math.log2(1 + sep) * 2) - 10; }
      if (b === this.sel) pr += 1000; if (b === this.hover) pr += 500;
      cand.push({ b, s, pr });
    }
    cand.sort((a, b) => b.pr - a.pr);
    const placed: [number, number, number, number][] = []; const used = new Set<string>();
    const maxN = Math.round(48 * dens);
    for (const c of cand) {
      if (!show && c.b !== this.sel && c.b !== this.hover) continue;
      if (placed.length >= maxN) break;
      const off = Math.max(8, Math.min(c.s.r, H * 0.4)) + 6;
      const w = c.b.name.length * 7.2 + 28, x0 = c.s.x + off * 0.7, y0 = c.s.y - 8;
      if (c.s.r * 2 > H * 0.9 && c.b !== this.sel) continue;
      if (placed.some(([x, y, ww, hh]) => x0 < x + ww && x0 + w > x && y0 < y + hh && y0 + 18 > y)) continue;
      // v3.8: labels never run under the interface chrome (top bar / breadcrumbs / timeline); a star label "Sargas" was
      // drawn across the breadcrumb at Proxima (final-ui4). Chrome rectangles are refreshed with the layout (see chromeRects).
      if (c.b !== this.sel && this.chromeRects().some(r => x0 < r.right && x0 + w > r.left && y0 < r.bottom && y0 + 18 > r.top)) continue;
      placed.push([x0, y0, w, 18]); used.add(c.b.id);
      let el = this.labels.get(c.b.id);
      if (!el) {
        el = h('div', `lb k-${c.b.kind}`, `<span class="ring"></span><span class="tx">${esc(c.b.name)}</span>`);
        el.style.setProperty('--c', hex(c.b.def.color.map(x => Math.min(1, x * 1.2 + 0.18))));
        el.onclick = () => this.select(c.b, false); el.ondblclick = () => this.select(c.b, true);
        el.onmouseenter = () => { this.engine.hover = c.b; }; el.onmouseleave = () => { if (this.engine.hover === c.b) this.engine.hover = null; };
        wrap.appendChild(el); this.labels.set(c.b.id, el);
      }
      const big = c.s.r > 6;
      el.classList.toggle('big', big); el.classList.toggle('sel', c.b === this.sel); el.classList.remove('hide');
      const ringOff = big ? off * 0.7 : -6;
      el.style.transform = `translate3d(${(c.s.x + ringOff).toFixed(1)}px, ${(c.s.y - 7).toFixed(1)}px, 0)`;
    }
    for (const [id, el] of this.labels) if (!used.has(id)) el.classList.add('hide');
    const s = this.sel ? this.engine.screen.get(this.sel.id) : null;
    if (s && s.vis && s.z < 1) { const r = Math.max(14, Math.min(s.r * 1.15 + 10, H)); this.reticle.style.width = this.reticle.style.height = `${r * 2}px`; this.reticle.style.transform = `translate3d(${s.x - r}px, ${s.y - r}px, 0)`; this.reticle.style.opacity = s.r > H * 0.3 ? '0' : '1'; }
    else this.reticle.style.opacity = '0';
  }
}
function phaseIllum(b: Body, cam: number[], sys: SolarSystem) { const toSun = norm(sub(sys.sun.pos, b.pos)), toCam = norm(sub(cam as any, b.pos)); return (1 + dot(toSun, toCam)) / 2; }
