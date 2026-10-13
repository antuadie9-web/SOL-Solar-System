// @ts-nocheck — TSL node graphs are dynamically typed
// Surface material for every resolved body. All lighting is evaluated in the body-fixed frame (km),
// with uniforms prepared in double precision on the CPU, so shading is stable at any distance.
import * as THREE from 'three/webgpu';
import {
  textureSize, int,
  Fn, uniform, texture, positionLocal, normalLocal, vec2, vec3, vec4, float, normalize, dot, max, min, mix, smoothstep, clamp, exp, pow,
  dFdx, dFdy, length, cross, abs, sign, select, If, varying, wgslFn, acos, sin, cos, sqrt, fwidth, attribute,
  sampler,
} from 'three/tsl';
import { eclipseVis, shadowAll, sunTransmit, ringShadowUV, lunarLambert, ggxSpec, equirect, fbm, craters, vnoise } from './shaderlib';
import type { BodyDef } from '../data/catalog';
import { SURFACE_INDEX, type BodyVisualProfile } from './identity';
import { transmittanceUVw, viewTransmittance } from './atmosphere';

const TDBG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('qa-tdbg') === '1';
export interface SurfaceUniforms {
  sunPos: any; sunR: any; irr: any; cam: any; radii: any; occ: any[]; tau: any; ringIn: any; ringOut: any; ringOn: any;
  albedoScale: any; markUnknown: any; recAlbedo: any; time: any; occGlow: any; nightGain: any; cloudOn: any; exposure?: any; seeThrough: any;
  /** v3.5 secondary illumination (planetshine): direction to the shining neighbour (body-fixed, unit) and its
   *  irradiance (rgb, SOL irradiance units, pre-exposed). PHYSICAL — e.g. earthshine on the Moon, Saturnshine on its moons. */
  shineDir: any; shineIrr: any;
  /** v3.5 labelled inspection fill (Exploration/Cinematic only): level = fraction of the local solar irradiance,
   *  pre-exposed; applied only beyond the terminator. NOT sunlight — the UI labels it whenever it is active. */
  inspect: any;
}
export type SurfaceKind = 'rocky' | 'earth' | 'gas' | 'icy' | 'venus' | 'procedural' | 'haze';

// Mikkelsen-style surface-gradient bump from screen-space derivatives
const bumpNormal = wgslFn(`
fn bumpNormal(n: vec3<f32>, dpx: vec3<f32>, dpy: vec3<f32>, dhx: f32, dhy: f32) -> vec3<f32> {
  let r1 = cross(dpy, n); let r2 = cross(n, dpx); let det = dot(dpx, r1);
  let g = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - g);
}`);
const tangentNormal = wgslFn(`
fn tangentNormal(n: vec3<f32>, t: vec3<f32>, strength: f32) -> vec3<f32> {
  let east = normalize(vec3<f32>(-n.y, n.x, 0.0) + vec3<f32>(1e-6, 0.0, 0.0));
  let north = cross(n, east);
  let tt = vec3<f32>((t.xy * 2.0 - 1.0) * strength, max(t.z * 2.0 - 1.0, 0.05));
  return normalize(east * tt.x + north * tt.y + n * tt.z);
}`);
// v3.6 terrain horizon-map shadow: horizon elevation (rad) in 8 azimuths from local north, interpolated at the Sun's
// azimuth; penumbra over the solar disc's angular radius `sunRad` (rad). 1 = lit, 0 = Sun fully below the local horizon.
const horizonShadow = wgslFn(`
fn horizonShadow(h0: vec4<f32>, h1: vec4<f32>, up: vec3<f32>, l: vec3<f32>, sunRad: f32) -> f32 {
  let el = max(length(up.xy), 1e-6);
  let east = vec3<f32>(-up.y / el, up.x / el, 0.0);
  let north = cross(up, east);
  let az = atan2(dot(l, east), dot(l, north));
  let f = (az / 0.785398163 + 8.0) % 8.0;
  let i0 = i32(floor(f)) % 8; let i1 = (i0 + 1) % 8; let w = fract(f);
  var hz = array<f32, 8>(h0.x, h0.y, h0.z, h0.w, h1.x, h1.y, h1.z, h1.w);
  let hor = mix(hz[i0], hz[i1], w);
  let sunEl = asin(clamp(dot(l, up), -1.0, 1.0));
  return smoothstep(hor - sunRad, hor + sunRad, sunEl);
}`);
const minnaert = wgslFn(`
fn minnaert(mu0: f32, mu: f32, k: f32) -> f32 {
  let m0 = max(mu0, 0.0); let m = max(mu, 0.02);
  return pow(m0, k) * pow(m, k - 1.0);
}`);
const proceduralAlbedo = wgslFn(`
fn proceduralAlbedo(p: vec3<f32>, tint: vec3<f32>, spot: vec3<f32>, seed: f32, craterAmt: f32) -> vec4<f32> {
  let q = p + vec3<f32>(seed * 1.37, seed * 0.71, seed * 2.13);
  let large = fbm(q * 1.6, 5);
  let fine = fbm(q * 9.0, 4);
  let cr = craters(q, 3.0) * craterAmt + craters(q * 2.7, 3.0) * 0.5 * craterAmt + craters(q * 7.3, 3.0) * 0.25 * craterAmt;
  var c = tint * (0.78 + 0.45 * (large - 0.5) + 0.18 * (fine - 0.5) - 0.12 * cr);
  // a large albedo feature for bodies with a known spot (Haumea's red spot, Umbriel's Wunda)
  let sp = smoothstep(0.82, 0.95, dot(normalize(p), normalize(vec3<f32>(0.7, 0.3, 0.2))));
  c = mix(c, spot, sp * select(0.0, 1.0, spot.x > 0.0));
  let h = cr * 0.6 + (large - 0.5) * 0.8 + (fine - 0.5) * 0.15;
  return vec4<f32>(max(c, vec3<f32>(0.0)), h);
}`, [fbm, craters]);

// v3.3 surface families (spec §8): distinct geological generators selected by BodyVisualProfile, replacing the single
// shared fBm+crater recipe. All are evaluated in 3-D body-fixed space (no UVs needed → works on UV-less shape models and
// has no seams or polar pinching). Returns (albedo rgb, relative height for bump shading).
const familySurface = wgslFn(`
fn familySurface(p: vec3<f32>, tint: vec3<f32>, spot: vec3<f32>, seed: f32, craterAmt: f32, fam: f32, fp: f32, rkm: f32) -> vec4<f32> {
  // fp = pixel footprint on the unit body: fade each octave before it aliases (no sparkle/speckle at distance)
  let bl9 = smoothstep(0.5, 0.12, fp * 9.0); let bl34 = smoothstep(0.5, 0.12, fp * 34.0); let bl71 = smoothstep(0.5, 0.12, fp * 71.0);
  let f = i32(fam + 0.5);
  let q = p + vec3<f32>(seed * 0.00137, seed * 0.00071, seed * 0.00213);
  let large = fbm(q * 1.6, 5);
  let fine = mix(0.5, fbm(q * 9.0, 4), bl9);
  let cr = craters(q, 3.0) * craterAmt + craters(q * 2.7, 3.0) * 0.5 * craterAmt + craters(q * 7.3, 3.0) * 0.25 * craterAmt * smoothstep(0.5, 0.12, fp * 22.0);
  var c = tint * (0.78 + 0.45 * (large - 0.5) + 0.18 * (fine - 0.5) - 0.12 * cr);
  var h = cr * 0.6 + (large - 0.5) * 0.8 + (fine - 0.5) * 0.15;
  if (f == 2) {
    // icy tectonic: two families of lineae/grooves, warped, strongest in "corona" provinces; sparse fresh craters
    let w = fbm(q * 3.0, 3) * 2.0;
    let l1 = abs(sin(dot(q, vec3<f32>(0.8, 0.5, 0.3)) * 26.0 + w * 3.0));
    let l2 = abs(sin(dot(q, vec3<f32>(-0.3, 0.7, 0.6)) * 41.0 + w * 2.0));
    let prov = smoothstep(0.42, 0.62, large);
    let grooves = (smoothstep(0.88, 1.0, 1.0 - l1) + 0.6 * smoothstep(0.93, 1.0, 1.0 - l2)) * (0.35 + 0.65 * prov);
    c = tint * (0.97 + 0.12 * (large - 0.5) + 0.05 * (fine - 0.5)) * (1.0 - 0.28 * grooves * vec3<f32>(0.9, 1.0, 1.1)) - 0.05 * cr * tint;
    h = grooves * 0.45 + cr * 0.18 + (large - 0.5) * 0.25;
  } else if (f == 3) {
    // dark carbonaceous rubble: boulder speckle (bright & dark clasts), smooth fine-gravel ponds in lows
    // v3.8 DEF-38-007: the clast speckle at 34/71 cells per radius is a boulder field only on km-sized rubble piles
    // (Bennu, Ryugu, Itokawa: boulders ≲ 100 m). On 75–210 km moons (Himalia, Puck, Larissa, Proteus) the same motif made
    // 4-km white blotches — the identical pattern on unrelated worlds the spec forbids. Clasts fade out between 3 and
    // 25 km radius; large dark bodies are regolith-mantled and crater-dominated (Phoebe, Cassini ISS: darker crater floors,
    // brighter fresh walls/rims exposing cleaner material — Porco et al. 2005).
    let cw = 1.0 - smoothstep(3.0, 25.0, rkm);
    let b1 = mix(0.2, smoothstep(0.66, 0.8, vnoise(q * 34.0)), bl34) * cw; let b2 = mix(0.15, smoothstep(0.7, 0.85, vnoise(q * 71.0 + 5.0)), bl71) * cw;
    let pond = smoothstep(0.42, 0.34, large);
    // v3.8 (session 3): rim brightening reduced 0.22 → 0.07 and floor darkening 0.10 → 0.06 — the first values drew
    // cartoon-like bright rings around every crater (wip9 Proteus/Larissa/Phoebe); Cassini Phoebe shows bright material on
    // crater WALLS, a few-% albedo modulation at body scale, not haloes.
    let rim = smoothstep(0.02, 0.14, cr) * (1.0 - cw);
    c = tint * (0.86 + 0.2 * (fine - 0.5) + 0.55 * b1 * (1.0 - pond) - 0.25 * b2 * (1.0 - pond) + (1.0 - cw) * (0.14 * (large - 0.5) - 0.06 * cr + 0.07 * rim));
    h = (b1 * 0.9 + b2 * 0.4) * (1.0 - pond) + cr * (0.35 + 0.3 * (1.0 - cw)) + (large - 0.5) * 0.6;
  } else if (f == 4) {
    // comet mantle: very dark dust plains vs. rough consolidated terrain; rare bright exposed-ice patches on scarps
    let rough = smoothstep(0.46, 0.56, large);
    let ice = smoothstep(0.84, 0.9, fbm(q * 14.0, 3)) * rough * bl9;
    c = tint * (0.82 + 0.3 * rough * (fine - 0.5)) + vec3<f32>(0.5, 0.52, 0.55) * ice * 0.35;
    h = rough * (fine - 0.3) * 0.8 + (large - 0.5) * 0.5;
  } else if (f == 5) {
    // volatile-rich dwarf: large coherent albedo provinces (bright N₂/CH₄ frost vs. dark-red tholin units)
    let m = smoothstep(0.4, 0.6, fbm(q * 1.15, 4));
    var dark = tint * vec3<f32>(0.72, 0.52, 0.42);
    if (spot.x > 0.0) { dark = spot; }
    c = mix(dark, min(tint * 1.08, vec3<f32>(1.0)), m) * (0.96 + 0.08 * (fine - 0.5)) - 0.04 * cr * tint;
    h = (large - 0.5) * 0.35 + cr * 0.12;
  } else if (f == 6) {
    // metal-rich: patchy bright/dark units, crisp small craters
    let pch = smoothstep(0.45, 0.6, fbm(q * 4.0, 4));
    c = tint * (0.82 + 0.28 * pch + 0.12 * (fine - 0.5) - 0.1 * cr);
  } else if (f == 7) {
    // sponge-like porous ice (Hyperion): saturated deep pits with dark lag deposits on their floors
    let pits = craters(q * 1.0, 6.0) + craters(q * 1.9, 6.0) * 0.7;
    let floorDark = smoothstep(-0.02, -0.18, pits);
    c = tint * (1.0 - 0.6 * floorDark) * (0.95 + 0.1 * (fine - 0.5));
    h = pits * 1.2 + (large - 0.5) * 0.4;
  } else if (f == 8) {
    // red silicate / organics: saturated reddish, smoother with subtle mottling
    c = tint * (0.86 + 0.24 * (large - 0.5) + 0.08 * (fine - 0.5) - 0.06 * cr);
    h = (large - 0.5) * 0.6 + cr * 0.3;
  } else if (f == 9) {
    // v3.7.1 mantled ice (Saturnian ring moons, Trojans, Alkyonides): fine E-ring/ring-particle mantle — very low albedo
    // contrast, craters buried and softened, broad smooth ponds; relief dominated by long wavelengths (Cassini ISS)
    c = tint * (0.97 + 0.07 * (large - 0.5) + 0.03 * (fine - 0.5) - 0.03 * cr);
    h = (large - 0.5) * 0.5 + cr * 0.12;
  } else if (f == 10) {
    // v3.7.1 cratered ice (Janus, Epimetheus, Nix…): bright water ice with sharp craters, slightly darker crater floors and
    // brighter fresh rims/walls; less colour contrast than rock
    let rim = smoothstep(0.02, 0.12, cr);
    c = tint * (0.93 + 0.1 * (large - 0.5) + 0.06 * (fine - 0.5) - 0.07 * cr + 0.05 * rim);
    h = cr * 0.55 + (large - 0.5) * 0.45 + (fine - 0.5) * 0.1;
  }
  let sp = smoothstep(0.82, 0.95, dot(normalize(p), normalize(vec3<f32>(0.7, 0.3, 0.2))));
  if (f != 5) { c = mix(c, spot, sp * select(0.0, 1.0, spot.x > 0.0)); }
  return vec4<f32>(max(c, vec3<f32>(0.0)), h);
}`, [fbm, craters, vnoise]);

export function makeSurfaceMaterial(def: BodyDef, kind: SurfaceKind, maps: { color?: THREE.Texture; normal?: THREE.Texture; night?: THREE.Texture; clouds?: THREE.Texture; ocean?: THREE.Texture; ring?: THREE.Texture; recon?: THREE.Texture; reconW?: THREE.Texture; mask?: THREE.Texture }, profile?: BodyVisualProfile,
  /** v3.6: `terrainAttr` = geometry is patch-local (terrain tiles); shading reads the body-fixed `bodyPos` attribute.
   *  `U` = share the uniforms of the body's sphere material (one set of lighting state per body). */
  /** `atmo` (v3.6): transmittance LUT + ground skylight table of the body's atmosphere (render/atmoModel.ts) */
  opts: { U?: SurfaceUniforms; terrainAttr?: boolean; atmo?: { T: THREE.Texture; sky: THREE.Texture; Rg: number; Rt: number } } = {}) {
  const U: SurfaceUniforms = opts.U ?? {
    sunPos: uniform(new THREE.Vector3(1e9, 0, 0)), sunR: uniform(695700), irr: uniform(1), cam: uniform(new THREE.Vector3()), radii: uniform(new THREE.Vector3(1, 1, 1)),
    occ: [0, 1, 2, 3].map(() => uniform(new THREE.Vector4(0, 0, 0, 0))), tau: uniform(new THREE.Vector3(0, 0, 0)),
    ringIn: uniform(0), ringOut: uniform(1), ringOn: uniform(0), markUnknown: uniform(1), recAlbedo: uniform(def.albedo), albedoScale: uniform(1), time: uniform(0), nightGain: uniform(1), cloudOn: uniform(1), seeThrough: uniform(0), occGlow: uniform(0),
    shineDir: uniform(new THREE.Vector3(0, 0, 1)), shineIrr: uniform(new THREE.Vector3(0, 0, 0)), inspect: uniform(0),
  };
  const m = new THREE.MeshBasicNodeMaterial();
  const tint = vec3(def.color[0], def.color[1], def.color[2]);
  // the procedural generator follows the body's visual profile (family, seed from its id); v3.2's per-def seed is kept
  // only as a tint/spot source
  const fam = profile && profile.surface !== 'mapped' ? SURFACE_INDEX[profile.surface] : 1;
  const proc = def.procedural || (profile && profile.surface !== 'mapped' && !maps.color) ? { seed: profile?.seed ?? def.procedural!.seed, craters: profile?.craterDensity ?? def.procedural!.craters, rough: profile?.roughness ?? def.procedural!.rough, tint: def.procedural?.tint, spot: def.procedural?.spot } : undefined;
  m.colorNode = Fn(() => {
    const pUnit = opts.terrainAttr ? attribute('bodyPos', 'vec3') : positionLocal;   // unit-sphere / shape-model coords (scaled by mesh.scale); terrain: body-fixed / R0
    const p = pUnit.mul(U.radii);                      // km, body-fixed
    const ng = (def.model || def.terrain) ? normalize(normalLocal) : normalize(pUnit.div(U.radii));          // shape-model or ellipsoid normal
    const dirLocal = normalize(pUnit);
    const v = normalize(U.cam.sub(p));
    const l = normalize(U.sunPos.sub(p));
    const uvA = equirect({ d: dirLocal });
    // seam-free gradients (Tarini)
    const uB = uvA.x.add(0.5).fract();
    const dxA = dFdx(uvA), dyA = dFdy(uvA), dxB = dFdx(uB), dyB = dFdy(uB);
    const gx = vec2(select(abs(dxA.x).lessThan(abs(dxB)), dxA.x, dxB), dxA.y);
    const gy = vec2(select(abs(dyA.x).lessThan(abs(dyB)), dyA.x, dyB), dyA.y);
    const samp = (t: THREE.Texture) => texture(t, uvA).grad(gx, gy);
    let albedo: any = tint.mul(U.albedoScale), n: any = ng, height: any = float(0);
    let noData: any = float(0), reconW: any = float(0), reconC: any = vec3(0);
    if (maps.color) {
      const c0 = samp(maps.color).rgb;
      albedo = c0.mul(U.albedoScale);
      // unobserved map regions (pure black in the source mosaic): flag them so they are never shown as real terrain
      if (def.noData) {
        // v3.8.1 cp2 (AST-381-01c): the observed→unobserved boundary is a step from albedo ≈ 0.1 to 0; bilinear filtering
        // passes through dark intermediate values that the threshold did not catch, which drew a thin black seam. The mask is
        // now the max over the texel's four half-texel neighbours, so the reconstruction covers the interpolation zone.
        const Y = (c: any) => dot(c, vec3(0.2126, 0.7152, 0.0722)), th = def.noData.threshold;
        // texel size from the BOUND image at draw time (the texture starts as a 1×1 placeholder and is swapped when it streams)
        const tsz = vec2(textureSize(texture(maps.color), int(0))), tw = float(1).div(tsz.x), tht = float(1).div(tsz.y);
        const m0 = smoothstep(th * 1.6, th, Y(c0));
        const mk = (dx: number, dy: number) => smoothstep(th * 1.6, th, Y(texture(maps.color, uvA.add(vec2(tw.mul(dx), tht.mul(dy)))).grad(gx, gy).rgb));
        noData = max(max(m0, max(mk(0.6, 0), mk(-0.6, 0))), max(mk(0, 0.6), mk(0, -0.6)));
        if (maps.mask) {
          // v3.8.1 AST-381-03 iteration 4: data mask at the colour map's own resolution, filtered identically — normalised
          // filtering c/m recovers the true observed colour at edge texels (no dark outline from black neighbours) and m
          // itself is the exact fractional coverage, so the observed→reconstruction hand-over spans one filtered texel
          const mm = samp(maps.mask).r;
          albedo = c0.div(max(mm, 0.02)).mul(U.albedoScale);
          noData = max(smoothstep(0.98, 0.5, mm), m0);   // m0: true black while the mask is still its white placeholder
        }
        if (maps.recon) {
          // v3.8.1 AST-381-03 (owner review REV2-02): guide field — R = smooth reconstruction weight (0 on every observed
          // pixel), G = low-frequency observed albedo carried into the gap (tools/ingest/partial_recon.py)
          // iteration 2: colour guide (sRGB texture → linear) + separate smooth weight
          reconC = texture(maps.recon, uvA).grad(gx, gy).rgb;
          reconW = maps.reconW ? texture(maps.reconW, uvA).grad(gx, gy).r : float(0);
          noData = max(noData, reconW);
        }
      }
    }
    if (proc) {
      const sp = proc.spot ?? [0, 0, 0], pt = proc.tint ?? def.color;
      const pa = familySurface({ p: (def.model ? positionLocal : dirLocal).mul(1.0), tint: vec3(pt[0], pt[1], pt[2]), spot: vec3(sp[0], sp[1], sp[2]), seed: float(proc.seed), craterAmt: float(proc.craters), fam: float(fam), fp: length(fwidth(dirLocal)), rkm: float(profile?.radiusKm ?? def.radius) });
      albedo = maps.color ? albedo : pa.rgb.mul(U.albedoScale);
      height = pa.w.mul(proc.rough * 0.04 + 0.01);
      if (def.model && (fam === 10 || fam === 3 || fam === 9)) {
        // v3.8.1 AST-381-04 (owner review REV2-03): on an OBSERVED shape model the long-wavelength relief is the model itself,
        // so the procedural fBm relief is dropped and only sub-resolution craters are added — four octaves (cells 3…59 per
        // radius, i.e. the shape model's ≈2 km resolution down to ≈0.5 km), equal weight per octave so the cumulative
        // size–frequency slope is the saturation-equilibrium −2, with a depth/diameter of 0.12 (degraded simple craters on
        // icy satellites) or 0.04 for the ring-particle-mantled moons (fam 9: Pan, Atlas, Daphnis, Telesto, Calypso, Helene).
        // v3.4–cp2 used the generic recipe whose craters came out at d/D ≈ 0.004 — 30× too shallow to shade: "clay".
        // Individual craters are synthetic (REPRESENTATIVE); the population statistics are what is constrained.
        const qq = positionLocal.add(vec3(proc.seed * 0.00137, proc.seed * 0.00071, proc.seed * 0.00213)), fpx = length(fwidth(dirLocal));
        let crs: any = float(0);
        // mantled moons: the fine octaves are buried by the ring-particle mantle (Pan/Atlas/Telesto/Calypso/Helene: smooth at Cassini resolution)
        for (const sc of (fam === 9 ? [1, 2.7] : [1, 2.7, 7.3, 19.7])) crs = crs.add(craters({ p: qq.mul(sc), scale: float(3) }).div(3 * sc).mul(smoothstep(0.35, 0.12, fpx.mul(3 * sc))));
        const dD = fam === 9 ? 0.04 : fam === 3 ? 0.10 : 0.12;
        height = crs.mul(dD / 0.3);
      }
      if (def.noData) height = height.mul(noData);     // procedural relief only where the map has no data (soft weight with a guide field)
      // screen-derivative bump, limited so that no normal tilts by more than ~35° from the geometric normal (v3.3: the
      // unbounded version produced black pixel speckles on crater rims at 2×2-quad derivative granularity)
      const nb = bumpNormal({ n: ng, dpx: dFdx(dirLocal), dpy: dFdy(dirLocal), dhx: dFdx(height), dhy: dFdy(height) });
      n = normalize(mix(ng, nb, float(0.65).mul(smoothstep(0.55, 0.85, dot(nb, ng)).mul(0.6).add(0.4))));
    }
    if (def.noData && proc) {
      // labelled reconstruction: procedural terrain at the body's mean albedo, with a faint 10° graticule so the
      // unobserved hemisphere is unmistakable (U.markUnknown → 0 hides the graticule, never the substitution)
      const lat = uvA.y.mul(180), lon = uvA.x.mul(360);
      const tl = Math.max(0.05, 0.2126 * def.color[0] + 0.7152 * def.color[1] + 0.0722 * def.color[2]);
      let grid: any = max(smoothstep(0.35, 0.0, abs(lat.mod(10).sub(5)).sub(4.65)), smoothstep(0.35, 0.0, abs(lon.mod(10).sub(5)).sub(4.65))).mul(U.markUnknown).mul(0.35);
      const pr = proceduralAlbedo({ p: dirLocal, tint: vec3(def.color[0], def.color[1], def.color[2]), spot: vec3(0, 0, 0), seed: float(proc.seed), craterAmt: float(proc.craters) }).rgb.mul(1 / tl / 0.78);
      let rec: any = pr.mul(U.recAlbedo);
      if (maps.recon) {
        // regional albedo continues from the observed side (guide G, calibrated exactly like observed pixels); procedural
        // detail only modulates it, at the observed map's own small-scale relative contrast; the graticule label starts
        // inside the gap so the boundary itself is not outlined (the label is never removed: U.markUnknown)
        // regional COLOUR from the guide (calibrated like observed pixels), modulated by procedural structure at the observed
        // map's own measured contrast: mid scale (1°–6°, fBm) and fine scale (procedural albedo); both amplitudes come from
        // tools/ingest/partial_recon.py statistics, not from taste
        const kF = def.noData!.detail ?? 0.4, kM = def.noData!.mid ?? 0.3;
        const pn = dot(pr, vec3(0.2126, 0.7152, 0.0722));
        const mid = fbm({ p: dirLocal.mul(8.0).add(vec3(proc.seed * 0.01, 0, 0)), oct: int(4) }).mul(2).sub(1);
        rec = reconC.mul(U.albedoScale).mul(float(1).add(mid.mul(kM))).mul(float(1).add(pn.sub(1).mul(kF)));
        grid = grid.mul(smoothstep(0.5, 0.95, reconW));
      }
      albedo = mix(albedo, mix(rec, vec3(0.55, 0.62, 0.75).mul(U.recAlbedo), grid), noData);
    }
    if (maps.normal) n = tangentNormal({ n: ng, t: samp(maps.normal).rgb, strength: float(kind === 'earth' ? 1.0 : 1.4) });
    const mu0g = dot(ng, l), mu0 = dot(n, l), mu = dot(n, v);
    // phase angle (deg)
    const phase = acos(clamp(dot(l, v), -1, 1)).mul(57.29578);
    // shadows: eclipses by other bodies + ring shadow
    let vis: any = shadowAll({ p, sunPos: U.sunPos, sunR: U.sunR, o0: U.occ[0], o1: U.occ[1], o2: U.occ[2], o3: U.occ[3] });
    if (opts.terrainAttr) {
      // angular radius of the Sun from the body: R☉ / |sunPos| (≈ 0.27° Moon, 0.18° Mars)
      const sunRad = U.sunR.div(length(U.sunPos));
      vis = vis.mul(horizonShadow({ h0: attribute('hz0', 'vec4'), h1: attribute('hz1', 'vec4'), up: dirLocal, l, sunRad: sunRad.max(0.002) }));
    }
    if (maps.ring) {
      const rt = ringShadowUV({ p, l, rin: U.ringIn, rout: U.ringOut });
      // v3.7: ring shadow from the ring system's total normal optical depth along the slanted sunlight path, exp(−τ/|l_z|)
      // (v3.6 and earlier: 0.92 × the colour map's alpha, i.e. an arbitrary opacity, and Saturn only)
      const ring = texture(maps.ring, vec2(clamp(rt, 0.001, 0.999), 0.5));
      const inRing = rt.greaterThan(0).and(rt.lessThan(1));
      vis = vis.mul(select(inRing, exp(ring.r.negate().div(max(abs(l.z), 0.01))), float(1)));
    }
    // v3.6: sunlight reaching the ground from the transmittance LUT (exact spherical path through every layer, ozone in its
    // own layer); v3.5 used exp(−τ_vertical / μ0), which over-darkened and over-reddened grazing sunlight
    const AT = opts.atmo;
    const T = AT ? texture(AT.T, transmittanceUVw({ r: float(AT.Rg + 0.01), mu: mu0g, Rg: float(AT.Rg), Rt: float(AT.Rt) })).rgb : sunTransmit({ mu0: mu0g, tau: U.tau });
    // v3.6 diffuse skylight on the ground (∫ L_sky cos θ dω, per unit solar irradiance, vs solar zenith cosine), with the
    // sky-view factor of the tilted surface ½(1 + n·up); eclipses/ring shadow dim it with the direct light
    const skyE = AT ? texture(AT.sky, vec2(clamp(mu0g.add(0.2).div(1.2), 0, 1).mul(31 / 32).add(0.5 / 32), 0.5)).rgb : vec3(0, 0, 0);
    // light refracted through an occluder's atmosphere fills its umbra with a copper glow (lunar eclipses)
    const v0 = eclipseVis({ p, sunPos: U.sunPos, sunR: U.sunR, occ: U.occ[0] });
    const glow = vec3(1.0, 0.32, 0.1).mul(float(1).sub(v0)).mul(U.occGlow).mul(0.018);
    const sunL = T.mul(U.irr).mul(vec3(vis, vis, vis).add(glow));
    // terminator softening for the geometric horizon (sun's finite size & atmospheric refraction)
    const horizon = smoothstep(-0.01, 0.02, mu0g);
    let col: any;
    let shineAlb: any = albedo;   // reflectance seen by secondary light (Earth: clouds included)
    if (kind === 'gas' || kind === 'venus' || kind === 'haze') {
      const k = def.limb ?? (kind === 'venus' ? 0.86 : 0.9);
      col = albedo.mul(minnaert({ mu0, mu, k: float(k) })).mul(sunL).mul(horizon);
    } else if (kind === 'earth') {
      const ocean = maps.ocean ? texture(maps.ocean, uvA).grad(gx, gy).r : float(0);
      const land = albedo.mul(max(mu0, 0)).mul(float(1).sub(ocean.mul(0.15)));
      const spec = ggxSpec({ n: ng, v, l, rough: float(0.22), f0: float(0.02) }).mul(ocean).mul(max(mu0g, 0)).mul(0.9);
      let surf: any = land.add(vec3(spec, spec, spec));
      // clouds with ground shadows (layer ≈ 8 km), cast along the projected sun direction
      if (maps.clouds) {
        const c = samp(maps.clouds).r;
        const lt = l.sub(ng.mul(mu0g)).mul(float(10 / 6371).div(max(mu0g, 0.12)));
        const uvS = equirect({ d: normalize(dirLocal.add(lt)) });
        const cs = texture(maps.clouds, uvS).grad(gx, gy).r;
        surf = surf.mul(float(1).sub(cs.mul(0.55).mul(U.cloudOn)));
        const cl = float(0.92).mul(max(mu0g, 0).mul(0.82).add(pow(max(dot(l.negate(), v), 0), 6).mul(0.08)).add(max(mu0g, 0).mul(0.1)));
        surf = mix(surf, vec3(cl, cl, cl.mul(1.02)), c.mul(U.cloudOn));
        shineAlb = mix(albedo, vec3(0.92, 0.92, 0.94), c.mul(U.cloudOn));
      }
      col = surf.mul(sunL).mul(horizon);
      if (maps.night) {
        const nl = samp(maps.night).r;
        const dark = smoothstep(0.08, -0.12, mu0g);
        const cloudDim = maps.clouds ? float(1).sub(samp(maps.clouds).r.mul(0.75).mul(U.cloudOn)) : float(1);
        col = col.add(vec3(1.0, 0.72, 0.42).mul(pow(nl, 2.2)).mul(dark).mul(cloudDim).mul(U.nightGain));
      }
    } else {
      const bias = kind === 'icy' ? 0.45 : 0.0;
      const f = lunarLambert({ mu0, mu, phaseDeg: phase, lambertBias: float(bias) });
      col = albedo.mul(f).mul(sunL).mul(smoothstep(-0.02, 0.01, mu0g));
    }
    if (AT && kind !== 'gas' && kind !== 'venus' && kind !== 'haze') col = col.add(shineAlb.mul(skyE).mul(U.irr).mul(dot(n, dirLocal).mul(0.5).add(0.5)).mul(vis));
    // v3.8.1 ATM-381-01 (owner review REV2-04): twilight on thick-atmosphere cloud/haze tops. The deck sits INSIDE the
    // scattering haze (Venus: upper haze 70–90 km above the cloud top; Titan: the main haze), so it keeps receiving
    // diffuse light from the sunlit atmosphere above for several degrees past the geometric terminator. v3.6–cp2 gave
    // Venus/Titan no skylight at all, so the lit side ended in a cliff. The diffuse-irradiance LUT of the same physical
    // atmosphere (which already extends to μ0 = −0.2) supplies it — no new tuning constant.
    // iteration 2: only the twilight EXCESS beyond the geometric terminator — on the day side the deck's Minnaert
    // reflectance already contains its diffuse (multiply-scattered) light, so adding skylight there double-counted (+15 %)
    if (AT && (kind === 'venus' || kind === 'haze')) col = col.add(shineAlb.mul(skyE).mul(U.irr).mul(vis).mul(float(1).sub(smoothstep(-0.02, 0.1, mu0g))));
    // ── v3.5 secondary illumination: planetshine (physical, unshadowed approximation of a disc source) ──────────
    const ls = normalize(U.shineDir);
    const mus0 = dot(n, ls), musg = dot(ng, ls);
    const shinePhase = acos(clamp(dot(ls, v), -1, 1)).mul(57.29578);
    let shineF: any;
    if (kind === 'gas' || kind === 'venus' || kind === 'haze') shineF = minnaert({ mu0: mus0, mu, k: float(def.limb ?? 0.9) });
    else if (kind === 'earth') shineF = max(mus0, 0);
    else shineF = lunarLambert({ mu0: mus0, mu, phaseDeg: shinePhase, lambertBias: float(kind === 'icy' ? 0.45 : 0.0) });
    // an extended source (the parent planet spans tens of degrees from a close moon) wraps light past the
    // geometric horizon: soften the shine terminator over ~0.25 in μ (Lambert sphere of finite angular size)
    const shineWrap = smoothstep(-0.25, 0.15, musg);
    col = col.add(shineAlb.mul(U.shineIrr).mul(shineF.add(max(musg.add(0.25), 0).mul(0.12)).mul(shineWrap)));
    // ── v3.5 labelled inspection fill (Exploration/Cinematic; U.inspect = 0 in Scientific) ────────────────────
    // A soft key from the observer's side, tilted toward the body's north so relief reads, confined to the
    // unlit hemisphere and faded in across the terminator so the lit side is never brightened.
    const lf = normalize(v.add(vec3(0, 0, 0.45)));
    const muf = dot(n, lf);
    const fillF = (kind === 'gas' || kind === 'venus' || kind === 'haze') ? minnaert({ mu0: muf, mu, k: float(0.8) }).mul(0.6) : max(muf, 0).mul(0.75).add(0.25).mul(max(mu, 0).mul(0.5).add(0.5));
    // ATM-381-01: on thick atmospheres the labelled fill starts well past the twilight zone, so the natural twilight
    // fall-off is visible and the fill no longer leaves a dark trough right at the terminator ("hard terminator")
    // Venus/Titan: no inspection fill at all — their night sides hold nothing a fill could reveal (featureless deck), and
    // the fill made the night brighter than the twilight beside it: the "hard terminator" band (REV2-04)
    const night = (kind === 'venus' || kind === 'haze') ? float(0) : kind === 'gas' ? smoothstep(-0.12, -0.45, mu0g) : smoothstep(0.06, -0.22, mu0g);
    col = col.add(shineAlb.mul(U.inspect).mul(fillF).mul(night));
    // QA diagnostic (?qa-tdbg=1): terrain patches show R = direct-light visibility, G = μ0, B = 10 × skylight
    if (opts.terrainAttr && TDBG) return vec4(vis, max(mu0g, 0), skyE.r.mul(10), 1);
    // v3.7 ATM-005: per-channel transmittance from the surface to the camera (the atmosphere shell adds only in-scatter
    // over the disc) — red Martian ground stays red behind dust, Titan's surface is obscured per channel
    if (AT) {
      const rr = def.radii ?? [def.radius, def.radius, def.radius], nv = vec3(1, rr[0] / rr[1], rr[0] / rr[2]);
      col = col.mul(viewTransmittance({ p: p.mul(nv), c: U.cam.mul(nv), Rg: float(AT.Rg), Rt: float(AT.Rt), tT: texture(AT.T), tS: sampler(AT.T) }));
    }
    return vec4(col, 1);
  })();
  return { material: m, U };
}
