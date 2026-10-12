import { DEEP_SKY, dsoEclipticKm, dsoNavigable } from './data/deepSky';
const DSO_LABEL: Record<string, string> = { 'open-cluster': 'Open cluster', 'emission-nebula': 'Emission nebula', 'dark-cloud': 'Dark nebula', 'molecular-cloud': 'Molecular cloud', 'galactic-centre': 'Galactic centre' };
import './ui/styles.css';
import * as THREE from 'three/webgpu';
import { SolarSystem, OscStates } from './astro/system';
import { jdFromDate, utcToTT, ttToTdb, ut1FromTT } from './astro/time';
import { SAMPLED, SampledManifest } from './astro/sampled';
import { Engine } from './render/engine';
import { blackbodyRGB } from './render/points';
import { rowMV, rowBand } from './galaxy/photometry';
import { Settings } from './core/settings';
import { loadBinary, loadJSON, loadArrayBuffer, loadTexture, loadPNGTexture } from './core/assets';
import { TextureStore } from './core/textures';
import { probeNativeWebGPU, GpuUnavailable, QA } from './core/gpu';
import { UI } from './ui/ui';
import { Clock } from './core/clock';
import { CatalogStream, type CatalogManifest } from './contracts/catalog';

// Staged, validated boot (Phase 1):
//  1. native-WebGPU gate (no WebGL path exists);
//  2. REQUIRED data — the app refuses to start with a precise list if any is missing (baseline could dereference
//     missing assets and crash later);
//  3. OPTIONAL data — degrades visibly but harmlessly (e.g. no Milky Way panorama → black sky, no names → no search);
//  4. surface maps are NOT preloaded: the TextureStore fetches a body's maps when it is first resolved on screen,
//     except the opening subject (Earth), which is warmed up so the first view is complete;
//  5. sampled-ephemeris binaries stream in after the first frame (the analytic/edge tiers cover the gap).
async function boot() {
  const ui = new UI();
  ui.loader.show();
  let gpuInfo;
  try { gpuInfo = await probeNativeWebGPU(); }
  catch (e: any) { if (e instanceof GpuUnavailable) ui.loader.fail(e.title, e.message); else ui.loader.fail('WebGPU check failed', String(e?.message ?? e)); return; }
  (window as any).__solGpu = gpuInfo;
  ui.loader.stage('gpu', 'done', [gpuInfo.vendor, gpuInfo.architecture].filter(Boolean).join(' · ') + (gpuInfo.fallback ? ' (software, QA)' : ''));
  ui.loader.stage('data', 'active');
  const settings = new Settings();
  type Job = { label: string; run: () => Promise<any>; required: boolean };
  const jobs: Job[] = [
    { label: 'Hipparcos–Tycho star catalogue', run: () => loadBinary('data/stars.bin'), required: true },
    { label: 'JPL small-body database', run: () => loadBinary('data/smallbodies.bin'), required: true },
    { label: 'Planetary satellite elements', run: () => loadJSON('data/satellites.json'), required: true },
    { label: 'Featured asteroids & comets (SBDB, full precision)', run: () => loadJSON('data/featured.json'), required: true },
    { label: 'Photometric calibration', run: () => loadJSON('data/texstats.json'), required: true },
    { label: 'Satellite osculating states (Horizons)', run: () => loadJSON('data/satellites_osc.json'), required: false },
    { label: 'Sampled ephemeris manifest (Horizons)', run: () => loadJSON('data/ephem/manifest.json'), required: false },
    { label: 'Constellation figures', run: () => loadJSON('data/constellations.json'), required: false },
    { label: 'Searchable minor-planet names', run: () => loadJSON('data/smallbodies_names.json'), required: false },
    // v3.5: star-removed diffuse layer (tools/ingest/sky_diffuse.py); the raw map is the fallback
    { label: 'Milky Way diffuse light', run: () => loadTexture('milkyway_diffuse').catch(() => loadTexture('milkyway')), required: false },
    { label: 'Saturn ring profile', run: () => loadPNGTexture('tex/saturn_ring.png'), required: false },
    { label: 'Map highlight statistics', run: () => loadJSON('data/texstats_hi.json'), required: false },
    { label: 'Diffuse sky calibration', run: () => loadJSON('data/milkyway_diffuse.json'), required: false },
  ];
  let done = 0; const results: any[] = new Array(jobs.length); const missing: string[] = [], degraded: string[] = [];
  await Promise.all(jobs.map(async (j, i) => {
    try { results[i] = await j.run(); } catch (e) { (j.required ? missing : degraded).push(j.label); console.warn('asset failed', j.label, e); }
    done++; ui.loader.progress(j.label, done, jobs.length);
  }));
  if (!missing.length) ui.loader.stage('data', 'done', `${jobs.length - degraded.length} of ${jobs.length} files${degraded.length ? ` · ${degraded.length} optional unavailable` : ''}`);
  if (missing.length) { ui.loader.fail('Required data could not be loaded', `Missing: ${missing.join(', ')}. Check the network connection and that the app's assets/ folder is deployed, then reload.`); return; }
  const [stars, small, sats, featured, texStats, osc, ephemMan, constellations, names, milky, ring, texHi, skyCal] = results as [Float32Array, Float32Array, any, any, any, OscStates | undefined, SampledManifest | undefined, any, any, THREE.Texture | undefined, THREE.Texture | undefined, any, any];
  if (milky) milky.colorSpace = THREE.SRGBColorSpace;
  if (ephemMan) SAMPLED.setManifest(ephemMan);
  // ── world ──────────────────────────────────────────────────────────────
  const sys = new SolarSystem(sats, featured, osc ?? null);
  const clock = new Clock(utcToTT(jdFromDate(new Date())));
  const advance = () => sys.update(ttToTdb(clock.jd), ut1FromTT(clock.jd));
  advance();
  const textures = new TextureStore(QA.get('qa-tex-budget') ? +QA.get('qa-tex-budget')! : settings.get('textureBudgetMiB') as number);
  const engine = new Engine(sys, { textures, stars, constellations: constellations ?? null, small, texStats, milky: milky ?? null, ring: ring ?? null, texHi: texHi ?? null, skyCal: skyCal ?? null }, settings);
  engine.gpuInfo = gpuInfo;
  // warm the opening subject so the first frame is complete
  const earthDef = sys.get('earth')!.def;
  for (const n of [earthDef.tex, earthDef.normal, earthDef.night, earthDef.clouds, earthDef.ocean]) if (n) textures.get(n, { srgb: n === earthDef.tex, hiAvailable: !!earthDef.texHi, color: earthDef.color, priority: true });
  ui.loader.stage('scene', 'active', 'Earth surface maps');
  await Promise.race([Promise.all([earthDef.tex, earthDef.normal, earthDef.night, earthDef.clouds].filter(Boolean).map(n => textures.ready(n!))), new Promise(r => setTimeout(r, 8000))]);
  ui.loader.stage('scene', 'done', 'Earth maps'); ui.loader.stage('shaders', 'active', 'device + render pipelines');
  try { await engine.init(ui.canvas); } catch (e: any) { ui.loader.fail('WebGPU initialisation failed', String(e?.message ?? e)); return; }
  engine.onDeviceLost = (i) => ui.loader.fail('The GPU device was lost', `Chrome reported: ${i.reason}${i.message ? ' — ' + i.message : ''}. This can follow a driver reset, GPU memory exhaustion or the tab being backgrounded for long. Reload to continue.`);
  if (degraded.length) console.info('SOL running with optional data unavailable:', degraded.join(', '));
  ui.attach(engine, sys, clock, settings, names ?? []);
  ui.loader.stage('shaders', 'done'); ui.loader.stage('live', 'active');
  // start view: Earth, sunlit
  const earth = sys.get('earth')!;
  engine.rig.pos = [earth.pos[0] + 6e4, earth.pos[1] - 3e4, earth.pos[2] + 1.5e4];
  engine.rig.setTarget(earth);
  // ── stream sampled ephemerides: the focused system first, the rest in the background ──────────────────
  const streamEphem = async () => {
    if (!ephemMan) return;
    const order = ['planets', ...Object.keys(ephemMan.systems).filter(k => k !== 'planets')];
    const want = (): string | undefined => {
      const t = engine.rig.target; let b = t; while (b && b.parent && b.parent.kind !== 'star') b = b.parent;
      const sysName = b ? (b.id === 'pluto' ? 'pluto' : b.kind === 'planet' ? b.id : SAMPLED.systemOf(b.id)) : undefined;
      return sysName && ephemMan.systems[sysName] && !SAMPLED.isAttached(sysName) ? sysName : order.find(k => !SAMPLED.isAttached(k));
    };
    for (let k = want(); k; k = want()) {
      try { SAMPLED.attach(k, await loadArrayBuffer(`data/ephem/${ephemMan.systems[k].file}`)); }
      catch (e) { console.warn('ephemeris stream failed', k, e); order.splice(order.indexOf(k), 1); if (!order.length) break; }
    }
  };
  // ── 3D star catalogue (Gaia DR3 + Hipparcos): optional, streamed after boot ──────────────────────────────
  // v3.4 (contract 3): sector shards streamed nearest-first through CatalogStream with SHA-256 verification; rows that
  // have not arrived are invisible, failed shards are reported (diagnostics) and never silently duplicated.
  // v3.5 (AUD-03): two stages instead of streaming all 85 shards at boot.
  //  (a) at boot: the 166 named, navigable stars (v3.8: +9 nearby stars incl. Proxima Centauri) from a 6 KB extract (named-rows.bin) → search & travel targets exist
  //      immediately; (b) the 3D layer's shards stream only when the camera needs them — once it is > 300 AU from the
  //      Sun (the directional catalogue covers everything nearer; the 3D layer fades in from 1,000 AU) — through the
  //      CatalogStream residency (nearest-first, re-prioritised as the camera moves, far shards evicted).
  const PCKM = 3.0856775814913673e13, STREAM_AU = 300, RES_PC = 110, EVICT_PC = 180;
  const loadStars3D = async () => {
    try {
      const [man, named, nrMeta, nrBuf] = await Promise.all([loadJSON<CatalogManifest>('catalogs/stars/index.json'), loadJSON<{ name: string; index: number; distPc: number }[]>('catalogs/stars/named.json'),
        loadJSON<{ count: number; rowFloats: number; sha256: string }>('catalogs/stars/named-rows.json'), loadArrayBuffer('catalogs/stars/named-rows.bin')]);
      if (nrMeta.count !== named.length || nrBuf.byteLength !== named.length * man.rowFloats * 4) throw new Error('named-rows does not match named.json');
      const nr = new Float32Array(nrBuf);
      sys.addStars(named.map((n, j) => {
        const r = nr.subarray(j * 10, j * 10 + 10), M = r[6], T = r[7];
        const L = Math.pow(10, -0.4 * (M - 4.67)), R = Math.sqrt(L) / Math.pow(T / 5772, 2) * 695700;   // bolometric correction ignored → order-of-magnitude
        // v3.8 DEF-38-011: every named star had the same fixed colour (1, 0.95, 0.9) — Proxima (≈ 3,000 K) looked solar.
        // Colour now from the catalogue Teff (Planck spectrum → linear sRGB, luminance-normalised), as in the 3-D star layer.
        const bb = blackbodyRGB(T), bl = 0.2126 * bb[0] + 0.7152 * bb[1] + 0.0722 * bb[2] || 1;
        return { id: 'star:' + n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: n.name, radius: R, color: [bb[0] / bl, bb[1] / bl, bb[2] / bl] as [number, number, number],
          subtitle: `Star · ${n.distPc < 100 ? n.distPc.toFixed(2) : n.distPc.toFixed(0)} pc from the Sun`,
          desc: `${n.name} is drawn at its measured position (${(r[8] & 2) ? 'Hipparcos' : 'Gaia DR3'} astrometry) and distance from its parallax. SOL does not yet render resolved stellar surfaces or planetary systems for other stars; travelling here shows the true sky from its neighbourhood.`,
          pos: (jd: number) => { const y = (jd - 2457389.0) / 365.25; return [(r[0] + r[3] * y) * PCKM, (r[1] + r[4] * y) * PCKM, (r[2] + r[5] * y) * PCKM] as [number, number, number]; },
          info: { absMag: rowMV(M, T, r[8]).toFixed(2), absMagBand: 'V', absMagSrc: `${M.toFixed(2)} (${rowBand(r[8]) === 'G' ? 'Gaia G' : 'Hipparcos Hp'})`, teff: `${Math.round(T)} K`, radiusNote: `≈ ${(R / 695700).toFixed(2)} R☉ (from M and Teff, no bolometric correction)`, distErr: `±${(r[9] * 100).toFixed(1)} %`, hasRV: (r[8] & 1) ? '1' : '0', source: (r[8] & 2) ? 'Hipparcos (van Leeuwen 2007)' : 'Gaia DR3' } };
      }));
      // v3.8 (spec §26): selected deep-sky reference objects — labelled markers at measured ICRS position + distance
      sys.addStars(DEEP_SKY.map(o => {
        const p = dsoEclipticKm(o), nav = dsoNavigable(o);
        return { id: o.id, name: o.name, radius: o.radiusPc * PCKM, color: [0.8, 0.85, 1] as [number, number, number],
          subtitle: `${DSO_LABEL[o.kind]} · ${o.distPc < 1000 ? o.distPc.toFixed(1) + ' pc' : (o.distPc / 1000).toFixed(2) + ' kpc'} from the Sun`,
          desc: `${o.name}: ${o.note} Shown as a labelled marker at its measured position; SOL does not render its appearance (no volumetric nebula/cluster model yet).`,
          pos: () => p, info: { dsoKind: o.kind, navigable: nav ? '1' : '0', distance: `${o.distPc.toFixed(1)} pc${o.distSigmaPc ? ' ± ' + o.distSigmaPc + ' pc' : ''} (${o.distanceKind}, ${o.status})`, source: o.source, radiusNote: `≈ ${o.radiusPc} pc (extent used for the view distance)` } };
      }));
      // (b) lazily streamed 3D layer
      let stream: CatalogStream | null = null, layer: any = null, toasted = false;
      const obs = (): [number, number, number] => { const c = engine.rig.pos; return [c[0] / PCKM, c[1] / PCKM, c[2] / PCKM]; };
      const tick = () => {
        const rAU = Math.hypot(...engine.rig.pos) / 149597870.7;
        if (!stream && rAU > STREAM_AU) {
          const data = new Float32Array(man.count * man.rowFloats); const cat = { data, count: man.count, named };
          layer = engine.attachStars3D(cat, true);
          const base = new URL('assets/catalogs/stars/', document.baseURI).toString();
          stream = new CatalogStream(man, base, {
            onShard: (s, rows) => { data.set(rows, s.firstRow * man.rowFloats); layer.fillRows(s.firstRow, s.count); },
            onEvict: (s) => layer.clearRows(s.firstRow, s.count),
          });
          stream.setResidency(RES_PC, EVICT_PC); stream.setObserver(obs());
          (window as any).__solStars = stream; engine.catalogStreams.stars3d = stream;
          void stream.start().then(() => {
            if (toasted) return; toasted = true; const cnt = stream!.counts(); const bad = (cnt['failed-missing'] ?? 0) + (cnt['failed-checksum'] ?? 0) + (cnt['failed-size'] ?? 0);
            ui.toast?.(`${layer.loadedRows.toLocaleString()} stars with measured 3D positions streamed in` + (bad ? ` · ${bad} sector shard(s) unavailable` : ''));
          });
        } else if (stream) void stream.update(obs());
      };
      (window as any).__solStarsTick = tick;
      setInterval(tick, 1000);
    } catch (e) { console.info('3D star catalogue unavailable', e); }
  };
  setTimeout(() => void loadStars3D(), 1500);
  // v3.8.1 SKY-381-04: stream the Gaia EDR3 8192×4096 Galactic sky layer (log-luminance r8 + 2k chroma) after boot. The
  // boot-time v3.5 4k diffuse map stays in use until it lands (and if it fails); same calibration, so only detail changes.
  const loadSky381 = async () => {
    if (QA.get('qa-off')?.split(',').includes('sky381')) return;
    try {
      const meta = await loadJSON<any>('data/milkyway_v381.json');
      const [buf, chroma] = await Promise.all([loadArrayBuffer(meta.luma.file), loadTexture('milkyway_chroma_2k')]);
      const ds = new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip')));
      const px = new Uint8Array(await ds.arrayBuffer());
      if (px.length !== meta.luma.width * meta.luma.height) throw new Error(`sky luma size ${px.length}`);
      const t = new THREE.DataTexture(px, meta.luma.width, meta.luma.height, THREE.RedFormat, THREE.UnsignedByteType);
      t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
      chroma.colorSpace = THREE.SRGBColorSpace;
      engine.sky.setHiRes(t, chroma, meta); (window as any).__solSky = { layer: 'gaia-edr3-8k', meta };
    } catch (e) { console.info('v3.8.1 sky layer unavailable — keeping the v3.5 4k diffuse map', e); (window as any).__solSky = { layer: 'v3.5-diffuse-4k', error: String(e) }; }
  };
  setTimeout(() => void loadSky381(), 800);
  // ── loop ───────────────────────────────────────────────────────────────
  let last = performance.now(); let streamed = false;
  const frame = () => {
    const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    clock.tick(dt);
    advance();
    engine.render(dt);
    ui.frame(dt);
    (window as any).__frames = ((window as any).__frames || 0) + 1;
    if (!streamed) { streamed = true; setTimeout(() => void streamEphem(), 0); }
  };
  engine.renderer.setAnimationLoop(frame);
  window.addEventListener('resize', () => engine.resize());
  ui.loader.ready();
  (window as any).__sol = { engine, sys, clock, settings, ui, textures, sampled: SAMPLED, advance };
  (window as any).__solVersion = __SOL_VERSION__; (window as any).__solCommit = __SOL_COMMIT__;
  // v3.8.1 PERF-381-01: owner hardware benchmark (open with ?bench=1)
  if (new URLSearchParams(location.search).has('bench')) setTimeout(() => { void import('./qa/bench').then(m => m.runBenchmark((window as any).__sol)); }, 2500);
}
boot().catch(e => { console.error(e); (window as any).__err = String(e?.stack ?? e); });
