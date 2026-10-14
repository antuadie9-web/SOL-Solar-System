// @ts-nocheck — TSL node graphs are dynamically typed
// WGSL helper library (raw WebGPU shading code wrapped as TSL native functions).
import { wgslFn } from 'three/tsl';

// Fraction of the solar disc visible from point p, past one spherical occluder (circle–circle overlap of angular discs).
export const eclipseVis = wgslFn(`
fn eclipseVis(p: vec3<f32>, sunPos: vec3<f32>, sunR: f32, occ: vec4<f32>) -> f32 {
  if (occ.w <= 0.0) { return 1.0; }
  let ts = sunPos - p; let ds = length(ts); let sd = ts / ds;
  let to = occ.xyz - p; let dO = length(to);
  if (dO >= ds || dot(to, sd) <= 0.0 || dO <= occ.w) { return 1.0; }
  let od = to / dO;
  let d = atan2(length(cross(sd, od)), dot(sd, od));
  let rs = atan(sunR / ds);
  let ro = asin(min(occ.w / dO, 1.0));
  if (d >= rs + ro) { return 1.0; }
  if (d <= ro - rs) { return 0.0; }
  if (d <= rs - ro) { return 1.0 - (ro * ro) / (rs * rs); }
  let r1 = rs; let r2 = ro;
  let a1 = r1 * r1 * acos(clamp((d * d + r1 * r1 - r2 * r2) / (2.0 * d * r1), -1.0, 1.0));
  let a2 = r2 * r2 * acos(clamp((d * d + r2 * r2 - r1 * r1) / (2.0 * d * r2), -1.0, 1.0));
  let a3 = 0.5 * sqrt(max((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2), 0.0));
  return clamp(1.0 - (a1 + a2 - a3) / (3.14159265 * r1 * r1), 0.0, 1.0);
}`);

// Sun-disc visibility through up to four occluders, with a reddened umbral glow for occluders that have an atmosphere (w<0 flag in o.y trick avoided: separate glow factor)
export const shadowAll = wgslFn(`
fn shadowAll(p: vec3<f32>, sunPos: vec3<f32>, sunR: f32, o0: vec4<f32>, o1: vec4<f32>, o2: vec4<f32>, o3: vec4<f32>) -> f32 {
  return eclipseVis(p, sunPos, sunR, o0) * eclipseVis(p, sunPos, sunR, o1) * eclipseVis(p, sunPos, sunR, o2) * eclipseVis(p, sunPos, sunR, o3);
}`, [eclipseVis]);

// Atmospheric transmittance toward the Sun for a surface point (Kasten–Young air mass, per-channel vertical optical depth).
export const sunTransmit = wgslFn(`
fn sunTransmit(mu0: f32, tau: vec3<f32>) -> vec3<f32> {
  let zen = degrees(acos(clamp(mu0, -1.0, 1.0)));
  let am = 1.0 / (max(mu0, 0.0) + 0.50572 * pow(max(96.07995 - zen, 0.3), -1.6364));
  return exp(-tau * min(am, 40.0));
}`);

// Ring shadow cast on the planet: opacity of the ring where the ray toward the Sun crosses the equatorial plane (z=0 local).
export const ringShadowUV = wgslFn(`
fn ringShadowUV(p: vec3<f32>, l: vec3<f32>, rin: f32, rout: f32) -> f32 {
  if (abs(l.z) < 1e-5) { return -1.0; }
  let t = -p.z / l.z;
  if (t <= 0.0) { return -1.0; }
  let q = p + l * t; let r = length(q.xy);
  return (r - rin) / (rout - rin);
}`);

// Lunar–Lambert photometric function (McEwen 1991): blends Lommel–Seeliger and Lambert by phase angle.
export const lunarLambert = wgslFn(`
fn lunarLambert(mu0: f32, mu: f32, phaseDeg: f32, lambertBias: f32) -> f32 {
  let a = phaseDeg;
  var L = 1.0 - 0.019 * a + 0.000242 * a * a - 0.00000146 * a * a * a;
  L = clamp(mix(L, 0.0, lambertBias), 0.0, 1.0);
  let m0 = max(mu0, 0.0); let m = max(mu, 0.0);
  let surge = 1.0 + 0.35 * exp(-a / 4.0);
  return ((1.0 - L) * m0 + 2.0 * L * m0 / (m0 + m + 1e-4)) * surge;
}`);

// GGX specular (sun glint on oceans & lakes)
export const ggxSpec = wgslFn(`
fn ggxSpec(n: vec3<f32>, v: vec3<f32>, l: vec3<f32>, rough: f32, f0: f32) -> f32 {
  let h = normalize(v + l);
  let nh = max(dot(n, h), 0.0); let nl = max(dot(n, l), 0.0); let nv = max(dot(n, v), 1e-3); let vh = max(dot(v, h), 0.0);
  let a2 = rough * rough * rough * rough;
  let dd = nh * nh * (a2 - 1.0) + 1.0;
  let D = a2 / (3.14159265 * dd * dd);
  let k = rough * rough * 0.5;
  let G = (nl / (nl * (1.0 - k) + k)) * (nv / (nv * (1.0 - k) + k));
  let F = f0 + (1.0 - f0) * pow(1.0 - vh, 5.0);
  return D * G * F / (4.0 * nv + 1e-4);
}`);

// Seam-free equirectangular UV from a body-fixed unit direction (u east-positive, 0° at u = 0.5)
export const equirect = wgslFn(`
fn equirect(d: vec3<f32>) -> vec2<f32> {
  let lon = atan2(d.y, d.x);
  let lat = asin(clamp(d.z, -1.0, 1.0));
  return vec2<f32>(lon * 0.15915494 + 0.5, lat * 0.31830989 + 0.5);
}`);

// Hash & value noise (3D) for procedural surfaces, granulation and particles
export const noiseLib = wgslFn(`
fn hash31(p: vec3<f32>) -> f32 {
  var q = fract(p * 0.1031); q += dot(q, q.zyx + 31.32); return fract((q.x + q.y) * q.z);
}`);
export const vnoise = wgslFn(`
fn vnoise(p: vec3<f32>) -> f32 {
  let i = floor(p); let f = fract(p); let u = f * f * (3.0 - 2.0 * f);
  let n000 = hash31(i); let n100 = hash31(i + vec3<f32>(1.0, 0.0, 0.0)); let n010 = hash31(i + vec3<f32>(0.0, 1.0, 0.0)); let n110 = hash31(i + vec3<f32>(1.0, 1.0, 0.0));
  let n001 = hash31(i + vec3<f32>(0.0, 0.0, 1.0)); let n101 = hash31(i + vec3<f32>(1.0, 0.0, 1.0)); let n011 = hash31(i + vec3<f32>(0.0, 1.0, 1.0)); let n111 = hash31(i + vec3<f32>(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z);
}`, [noiseLib]);
export const fbm = wgslFn(`
fn fbm(p: vec3<f32>, oct: i32) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var k = 0; k < oct; k++) { s += a * vnoise(q); q = q * 2.03 + vec3<f32>(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}`, [vnoise]);
// Crater field (Voronoi-ish): returns height contribution and rim
export const craters = wgslFn(`
fn craters(p: vec3<f32>, scale: f32) -> f32 {
  let q = p * scale; let i = floor(q); let f = fract(q);
  var h = 0.0;
  for (var z = -1; z <= 1; z++) { for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let o = vec3<f32>(f32(x), f32(y), f32(z));
    let c = i + o; let r = hash31(c);
    if (r > 0.55) { continue; }
    let cp = o + vec3<f32>(hash31(c + 3.1), hash31(c + 7.7), hash31(c + 13.3)) - f;
    let rad = 0.25 + 0.45 * hash31(c + 21.0);
    let d = length(cp) / rad;
    if (d < 1.6) {
      let bowl = d * d - 1.0;
      let rim = 0.35 * exp(-pow((d - 1.0) * 5.0, 2.0));
      // v3.8.1 AST-381-03/04: continuous at the rim crest (d = 1). Until v3.8.1 the outer branch was rim·0.6, a step of
      // 0.14·rad in height exactly on the rim; screen-derivative bump mapping turned that step into the dotted crater
      // outlines seen on every procedural surface (reconstructions, small moons). Same rim height (0.35), same bowl.
      h += select(rim, bowl * 0.6 + rim, d < 1.0) * rad;
    }
  }}}
  return h;
}`, [noiseLib]);
