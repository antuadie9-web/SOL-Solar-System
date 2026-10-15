// @ts-nocheck — TSL node graphs are dynamically typed
// Engine: owns the WebGPU renderer, the true-scale scene graph (camera-relative), all render layers and the frame loop.
import * as THREE from 'three/webgpu';
import { pass, uniform, vec4, vec3, float, mrt, output, Fn, screenUV } from 'three/tsl';
import * as TSL from 'three/tsl';
import { MODE_PARAMS, approachParams, skyExposure, skyExposureV381, sunGlareVeil, meterLuminance, photometricPeak, HIGHLIGHT_TARGET, type ViewMode, type PresentationParams, type MeterBody, type PhotometricKind } from './presentation';
import { radianceFromSB, visibilityGain, pointFloor, pointExposure, pointDepthScale, pointBodyFlux, discReflectance, lumNormalised } from './presentation';
import { airglowPeakPerKm } from './atmosphere';
import { limbLuminance } from './atmoModel';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SolarSystem, Body } from '../astro/system';
import { AU, R_SUN, GM_SUN, DEG } from '../astro/constants';
import { V3, sub, len, norm, mulMtV, scale, dot, add, cross } from '../astro/vec';
import { radecToVec, eqToEcl } from '../astro/frames';
import { cubeSphere, irregularGeometry, familyGeometry, type FamilyGeometryStats } from './geometry';
import { visualProfile, type BodyVisualProfile } from './identity';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export interface ModelInfo { meshes: number; triangles: number; hasUV: boolean; hasNormals: boolean; textured: boolean; extentKm: number | null }
import { makeSurfaceMaterial, SurfaceKind } from './planetMaterial';
import { makeAtmosphere, verticalTau, atmosphereLUTs } from './atmosphere';
import { makeRingSystem, smoothRingColour, buildProfileLOD, decodeProfile, peakIF, peakIFAt, ringTau, ringShadeIF, type ProfileLOD } from './ringSystem';
const RS_PROF = (e: any, id: string, def: any) => (def.profile ? e.ringProfiles[id] ?? null : null);
import { RING_SYSTEMS, ringLabels } from '../data/rings';
import { makePlumes, plumePeakIF } from './plumes';
import { makeStarDisc } from './starDisc';
import { limbDarkeningRGB, surfaceBrightnessRelSun, R_SUN_KM } from '../galaxy/stellarRadii';
import { makeSun, makeGlare, SUN_L0, SUN_L_MEAN, SUN_LOOKS, sunMeterWeight, glareWeight, sunDiscScale, glareAmplitudes, glareExtentRad, resolvedGlare, resolvedGlareWeight, pointGlareFromHandover, type SunLook } from './sun';
import { makeCorona } from './corona';
import { Stars3D, PC_KM, Star3DCatalog } from '../galaxy/stars3d';
import { TerrainBody } from '../terrain/terrain';
import { TilePyramid, type TileManifest } from '../terrain/tiles';
import { loadJSON, loadArrayBuffer, fetchAsset } from '../core/assets';
import { makeSky, constellationLines } from './sky';
import { PointLayer, starField, PX, blackbodyRGB, bvToTemp } from './points';
import { LineSet, orbitSegments, LINE_GLOBAL } from './lines';
import { guideRelevance, guideExtras, approach, screenFade, type GuideMode } from './guides';
import { SmallBodies } from './smallbodies';
import { CometTail } from './comets';
import { CameraRig, sceneVec } from './camera';
import { conicPolyline, trueAnomalyOf, trueToMeanFraction, rotOrbit } from '../astro/kepler';
import { mulMtV as mulMtV3 } from '../astro/vec';
import type { TextureStore } from '../core/textures';
import { netStats } from '../core/assets';
import type { GpuInfo } from '../core/gpu';
import { Settings } from '../core/settings';
import { makeRingField, saturnTau, particleCountForTau } from './ringParticles';
import { selectDetail, TIER_NAMES, sphereSegmentsForTier, type DetailTier } from '../contracts/lod';

export interface Assets { stars3d?: Star3DCatalog | null; textures: TextureStore; stars: Float32Array; constellations: any | null; small: Float32Array; texStats: Record<string, number>; milky: THREE.Texture | null; ring: THREE.Texture | null;
  /** v3.5: per-map highlight statistics (tools/ingest/texstats_hi.py) and the diffuse-sky calibration (sky_diffuse.py) */
  texHi?: Record<string, { p99max: number; mean: number }> | null; skyCal?: { bandMedianY: number } | null }
/** Device-pixel-ratio formula shared by boot and the settings panel (fixes the inconsistent initial formula, P1). */
export const pixelRatioFor = (renderScale: number) => Math.min(2, window.devicePixelRatio || 1) * renderScale;
const S = new THREE.Matrix4();
const QA = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const qaOff = (k: string) => (QA.get('qa-off') ?? '').split(',').includes(k);
// Pre-exposure: every light uniform is multiplied by the current camera exposure on the CPU, so the half-float
// HDR buffer holds display-scaled values (stars at 1e-11 and the Sun at 5e4 can't share raw half-float range).
let LS = 1;
const tmpV = new THREE.Vector3();
function rotToMatrix4(r: number[], pos: THREE.Vector3, sc: THREE.Vector3, out: THREE.Matrix4) {
  // scene = SCENE_FROM_ECL · R_body ; columns are body axes in scene coords
  out.set(
    r[0] * sc.x, r[1] * sc.y, r[2] * sc.z, pos.x,
    r[6] * sc.x, r[7] * sc.y, r[8] * sc.z, pos.y,
    -r[3] * sc.x, -r[4] * sc.y, -r[5] * sc.z, pos.z,
    0, 0, 0, 1);
  return out;
}
// v3.7.1: north pole of the B1950 (FK4) mean equator expressed in ecliptic J2000: third column of the FK4→FK5 rotation
// (Standish 1982 / Aoki et al. 1983, E-terms omitted) = B1950 pole in J2000 equatorial, then rotated by ε0 = 23.4392911°.
const B1950_POLE_ECL: V3 = (() => { const p = [-0.0048579477, -0.0000271765, 0.9999881997];   // M·ẑ (third column)
  const e = 23.4392911 * Math.PI / 180, c = Math.cos(e), sn = Math.sin(e); return [p[0], c * p[1] + sn * p[2], -sn * p[1] + c * p[2]]; })();
// v3.8 (PERF-009): family-shape worker with a synchronous fallback (no Worker / ?qa-sync-shapes=1 / worker failure)
let shapeW: Worker | null | undefined; const shapeWait = new Map<string, (d: any) => void>(); const shapeCache = new Map<string, Promise<{ geo: THREE.BufferGeometry; stats: FamilyGeometryStats }>>();
function buildFamilyShape(id: string, profile: any, seg: number) {
  const key = id + ':' + seg; const hit = shapeCache.get(key); if (hit) return hit;
  const sync = () => Promise.resolve(familyGeometry(profile, seg));
  if (shapeW === undefined) { try { shapeW = typeof Worker === 'undefined' || /[?&]qa-sync-shapes=1/.test(location.search) ? null : new Worker(new URL('./shapeWorker.ts', import.meta.url), { type: 'module' }); if (shapeW) { shapeW.onmessage = (ev) => { const w = shapeWait.get(ev.data.key); if (w) { shapeWait.delete(ev.data.key); w(ev.data); } }; shapeW.onerror = (e) => { console.warn('shape worker failed — main-thread fallback', e); shapeW = null; for (const [, w] of shapeWait) w(null); shapeWait.clear(); }; } } catch { shapeW = null; } }
  if (!shapeW) { const p = sync(); shapeCache.set(key, p); return p; }
  const p = new Promise<{ geo: THREE.BufferGeometry; stats: FamilyGeometryStats }>(res => {
    shapeWait.set(key, (d) => { if (!d) { res(familyGeometry(profile, seg)); return; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(d.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(d.N, 3)); g.setIndex(new THREE.BufferAttribute(d.I, 1)); g.computeBoundingSphere();
      res({ geo: g, stats: d.stats }); });
    shapeW!.postMessage({ key, profile: JSON.parse(JSON.stringify(profile)), seg });
  });
  shapeCache.set(key, p); return p;
}
const toLocal = (b: Body, v: V3): THREE.Vector3 => { const l = mulMtV(b.rot, v); return new THREE.Vector3(l[0], l[1], l[2]); };

class BodyView {
  group = new THREE.Group(); surface?: THREE.Mesh; U?: any; atmo?: { mesh: THREE.Mesh; U: any; R: number; Ra: number }; rings?: { mesh: THREE.Mesh; U: any };
  sun?: { U: any }; hiLoaded = false; texNames: string[] = []; discWeight = 1; warmFrames = 0; plumePeakIF = 0;
  terrain?: TerrainBody; terrainLoading = false; material?: THREE.Material; terrainMaterial?: THREE.Material; useTerrain = false; occluders: Body[] = []; ready = false; model = false; modelScale = 1;
  profile?: BodyVisualProfile; shapeStats?: FamilyGeometryStats; modelInfo?: ModelInfo;
  /** v3.5: calibrated reflectance of the map's brightest 1 % (max channel) — highlight-protected metering (EXP-002) */
  hiAlb = 0.5; photo: PhotometricKind = 'rocky'; minnaertK = 0.9;
  /** v3.5: detail tier from the LOD contract (drives atmosphere sampling, hi-res streaming, terrain switch) */
  tier: DetailTier = 0;
  /** v3.6: segment count of a plain ellipsoid surface (0 = not a plain sphere: model / family shape / terrain body) */
  sphereSeg = 0;
  /** v3.6 atmosphere LUTs (CPU copy) and the metered limb luminance */
  atmoLuts?: import('./atmoModel').AtmoLUTs; limbL?: number;
  constructor(public b: Body) { this.group.matrixAutoUpdate = false; }
}
export class Engine {
  renderer!: THREE.WebGPURenderer; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(50, 1, 1e-6, 1e13);
  pipeline!: THREE.RenderPipeline; rig = new CameraRig(); views = new Map<string, BodyView>();
  points!: PointLayer; small!: SmallBodies; glare!: ReturnType<typeof makeGlare>; sky!: ReturnType<typeof makeSky>;
  orbits = new Map<string, { set: LineSet; parent: Body; built: number; period: number; pts: Float64Array; el: any; frame: number[]; open: boolean; phase: Float32Array; nuRange: [number, number] }>();
  constLines?: LineSet; eclipticGrid?: LineSet; tails = new Map<string, CometTail>();
  exposure = uniform(1); expLog = Math.log(3e4); displayExposure = 3e4; starMesh?: THREE.Mesh; bloomStrength = uniform(0.35);
  screen: Map<string, { x: number; y: number; z: number; r: number; vis: boolean; dist: number; bright: number }> = new Map();
  W = 1; H = 1; pxAng = 1e-3; time = 0; frameMs = 16; private gltf = new GLTFLoader(); private models = new Map<string, { geo: THREE.BufferGeometry; info: ModelInfo }>();
  constructor(public sys: SolarSystem, public assets: Assets, public settings: Settings) {}

  async init(canvas: HTMLCanvasElement) {
    // v3.8.1 PERF-381-01: GPU timestamp queries only for the benchmark (?bench=1) — they add resolve work every frame
    const bench = typeof location !== 'undefined' && new URLSearchParams(location.search).has('bench');
    const r = this.renderer = new THREE.WebGPURenderer({ canvas, antialias: false, reversedDepthBuffer: true, powerPreference: 'high-performance', outputBufferType: THREE.HalfFloatType, trackTimestamp: bench } as any);
    // three's WebGPURenderer silently installs a WebGL2 fallback backend; SOL is native-WebGPU only, so remove it:
    // if WebGPU initialisation fails, init() now rejects instead of creating a WebGL context.
    (r as any)._getFallback = null;
    r.onDeviceLost = (info: any) => { this.deviceLost = { reason: String(info?.reason ?? 'unknown'), message: String(info?.message ?? '') }; this.onDeviceLost?.(this.deviceLost); };
    await r.init();
    const be: any = r.backend;
    if (!be?.isWebGPUBackend || !be.device || typeof (globalThis as any).GPUDevice === 'undefined' || !(be.device instanceof (globalThis as any).GPUDevice)) throw new Error('Native WebGPU backend assertion failed — refusing to run on any other backend.');
    // v3.4: Khronos PBR Neutral tone mapping by default. Measured on the v3.3 captures, AgX turned a (0.68, 0.50, 0.31)
    // linear photosphere into display (187, 173, 156) — near-grey beige — and likewise flattened planet albedo colour.
    // Neutral keeps hue/saturation faithful below its highlight shoulder and compresses only highlights. AgX remains
    // selectable (Settings → Graphics → Tone mapping) for comparison.
    const tm = () => { r.toneMapping = this.settings.get('toneMap') === 'agx' ? THREE.AgXToneMapping : THREE.NeutralToneMapping; r.toneMappingExposure = 1; };
    tm(); this.settings.on((k) => { if (k === 'toneMap') { tm(); (this.pipeline as any)?.needsUpdate !== undefined && ((this.pipeline as any).needsUpdate = true); } });
    r.setPixelRatio(pixelRatioFor(this.settings.get('renderScale') as number));
    this.camera.matrixAutoUpdate = false;
    this.rig.ground = (b, d) => this.groundRadius(b, d);
    // v3.7 measured ring profiles (Saturn: Voyager PPS 1 km) are tiny (141 kB) — loaded before any view is built
    // v3.8 (PERF-008): pre-smoothed ring colour (tools/ingest/ring_colour_smooth.py) — the v3.7 in-browser canvas readback
    // cost 9.6–12 s of main-thread time on the software adapter the first time Saturn resolved
    try { const buf = new Uint8Array(await loadArrayBuffer('tex/saturn_ring_colour_1024.rgba')); if (buf.length === 4096) { const t = new THREE.DataTexture(buf, 1024, 1, THREE.RGBAFormat); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; this.ringColourPre = t; } } catch (e) { console.warn('pre-smoothed ring colour unavailable — falling back to the canvas path', e); }
    for (const [id, rs] of Object.entries(RING_SYSTEMS)) if (rs.profile) { try { const a = decodeProfile(await loadArrayBuffer(rs.profile.file)); this.ringProfiles[id] = buildProfileLOD(a, rs.profile.r0, rs.profile.dr); } catch (e) { console.warn('ring profile', id, e); } }
    this.buildStatic();
    // post: HDR scene × exposure → bloom → AgX → sRGB
    this.pipeline = new THREE.RenderPipeline(r);
    const sp = pass(this.scene, this.camera, { samples: qaOff('msaa') ? 0 : 4 } as any);
    this.scenePass = sp;
    const lit = sp.getTextureNode('output').min(4096);
    // Bloom models lens/sensor scattering of sources far above display white (the Sun, specular glints). Threshold 6×
    // display white (was 1.8×) so a correctly exposed extended body (Moon, Earth) is crisp instead of haloed (Phase 1).
    // Bloom input is clamped at 48× display white: the core of a point-like Sun (≈10⁹ after exposure) otherwise
    // spreads through the blur pyramid as a uniform grey fog over the whole frame (seen at 1–30 AU in golden captures).
    // The Sun's optical halo/spikes come from the dedicated glare PSF sprite instead.
    const bl = bloom(lit.min(48), 1, 0.6, 6.0);
    (bl as any).strength.value = 0.35;
    this.bloomNode = bl;
    // v3.5 presentation grade (Cinematic; identity in Scientific/Exploration): contrast in log space about mid-grey,
    // saturation about luminance, and a gentle optical vignette. Applied to scene-linear HDR before tone mapping.
    const G = this.grade;
    const graded = Fn(() => {
      const c = lit.rgb.max(0);
      const Y = TSL.dot(c, vec3(0.2126, 0.7152, 0.0722)).max(1e-9);
      const Yc = TSL.pow(Y.div(0.18), G.contrast).mul(0.18);
      const c1 = c.mul(Yc.div(Y));
      const c2 = TSL.mix(vec3(Yc, Yc, Yc), c1, G.saturation).max(0);
      const q = screenUV.sub(0.5).mul(TSL.vec2(1.6, 1));
      const r2 = TSL.dot(q, q);
      return vec4(c2.mul(float(1).sub(G.vignette.mul(r2))), 1);
    })();
    const base = qaOff('grade') ? lit : graded;
    this.pipeline.outputNode = qaOff('bloom') ? base : base.add(bl.mul(this.bloomStrength.div(0.35)));
    this.resize();
  }
  corona!: ReturnType<typeof makeCorona>; starDisc!: ReturnType<typeof makeStarDisc>;
  /** v3.8.1 resolved-star diagnostics */ resolvedStar: { id: string; rpx: number; weight: number; S: number } | null = null;
  ringProfiles: Record<string, ProfileLOD> = {};
  ringColour: THREE.Texture | null | undefined = undefined; ringColourPre: THREE.Texture | null = null;
  /** v3.7 per-ring-system render state for diagnostics / screenshot metadata */
  ringState: Record<string, { tier: string; outerPx: number; gain: number; enhanced: boolean; source: string }> = {};
  ringDiag(id: string) { return this.ringState[id] ?? null; }
  /** v3.5 viewing mode state: current (interpolated) presentation parameters, sky exposure and what is enhanced */
  grade = { contrast: uniform(1), saturation: uniform(1), vignette: uniform(0) };
  pres: PresentationParams = { ...MODE_PARAMS.exploration }; skyExp = 1; veil = 0; sunVeil = 0; meter: any = null;
  /** v3.8 far-Sun diagnostics: exposure the unresolved Sun point is drawn with, and the display-referred glare level */
  sunPointExposure = 0; glareDisplay = 0; sunDiscScaleNow = 1; coronaScale = 1;
  /** v3.8 performance counters: views prepared ahead of time vs built on the frame they first became visible */
  perf = { prepared: 0, lateViews: 0, preparedThisFrame: 0 };
  enhancement = { inspect: false, skyDecoupled: false, mode: 'exploration' as ViewMode, rings: null as null | { body: string; gain: number }, plumes: null as null | string, plumeGain: 1, pointFloor: 0 };
  stars3d: Stars3D | null = null; dirStarFade = uniform(1);
  /** v3.4: catalogue streams by name (diagnostics overlay reads their per-shard state) */
  catalogStreams: Record<string, { counts(): Record<string, number> }> = {};
  /** Attach the 3D Gaia/Hipparcos layer (may arrive after boot). */
  attachStars3D(cat: Star3DCatalog, streamed = false) { if (this.stars3d) return this.stars3d; this.stars3d = new Stars3D(cat, streamed); if (!qaOff('stars')) this.scene.add(this.stars3d.mesh); return this.stars3d; }
  bloomNode: any; deviceLost: { reason: string; message: string } | null = null; onDeviceLost?: (i: { reason: string; message: string }) => void; gpuInfo: GpuInfo | null = null;
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.W = w; this.H = h;
    this.camera.aspect = w / h;
  }
  // ── static layers ───────────────────────────────────────────────────────
  buildStatic() {
    const A = this.assets;
    this.sky = makeSky(A.milky ?? blackTexture(), A.skyCal ?? undefined); if (!qaOff('sky')) this.scene.add(this.sky.mesh);
    // stars: ICRS unit vectors → ecliptic → scene; flux from V magnitude; colour from B−V blackbody
    const n = A.stars.length / 5, dirs = new Float32Array(n * 3), flux = new Float32Array(n * 3);
    const sunRGB = blackbodyRGB(5772);
    for (let i = 0; i < n; i++) {
      const s = A.stars.subarray(i * 5, i * 5 + 5);
      const e = eqToEcl([s[0], s[1], s[2]]);
      dirs[i * 3] = e[0]; dirs[i * 3 + 1] = e[2]; dirs[i * 3 + 2] = -e[1];
      const F = Math.PI * Math.pow(10, -0.4 * (s[3] + 26.74));
      const c = blackbodyRGB(bvToTemp(Math.max(-0.4, Math.min(2.0, s[4]))));
      const cr = c[0] / sunRGB[0], cg = c[1] / sunRGB[1], cb = c[2] / sunRGB[2], cy = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
      flux[i * 3] = 1e10 * F * cr / cy; flux[i * 3 + 1] = 1e10 * F * cg / cy; flux[i * 3 + 2] = 1e10 * F * cb / cy;
    }
    if (!qaOff('stars')) this.scene.add(starField(dirs, flux, n, this.dirStarFade));
    if (A.stars3d) this.attachStars3D(A.stars3d);
    // constellations
    const toScene = (ra: number, dec: number): [number, number, number] => { const e = eqToEcl(radecToVec(ra < 0 ? ra + 360 : ra, dec)); return [e[0], e[2], -e[1]]; };
    const cl = constellationLines(A.constellations ?? [], toScene);
    this.constLines = new LineSet(cl, null, { color: new THREE.Color(0.35, 0.55, 0.9), width: 1.0, opacity: 0.28, far: true });
    this.constLines.mesh.renderOrder = -80; this.scene.add(this.constLines.mesh);
    // ecliptic & equator reference circles
    const ring = (f: (a: number) => [number, number, number]) => { const out: number[] = []; for (let i = 0; i < 360; i++) { const a = f(i * DEG), b = f((i + 1) * DEG); out.push(...a.map(x => x * 9e9), ...b.map(x => x * 9e9)); } return new Float32Array(out); };
    const ecl = ring(a => [Math.cos(a), 0, -Math.sin(a)]);
    this.eclipticGrid = new LineSet(ecl, null, { color: new THREE.Color(0.95, 0.75, 0.35), width: 1.0, opacity: 0.22, far: true });
    this.eclipticGrid.mesh.renderOrder = -79; this.scene.add(this.eclipticGrid.mesh);
    // unresolved bodies
    this.points = new PointLayer(this.sys.bodies.length + 8, PX.bodyGain); if (!qaOff('points')) this.scene.add(this.points.mesh);
    // asteroid swarm
    this.small = new SmallBodies(A.small); this.scene.add(this.small.mesh);
    // glare
    this.glare = makeGlare(); if (!qaOff('glare')) this.scene.add(this.glare.mesh);
    this.corona = makeCorona(); if (!qaOff('corona')) this.scene.add(this.corona.mesh);
    this.starDisc = makeStarDisc(); this.scene.add(this.starDisc.mesh);   // v3.8.1 STAR-381-D
    // comets
    for (const b of this.sys.bodies) if (b.kind === 'comet') { if (qaOff('comets')) continue; const t = new CometTail(20000, b.id.length * 97 + 3); this.tails.set(b.id, t); this.scene.add(t.mesh); }
  }
  /** Surface shading kind (shared by the disc material and the CONT-14c point photometry). */
  surfaceKind(b: Body): SurfaceKind {
    const d = b.def, profile = visualProfile(d);
    const icyFamily = profile.surface === 'icy-tectonic' || profile.surface === 'sponge-ice' || profile.surface === 'volatile-dwarf';
    return b.id === 'earth' ? 'earth' : ['jupiter', 'saturn', 'uranus', 'neptune'].includes(b.id) ? 'gas' : b.id === 'venus' ? 'venus' : b.id === 'titan' ? 'haze'
      : ['europa', 'enceladus', 'tethys', 'dione', 'rhea', 'mimas', 'ariel', 'titania', 'triton', 'pluto', 'charon', 'eris', 'haumea', 'makemake'].includes(b.id) || icyFamily ? 'icy' : d.procedural || profile.surface !== 'mapped' ? 'procedural' : 'rocky';
  }
  photoKind(k: SurfaceKind): PhotometricKind { return k === 'gas' || k === 'venus' || k === 'haze' ? 'gas' : k === 'earth' ? 'earth' : k === 'icy' ? 'icy' : 'rocky'; }
  // ── per-body view (lazy) ────────────────────────────────────────────────
  getView(b: Body): BodyView {
    let v = this.views.get(b.id); if (v) return v;
    v = new BodyView(b); this.views.set(b.id, v); this.scene.add(v.group);
    const d = b.def, TS = this.assets.textures;
    if (b.kind === 'star') {
      const s = makeSun(); v.sun = s;
      v.surface = new THREE.Mesh(cubeSphere(96), s.material); v.group.add(v.surface);
      v.ready = true; return v;
    }
    const profile = visualProfile(d); v.profile = profile;
    const kind = this.surfaceKind(b);
    const maps: any = {};
    const hi = !!d.texHi;
    if (d.tex) maps.color = TS.get(d.tex, { srgb: true, hiAvailable: hi, color: d.color, priority: true });
    if (d.normal) maps.normal = TS.get(d.normal, { srgb: false, hiAvailable: hi });
    if (d.noData?.recon && d.tex) { maps.recon = TS.get(`${d.tex}_recon`, { srgb: true }); maps.reconW = TS.get(`${d.tex}_reconw`, { srgb: false }); maps.mask = TS.get(`${d.tex}_mask`, { srgb: false, hiAvailable: hi, color: [1, 1, 1] }); }   // v3.8.1 AST-381-03 reconstruction guide (colour + weight)
    if (d.night) maps.night = TS.get(d.night, { srgb: false, hiAvailable: hi });
    if (d.clouds) maps.clouds = TS.get(d.clouds, { srgb: false, hiAvailable: hi });
    if (d.ocean) maps.ocean = TS.get(d.ocean, { srgb: false });
    v.texNames = [d.tex, d.normal, d.night, d.clouds, d.ocean, ...(d.noData?.recon && d.tex ? [`${d.tex}_recon`, `${d.tex}_reconw`, `${d.tex}_mask`] : [])].filter(Boolean) as string[];
    // v3.7 ring systems (src/data/rings.ts): the shadow the rings cast on the body uses the system's total-τ texture
    const RS = RING_SYSTEMS[b.id];
    let ringSys: ReturnType<typeof makeRingSystem> | null = null;
    if (RS) { ringSys = makeRingSystem(RS, b.radii as any, RS.profile ? this.ringProfiles[b.id] ?? null : null, RS.colorTex === 'saturn_ring' ? (this.ringColour ??= this.ringColourPre ?? (this.assets.ring?.image ? smoothRingColour(this.assets.ring.image) : null) ?? this.assets.ring) : null); maps.ring = ringSys.shadowTex; }
    // v3.6: the body's atmosphere LUTs (transmittance, multiple scattering, skylight) are built first: the surface uses them
    const AL = d.atmo ? atmosphereLUTs(b.id, d.atmo, b.radii[0]) : null;
    if (AL) { v.atmoLuts = AL.luts; if (AL.pending) { const vv = v; AL.ready.then(() => { vv.warmFrames = Math.max(vv.warmFrames, 2); }); } }   // v3.8: re-warm once the worker LUTs land (atmosphere shell pipeline)
    const atmoOpt = AL ? { T: AL.T, sky: AL.sky, Rg: AL.luts.A.Rg, Rt: AL.luts.A.Rt } : undefined;
    const { material, U } = makeSurfaceMaterial(d, kind, maps, profile, { atmo: atmoOpt });
    v.U = U; v.material = material;
    // v3.6: terrain patches carry patch-local positions + a body-fixed `bodyPos` attribute → own material, SAME uniforms
    if (d.terrain) v.terrainMaterial = makeSurfaceMaterial(d, kind, maps, profile, { U, terrainAttr: true, atmo: atmoOpt }).material;
    // albedo calibration against the texture's mean linear reflectance
    const mean = d.tex ? this.assets.texStats[d.tex] : undefined;
    // v3.8.1 CONT-14c: surface-BRDF bodies are calibrated so the shaded disc integrates to the geometric albedo at zero
    // phase (presentation.discReflectance); the inherited 1.25·p made full-phase airless discs 1.4–1.7× too bright.
    // Gas giants likewise (was 1.05·p → disc 0.70–0.73 of the geometric-albedo flux, SW HDR readback; their thin shells add
    // < 3 %). Venus, Titan and Earth keep their calibration until WP-E gives their shells a disc-integral contract; the
    // shell-added light (Titan 2.5×, Mars 3× at α = 120°) is registered as CONT-14d.
    const target = b.id === 'earth' ? 0.075 : (kind === 'venus' || kind === 'haze') ? Math.min(0.92, d.albedo * 1.25) : discReflectance(d.albedo, this.photoKind(kind), d.limb ?? 0.9);
    const tc = d.procedural?.tint ?? d.color, tl = 0.2126 * tc[0] + 0.7152 * tc[1] + 0.0722 * tc[2];
    // maps with unobserved (black) regions: calibrate against the mean of the OBSERVED part only (baseline divided by
    // the full-map mean, over-brightening Ariel/Titania/Oberon by ~2×)
    const meanObs = mean && d.noData ? mean / Math.max(0.1, 1 - d.noData.fraction) : mean;
    U.albedoScale.value = meanObs ? target / meanObs : target / Math.max(0.02, tl);
    // reconstruction brightness = mean of the OBSERVED part of the map after calibration (texture mean includes the black gap)
    if (d.noData && meanObs) U.recAlbedo.value = U.albedoScale.value * meanObs;
    // v3.5 highlight statistics: calibrated reflectance of the brightest 1 % (max channel) of the map
    const hs = d.tex ? this.assets.texHi?.[d.tex] : undefined;
    v.hiAlb = b.id === 'earth' ? 0.92 : hs ? U.albedoScale.value * hs.p99max : U.albedoScale.value * Math.max(tc[0], tc[1], tc[2]) * 1.3;
    v.photo = kind === 'gas' || kind === 'venus' || kind === 'haze' ? 'gas' : kind === 'earth' ? 'earth' : kind === 'icy' ? 'icy' : 'rocky';
    v.minnaertK = d.limb ?? (kind === 'venus' ? 0.86 : 0.9);
    U.radii.value.set(...b.radii.map(x => x + (d.cloudTopKm ?? 0)));
    if (d.atmo) U.tau.value.set(...verticalTau(d.atmo, b.radii[0]));
    if (d.model) {
      v.surface = new THREE.Mesh(cubeSphere(48), material); v.group.add(v.surface);
      this.loadModel(d.model).then(g => { if (!g) return; v!.surface!.geometry = g.geo; v!.model = true; v!.modelInfo = g.info; U.radii.value.set(b.radii[0], b.radii[0], b.radii[0]); });
    } else if (profile.shape !== 'ellipsoid' && profile.shape !== 'model' && b.radius < 600) {
      // v3.3: family-specific deterministic shape (seeded by canonical id) — replaces the shared 7-lobe/26-crater recipe
      const q = this.settings.get('quality'), seg = q === 'ultra' ? 96 : q === 'medium' ? 48 : 72;
      // v3.8 (PERF-009): built in a worker; a plain ellipsoid stands in until the mesh arrives (typically < 1 s)
      v.surface = new THREE.Mesh(cubeSphere(32), material); v.group.add(v.surface);
      const vv = v; buildFamilyShape(b.id, profile, seg).then(fg => { vv.shapeStats = fg.stats; vv.surface!.geometry = fg.geo; vv.warmFrames = Math.max(vv.warmFrames, 1); });
    } else if (d.procedural && (b.radii[0] !== b.radii[2] || b.radius < 400)) {
      v.surface = new THREE.Mesh(irregularGeometry(d.procedural.seed, d.procedural.rough * (b.radius < 400 ? 1 : 0.15), 40), material); v.group.add(v.surface);
    } else {
      v.surface = new THREE.Mesh(sphereLOD(b.radius > 20000 ? 128 : 96), material); v.group.add(v.surface); v.sphereSeg = b.radius > 20000 ? 128 : 96;
    }
    v.surface.frustumCulled = false;
    if (d.atmo) {
      const a = makeAtmosphere(d.atmo, b.radii[0], b.id);
      const mesh = new THREE.Mesh(cubeSphere(96), a.material); mesh.renderOrder = 1; mesh.frustumCulled = false;
      const s = (b.radii[0] + d.atmo.height) / b.radii[0];
      a.U.shell.value.set(b.radii[0] * s, b.radii[1] * s, b.radii[2] * s);
      a.U.norm.value.set(1, b.radii[0] / b.radii[1], b.radii[0] / b.radii[2]);
      v.atmo = { mesh, U: a.U, R: a.R, Ra: a.Ra }; v.group.add(mesh);
    }
    // v3.7 localised plumes (Io, Enceladus) — never a global shell
    const PL = makePlumes(b.id, b.radius);
    if (PL) { (v as any).plumes = PL; v.group.add(PL.mesh); }
    if (ringSys) {
      if (ringSys.patch) this.scene.add(ringSys.patch);
      v.rings = { mesh: ringSys.mesh, patch: ringSys.patch, U: ringSys.U, def: RS, peak: peakIF(RS, RS.profile ? this.ringProfiles[b.id] ?? null : null) } as any; v.group.add(ringSys.mesh);
      U.ringIn.value = RS.inner; U.ringOut.value = RS.outer;
    }
    v.occluders = this.pickOccluders(b);
    v.ready = true;
    return v;
  }
  /** glTF shape-model import (v3.3): keeps EVERY mesh primitive of the scene hierarchy (world transforms applied and
   *  merged), keeps authored normals/UVs when present, and reports what the asset actually contains so the inspector can
   *  say "shape observed, surface reconstructed" instead of implying a photographic model. v3.2 kept only the first mesh. */
  async loadModel(id: string): Promise<{ geo: THREE.BufferGeometry; info: ModelInfo } | null> {
    if (this.models.has(id)) return this.models.get(id)!;
    try {
      const g = await this.gltf.loadAsync(`assets/models/${id}.glb`);
      g.scene.updateMatrixWorld(true);
      const parts: THREE.BufferGeometry[] = []; let meshes = 0, hasUV = true, hasNormals = true, textured = false, tris = 0;
      g.scene.traverse((o: any) => {
        if (!o.isMesh) return; meshes++;
        const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld);
        hasUV &&= !!geo.attributes.uv; hasNormals &&= !!geo.attributes.normal;
        const mats = Array.isArray(o.material) ? o.material : [o.material]; textured ||= mats.some((m: any) => m?.map);
        tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
        parts.push(geo);
      });
      if (!parts.length) return null;
      // merge on the attributes every part shares (position always; normal/uv only if all have them)
      const keep = ['position', ...(hasNormals ? ['normal'] : []), ...(hasUV ? ['uv'] : [])];
      for (const p of parts) { for (const k of Object.keys(p.attributes)) if (!keep.includes(k)) p.deleteAttribute(k); if (!p.index) p.setIndex([...Array(p.attributes.position.count).keys()]); }
      const G = parts.length === 1 ? parts[0] : mergeGeometries(parts, false)!;
      const bodyFixed = !!this.sys.bodies.find(b => b.def.model === id && b.def.modelFrame === 'body-fixed');
      G.computeBoundingBox(); const bb = G.boundingBox!, c = new THREE.Vector3(); bb.getCenter(c); if (!bodyFixed) G.translate(-c.x, -c.y, -c.z);   // v3.8.1: body-fixed models keep the source origin
      // normalise to unit longest semi-axis; the body's radii then scale it (longest axis → a)
      const sz = new THREE.Vector3(); bb.getSize(sz); const m = Math.max(sz.x, sz.y, sz.z) / 2; G.scale(1 / m, 1 / m, 1 / m);
      // orient longest extent along +x (rotation models use a as the long axis)
      // (v3.8: skipped for models declared in their source body-fixed frame, whose axes the rotation model refers to)
      if (!this.sys.bodies.find(b => b.def.model === id && b.def.modelFrame === 'body-fixed')) { if (sz.y > sz.x && sz.y >= sz.z) G.rotateZ(Math.PI / 2); else if (sz.z > sz.x && sz.z > sz.y) G.rotateY(Math.PI / 2); }
      if (!G.attributes.normal) G.computeVertexNormals();
      const info: ModelInfo = { meshes, triangles: Math.round(tris), hasUV, hasNormals, textured, extentKm: null };
      const r = { geo: G, info }; this.models.set(id, r); return r;
    } catch (e) { console.warn('model', id, e); return null; }
  }
  /**
   * v3.5 secondary illumination source for body b: the neighbour (parent planet or a large moon) that delivers the most
   * reflected sunlight. Irradiance (SOL units, sunlight = 1/r²) = the neighbour's disc-integrated flux / π, from the
   * shared CONT-14c photometry (presentation.pointBodyFlux: geometric albedo p, the neighbour's own phase integral). Colour = the neighbour's mean colour. Physical, unshadowed (eclipses of the neighbour ignored).
   */
  planetshine(b: Body): { dir: V3; rgb: [number, number, number]; E: number; src: string } | null {
    const cand: Body[] = [];
    if (b.parent && b.parent.kind !== 'star') cand.push(b.parent);
    for (const c of b.children) if (c.radius > 400) cand.push(c);
    let best: any = null;
    for (const c of cand) {
      const dv = sub(c.pos, b.pos), d = len(dv); if (!(d > c.radius)) continue;
      const toSun = norm(scale(c.pos, -1)), toB = norm(scale(dv, -1));
      const a = Math.acos(Math.max(-1, Math.min(1, dot(toSun, toB))));
      const rS = len(c.pos) / AU;
      const ck = this.surfaceKind(c), E = pointBodyFlux(c.albedo, this.photoKind(ck), a * 180 / Math.PI, c.radius / d, rS, c.def.limb ?? (ck === 'venus' ? 0.86 : 0.9)) / Math.PI;   // CONT-14c: same disc integral as the point (was ⅔·p·Φ_Lambert)
      if (!best || E > best.E) { const col = c.def.color, cy = 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2]; best = { dir: dv, E, src: c.id, rgb: [E * col[0] / cy, E * col[1] / cy, E * col[2] / cy] }; }
    }
    return best && best.E > 0 ? best : null;
  }
  pickOccluders(b: Body): Body[] {
    const cand: Body[] = [];
    if (b.parent && b.parent.kind !== 'star') cand.push(b.parent);
    for (const s of (b.parent?.children ?? [])) if (s !== b && s.radius > 80) cand.push(s);
    for (const c of b.children) if (c.radius > 80) cand.push(c);
    return cand.sort((x, y) => y.radius - x.radius).slice(0, 4);
  }
  // ── orbits ──────────────────────────────────────────────────────────────
  ensureOrbit(b: Body) {
    if (!b.orbitEl || !b.parent) return null;
    let o = this.orbits.get(b.id);
    const jd = this.sys.jd;
    if (o) {
      const age = Math.abs(jd - o.built);
      if (age < Math.max(0.02 * o.period, 0.5) || age < 1) return o;
      this.scene.remove(o.set.mesh); o.set.dispose();
    }
    const { el, frame, hyper } = b.orbitEl(jd);
    // Adaptive osculating conic (Phase 2): chord error ≤ 1.5e-4 × local radius (≈0.15 px when the orbit spans 1000 px),
    // dense at periapsis; open arcs for e ≥ 1 limited to 120 AU. Vertex phases are mean-anomaly fractions (time).
    const open = hyper || el.e >= 1;
    const pl = conicPolyline(open ? { ...el, e: Math.max(el.e, 1.0001) } : el, 1.5e-4, 120 * AU);
    const pts = pl.pts;
    // frame → ecliptic → scene axes
    const sc = new Float64Array(pts.length);
    for (let k = 0; k < pts.length; k += 3) {
      const x = pts[k], y = pts[k + 1], z = pts[k + 2];
      const ex = frame[0] * x + frame[1] * y + frame[2] * z, ey = frame[3] * x + frame[4] * y + frame[5] * z, ez = frame[6] * x + frame[7] * y + frame[8] * z;
      sc[k] = ex; sc[k + 1] = ez; sc[k + 2] = -ey;
    }
    const { segs, ph } = orbitSegments(sc, !open, pl.phase);
    const col = orbitColor(b);
    const set = new LineSet(segs, ph, { color: col, width: b.kind === 'planet' ? 1.6 : 1.2, opacity: 1, trail: true });
    set.mesh.matrixAutoUpdate = false;
    this.scene.add(set.mesh);
    const period = el.e < 1 ? 2 * Math.PI * Math.sqrt(Math.pow(el.a, 3) / ((b.parent.GM || GM_SUN) + b.GM)) / 86400 : 1e9;
    o = { set, parent: b.parent, built: jd, period: isFinite(period) ? period : 1e9, pts: sc, el, frame, open, phase: pl.phase, nuRange: pl.nuRange };
    this.orbits.set(b.id, o);
    return o;
  }
  // ── frame ───────────────────────────────────────────────────────────────
  render(dt: number) {
    const sys = this.sys, rig = this.rig, st = this.settings;
    this.time += dt; this.frameNo++; this.frameDt = dt;
    this.assets.textures.tick();
    const tFrame0 = performance.now();
    rig.update(dt);
    const cam = rig.pos;
    // camera
    this.camera.quaternion.copy(rig.quat); this.camera.position.set(0, 0, 0);
    this.camera.fov = rig.fov; this.camera.updateProjectionMatrix(); this.camera.updateMatrix(); this.camera.updateMatrixWorld(true);
    this.pxAng = 2 * Math.tan(rig.fov * DEG / 2) / this.H;
    PX.pixelSA.value = this.pxAng * this.pxAng; PX.viewport.value.set(this.W, this.H); PX.dpr.value = this.renderer.getPixelRatio();
    // v3.5 viewing mode: approved presentation parameters glide to the selected mode (no popping on a switch)
    const mode = ((st.get('viewMode') as ViewMode) in MODE_PARAMS ? st.get('viewMode') : 'exploration') as ViewMode;
    this.pres = this.expSettle ? { ...MODE_PARAMS[mode] } : approachParams(this.pres, MODE_PARAMS[mode], dt, st.get('reducedMotion') ? 0.15 : 0.45);
    const P = this.pres;
    const exposure = Math.exp(this.expLog) * Math.pow(2, st.get('ev') as number);
    LINE_GLOBAL.invExp.value = 1; LS = exposure;
    // sky-layer exposure (presentation.ts): physical in Scientific, dark-adapted & weakly coupled otherwise; the veil
    // (sunlit air around the camera, the Sun in the frame) from the previous frame re-couples it
    // v3.8.1 EXP-381-01: daylit-air veil re-couples (physical); the Sun's glare veil is a bounded, continuous EV reduction
    const skyE = this.skyExp = skyExposureV381(exposure, P, this.veil, this.sunVeil, st.get('skyEV') as number);
    PX.starKnee.value = P.starKnee; PX.starGamma.value = P.starGamma;
    PX.sunPeakCap.value = this.enhancement.mode === 'scientific' ? 1e30 : 2.4;   // SUN-381-08: same level as sunDiscScale's target
    this.grade.contrast.value = P.contrast; this.grade.saturation.value = P.saturation; this.grade.vignette.value = P.vignette;
    this.enhancement.mode = mode; this.enhancement.skyDecoupled = skyE > exposure * 1.5;
    this.exposure.value = 1; this.displayExposure = exposure; PX.exposure.value = 1;
    // directional (Sun-centred) catalogue ↔ 3D catalogue: identical directions near the Sun, so cross-fade between
    // 1,000 and 10,000 AU from the Sun, where parallax of the nearest stars starts to exceed ~0.1–1 arcmin.
    {
      const rSun = len(cam) / AU, w3 = this.stars3d ? smooth(1000, 10000, rSun) : 0;
      this.dirStarFade.value = 1 - w3;
      if (this.stars3d) { this.stars3d.flush(); const s3 = this.stars3d.U; s3.fade.value = w3; this.stars3d.setCamera(cam[0] / PC_KM, cam[2] / PC_KM, -cam[1] / PC_KM); s3.years.value = (this.sys.jd - 2457389.0) / 365.25; this.stars3d.mesh.visible = w3 > 0.001; }
    }
    PX.starGain.value = st.get('stars') ? (st.get('starBrightness') as number) * skyE * 1e-10 : 0;
    PX.bodyGain.value = 1;
    this.starMesh && ((this.starMesh as any).visible = true);
    // v3.5: physically calibrated diffuse Milky Way (sky.ts) on the sky exposure (v3.4: LS·4e-6, ≈100× the measured
    // surface brightness on the SCENE exposure — so it vanished whenever a sunlit body set the exposure)
    this.sky.U.gain.value = st.get('milkyWay') ? skyE * P.milkyWay * (st.get('skyBrightness') as number) : 0;
    this.sky.U.frame.value = (this.frameNo % 64);
    this.bloomStrength.value = st.get('bloom') ? (st.get('bloomStrength') as number) * P.bloom : 0;
    this.constLines!.mesh.visible = !!st.get('constellations'); this.eclipticGrid!.mesh.visible = !!st.get('ecliptic') || (guideExtras((st.get('guideMode') as GuideMode) || 'clean').ecliptic && !!st.get('orbits'));
    for (const l of [this.constLines!, this.eclipticGrid!]) l.U.viewport.value.set(this.W, this.H);
    // bodies
    const sun = sys.sun;
    let nPts = 0; let avgLum = 0; let subject = 0; let sunSubj = 0, sunSubjA = 0; let nearest = 1e12; const meterBodies: MeterBody[] = []; let nightView = 0;
    // v3.8 DEF-38-005: enhancement labels are rebuilt every frame from the views actually drawn. v3.7.1 cleared a ring /
    // plume enhancement only when that same body updated again, so after leaving Jupiter the HUD/metadata kept reporting
    // "Jupiter rings ×43" while the camera was at Enceladus.
    this.enhancement.rings = null; this.enhancement.plumes = null; this.enhancement.plumeGain = 1; this.enhancement.pointFloor = 0;
    const sunVis = this.sunVisibility(cam); this.sunRpx = 0; this.sunVisNow = sunVis; this.sunPointExposure = 0; this.perf.preparedThisFrame = 0;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.quat);
    const occAll = (v: BodyView) => v.occluders;
    let xRes: { b: Body; rpx: number; relS: THREE.Vector3; dist: number } | null = null;
    for (const b of sys.bodies) {
      const rel = sub(b.pos, cam), dist = len(rel);
      const relS = sceneVec(rel);
      const rpx = Math.atan(b.radius / Math.max(dist, 1e-9)) / this.pxAng;
      const surf = dist - b.radius; if (surf < nearest) nearest = surf;
      const inFront = relS.dot(fwd) > -b.radius;
      // screen projection for labels / picking
      tmpV.copy(relS).applyMatrix4(this.camera.matrixWorldInverse).applyMatrix4(this.camera.projectionMatrix);
      const scr = { x: (tmpV.x * 0.5 + 0.5) * this.W, y: (-tmpV.y * 0.5 + 0.5) * this.H, z: tmpV.z, r: rpx, vis: inFront && Math.abs(tmpV.x) < 1.2 && Math.abs(tmpV.y) < 1.2, dist, bright: rpx > 0.55 ? 1 : 0 };
      this.screen.set(b.id, scr);
      // catalogue stars are drawn by the 3D star layer; label them only once the camera has left the planetary system
      if (b.kind === 'xstar') {
        scr.bright = inFront && len(cam) > 1000 * AU ? 0.05 : 0; scr.r = 0;
        // v3.8.1 STAR-381-D: resolved stellar disc (nearest resolved catalogue star only), flux handed over from the PSF
        if (!b.info?.dsoKind && b.info?.catIndex && inFront && rpx > 0.6 && (!xRes || rpx > xRes.rpx)) xRes = { b, rpx, relS: relS.clone(), dist };
        // cp2 (STAR-381-D2): a resolved photosphere meters exactly like the Sun's (same weight law, its own surface brightness),
        // so Scientific shows it at a physical exposure instead of a frame-filling over-exposed blob
        if (!b.info?.dsoKind && b.info?.catIndex && inFront && rpx > 4) {
          const Sx = surfaceBrightnessRelSun(parseFloat(b.info.absMag), b.radius / R_SUN_KM), mk = mode === 'scientific' ? 1 : mode === 'exploration' ? 0.8 : 0.7;
          // highlight protection: meter on the brightest CHANNEL of the star's colour (an M dwarf's red channel is ≈ 1.6× its
          // luminance; metering luminance clipped red and flattened the limb darkening)
          const c = b.def.color as number[], cy = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], hi = Math.max(c[0], c[1], c[2]) / Math.max(cy, 1e-6);
          subject = Math.max(subject, SUN_L_MEAN * Sx * hi * sunMeterWeight(rpx) * mk);
        }
        continue;
      }
      const resolved = rpx > 0.55 && inFront;
      // v3.7.1 (ATM-011 root cause): fraction of the disc that is inside the frame. v3.3–3.7 metered every resolved body in
      // the forward HEMISPHERE, so an off-screen Sun 85° from the view axis (Venus terminator view: 6.7-px disc, meter weight
      // 0.004 × the solar radiance) out-weighed Venus itself and closed the exposure by ≈ 5.6 EV. Bodies now meter only by
      // the part of their disc that is in the frame (square-overlap estimate; exact enough for a meter).
      // Normalised by min(disc square, frame) so a disc that fills the frame meters at full weight; very near/large discs
      // (centre projection unreliable) count fully.
      // v3.8 DEF-38-003: a body whose angular radius exceeds ~8° (camera near the surface, e.g. venus-cloudtop-flight at
      // 120 km looking at the horizon) has an unreliable centre projection; the square estimate returned 0 there, so the
      // world filling the frame stopped metering and the exposure rose by 2.1 EV (washed-out cloud deck). Such bodies are
      // metered by the fraction of the frame they cover, from a grid of view rays intersected with the sphere.
      const angR = Math.asin(Math.min(1, b.radius / Math.max(dist, 1e-9)));
      const frameFrac = (angR > 0.14 && b.kind !== 'xstar') ? this.frameCoverage(relS, b.radius)
        : !inFront ? 0 : rpx > 0.6 * Math.max(this.W, this.H) ? 1
        : Math.min(1, Math.max(0, Math.min(scr.x + rpx, this.W) - Math.max(scr.x - rpx, 0)) * Math.max(0, Math.min(scr.y + rpx, this.H) - Math.max(scr.y - rpx, 0)) / Math.max(Math.min(4 * rpx * rpx, this.W * this.H), 1e-9));
      // disc ↔ point-source cross-fade: the PSF carries weight `fade`, the resolved disc (1 − fade), so the total flux
      // is conserved through the transition instead of doubling between 0.55 and 3.5 px (Phase 1 fix).
      const fade = 1 - smooth(1.2, 3.5, rpx);
      let v = this.views.get(b.id);
      if (resolved && !v) { v = this.getView(b); this.perf.lateViews++; }
      // v3.8 (PERF-007) predictive preparation: a body approaching resolution (≥ 0.12 px, i.e. ~5× before it resolves) or
      // the destination of the current flight gets its view built ahead of time, at most one per frame, and is drawn for
      // two frames at zero irradiance (sub-pixel, black) so that its render pipelines and node programs are compiled through
      // the real scene pass before the body is actually seen — instead of on the frame it first becomes visible.
      else if (!v && inFront && this.perf.preparedThisFrame === 0 && (rpx > 0.12 || (rig.flight && (rig.flight as any).to === b)) && b.kind !== 'xstar' && !qaOff('prewarm')) {
        v = this.getView(b); v.warmFrames = 2; this.perf.preparedThisFrame++; this.perf.prepared++;
      }
      if (v) {
        const warm = !resolved && v.warmFrames > 0; if (warm) v.warmFrames--;
        v.group.visible = resolved || warm;
        if (!resolved && (v.rings as any)?.patch) (v.rings as any).patch.visible = false;
        if (v.terrain) v.terrain.group.visible = false;   // updateView re-enables it in the near-surface tier
        v.discWeight = 1 - fade;
        // v3.5 AUD-04: the shared detail contract decides the tier of every resolved view (with hysteresis)
        v.tier = selectDetail({ radiusKm: Math.max(b.radii[0], b.radius), distanceKm: dist, fovYRad: rig.fov * DEG, viewportH: this.H, luminous: b.kind === 'star',
          hasSurface: !!(b.def.tex || b.def.procedural || b.def.model || v.profile), hasTerrain: !!b.def.terrain, budgetOk: true, focused: b === rig.target }, v.tier).tier;
        // v3.6 AUD-04 geometry LOD: plain ellipsoids are re-meshed by tier (D2 proxy 24, D3 96/128, D5 focused 192) so a
        // 3-px disc no longer costs 55k triangles and a full-screen limb is no longer faceted
        if (v.sphereSeg && resolved) { const want = sphereSegmentsForTier(v.tier, b.radius); if (want !== v.sphereSeg) { v.surface!.geometry = sphereLOD(want); v.sphereSeg = want; } }
        if (resolved || warm) this.updateView(v, relS, cam);
        if (warm) v.discWeight = 0;
      }
      // The Sun never disappears: below a few pixels it becomes a photometric point source with the full solar flux
      // π·(1 AU/d)² (same unit as the planet points), fading in exactly as the disc fades out.
      if (b.kind === 'star' && inFront && fade > 0.002) {
        // v3.8 (SUN-010, far-Sun regimes): the unresolved Sun is a STAR. v3.5–3.7 kept it on the scene exposure and
        // uncompressed while every other point source (catalogue stars, unresolved planets) sits in the sky domain, so beyond
        // ~10⁴ AU the Sun (m = −2.4 at 1 ly, −0.17 at 1 pc) was drawn fainter than mag-1 stars. Its exposure now glides
        // in log space from the scene exposure (resolved disc) to the sky exposure as the disc→point cross-fade completes,
        // and it takes the same highlight compression as the stars (identity in Scientific: there skyE = scene exposure).
        const Esun = Math.exp(Math.log(LS) + (Math.log(Math.max(skyE, 1e-30)) - Math.log(LS)) * fade);
        this.sunPointExposure = Esun;
        // v3.8.1 SUN-381-07c (REV2-01/CONT-01): outside Scientific the unresolved Sun is shown with its irradiance capped at
        // the 100 AU value. Audit (glare-final, glare-far): on the sky exposure the point sprite + bloom of a 1–5 AU Sun
        // (G ≈ 1.5–2.8 k) out-shone the resolved disc at the hand-over (G ≈ 0.6–0.75 k) although it is 3–10× fainter; at
        // 100 AU the same law gives G ≈ 0.69 k. Capping gives a plateau from the hand-over to 100 AU and the unchanged
        // star law beyond, so displayed solar brightness never increases with distance. Scientific stays physical.
        // SUN-381-08: physical flux (distance-exact); the display contract is applied in the PSF shader (sunPeakCap) — the
        // interim 100 AU irradiance cap (SUN-381-07c) is withdrawn (owner review: it hid rather than solved the mismatch)
        const F = Math.PI * Math.pow(AU / Math.max(dist, 1), 2) * fade * Esun * sunVis;
        const c = b.def.color, cy = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        const pk = pointDepthScale(this.viewBound(b), dist); this.points.pos.set([relS.x * pk, relS.y * pk, relS.z * pk], nPts * 3);   // CONT-14 representation/depth contract
        this.points.flux.set([F * c[0] / cy, F * c[1] / cy, F * c[2] / cy], nPts * 3);
        this.points.comp[nPts] = 2 + fade;                // v3.8: compressed like the stars once unresolved; 2+ = Sun flag (SUN-381-08 peak cap)
        nPts++;
        scr.bright = Math.max(scr.bright, 1);
      }
      // point-source representation (fades out as the disc resolves)
      if (b.kind !== 'star') {
        if (fade > 0.002 && inFront) {
          const toSun = sub(sun.pos, b.pos), rS = len(toSun) / AU;
          const cosA = dot(norm(toSun), norm(scale(rel, -1)));
          const alpha = Math.acos(Math.max(-1, Math.min(1, cosA)));
          const sk = this.surfaceKind(b), pk0 = this.photoKind(sk), mk = b.def.limb ?? (sk === 'venus' ? 0.86 : 0.9);
          // v3.5: unresolved worlds belong to the sky domain (they sit among the stars) → sky exposure + compression.
          // v3.8.1 CONT-14: reached through the shared hand-over contract (pointExposure) instead of a jump at the disc.
          const Ept = pointExposure(LS, skyE, rpx);
          let F = pointBodyFlux(b.albedo, pk0, alpha * 180 / Math.PI, b.radius / dist, rS, mk) * fade * visibilityGain(mode, st.get('bodyBoost') as number) * Ept;
          // keep planets findable as points (presentation only — GA-SCI-01: Scientific draws the physical flux, floor 0)
          const floor = pointFloor(mode, b.kind, b.radius, this.pxAng, fade);
          if (F < floor) { F = floor; this.enhancement.pointFloor++; }
          const c = lumNormalised(b.def.color);   // CONT-14c: was raw tint × 1.6 (Callisto's point 3× too faint, luminance 0.34 × 1.6)
          scr.bright = Math.max(scr.bright, F / (this.pxAng * this.pxAng * 6.283 * 0.56));
          const pk = pointDepthScale(this.viewBound(b), dist); this.points.pos.set([relS.x * pk, relS.y * pk, relS.z * pk], nPts * 3);   // CONT-14 representation/depth contract
          this.points.flux.set([F * c[0], F * c[1], F * c[2]], nPts * 3);
          this.points.comp[nPts] = fade;    // CONT-14: star highlight compression engages with the point, not at full weight under the disc
          nPts++;
        }
      }
      // exposure estimate: area-weighted luminance, but expose for the dominant subject like a photographer
      // expose for the solar disc as soon as it is a few tens of pixels across, so limb darkening and granulation read
      // instead of a clipped white blob (was smooth(40, 420)); smaller discs keep the sky exposure and bloom/glare.
      // v3.5: the resolved disc's meter weight is a presentation choice per mode (Scientific keeps v3.4's 0.25 → centre ≈ 0.81
      // display white; Exploration/Cinematic expose ≈ +0.3/+0.5 EV so the centre sits in the tone curve's shoulder and reads
      // luminous cream-white with a warm limb instead of flat beige). Radiometry and lighting are unchanged.
      if (resolved && b.kind === 'star') { const mk = mode === 'scientific' ? 1 : mode === 'exploration' ? 0.8 : 0.7; sunSubj = SUN_L_MEAN * sunMeterWeight(Math.max(rpx, 8)) * mk * sunVis * frameFrac; sunSubjA = smooth(3.5, 8, rpx); this.sunRpx = rpx; }
      // v3.8.1 EXP-381-03 (CONT-01/03, continuous-travel finding): the solar meter weight is blended in LOG space between the
      // sky target (3.5 px) and the disc target (8 px). Until now subject = max(…, L☉·w(rpx)): L☉ exceeds the sky by ~10⁹,
      // so the whole ≈25 EV switch happened within ≈0.3 px of the 4-px end of the ramp (12 EV in one travel step at 2 AU).
      // total/partial eclipse: meter for the inner corona (≈1e-7 of the disc after the Baumbach profile) like an eclipse photographer
      if (resolved && b.kind === 'star') subject = Math.max(subject, SUN_L_MEAN * 1e-7 * smooth(8, 120, rpx) * (1 - sunVis) * Math.min(1, frameFrac * 4));
      // during an eclipse the occluded disc no longer sets the exposure: the camera opens up and the corona emerges
      if (resolved && b.kind !== 'star') {
        const cov = Math.min(1, Math.PI * rpx * rpx * frameFrac / (this.W * this.H));
        const rS = len(b.pos) / AU, cosA = dot(norm(scale(b.pos, -1)), norm(scale(rel, -1)));
        const lit = Math.max(0, (1 + cosA) / 2);   // clamp: rounding gave lit < 0 on an exact night-side view → pow() NaN → white frame (eclipse bug)
        // meter for a reference grey rather than the body's own albedo (v3.2 normalised every body to the same screen
        // brightness, so a 4 %-albedo comet looked as white as a 96 % icy dwarf — part of the "all alike" complaint).
        // Partial compensation keeps dark bodies readable while preserving their relative darkness.
        // v3.3 final QA: exponent 0.4→0.25 (dark bodies keep more of their real darkness) and metering factor 0.2→0.26
        // (≈0.6–1.2 stop less exposure): software captures showed small bodies at a median of ≈200/255, i.e. near-white.
        const Ls = Math.pow(Math.min(0.9, b.albedo), 0.25) * Math.pow(0.3, 0.75) * 0.55 / (rS * rS);
        avgLum += cov * lit * Ls;
        // v3.3 final QA: metering ramp smooth(2,90)→smooth(1.5,28) px radius. A 15–30 px Saturn in the system view was
        // metered at ≈10 % weight, so it clipped and bloomed into a large brown halo; resolved discs now hold their banding.
        // v3.4: Neutral tone mapping holds colour until its shoulder and then clips harder than AgX, so resolved bodies are
        // metered ≈0.45 EV darker under Neutral (software captures: Vesta/Enceladus/Iapetus clipped to white otherwise)
        const tmK = 1;   // v3.5: the v3.4 blanket −0.45 EV under Neutral is replaced by per-body highlight protection
        // v3.5 (EXP-002): the v3.4 reference-grey subject is kept for overall brightness, the lit fraction may only open
        // the meter `nightCapEV` beyond full-lit metering, and the brightest 1 % of the sunlit disc is protected
        // (presentation.ts meterLuminance). Phase angle α from Sun→body→camera.
        const vv = v ?? this.views.get(b.id);
        const toSunN = norm(sub(sun.pos, b.pos)), toCamN = norm(scale(rel, -1));
        const alphaDeg = Math.acos(Math.max(-1, Math.min(1, dot(toSunN, toCamN)))) * 180 / Math.PI;
        const w = smooth(1.5, 28, rpx) * Math.min(1, frameFrac * 2);   // v3.7.1: off-frame bodies do not meter (ATM-011)
        // v3.7: behind an atmosphere the grazing limb is dimmed by the per-channel view transmittance (ATM-005), so the Minnaert
        // limb spike no longer exists — meter the peak over μ ≥ 0.3 there (Venus terminator was 5 EV under-exposed, ATM-011)
        const fpk = vv ? photometricPeak(alphaDeg, vv.photo, vv.minnaertK, vv.atmoLuts ? 0.3 : 0.08) : 1;
        // v3.6: an atmosphere's sunward limb (forward-scattering dust/haze crescent) can be far brighter than the surface
        // at high phase — protect it too (v3.6 QA: the Mars night-side view clipped 2.6 % of the disc to white otherwise)
        let hr = (vv?.hiAlb ?? 0.5) * fpk / (rS * rS);
        if (vv?.atmoLuts && (vv.atmoLuts as any).ready !== false && w > 0.05 && this.settings.get('atmospheres')) {
          // v3.8.1 cp2 (EXP-381-02): refresh also when the viewing geometry changed (> 2° of camera or Sun direction, or > 5 %
          // in distance) — the 8-frame cache alone let a cut to a new view meter on the PREVIOUS view's limb (sat-backlit
          // regression capture: 0.59 vs 0.05, ≈ 1 EV exposure difference depending on what was viewed before)
          const cl = toLocal(b, scale(rel, -1)), sl = toLocal(b, sub(sun.pos, b.pos)).normalize(), cd = cl.length(), cu = cl.clone().divideScalar(cd);
          const lk = (vv as any).limbKey as { c: THREE.Vector3; d: number; s: THREE.Vector3 } | undefined;
          const moved = !lk || cu.dot(lk.c) < 0.99939 || sl.dot(lk.s) < 0.99939 || Math.abs(cd / lk.d - 1) > 0.05;
          if (!(this.frameNo % 8) || vv.limbL === undefined || moved) { vv.limbL = limbLuminance(vv.atmoLuts.A, vv.atmoLuts, [cl.x, cl.y, cl.z], [sl.x, sl.y, sl.z]); (vv as any).limbKey = { c: cu, d: cd, s: sl.clone() }; }
          // v3.7: capped at +2 EV of the disc highlight — the GPU march (16 steps) under-samples thin cloud-top hazes at grazing
          // incidence, so an uncapped CPU limb estimate under-exposed the Venus terminator by ≈ 5.6 EV (v3.7 QA, ATM-011)
          hr = Math.max(hr, Math.min(Math.PI * vv.limbL / (rS * rS), hr * 4));
        }
        // v3.7.1: a forward-scattering plume is part of the subject's highlights (Enceladus backlit: v3.7 metered only the
        // dark disc and the jets clipped to a white blob)
        if (vv?.plumePeakIF && this.settings.get('plumes') !== false) hr = Math.max(hr, vv.plumePeakIF * 0.5 / (rS * rS));
        meterBodies.push({ subjectFull: Ls * 0.26 * tmK, litWeight: Math.pow(lit, 0.6), highlightRadiance: hr, weight: w });
        if (b === this.rig.target) nightView = 1 - lit;
      }
      // v3.8.1 RING-381-01 (CONT-09): the ring system is a meter subject of its own. Until cp2 only the planet's disc was
      // metered, so with Saturn off-frame (A-ring close-ups, near-field particles) the meter found nothing and fell back to
      // the dark-sky exposure (+14.6 EV): white frames. A 7×5 grid of view rays is intersected with the ring plane; each hit
      // gives the ring's opacity 1 − e^(−τ/μ) (its share of the frame) and its I/F in the actual Sun/camera geometry.
      // (A first version sampled a fixed polar grid on the rings; it missed close-ups, where the visible patch is ≪ grid step.)
      const rv = (this.views.get(b.id) as any)?.rings;
      if (rv && this.settings.get('rings') !== false && dist < rv.def.outer * 60) {
        const RD = rv.def, prof = RD.profile ? this.ringProfiles[b.id] ?? null : null, rSun = len(sub(sun.pos, b.pos)) / AU;
        const lB = toLocal(b, norm(sub(sun.pos, b.pos))), cL = toLocal(b, scale(rel, -1));   // camera in the ring frame
        const tY = Math.tan(rig.fov * DEG / 2), tX = tY * this.W / this.H;
        const qR = new THREE.Vector3(1, 0, 0).applyQuaternion(rig.quat), qU = new THREE.Vector3(0, 1, 0).applyQuaternion(rig.quat);
        let hitW = 0, ifMax = 0, litAny = 0, n = 0;
        for (let iy = 0; iy < 5; iy++) for (let ix = 0; ix < 7; ix++) {
          n++;
          const sx = ((ix + 0.5) / 7 * 2 - 1) * tX, sy = ((iy + 0.5) / 5 * 2 - 1) * tY;
          const dS = fwd.clone().addScaledVector(qR, sx).addScaledVector(qU, sy).normalize();
          const dL = toLocal(b, [dS.x, -dS.z, dS.y]);                                      // scene → helio → ring frame
          if (Math.abs(dL.z) < 1e-6) continue;
          const t = -cL.z / dL.z; if (t <= 0) continue;
          const px = cL.x + dL.x * t, py = cL.y + dL.y * t, r = Math.hypot(px, py);
          if (r < RD.inner || r > RD.outer) continue;
          const [tm, td] = ringTau(RD, r, Math.max(1, t * this.pxAng * 40), prof);
          const vv3: [number, number, number] = [-dL.x, -dL.y, -dL.z], mu = Math.max(Math.abs(dL.z), 1e-3);
          hitW += 1 - Math.exp(-(tm + td) / mu);
          const I = ringShadeIF(tm, td, [lB.x, lB.y, lB.z], vv3, RD);
          if (I > ifMax) ifMax = I;
          if (lB.z * vv3[2] > 0) litAny = 1;
        }
        const cov = hitW / n, wR = smooth(0.02, 0.25, cov);
        // RING-381-02 (continuous pan finding): highlights stay protected while ANY ring area is in frame — with the subject
        // ramp alone, a ring sliver leaving the frame was over-exposed by ≈2.4 EV and bloomed into a white corner glare
        const wH = smooth(0.0, 0.03, cov);
        if ((wR > 0 || wH > 0) && ifMax > 0) meterBodies.push({ subjectFull: ifMax * 0.55 / (rSun * rSun), litWeight: litAny ? 1 : 0.5, highlightRadiance: ifMax / (rSun * rSun), weight: wR, hiWeight: wH });
      }
    }
    this.points.commit(nPts);
    {
      const D = this.starDisc, s3 = this.stars3d;
      if (xRes && s3) {
        const b = xRes.b, w = smooth(1.2, 3.5, xRes.rpx), MV = parseFloat(b.info.absMag), T = parseFloat(b.info.teff) || 5772;
        const S = surfaceBrightnessRelSun(MV, b.radius / R_SUN_KM);
        // display: the star's V-band mean radiance on the sky exposure (it sits among the stars), with the same local HDR
        // presentation as the Sun's disc outside Scientific so a resolved photosphere shows limb darkening instead of clipping
        // exposure glides in log space from the sky exposure (point-like, among the stars) to the scene exposure as the disc
        // becomes the metered subject — the same rule as the Sun's point→disc transition (SUN-010)
        const wE = smooth(4, 40, xRes.rpx), Ex = Math.exp(Math.log(Math.max(skyE, 1e-30)) * (1 - wE) + Math.log(Math.max(LS, 1e-30)) * wE);
        const c = b.def.color as [number, number, number], hiC = Math.max(...c) / Math.max(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], 1e-6);
        // local HDR presentation on the brightest channel (target 1.3 display-linear) so a red photosphere keeps its limb darkening
        const Lmean = SUN_L_MEAN * S * Ex, ds = sunDiscScale(Lmean * hiC, xRes.rpx, mode, 1.3);
        D.U.center.value.copy(xRes.relS); D.U.radius.value = b.radius; D.U.u.value.set(...limbDarkeningRGB(T));
        D.U.right.value.set(1, 0, 0).applyQuaternion(rig.quat); D.U.up.value.set(0, 1, 0).applyQuaternion(rig.quat);
        D.U.L.value.set(c[0], c[1], c[2]).multiplyScalar(Lmean * ds); D.U.weight.value = w; D.mesh.visible = w > 0.001;
        s3.U.hideIndex.value = +b.info.catIndex; s3.U.hideKeep.value = 1 - w;
        this.resolvedStar = { id: b.id, rpx: xRes.rpx, weight: w, S };
      } else { D.mesh.visible = false; if (s3) { s3.U.hideIndex.value = -1; s3.U.hideKeep.value = 1; } this.resolvedStar = null; }
    }
    // v3.5 fix: the Saturn ring particle slice is updated only while Saturn's view is drawn; when the camera leaves
    // (travel to another world, Saturn no longer resolved) v3.4 left the last slice visible in front of every other
    // world (seen in the earth-polar / mars-night QA captures after ring-flythrough). Hide it unless touched this frame.
    if (this.ringField && !this.ringFieldTouched) { this.ringField.mesh.visible = false; this.rfPrev = null; this.rfJd = null; this.ringFieldState.active = false; }
    this.ringFieldTouched = false;
    rig.nearestSurface = nearest;
    // sky glow when inside an atmosphere (daylight sky dominates adaptation)
    const earth = sys.get('earth')!; const avgLum0 = avgLum;
    for (const id of ['earth', 'mars', 'venus', 'titan']) {
      const b = sys.get(id)!, d = len(sub(cam, b.pos)) - b.radius, H = b.def.atmo!.height;
      if (d < H) {
        const up = norm(sub(cam, b.pos)), sunEl = dot(up, norm(scale(b.pos, -1)));
        const k = id === 'earth' ? 0.35 : id === 'mars' ? 0.12 : 0.25;
        avgLum += k * Math.max(0, sunEl + 0.1) * (1 - d / H) / Math.pow(len(b.pos) / AU, 2);
      }
    }
    // v3.5 physical veil over the sky layers (re-couples the sky exposure): daylit air around the camera, the Sun in frame
    {
      const atmoDay = avgLum - avgLum0;
      const sRel = sceneVec(sub(sun.pos, cam)); const sDir = sRel.clone().normalize();
      tmpV.copy(sRel).applyMatrix4(this.camera.matrixWorldInverse).applyMatrix4(this.camera.projectionMatrix);
      // v3.8.1 EXP-381-01: v3.5–3.8.0 folded a binary "Sun centre within ±1.1 NDC" step (×0.45) into this coupling veil,
      // so the entire sky dropped 7–12 EV whenever the Sun's centre crossed the frame edge. The atmosphere veil keeps the
      // physical coupling; the Sun's glare is a separate continuous veil (presentation.ts sunGlareVeil).
      const vTarget = smooth(0.001, 0.03, atmoDay);
      const halfY = rig.fov * DEG / 2, halfX = Math.atan(Math.tan(halfY) * this.W / this.H);
      const sunMagV = -26.74 + 5 * Math.log10(Math.max(len(sub(sun.pos, cam)) / AU, 1e-6));
      const sTarget = sunGlareVeil({ ndcX: tmpV.x, ndcY: tmpV.y, inFront: sDir.dot(fwd) > 0, halfFovX: halfX, halfFovY: halfY, sunVis, sunMagV });
      const kV = 1 - Math.exp(-dt / 0.6);              // symmetric 0.6 s adaptation, frame-rate independent
      this.sunVeil = Number.isFinite(sTarget) ? this.sunVeil + (sTarget - this.sunVeil) * kV : 0;
      if (this.expSettle) this.sunVeil = sTarget;
      this.veil = Number.isFinite(vTarget) ? this.veil + (vTarget - this.veil) * (1 - Math.exp(-4 * dt)) : 0;
      if (this.expSettle) this.veil = vTarget;
    }
    this.enhancement.inspect = P.inspect > 0.002 && !!st.get('nightInspect') && nightView > 0.15;
    // auto exposure (log-space adaptation, eye-like asymmetric speed)
    const dark = Math.log(st.get('darkExposure') as number);
    const key = 0.16 * Math.pow(2, P.keyEV);
    const hlT = this.settings.get('toneMap') === 'agx' ? HIGHLIGHT_TARGET.agx : HIGHLIGHT_TARGET.neutral;
    // an eclipse (Sun partly/fully hidden) meters for the corona: the occulting body's night side must not cap the exposure
    const met = meterLuminance(meterBodies, key, hlT, sunVis < 0.98 ? 40 : P.nightCapEV, avgLum);
    subject = Math.max(subject, met.subject, met.highlight);   // `subject` still carries the Sun / eclipse metering
    this.meter = { subject: met.subject, highlight: met.highlight, bodies: meterBodies.length };
    const tl0 = Math.min(dark, Math.log(key / Math.max(avgLum, subject, 1e-12)));
    const tlS = sunSubjA > 0 ? Math.min(dark, Math.log(key / Math.max(avgLum, subject, sunSubj, 1e-12))) : tl0;
    const targetLog = st.get('autoExposure') ? tl0 + (tlS - tl0) * sunSubjA : Math.log(st.get('manualExposure') as number);
    const speed = targetLog < this.expLog ? 3.5 : 1.1;
    this.expDebug = { avgLum, subject, sunVis, targetLog };
    if (Number.isFinite(targetLog)) this.expLog += this.expSettle ? targetLog - this.expLog : (targetLog - this.expLog) * (1 - Math.exp(-speed * dt));
    if (!Number.isFinite(this.expLog)) this.expLog = Math.log(3e4);   // never let a NaN poison every later frame
    this.expSettle = false;
    // Sun glare (visible fraction of the disc)
    {
      const rel = sub(sun.pos, cam), dist = len(rel), relS = sceneVec(rel);
      const visFrac = sunVis;
      const F = Math.PI * Math.pow(AU / dist, 2) * visFrac;
      this.glare.U.center.value.copy(relS);
      const front = relS.clone().normalize().dot(fwd) > 0;
      // v3.8 (SUN-011): glare follows the Sun's own display brightness continuously. v3.3–3.7 hard-capped it at 3, so from
      // ≈ 3 AU to ≈ 300 AU the same saturated blob was drawn, then it collapsed. Outside Scientific the display-referred
      // glare is compressed (∝ x^0.4, the same philosophy as the star highlight knee): it still rises and falls monotonically
      // with distance and exposure but never balloons. Scientific keeps the linear camera PSF (capped only for safety).
      // v3.8.1 SUN-381-01: angle-space glare (sun.ts makeGlare). Display flux x = F·E with the exposure the Sun is actually
      // drawn with (the resolved disc's local presentation scale included), so glare and disc stay consistent: a resolved,
      // locally compressed disc gets a halo below its own limb brightness instead of a brighter blob around it.
      // amplitude from the Sun's physical display flux (scene exposure), capped for a resolved disc at 0.8× the disc's own
      // displayed centre so the halo never outshines the locally presented photosphere
      // v3.8.1 cp2 SUN-381-06: point-like glare (physical display flux at the point exposure) handed over smoothly to the
      // resolved-disc glare (a fixed fraction of the displayed disc radiance whose footprint grows with the disc), so the
      // glare's integrated light keeps rising as the Sun is approached instead of collapsing at the resolution threshold.
      // angular radius from geometry EVERY frame — this.sunRpx is only refreshed while the disc is resolved, so a stale value
      // (or 0) switched the point glare off between ≈ 9 and 13 AU in the continuous-travel test (CONT-01 acceptance)
      const rpxNow = Math.atan(R_SUN / dist) / this.pxAng; this.sunRpxNow = rpxNow;
      const amp = mode === 'scientific' ? glareAmplitudes(F * (this.sunPointExposure || LS)) : pointGlareFromHandover(rpxNow, mode);
      if (mode !== 'scientific') { amp.halo *= visFrac; amp.veil *= visFrac; }
      const wR = resolvedGlareWeight(rpxNow);
      if (wR > 0) {
        const discDisp = SUN_L0 * LS * (this.views.get('sun')?.discWeight ?? 1) * (this.sunDiscScaleNow || 1), rg = resolvedGlare(discDisp, mode);
        amp.halo = amp.halo * (1 - wR) + rg.halo * wR; amp.veil = amp.veil * (1 - wR) + rg.veil * wR;
      }
      const on = front && st.get('glare') ? glareWeight(rpxNow, this.H) * P.glare : 0;
      const angR = Math.atan(R_SUN / dist), th1 = Math.max(angR * 2.2, this.pxAng * 2.5);
      const G = this.glare.U;
      G.halo.value = amp.halo * on; G.veil.value = amp.veil * on * (mode === 'scientific' ? 0.6 : 1);
      G.angRad.value = angR; G.th1.value = th1; G.pxAng.value = this.pxAng; G.viewport.value.set(this.W, this.H);
      G.extentPx.value = Math.min(1.6 * Math.max(this.W, this.H), glareExtentRad(G.halo.value, G.veil.value, th1, 0.0087) / this.pxAng);
      G.spikes.value = mode === 'scientific' ? 0 : mode === 'cinematic' ? 1 : st.get('lensSpikes') ? 1 : 0;   // REV2-01: default presentation has no stylised spikes; Cinematic keeps them (labelled)
      G.tint.value.set(...(mode === 'scientific' ? [1, 1, 1] : mode === 'cinematic' ? [1.0, 0.93, 0.84] : [1.0, 0.975, 0.94]) as [number, number, number]);
      this.glareDisplay = amp.halo;
      this.glareFlux = F;
      // corona billboard (physical Baumbach brightness; structure simulated) facing the camera
      const C = this.corona.U;
      C.center.value.copy(relS); C.radius.value = R_SUN;
      // v3.8.1 SUN-381-05: the PHYSICAL Baumbach corona is ≈10⁻⁶ of the disc — but with the scene exposed for faint objects
      // (1–5 AU, nothing else metered) that is still 10²–10³ × display white out to ≈ 5 R☉, i.e. the flat white blob around
      // the Sun the owner reported (isolated: iso-nocorona capture). Exploration/Cinematic present the uneclipsed corona
      // with a local display scale so its brightest part (1.1 R☉) sits at ≈ 3× white and the r⁻²·⁵…r⁻¹⁷ falloff stays
      // visible; the weight vanishes as the disc is eclipsed (sunVis → 0), so eclipse coronae keep the physical metering.
      // Scientific: physical (no local scale).
      { const peakDisp = 1.28e-6 * SUN_L_MEAN * LS, sc = mode === 'scientific' ? 1 : Math.min(1, 3 / Math.max(peakDisp, 1e-12));
        this.coronaScale = Math.exp(Math.log(sc) * sunVis * sunVis); C.meanL.value = SUN_L_MEAN * LS * this.coronaScale; } C.time.value = (sys.jd - 2451545) * 86400 % 1e7;
      C.right.value.set(1, 0, 0).applyQuaternion(rig.quat); C.up.value.set(0, 1, 0).applyQuaternion(rig.quat);
      // projected solar north pole → position angle on screen
      const pz = sceneVec([sun.rot[2], sun.rot[5], sun.rot[8]]);
      C.poleAngle.value = Math.atan2(pz.dot(C.up.value), pz.dot(C.right.value));
      C.enabled.value = st.get('corona') === false ? 0 : 1;
      C.prominence.value = (st.get('prominences') === false ? 0 : 1) * (SUN_LOOKS[(st.get('sunLook') as SunLook) || 'natural'] ?? SUN_LOOKS.natural).prominence;
      C.days.value = sys.jd - 2451545;
      C.aureole.value = st.get('sunLook') === 'cinematic' ? 2.4 : st.get('sunLook') === 'scientific' ? 0 : 1.4;
      // the aureole belongs to the visible disc: it fades with the eclipse and with the disc→point transition
      C.aureole.value *= sunVis * (this.views.get('sun')?.discWeight ?? 0);
      // v3.8.1 SUN-381-04: the art-directed aureole is "5 % of the mean disc radiance at the limb"; with the disc 10⁴–10⁶ ×
      // over display white (1–5 AU) that clipped to a flat white blob ≈ 3 R☉ across — the dominant part of the owner's
      // "featureless white spot" (isolated by switching layers off: tools/qa captures iso-nocorona). Its DISPLAY amplitude
      // at the limb is now capped at 1.2× white and follows the disc's local presentation scale; the large-scale halo is
      // the angle-space glare. The physical Baumbach corona is unchanged.
      { const limbDisp = 0.05 * SUN_L_MEAN * LS * (this.sunDiscScaleNow || 1) * Math.max(C.aureole.value, 1e-9);
        C.aureole.value *= Math.min(1, 1.2 / Math.max(limbDisp, 1e-9)) * (this.sunDiscScaleNow || 1); }
      this.corona.mesh.visible = front || dist < R_SUN * 20;
    }
    // asteroids
    this.small.mesh.visible = !!st.get('asteroids') && !qaOff('small');
    if (qaOff('smalldraw')) { this.small.mesh.visible = false; if (st.get('asteroids') && !qaOff('small') && !qaOff('smallcompute')) this.renderer.compute(this.small.compute); }
    if (this.small.mesh.visible) {
      this.small.U.days.value = sys.jd - 2451545;
      this.small.U.cam.value.copy(sceneVec(cam));
      this.small.U.gain.value = LS * visibilityGain(mode, st.get('asteroidBoost') as number);   // GA-SCI-01
      this.small.U.colorMode.value = st.get('asteroidColors') ? 1 : 0;
      if (!qaOff('smallcompute')) this.renderer.compute(this.small.compute);
    }
    // comets
    for (const [id, t] of this.tails) this.updateTail(id, t, cam);
    // orbits
    LINE_GLOBAL.focus.value = rig.target ? len(sub(rig.target.pos, cam)) : 0;
    this.updateOrbits(cam, dt);
    this.updateTrajectory(cam);
    this.pipeline.render();
    this.cpuMs = performance.now() - tFrame0;
    this.frameTimes[this.frameNo % this.frameTimes.length] = dt * 1000;
  }
  expDebug: any = null; sunRpx = 0; sunRpxNow = 0; sunVisNow = 1; granT = 0; lastSunJd: number | null = null; frameDt = 1 / 60;
  frameNo = 0; cpuMs = 0; frameTimes = new Float32Array(240);
  /** Jump exposure to its current target (deterministic captures / QA); normal play adapts smoothly. */
  /** CONT-14: outer radius (km) of everything a body's own view draws that can write depth or attenuate behind it — the
   *  surface bound and the atmosphere shell (premultiplied "over" blending: its τ > 3 haze absorbs a sprite inside it). */
  private viewBound(b: Body) {
    const sh = this.views.get(b.id)?.atmo?.U.shell.value as THREE.Vector3 | undefined;
    return Math.max(b.radius, ...b.radii, sh ? Math.max(sh.x, sh.y, sh.z) : 0);
  }
  scenePass: any = null;
  /** QA-381-02: scene-linear (pre-exposed, before bloom/grade/tone map) readback of a centred w×w device-pixel window of the
   *  HDR scene pass — replaces 8-bit screenshot + inverse-tone-map for photometric diagnostics (cheaper, no clipping). */
  async qaReadHDR(w = 33) {
    const rt = this.scenePass?.renderTarget; if (!rt || !this.renderer) return null;
    const W = rt.width, H = rt.height, x0 = Math.round(W / 2 - (w - 1) / 2), y0 = Math.round(H / 2 - (w - 1) / 2);
    const raw: any = await (this.renderer as any).readRenderTargetPixelsAsync(rt, x0, y0, w, w);
    const half = raw instanceof Uint16Array, n = w * w, Y = new Float64Array(n), sum = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) {
      const v = half ? THREE.DataUtils.fromHalfFloat(raw[i * 4 + c]) : raw[i * 4 + c]; sum[c] += v; Y[i] += v / 3;
    }
    const srt = Float64Array.from(Y).sort(), med = srt[n >> 1];
    let sig = 0, peak = 0; for (let i = 0; i < n; i++) { sig += Math.max(0, Y[i] - med); peak = Math.max(peak, Y[i]); }
    return { w, W, H, sum, median: med, signal: sig, peak, half };
  }
  settleExposure() { this.expSettle = true; }
  private expSettle = false;
  /** Runtime diagnostics (§8.1 diagnostics overlay): backend, frame statistics, residency, network. */
  diagnostics() {
    const ft = [...this.frameTimes].filter(x => x > 0).sort((a, b) => a - b), q = (p: number) => ft.length ? +ft[Math.min(ft.length - 1, Math.floor(p * ft.length))].toFixed(2) : null;
    const be: any = this.renderer?.backend;
    return {
      backend: be?.isWebGPUBackend ? 'WebGPU (native)' : 'unknown', adapter: this.gpuInfo, deviceLost: this.deviceLost,
      frame: { n: ft.length, medianMs: q(0.5), p95Ms: q(0.95), p99Ms: q(0.99), cpuMs: +this.cpuMs.toFixed(2) },
      drawCalls: (this.renderer as any)?.info?.render?.drawCalls ?? null, views: this.views.size, orbits: this.orbits.size,
      textures: this.assets.textures.stats(), terrain: this.terrainStats, net: { ...netStats }, exposureEV: +Math.log2(this.displayExposure).toFixed(2),
      detail: this.targetDetail(),
      // v3.5 exposure/visibility state
      sunGlare: { rpx: +(this.sunRpxNow ?? this.sunRpx).toFixed(2), halo: +this.glareDisplay.toFixed(4), veil: +(this.glare?.U.veil.value ?? 0).toFixed(4), discScale: +(this.sunDiscScaleNow || 1).toFixed(4), pointEV: this.sunPointExposure ? +Math.log2(this.sunPointExposure).toFixed(2) : null, flux: +(this.glareFlux || 0).toFixed(4) },
      view: { mode: this.enhancement.mode, sceneEV: +Math.log2(this.displayExposure).toFixed(2), skyEV: +Math.log2(this.skyExp).toFixed(2), veil: +this.veil.toFixed(3), sunVeil: +this.sunVeil.toFixed(3),
        meter: this.meter, inspect: this.enhancement.inspect, skyDecoupled: this.enhancement.skyDecoupled },
      tiers: [...this.views.values()].reduce((o: Record<string, number>, v) => { if (v.group.visible) o['D' + v.tier] = (o['D' + v.tier] ?? 0) + 1; return o; }, {}),
    };
  }
  private lastTier: DetailTier | undefined;
  /** Contract 4: the detail tier the target currently warrants and why (shown in diagnostics; hysteresis kept). */
  targetDetail() {
    const t = this.rig.target; if (!t) return null;
    const r = Math.max(t.radii[0], t.radius), d = len(sub(this.rig.pos, t.pos));
    const sel = selectDetail({ radiusKm: r, distanceKm: d, fovYRad: this.rig.fov * DEG, viewportH: this.H * (this.renderer?.getPixelRatio?.() ?? 1), luminous: t.kind === 'star',
      hasSurface: !!(t.def.tex || t.def.procedural || t.def.model), hasTerrain: !!t.def.terrain, budgetOk: true, focused: true }, this.lastTier);
    this.lastTier = sel.tier;
    return `${TIER_NAMES[sel.tier]} (${sel.px.toFixed(1)} px) — ${sel.reason}`;
  }
  glareFlux = 0;
  /** Angle (rad) of the body-fixed +x axis from the ascending node of the body's equator on the ICRF equator, measured in
   *  the equatorial plane — converts inertial ring-arc longitudes into the body-fixed frame the ring mesh lives in. */
  primeMeridian(b: Body) {
    const R = b.rot, X: V3 = [R[0], R[3], R[6]], Z: V3 = [R[2], R[5], R[8]];
    const eps = 23.4392794444 * DEG, zIcrf: V3 = [0, -Math.sin(eps), Math.cos(eps)];
    let N = cross(zIcrf, Z); const nl = len(N); if (nl < 1e-9) return 0; N = scale(N, 1 / nl); const M = cross(Z, N);
    return Math.atan2(dot(X, M), dot(X, N));
  }
  /** fraction of the frame covered by a sphere (camera-relative scene position c, radius r): 12 × 12 view-ray grid, normalised like the
   *  square estimate by min(projected disc area, frame) so a disc wholly inside the frame meters at full weight */
  private _cq = new THREE.Vector3(); private _cr = new THREE.Vector3();
  frameCoverage(c: THREE.Vector3, r: number) {
    const N = 12, ty = Math.tan(this.rig.fov * Math.PI / 360), tx = ty * this.W / Math.max(1, this.H), q = this.rig.quat as any;
    let hit = 0; const cc = c.lengthSq() - r * r;
    if (cc <= 0) return 1;                                  // inside the sphere
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const d = this._cq.set(((i + 0.5) / N * 2 - 1) * tx, ((j + 0.5) / N * 2 - 1) * ty, -1).normalize().applyQuaternion(q);
      const bb = d.dot(c); if (bb > 0 && bb * bb >= cc) hit++;
    }
    const ta = Math.tan(Math.min(1.5, Math.asin(Math.min(1, r / Math.sqrt(c.lengthSq()))))), disc = Math.PI * ta * ta / (4 * tx * ty);
    return Math.min(1, hit / (N * N) / Math.max(1e-6, Math.min(1, disc)));
  }
  sunVisibility(cam: V3) {
    let vis = 1;
    const sun = this.sys.sun, ds = len(sub(sun.pos, cam)), rs = Math.atan(R_SUN / ds), sd = norm(sub(sun.pos, cam));
    for (const b of this.sys.bodies) {
      if (b === sun || b.radius < 50) continue;
      const to = sub(b.pos, cam), d = len(to); if (d > ds || d < b.radius) continue;
      const ro = Math.asin(Math.min(1, b.radius / d)), od = norm(to);
      const sep = Math.atan2(len(cross(sd, od)), dot(sd, od));
      if (sep >= rs + ro) continue;
      if (sep <= ro - rs) return 0;
      vis *= 1 - circleOverlap(rs, ro, sep) / (Math.PI * rs * rs);
      // atmosphere attenuation near the limb is handled in-shader; here only hard occlusion
    }
    return Math.max(0, vis);
  }
  updateView(v: BodyView, relS: THREE.Vector3, cam: V3) {
    const b = v.b, sys = this.sys;
    const M = rotToMatrix4(b.rot, relS, new THREE.Vector3(1, 1, 1), new THREE.Matrix4());
    v.group.matrix.copy(M); v.group.matrixWorldNeedsUpdate = true;
    const camLocal = toLocal(b, sub(cam, b.pos));
    if (b.kind === 'star') {
      v.surface!.scale.setScalar(b.radius); v.surface!.updateMatrix();
      const SU = v.sun!.U;
      SU.cam.value.copy(camLocal); SU.time.value = (sys.jd - 2451545) * 86400 % 1e6; SU.L0.value = SUN_L0 * LS * v.discWeight;
      // granulation runs on a visual clock: real solar evolution at normal rates, capped under time-lapse so granules
      // never strobe when the simulation runs at days or years per second
      const dSim = this.lastSunJd === null ? 0 : (sys.jd - this.lastSunJd) * 86400; this.lastSunJd = sys.jd;
      this.granT = (this.granT + Math.sign(dSim) * Math.min(Math.abs(dSim), this.frameDt * 40)) % 1e6;
      SU.granT.value = this.granT; SU.days.value = (sys.jd - 2451545) % 36525;
      const look = SUN_LOOKS[(this.settings.get('sunLook') as SunLook) || 'natural'] ?? SUN_LOOKS.natural;
      SU.tint.value.set(...look.tint); SU.contrast.value = look.contrast; SU.limbGrade.value = look.limbGrade;
      // v3.8.1 SUN-381-02: local HDR presentation of the resolved disc (Exploration/Cinematic; identity in Scientific)
      { const rpxD = Math.atan(b.radius / Math.max(relS.length(), 1)) / this.pxAng; const mode = (this.settings.get('viewMode') as ViewMode) || 'exploration';
        const ds = sunDiscScale(SUN_L0 * LS * v.discWeight, rpxD, mode); SU.discScale.value = ds; this.sunDiscScaleNow = ds; }
      SU.detail.value = this.settings.get('sunDetail') === 'low' ? 0.35 : this.settings.get('sunDetail') === 'medium' ? 0.7 : 1;
      return;
    }
    const sunLocal = toLocal(b, sub(sys.sun.pos, b.pos));
    const rS = len(b.pos) / AU, irr = LS / (rS * rS) * v.discWeight;
    // DEM terrain (Moon, Mars): stream the grid when within ~4 radii; switch from the sphere below ~1.6 radii
    const altR = camLocal.length() / b.radius;
    if (b.def.terrain && !v.terrain && !v.terrainLoading && altR < 4 && this.settings.get('terrain') !== false) { v.terrainLoading = true; void this.loadTerrain(v); }
    // v3.5 AUD-04: the terrain mesh replaces the sphere only in the D4 near-surface tier (contract hysteresis applies)
    const useTerrain = v.useTerrain = !!v.terrain && v.tier >= 4 && altR < 1.6 && this.settings.get('terrain') !== false;
    if (v.terrain) {
      v.terrain.group.visible = useTerrain; v.surface!.visible = !useTerrain;
      if (useTerrain) {
        const R0 = v.terrain.refRadiusKm; v.U.radii.value.set(R0, R0, R0);
        // v3.6: screen-space-error refinement (contracts/lod.ts) at the device resolution; quality sets the error target
        const q = this.settings.get('quality'), errPx = q === 'ultra' ? 3 : q === 'medium' ? 9 : 5;
        const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rig.quat), vdir = toLocal(b, [fw.x, -fw.z, fw.y]).normalize();
        v.terrain.buildMs = this.terrainBuildMs;
        v.terrain.update(camLocal, errPx, rig_fov(this) * DEG, this.H * (this.renderer?.getPixelRatio?.() ?? 1), { dir: vdir, aspect: this.W / this.H });
        // float64 per-patch placement through the frame hierarchy (camera → body-fixed → ground patch)
        const one = new THREE.Vector3(1, 1, 1);
        v.terrain.place(sub(b.pos, cam) as any, b.rot as any, (pe, out) => { rotToMatrix4(b.rot, new THREE.Vector3(pe[0], pe[2], -pe[1]), one, out); });
        this.terrainStats = v.terrain.stats;
      }
      else v.U.radii.value.set(b.radii[0], b.radii[1], b.radii[2]);
    }
    const ct = b.def.cloudTopKm ?? 0;   // v3.7: Venus' visible surface is its cloud deck
    if (!v.model) v.surface!.scale.set(b.radii[0] + ct, b.radii[1] + ct, b.radii[2] + ct);
    else v.surface!.scale.set(b.radii[0], b.radii[0], b.radii[0]);
    v.surface!.updateMatrix();
    const U = v.U;
    U.sunPos.value.copy(sunLocal); U.cam.value.copy(camLocal); U.irr.value = irr; U.sunR.value = R_SUN;
    if (v.model) U.cam.value.divideScalar(1);
    U.nightGain.value = (this.settings.get("cityLights") ? 1 : 0) * 6e-4 * LS;
    // v3.5 planetshine (physical secondary illumination) and the labelled inspection fill (presentation only)
    const sh = this.settings.get('planetshine') === false ? null : this.planetshine(b);
    if (sh) { const dl = toLocal(b, sh.dir); U.shineDir.value.copy(dl.normalize()); U.shineIrr.value.set(sh.rgb[0], sh.rgb[1], sh.rgb[2]).multiplyScalar(LS * v.discWeight); }
    else U.shineIrr.value.set(0, 0, 0);
    // the inspection light is withheld during a solar eclipse seen by the camera: the exposure is then set for the corona
    // and any fill would turn the occulting Moon into a bright disc (seen in the v3.5 eclipse QA capture before this fix)
    U.inspect.value = this.settings.get('nightInspect') === false ? 0 : this.pres.inspect * (this.settings.get('inspectLevel') as number ?? 1) * irr * smooth(0.9, 0.99, this.sunVisNow);
    U.cloudOn.value = this.settings.get('clouds') ? 1 : 0;
    U.markUnknown.value = this.settings.get('markUnknown') ? 1 : 0;
    U.occGlow.value = v.occluders[0]?.id === 'earth' ? 1 : 0;
    for (let k = 0; k < 4; k++) {
      const o = v.occluders[k];
      if (o) { const p = toLocal(b, sub(o.pos, b.pos)); U.occ[k].value.set(p.x, p.y, p.z, o.radius * (o.def.atmo && o.id === 'earth' ? 1.012 : 1)); }
      else U.occ[k].value.set(0, 0, 0, 0);
    }
    if (v.atmo) {
      // v3.8: while the worker is still building this body's LUTs (≈ 0.1–0.45 s after first resolve) the shell is hidden
      const on = !!this.settings.get('atmospheres') && (v.atmoLuts as any)?.ready !== false;
      v.atmo.mesh.visible = on;
      v.atmo.U.cam.value.copy(camLocal); v.atmo.U.sunDir.value.copy(sunLocal.clone().normalize()); v.atmo.U.irr.value = irr;
      v.atmo.U.ms.value = this.settings.get('multiScatter') === false ? 0 : 1;
      // v3.5 AUD-04: sample count follows the LOD tier (D2 proxy → coarse; D5 focused → +50 %) and the quality preset
      const qs = this.settings.get('quality') === 'ultra' ? 24 : this.settings.get('quality') === 'high' ? 16 : 10;
      v.atmo.U.steps.value = v.tier <= 2 ? Math.max(6, qs >> 1) : v.tier >= 5 ? Math.round(qs * 1.5) : qs;
      const ag = b.def.atmo?.airglow;
      if (ag && this.settings.get('airglow') !== false) { const k = airglowPeakPerKm(b.def.atmo!, radianceFromSB(22.0)) * this.skyExp * this.pres.airglow * v.discWeight; v.atmo.U.airglow.value.set(ag.color[0] * k, ag.color[1] * k, ag.color[2] * k); }
      else v.atmo.U.airglow.value.set(0, 0, 0);
      const inside = camLocal.length() < v.atmo.Ra * 1.002;
      const mat = v.atmo.mesh.material as THREE.Material;
      const side = inside ? THREE.BackSide : THREE.FrontSide;
      if (mat.side !== side) { mat.side = side; mat.depthTest = !inside; mat.needsUpdate = true; }
      v.atmo.mesh.scale.copy(v.atmo.U.shell.value); v.atmo.mesh.updateMatrix();
    }
    if ((v as any).plumes) {
      const P = (v as any).plumes; P.mesh.visible = this.settings.get('plumes') !== false;
      P.U.sunLocal.value.copy(sunLocal); P.U.cam.value.copy(camLocal); P.U.irr.value = irr;
      // v3.7.1 (ATM-012): geometry-aware labelled enhancement (v3.7: a fixed ×4). The plume's brightest physical I/F for this
      // Sun/camera geometry is lifted to a display target (≈ 10 % of a bright surface's I/F) but never dimmed and never
      // boosted beyond ×60; Scientific is always ×1 (physical). Physically, Io's umbrellas at moderate phase are ~0.3 % of the
      // surface brightness and essentially invisible — the enhancement is what makes them findable, and it is labelled.
      const sl = sunLocal.clone().normalize(), cl = camLocal.clone().normalize();
      const pk = plumePeakIF(P.list, [sl.x, sl.y, sl.z], [cl.x, cl.y, cl.z], b.radius);
      const tgt = this.enhancement.mode === 'cinematic' ? 0.08 : 0.06;
      const gain = this.enhancement.mode === 'scientific' ? 1 : Math.max(1, Math.min(60, tgt / Math.max(pk, 1e-9)));
      P.U.gain.value = gain; v.plumePeakIF = pk * gain;
      if (gain > 1.001 && gain >= this.enhancement.plumeGain) { this.enhancement.plumes = b.id; this.enhancement.plumeGain = gain; }
    }
    if (v.rings) {
      const R = v.rings as any, def = R.def;
      // v3.7 ring tiers: R0 (ring system < 1.5 px: nothing drawn — no false large geometry), R1/R2 shaded optical-depth
      // annulus (profile LOD by pixel footprint), R3 exact 1-km profile / analytic narrow rings, R4 Saturn particle field
      const dist = camLocal.length(), outerPx = Math.atan(def.outer / Math.max(dist, 1)) / this.pxAng;
      const tier = outerPx < 1.5 ? 'R0' : outerPx < 60 ? 'R1' : outerPx < 2500 ? 'R2' : 'R3';
      R.mesh.visible = !!this.settings.get('rings') && tier !== 'R0';
      R.U.sunLocal.value.copy(sunLocal); R.U.cam.value.copy(camLocal); R.U.irr.value = irr;
      R.U.sunAng.value = Math.atan(R_SUN / len(b.pos)) / (b.radius / len(b.pos)) * 1.0;
      // labelled visibility enhancement for intrinsically faint systems (never in Scientific mode; τ & geometry unchanged)
      // v3.7.1 RING-007: geometry-aware gain — the brightest ring I/F in the CURRENT Sun/camera geometry (re-evaluated every
      // 10 frames) is mapped to the same display target, so forward-scattering (backlit) dust can no longer be driven to white
      if (R.peakNow === undefined || !(this.frameNo % 10)) R.peakNow = peakIFAt(def, RS_PROF(this, b.id, def), [sunLocal.x, sunLocal.y, sunLocal.z], [camLocal.x, camLocal.y, camLocal.z]);
      const mode = this.enhancement.mode, want = mode === 'scientific' || this.settings.get('ringEnhance') === false ? 1 : Math.max(1, Math.min(def.enhanceMax, (mode === 'cinematic' ? 0.1 : 0.08) / Math.max(R.peakNow, R.peak * 0.02, 1e-12)));
      R.U.gain.value = want;
      // v3.7.1 RING-003: eccentric ring orientation — azimuth (body frame) of the French et al. reference direction, the
      // ascending node of Uranus' spin equator on the B1950 Earth equator, and days since the element epoch (TDB ≈ TT here)
      if (def.narrow.some((n: any) => n.orbit)) {
        const o = def.narrow.find((n: any) => n.orbit).orbit;
        const zb = [b.rot[2], b.rot[5], b.rot[8]];                           // body +z (IAU north) in ecliptic J2000
        const sense = b.id === 'uranus' ? -1 : 1;                            // Uranus spins about −z_IAU (W decreases)
        const zs = [zb[0] * sense, zb[1] * sense, zb[2] * sense];
        const zB = B1950_POLE_ECL;                                           // B1950 equator pole in ecliptic J2000
        let N = [zB[1] * zs[2] - zB[2] * zs[1], zB[2] * zs[0] - zB[0] * zs[2], zB[0] * zs[1] - zB[1] * zs[0]]; const nl = Math.hypot(N[0], N[1], N[2]); N = N.map(x => x / nl);
        const Nl = toLocal(b, N as V3);
        R.U.ecc.value.set(sys.jd - o.epochJd, Math.atan2(Nl.y, Nl.x), sense);
      }
      if (def.arcs) R.U.arcPhase.value = -(def.arcs.patternDegPerDay * (sys.jd - def.arcs.epochJd) * Math.PI / 180 - this.primeMeridian(b));
      this.ringState[b.id] = { tier, outerPx, gain: want, enhanced: want > 1.001, source: def.profile ? def.profile.source : 'catalogue components (src/data/rings.ts)' };
      if (want > 1.001 && (!this.enhancement.rings || want > this.enhancement.rings.gain)) this.enhancement.rings = { body: b.id, gain: want };
      // v3.7 precise near-field patch (camera within 2,000 km of the plane over the measured profile)
      if (R.patch) {
        const rc = Math.hypot(camLocal.x, camLocal.y), zc = camLocal.z, P0 = def.profile;
        const on = R.mesh.visible && Math.abs(zc) < 2000 && rc > P0.r0 && rc < P0.r0 + P0.n * P0.dr;
        R.patch.visible = on; R.U.patchOn.value = on ? 1 : 0;
        if (on) {
          const Rp = Math.max(30, Math.min(8000, Math.abs(zc) * 25)), base = rc - P0.r0, bi = Math.floor(base);
          R.U.patchR.value = Rp; R.U.patchC.value.set(camLocal.x, camLocal.y); R.U.patchR0.value = rc; R.U.patchBi.value = bi; R.U.patchBf.value = base - bi;
          R.U.patchOff.value.set(0, 0, -zc); R.U.patchCam.value.set(0, 0, zc);
          const m3 = new THREE.Matrix3().setFromMatrix4(v.group.matrixWorld);
          R.U.ax.value.set(1, 0, 0).applyMatrix3(m3).normalize(); R.U.ay.value.set(0, 1, 0).applyMatrix3(m3).normalize(); R.U.az.value.set(0, 0, 1).applyMatrix3(m3).normalize();
        }
      }
      if (b.id === 'saturn') { this.updateRingField(v, camLocal, sunLocal, irr); if (this.ringFieldState.active) this.ringState.saturn.tier = 'R4'; }
    }
    // hi-res texture streaming
    const sc = this.screen.get(b.id);
    for (const n of v.texNames) this.assets.textures.touch(n);
    // v3.5 AUD-04: full-resolution maps only for D3+ (mapped detail) and large discs
    if (b.def.texHi && sc && v.tier >= 3 && sc.r > 320 && this.settings.get('hiTextures')) for (const n of v.texNames) this.assets.textures.requestHi(n);
  }
  // ── v3.4 Saturn ring near-field particles (render/ringParticles.ts) ────────────────────────────────────────────────
  ringField: ReturnType<typeof makeRingField> | null = null; private rfPrev: THREE.Vector3 | null = null; private rfOff = new THREE.Vector3(); private rfT = 0; private rfJd: number | null = null;
  ringFieldState = { active: false, tau: 0, count: 0, altKm: 0, rKm: 0 };
  private ringFieldTouched = false;
  updateRingField(v: BodyView, camLocal: THREE.Vector3, sunLocal: THREE.Vector3, irr: number) {
    this.ringFieldTouched = true;
    const on = !!this.settings.get('ringParticles') && !!this.settings.get('rings') && !qaOff('ringfield');
    // v3.7: local τ from the MEASURED Voyager PPS profile at the box scale (v3.4–3.6: a 9-step coarse table)
    const r = Math.hypot(camLocal.x, camLocal.y), z = camLocal.z, prof = this.ringProfiles.saturn, tau = prof ? ringTau(RING_SYSTEMS.saturn, r, 0.12, prof)[0] : saturnTau(r);
    const fade = on ? Math.max(0, Math.min(1, (0.09 - Math.abs(z)) / 0.05)) * (tau > 0 ? 1 : 0) : 0;
    this.ringFieldState = { active: fade > 0, tau, count: 0, altKm: z, rKm: r };
    if (fade <= 0) { if (this.ringField) this.ringField.mesh.visible = false; this.rfPrev = null; this.rfJd = null; return; }
    if (!this.ringField) { this.ringField = makeRingField(); this.scene.add(this.ringField.mesh); }
    const F = this.ringField, U = F.U;
    // Hill axes (local body-fixed): x radial, y prograde, z ring normal → scene via the body group's rotation
    const ex = new THREE.Vector3(camLocal.x / r, camLocal.y / r, 0), ez = new THREE.Vector3(0, 0, 1), ey = new THREE.Vector3().crossVectors(ez, ex);
    const m3 = new THREE.Matrix3().setFromMatrix4(v.group.matrix);
    U.ex.value.copy(ex).applyMatrix3(m3).normalize(); U.ey.value.copy(ey).applyMatrix3(m3).normalize(); U.ez.value.copy(ez).applyMatrix3(m3).normalize();
    // co-orbiting observer: the box moves with the ring material; only the camera's OWN displacement moves through it
    if (this.rfPrev) { const d = camLocal.clone().sub(this.rfPrev); this.rfOff.x += d.dot(ex); this.rfOff.y += d.dot(ey); }
    this.rfPrev = camLocal.clone();
    const L = U.L.value as number; this.rfOff.x = ((this.rfOff.x % L) + L) % L; this.rfOff.y = ((this.rfOff.y % L) + L) % L;
    U.camOff.value.set(this.rfOff.x, this.rfOff.y, z);
    // Keplerian shear accumulated in simulation time since the field turned on: ẏ = −1.5 Ω x
    const GM = 37931206.2, Om = Math.sqrt(GM / (r * r * r));
    if (this.rfJd !== null) this.rfT += (this.sys.jd - this.rfJd) * 86400; this.rfJd = this.sys.jd;
    U.shear.value = (-1.5 * Om * this.rfT) % 1e3;
    // Saturn's shadow on the rings at the camera's position (cylinder approximation, ellipsoid ignored)
    const sd = sunLocal.clone().normalize(), along = camLocal.dot(sd), perp = camLocal.clone().sub(sd.clone().multiplyScalar(along)).length();
    U.shadow.value = along < 0 && perp < 58232 ? 0.03 : 1;
    U.sunDir.value.copy(sd).applyMatrix3(m3).normalize(); U.irr.value = irr; U.fade.value = fade;
    const n = particleCountForTau(tau); F.geo.instanceCount = n; F.mesh.visible = n > 0;
    this.ringFieldState.count = n;
  }
  onHiRes?: (b: Body) => void;
  updateTail(id: string, t: CometTail, cam: V3) {
    const b = this.sys.get(id)!;
    const r = len(b.pos), rAU = r / AU;
    const on = !!this.settings.get('cometTails');
    // activity: water-ice sublimation switches on inside ~3–4 AU (CO-driven activity weaker beyond)
    const act = on ? Math.pow(Math.min(1, 4.2 / rAU), 2) * Math.exp(-Math.max(0, rAU - 3.2) * 1.2) : 0;
    t.mesh.visible = act > 0.003;
    if (!t.mesh.visible) return;
    const rel = sub(b.pos, cam), relS = sceneVec(rel);
    const vel = this.sys.velocity(b, this.sys.jd);
    t.U.nucleus.value.copy(relS); t.U.sunDir.value.copy(sceneVec(norm(scale(b.pos, -1))));
    t.U.vel.value.copy(sceneVec(vel)); t.U.rKm.value = r; t.U.g.value = GM_SUN / (r * r);
    // total visual magnitude m = M1 + 5 log Δ + 10 log r  (Halley-type M1 ≈ 5.5; size-scaled)
    const M1 = 11 - 5 * Math.log10(Math.max(0.5, b.radius * 2));   // Halley (11 km) → 5.8, Hale–Bopp (60 km) → 2.1
    const delta = len(rel) / AU;
    const Ftot = Math.PI * Math.pow(10, -0.4 * (M1 + 10 * Math.log10(Math.max(rAU, 0.05)) + 26.74)) * Math.pow(AU / Math.max(len(rel), 1), 2) * visibilityGain(this.enhancement.mode, st(this, 'cometBoost'));
    // v3.5: the cometBoost visibility exaggeration (default 3000×) is meant for comets seen from afar; v3.4 kept it at
    // the nucleus too, so a camera a few km from 67P sat inside a 3000× coma and the frame clipped to white (80 % of
    // pixels in the v3.4 cg67p capture). The boost now fades to the physical ×1 within ~2×10⁵ km of the nucleus.
    const cb = visibilityGain(this.enhancement.mode, st(this, 'cometBoost')), near = smooth(2e3, 2e5, len(rel)); const fNear = (1 + (cb - 1) * near) / cb;
    t.U.dustFlux.value = LS * Ftot * 0.62 * act * fNear; t.U.ionFlux.value = LS * Ftot * 0.38 * act * fNear;
    t.U.size.value = Math.max(0.6, Math.min(3, b.radius / 3));
    void delta;
  }
  /** Orbit guides (v3.3): mode-driven relevance (src/render/guides.ts), smooth per-orbit opacity with no hard popping,
   *  relative-to-eye float64 anchors (no precision vibration), selected/hovered orbits always dominant. */
  orbitAlpha = new Map<string, number>();
  updateOrbits(cam: V3, dt = 1 / 60) {
    const st = this.settings, show = !!st.get('orbits'), sel = this.selected, mode = (st.get('guideMode') as GuideMode) || 'clean';
    const gb = (b: Body | null) => b ? { id: b.id, kind: b.kind, radius: b.radius, parentId: b.parent?.id ?? null, parentKind: b.parent?.kind ?? null } : null;
    const ctx = { mode, selected: gb(sel), hovered: gb(this.hover), target: gb(this.rig.target) };
    for (const b of this.sys.bodies) {
      if (!b.parent || !b.orbitEl) continue;
      const ex = this.orbits.get(b.id);
      const rel = show || b === sel ? guideRelevance(gb(b)!, ctx) : 0;
      const pc = sub(b.parent.pos, cam), dp = len(pc);
      const a = Math.abs(len(b.rel));
      const apx = Math.atan(a / Math.max(dp, 1)) / this.pxAng;
      let target = rel * screenFade(apx, this.H, b === sel);
      if (target > 0) {
        // the orbit of the body we are visiting (or of its parent) is hidden when we are close to it
        let anc: Body | null = this.rig.target;
        while (anc) { if (anc === b) { target *= smooth(0.002, 0.03, len(sub(cam, b.pos)) / Math.max(a, 1)); break; } anc = anc.parent; }
        // context fade: near a world, other heliocentric orbits all project onto the ecliptic band — fade them
        if (b.parent.kind === 'star' && this.rig.target && this.rig.target.kind !== 'star' && b !== sel && b !== this.hover) target *= smooth(3e-4, 3e-2, LINE_GLOBAL.focus.value / Math.max(a, 1));
        if (b !== sel && b !== this.hover && dp < 0.5 * a) target *= 0.35;
        // clean/focused: context orbits only when seen from outside (from inside, near the plane, they collapse into
        // lines sweeping across the view — the v3.2 "spaghetti" next to the Sun)
        if ((mode === 'clean' || mode === 'focused') && b !== sel && b !== this.hover) target *= smooth(0.25, 0.9, dp / Math.max(a, 1));
      }
      const prev = this.orbitAlpha.get(b.id) ?? 0, alpha = approach(prev, target, dt, target > prev ? 5 : 7);
      this.orbitAlpha.set(b.id, alpha < 0.002 && target === 0 ? 0 : alpha);
      if (alpha < 0.002) { if (ex) ex.set.mesh.visible = false; continue; }
      const o = this.ensureOrbit(b); if (!o) continue;
      const m = o.set.mesh; m.visible = true;
      const ps = sceneVec(pc);
      o.set.setOrigin(pc[0], pc[2], -pc[1]); void ps;
      const U = o.set.U;
      U.viewport.value.set(this.W, this.H);
      // exact phase of the body on the drawn conic: its true anomaly → mean-anomaly fraction (no nearest-vertex search)
      const relS = sceneVec(b.rel);
      const nu = trueAnomalyOf(mulMtV3(o.frame, b.rel), o.el);
      U.phase.value = o.open ? this.openPhase(o, nu) : trueToMeanFraction(nu, o.el.e);
      U.body.value.copy(relS); U.bodyR.value = b.radius; U.fadeNear.value = 1;
      U.opacity.value = (st.get('orbitOpacity') as number) * alpha * (b === sel ? 1.25 : 1) * (b.kind === 'moon' ? 0.85 : 1);
      U.highlight.value = b === sel ? 1 : b === this.hover ? 0.5 : 0;
      U.width.value = (b.kind === 'planet' ? 1.4 : 1.1);
      U.trail.value = st.get('orbitTrails') ? 1 : 0;
    }
    this.updateAxis(cam);
  }
  private axis: { id: string; set: LineSet } | null = null;
  /** Spin axis (±1.7 R, solid north / dashed south) and equator of the selected body — science mode only. The pole is
   *  the body's rotation-model pole (IAU WGCCRE where known); placeholder poles are flagged in the inspector. */
  updateAxis(cam: V3) {
    const b = this.selected, mode = (this.settings.get('guideMode') as GuideMode) || 'clean';
    const want = !!b && b.kind !== 'xstar' && guideExtras(mode).axis && !!this.settings.get('orbits');
    if (!want) { if (this.axis) this.axis.set.mesh.visible = false; return; }
    if (!this.axis || this.axis.id !== b!.id) {
      if (this.axis) { this.scene.remove(this.axis.set.mesh); this.axis.set.dispose(); }
      const segs: number[] = [], ph: number[] = [];
      const N = 96;
      // body-fixed points; pole = +z. Equator ring at 1.25 R.
      for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2; segs.push(Math.cos(a0) * 1.25, Math.sin(a0) * 1.25, 0, Math.cos(a1) * 1.25, Math.sin(a1) * 1.25, 0); ph.push(0, 0); }
      segs.push(0, 0, 1.0, 0, 0, 1.75); ph.push(0, 0); segs.push(0, 0, -1.0, 0, 0, -1.75); ph.push(0, 0);
      const set = new LineSet(new Float64Array(segs), new Float32Array(ph), { color: new THREE.Color(0.72, 0.78, 0.9).multiplyScalar(0.5), width: 1.0, opacity: 0.8 });
      this.scene.add(set.mesh); this.axis = { id: b!.id, set };
    }
    const set = this.axis.set, r = Math.max(b!.radii[0], b!.radius), rel = sub(b!.pos, cam), relS = sceneVec(rel);
    // body frame (columns = body axes in ecliptic) → scene, scaled by radius; anchor = body centre (RTE)
    const R = b!.rot;   // scene = SCENE_FROM_ECL · R_body (same mapping as rotToMatrix4), scaled by the radius
    set.U.basis.value.set(R[0] * r, R[1] * r, R[2] * r, R[6] * r, R[7] * r, R[8] * r, -R[3] * r, -R[4] * r, -R[5] * r);
    set.setOrigin(rel[0], rel[2], -rel[1]); void relS;
    set.U.viewport.value.set(this.W, this.H); set.U.fadeNear.value = 0;
  }
  selected: Body | null = null; hover: Body | null = null;
  private traj: { id: string; built: number; span: number; set: LineSet } | null = null;
  /** Sampled ephemeris trajectory of the selected body (spec §7: "sampled ephemeris trajectory through time", distinct
   *  from the osculating conic): 384 positions from the body's actual ephemeris tier over ±half a period (capped at
   *  ±25 yr), relative to its parent, drawn in amber. Where it departs from the blue conic, the orbit is perturbed. */
  updateTrajectory(cam: V3) {
    const b = this.selected, want = !!b && !!b.parent && !!this.settings.get('orbits') && !!this.settings.get('trajectory') && guideExtras((this.settings.get('guideMode') as GuideMode) || 'clean').trajectory && !!b.orbitEl;
    if (!want) { if (this.traj) this.traj.set.mesh.visible = false; return; }
    const o = this.orbits.get(b!.id), jd = this.sys.jd;
    const period = o?.period && o.period < 1e8 ? o.period : 365.25 * 50;
    const span = Math.min(period / 2, 365.25 * 25);
    if (!this.traj || this.traj.id !== b!.id || Math.abs(jd - this.traj.built) > span / 64) {
      if (this.traj) { this.scene.remove(this.traj.set.mesh); this.traj.set.dispose(); }
      const N = 384, pts = new Float64Array(N * 3), ph = new Float32Array(N);
      for (let k = 0; k < N; k++) {
        const t = jd - span + 2 * span * k / (N - 1);
        const rel = sub(this.sys.posAt(b!, t), this.sys.posAt(b!.parent!, t)), v = sceneVec(rel);
        pts[k * 3] = v.x; pts[k * 3 + 1] = v.y; pts[k * 3 + 2] = v.z; ph[k] = k / (N - 1);
      }
      const { segs, ph: sp } = orbitSegments(pts, false, ph);
      const set = new LineSet(segs, sp, { color: new THREE.Color(1.0, 0.72, 0.32).multiplyScalar(0.55), width: 1.3, opacity: 1, trail: false });
      set.mesh.matrixAutoUpdate = false; this.scene.add(set.mesh);
      this.traj = { id: b!.id, built: jd, span, set };
    }
    const m = this.traj.set.mesh, pc = sub(b!.parent!.pos, cam);
    m.visible = true; this.traj.set.setOrigin(pc[0], pc[2], -pc[1]);
    const U = this.traj.set.U; U.viewport.value.set(this.W, this.H); U.opacity.value = 0.8 * (this.settings.get('orbitOpacity') as number);
    U.body.value.copy(sceneVec(b!.rel)); U.bodyR.value = b!.radius; U.fadeNear.value = 1;
  }
  terrainStats: any = null;
  /** CPU ms per frame for terrain patch builds (QA harness raises it; interactive default 5 ms) */
  terrainBuildMs = 5;
  async loadTerrain(v: BodyView) {
    try {
      const id = v.b.def.terrain!, man = await loadJSON<TileManifest>(`terrain/${id}/tiles.json`);
      const fetchTile = async (L: number, r: number, c: number) => {
        const res = await fetchAsset(`terrain/${id}/t/${L}/${r}_${c}.i16z`);
        const buf = await new Response(res.body!.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        return new Int16Array(buf);
      };
      const budget = (this.settings.get('terrainBudgetMiB') as number ?? 256) * 2 ** 20;
      const pyr = new TilePyramid(man, fetchTile, budget);
      await pyr.warm();
      v.terrain = new TerrainBody(pyr, v.terrainMaterial ?? v.material!); this.scene.add(v.terrain.group); v.terrain.group.visible = false;
    } catch (e) { console.warn('terrain unavailable', v.b.id, e); }
  }
  /** Surface radius (km) under a body-fixed direction, including DEM relief when terrain is loaded. */
  groundRadius(b: Body, dirLocal: [number, number, number]) {
    const v = this.views.get(b.id); return v?.terrain ? v.terrain.refRadiusKm + v.terrain.heightKm(dirLocal) : Math.max(b.radii[0], b.radius);
  }
  /** v3.7 ring selector: smooth flight to a vantage point above a ring at radius r (sunward side, 25° above the plane,
   *  at a distance that frames ≈ 1.5 × the ring's local structure) — uses the existing goTo flight machinery. */
  flyToRing(b: Body, r: number) {
    const R = b.rot, sv = sub(this.sys.sun.pos, b.pos), sl = mulMtV(R, sv), s0 = Math.atan2(sl[1], sl[0]);
    const el = 25 * DEG, d = Math.max(r * 0.35, b.radius * 0.5);
    const at: V3 = [r * Math.cos(s0 + 0.5), r * Math.sin(s0 + 0.5), 0];
    const lp: V3 = [at[0] - d * Math.cos(el) * Math.cos(s0 + 0.5) * 0.3, at[1] - d * Math.cos(el) * Math.sin(s0 + 0.5) * 0.3, d * Math.sin(el)];
    const toE = (v: V3): V3 => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
    this.rig.flyToPoint(add(b.pos, toE(lp)), add(b.pos, toE(at)), b);
  }
  /** v3.7 ring-region label anchors: points on the ring plane at each labelled radius, on the ansa nearest the camera's
   *  right-hand side, alternating sides so narrow neighbours do not collide. */
  ringLabelAnchors(b: Body) {
    const def = RING_SYSTEMS[b.id]; if (!def) return [];
    const R = b.rot, cam = sub(this.rig.pos, b.pos), cl = mulMtV(R, cam);
    // in-plane unit vector perpendicular to the camera's projected direction (the ansa)
    let ax = -cl[1], ay = cl[0]; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
    return ringLabels(def).map((L, i) => { const s = i % 2 ? -1 : 1, p: V3 = [ax * L.r * s, ay * L.r * s, 0]; const e: V3 = [R[0] * p[0] + R[1] * p[1] + R[2] * p[2], R[3] * p[0] + R[4] * p[1] + R[5] * p[2], R[6] * p[0] + R[7] * p[1] + R[8] * p[2]]; return { key: `${b.id}-${i}`, label: L.name, pos: add(b.pos, e) }; });
  }
  /** Screen projection of a heliocentric ecliptic position (km) for DOM overlays. */
  project(pos: V3) {
    const rel = sub(pos, this.rig.pos), v = sceneVec(rel);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.rig.quat);
    tmpV.copy(v).applyMatrix4(this.camera.matrixWorldInverse).applyMatrix4(this.camera.projectionMatrix);
    return { x: (tmpV.x * 0.5 + 0.5) * this.W, y: (-tmpV.y * 0.5 + 0.5) * this.H, vis: v.dot(fwd) > 0 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05 };
  }
  /** Orbit landmarks of the selected body's drawn osculating conic (Phase 2b overlay): periapsis, apoapsis, nodes. */
  orbitLandmarks(b: Body): { key: string; label: string; pos: V3 }[] {
    const o = this.orbits.get(b.id); if (!o || !b.parent) return [];
    const el = o.el, e = o.open ? Math.max(el.e, 1.0001) : el.e, p = Math.abs(el.a) * Math.abs(1 - e * e);
    const at = (nu: number): V3 | null => { const d = 1 + e * Math.cos(nu); if (d <= 1e-6) return null; const r = p / d; const q = rotOrbit(r * Math.cos(nu), r * Math.sin(nu), el); const f = o.frame; return add(b.parent!.pos, [f[0] * q[0] + f[1] * q[1] + f[2] * q[2], f[3] * q[0] + f[4] * q[1] + f[5] * q[2], f[6] * q[0] + f[7] * q[1] + f[8] * q[2]]); };
    const peri = b.parent.kind === 'star' ? 'Perihelion' : b.parent.id === 'earth' ? 'Perigee' : 'Periapsis', apo = b.parent.kind === 'star' ? 'Aphelion' : b.parent.id === 'earth' ? 'Apogee' : 'Apoapsis';
    const out: { key: string; label: string; pos: V3 }[] = [];
    const push = (key: string, label: string, v: V3 | null) => { if (v) out.push({ key, label, pos: v }); };
    push('pe', peri, at(0)); if (!o.open) push('ap', apo, at(Math.PI));
    if (el.i > 1e-4 && Math.abs(el.i - Math.PI) > 1e-4) { push('an', 'Ascending node', at(-el.peri)); push('dn', 'Descending node', at(Math.PI - el.peri)); }
    return out;
  }
  /** Phase of a body on an open (hyperbolic) arc, normalised like conicPolyline's vertex phases. */
  private openPhase(o: { el: any; nuRange: [number, number] }, nu: number) {
    const e = Math.max(o.el.e, 1.0001); nu = Math.atan2(Math.sin(nu), Math.cos(nu));
    const m = (x: number) => trueToMeanFraction(x, e), a = m(o.nuRange[0]), b = m(o.nuRange[1]);
    return Math.max(0, Math.min(1, (m(nu) - a) / (b - a)));
  }
}
const sphereCache = new Map<number, THREE.BufferGeometry>();
/** Shared cube-sphere geometries per segment count (never disposed: at most four sizes exist). */
export function sphereLOD(seg: number) { let g = sphereCache.get(seg); if (!g) { g = cubeSphere(seg); sphereCache.set(seg, g); } return g; }
function rig_fov(e: Engine) { return e.rig.fov; }
function st(e: Engine, k: string) { return e.settings.get(k) as number; }
function blackTexture() { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat); t.needsUpdate = true; return t; }
function smooth(a: number, b: number, x: number) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function circleOverlap(r1: number, r2: number, d: number) {
  const a1 = r1 * r1 * Math.acos(Math.max(-1, Math.min(1, (d * d + r1 * r1 - r2 * r2) / (2 * d * r1))));
  const a2 = r2 * r2 * Math.acos(Math.max(-1, Math.min(1, (d * d + r2 * r2 - r1 * r1) / (2 * d * r2))));
  const a3 = 0.5 * Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  return a1 + a2 - a3;
}
export function orbitColor(b: Body) {
  const k = b.kind;
  // v3.3 palette: desaturated, near-neutral steel tones (guides are explanation, not glowing wires); planets carry a hint of their own colour
  if (k === 'planet') { const c = new THREE.Color(...b.def.color); return c.lerp(new THREE.Color(0.62, 0.72, 0.86), 0.7).multiplyScalar(0.8); }
  if (k === 'dwarf') return new THREE.Color(0.74, 0.68, 0.86).multiplyScalar(0.6);
  if (k === 'moon') return new THREE.Color(0.64, 0.74, 0.84).multiplyScalar(0.55);
  if (k === 'comet') return new THREE.Color(0.6, 0.82, 0.78).multiplyScalar(0.55);
  return new THREE.Color(0.84, 0.74, 0.62).multiplyScalar(0.55);
}
