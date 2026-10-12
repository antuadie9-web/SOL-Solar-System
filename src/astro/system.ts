// The Solar System model: every resolved body with its ephemeris source, rotation and physical data.
import { resolveSmallMoon, classifyMoon, CLASS_PRIORS, SMALL_MOONS } from '../data/smallMoons';
import SAT_SIZES from '../data/satSizes.json';
import { AU, DEG, GAUSS_K, GM_SUN, J2000, TAU } from './constants';
import { V3, M3, add, sub, scale, len, cross, norm, dot, mulMV, mulMM, fromCols, rotZ } from './vec';
import { EQ2ECL, poleFrameEq } from './frames';
import { planetHelio } from './planets';
import { moonGeocentric } from './moon';
import { ROT, rotationMatrix, simpleRot, RotModel, earthRotation } from './rotation';
import { solveKepler, rotOrbit, Elements } from './kepler';
import { CATALOG, BodyDef, Kind } from '../data/catalog';
import { galileanEcl } from './galilean';
import { ofDateToJ2000 } from './precession';
import { SAMPLED } from './sampled';
import { propagate } from './twobody';
let _galJd = NaN, _gal: number[][] = [];
// E5 coordinates are in units of Jupiter's equatorial radius as adopted by Lieske's theory (71,398 km, Meeus ch. 44),
// referred to the mean ecliptic & equinox of date; precessed rigorously to J2000 (R-003, R-005 in docs/rnd-ledger.md).
const E5_RJ = 71398;
function galilean(jd: number, k: number): V3 {
  if (jd !== _galJd) { _gal = galileanEcl(jd); _galJd = jd; }
  const p = _gal[k];
  return ofDateToJ2000([p[0] * E5_RJ, p[1] * E5_RJ, p[2] * E5_RJ], jd);
}

export interface SatEl { name: string; code: number; planet: string; frame: string; epoch: number; a: number; e: number; w: number; M: number; i: number; node: number; P: number; Pw: number; Pn: number; lra?: number; ldec?: number; GM?: number; R?: number }
export interface Featured { n: string; c: string; ep: number; e: number; q: number; i: number; om: number; w: number; tp: number; a: number; ma: number; diameter?: string; albedo?: string; rot_per?: string; GM?: string; H?: string; extent?: string; pole?: string }

export class Body {
  def: BodyDef; id: string; name: string; kind: Kind;
  parent: Body | null = null; children: Body[] = [];
  pos: V3 = [0, 0, 0];          // heliocentric ecliptic J2000, km
  rel: V3 = [0, 0, 0];          // relative to parent (km)
  rot: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // body-fixed → ecliptic
  radius: number; radii: [number, number, number];
  GM: number; albedo: number;
  rotModel?: RotModel; synchronous = false;
  ephem: (jd: number) => V3 = () => [0, 0, 0];   // position relative to parent (or Sun)
  orbitEl: ((jd: number) => { el: Elements; frame: M3; mu: number; hyper?: boolean }) | null = null;
  H?: number; sbdbClass?: string; info: Record<string, string> = {};
  /** Which ephemeris tier produced the current position (shown in the inspector; see docs/science/ephemeris-tiers.md). */
  ephemTier: () => string = () => 'analytic';
  constructor(def: BodyDef) {
    this.def = def; this.id = def.id; this.name = def.name; this.kind = def.kind;
    this.radius = def.radius; this.radii = def.radii ?? [def.radius, def.radius, def.radius];
    this.GM = def.GM ?? 0; this.albedo = def.albedo;
    if (def.noData) this.info.mapCoverage = `${Math.round((1 - def.noData.fraction) * 100)} % observed — ${def.noData.note}`;
    // honesty label: [0, 90] is the catalogue's placeholder for an unknown spin axis
    if (def.pole && def.pole[0] === 0 && def.pole[1] === 90 && !def.rot) this.info.note = 'Spin-axis orientation unknown to SOL — placeholder (aligned with the celestial pole)';
  }
  get hasOrbit() { return !!this.orbitEl; }
}

const deg = (x: number) => x * DEG;
// Elliptic or hyperbolic heliocentric two-body motion from (q, e, i, Ω, ω, tp) — works for every conic.
export function conicPos(q: number, e: number, i: number, Om: number, w: number, tp: number, jd: number, mu = GM_SUN): V3 {
  const el = { a: 0, e, i: deg(i), node: deg(Om), peri: deg(w), M: 0 };
  const dt = (jd - tp) * 86400;
  if (e < 0.9999) {
    const a = q / (1 - e), n = Math.sqrt(mu / (a * a * a));
    const E = solveKepler(n * dt, e), cE = Math.cos(E), sE = Math.sin(E);
    return rotOrbit(a * (cE - e), a * Math.sqrt(1 - e * e) * sE, el);
  } else if (e > 1.0001) {
    const a = q / (e - 1), n = Math.sqrt(mu / (a * a * a)), M = n * dt;
    let H = Math.asinh(M / e);
    for (let k = 0; k < 80; k++) { const f = e * Math.sinh(H) - H - M, d = f / (e * Math.cosh(H) - 1); H -= d; if (Math.abs(d) < 1e-14) break; }
    return rotOrbit(a * (e - Math.cosh(H)), a * Math.sqrt(e * e - 1) * Math.sinh(H), el);
  }
  // parabolic (Barker)
  const W = 3 * Math.sqrt(mu / (2 * q * q * q)) * dt, Y = Math.cbrt(W + Math.sqrt(W * W + 1)), s = Y - 1 / Y;
  return rotOrbit(q * (1 - s * s), 2 * q * s, el);
}
// State vector → osculating elements (for drawing orbits that pass exactly through perturbed positions)
export function stateToElements(r: V3, v: V3, mu: number): Elements & { hyper: boolean } {
  const h = cross(r, v), rl = len(r), v2 = dot(v, v);
  const ev = sub(scale(cross(v, h), 1 / mu), scale(r, 1 / rl));
  const e = len(ev), energy = v2 / 2 - mu / rl, a = -mu / (2 * energy);
  const hn = len(h), i = Math.acos(Math.max(-1, Math.min(1, h[2] / hn)));
  const nv: V3 = [-h[1], h[0], 0], nl = Math.hypot(nv[0], nv[1]);
  const node = nl > 1e-12 ? Math.atan2(nv[1], nv[0]) : 0;
  let peri = 0;
  if (e > 1e-9) { peri = nl > 1e-12 ? Math.acos(Math.max(-1, Math.min(1, dot(nv, ev) / (nl * e)))) : Math.atan2(ev[1], ev[0]); if (ev[2] < 0) peri = TAU - peri; }
  let nu = e > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, dot(ev, r) / (e * rl)))) : 0; if (dot(r, v) < 0) nu = TAU - nu;
  let M = 0;
  if (e < 1) { const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2)); M = E - e * Math.sin(E); }
  return { a, e, i, node, peri, M, hyper: e >= 1 };
}

export interface OscStates { epochJdTdb: number; states: Record<string, { name: string; planet: string; r: V3; v: V3 }> }
// Sampled-track ids that differ from body ids
const SAMPLED_ID: Record<string, string> = { sat902: 'nix', sat903: 'hydra' };

export class SolarSystem {
  bodies: Body[] = []; byId = new Map<string, Body>(); sun!: Body;
  jd = J2000; jdUT = J2000;
  constructor(public sats: SatEl[], public featured: Record<string, Featured>, public osc: OscStates | null = null) {
    for (const d of CATALOG) this.add(new Body(d));
    this.sun = this.byId.get('sun')!;
    this.wire();
    this.addMinorMoons();
    this.applyHighPrecisionTiers();
  }
  /** Prefer Horizons-derived tiers over the bundled analytic/mean-element models (R-004…R-006 in docs/rnd-ledger.md). */
  private applyHighPrecisionTiers() {
    const osc = this.osc;
    for (const b of this.bodies) {
      if (b === this.sun || b.id === 'moon' || b.kind === 'planet' || b.id === 'pluto' || b.id === 'charon') continue;
      const code = b.info.jplCode ? +b.info.jplCode : NaN;
      const st = osc && Number.isFinite(code) ? osc.states[code] : undefined;
      const base = b.ephem;
      let fallback = base, fallbackTier = b.parent === this.sun ? 'osculating elements (SBDB, two-body)' : 'mean elements (approximate)';
      const galilean = ['io', 'europa', 'ganymede', 'callisto'].includes(b.id);
      if (st && b.parent && b.parent !== this.sun && !galilean) {
        const mu = (b.parent.GM || 1) + (b.GM || 0), ep = osc!.epochJdTdb;
        fallback = (jd) => propagate(st.r, st.v, mu, (jd - ep) * 86400)[0];
        fallbackTier = `osculating state @ JD ${ep} (Horizons, two-body)`;
        // v3.8 DEF-38-009: inside ~10 planetary radii the giant planet's J2 makes the OSCULATING semi-major axis differ from
        // the mean (geometric) orbit by (3/2)·J2·(R/a)²·a ≈ 0.3–0.5 % (≈ 500 km for Pan), and two-body propagation of the
        // osculating state also carries a forced eccentricity. Pan was drawn at r = 134,086 km — inside the A ring, 500 km
        // outside the Encke gap it actually clears (so the A ring appeared through it). For these moons the JPL MEAN
        // elements (geometric a, e, apsidal/nodal precession) are propagated, with the mean longitude anchored to the
        // Horizons state at its epoch (rotation about the mean orbit normal), so the phase stays Horizons-accurate.
        const Rp = b.parent.radius || 1, aMean = (b as any).satEl?.a ?? 0;
        if (aMean > 0 && aMean < 10 * Rp && ['jupiter', 'saturn', 'uranus', 'neptune'].includes(b.parent.id)) {
          const p0 = base(ep), p1 = base(ep + 0.01), nrmV = norm(cross(p0, p1));
          const proj = (v: V3) => { const d = dot(v, nrmV); return norm(sub(v, scale(nrmV, d))); };
          const u0 = proj(p0), u1 = proj(st.r as V3), ang = Math.atan2(dot(cross(u0, u1), nrmV), dot(u0, u1));
          const c = Math.cos(ang), sn = Math.sin(ang);
          const rot = (v: V3): V3 => { const k = nrmV, kv = cross(k, v), kd = dot(k, v); return [v[0] * c + kv[0] * sn + k[0] * kd * (1 - c), v[1] * c + kv[1] * sn + k[1] * kd * (1 - c), v[2] * c + kv[2] * sn + k[2] * kd * (1 - c)]; };
          fallback = (jd) => rot(base(jd));
          fallbackTier = `mean elements (J2 precession), longitude anchored to Horizons @ JD ${ep}`;
        }
        b.orbitEl = (jd) => this.osculating(b, jd, mu);
      }
      const sid = SAMPLED_ID[b.id] ?? b.id;
      if (SAMPLED.has(sid)) {
        const fb = fallback;
        b.ephem = (jd) => SAMPLED.pos(sid, jd) ?? fb(jd);
        b.ephemTier = () => { const v = SAMPLED.validity(sid, this.jd); return v === 'sampled' ? 'JPL Horizons sampled (interpolated)' : v === 'extrapolated' ? 'two-body extrapolation from Horizons window edge' : fallbackTier; };
        if (b.parent && b.parent !== this.sun) b.orbitEl = (jd) => this.osculating(b, jd, (b.parent!.GM || 1) + (b.GM || 0));
        else b.orbitEl = (jd) => this.osculating(b, jd, GM_SUN);
      } else { b.ephem = fallback; b.ephemTier = () => fallbackTier; }
    }
    // Pluto system: barycentre (heliocentric) and Charon (Pluto-centred) from Horizons when available
    const pluto = this.byId.get('pluto')!, charon = this.byId.get('charon')!;
    const baryOld = (pluto as any).baryEphem as (jd: number) => V3, chOld = charon.ephem, q = charon.GM / (pluto.GM + charon.GM);
    const bary = (jd: number) => SAMPLED.pos('pluto-bary', jd) ?? baryOld(jd);
    const chRel = (jd: number) => SAMPLED.pos('charon', jd) ?? chOld(jd);
    pluto.ephem = (jd) => sub(bary(jd), scale(chRel(jd), q));
    charon.ephem = chRel;
    pluto.ephemTier = () => SAMPLED.validity('pluto-bary', this.jd) === 'sampled' ? 'JPL Horizons sampled (interpolated)' : 'two-body barycentre orbit (approximate)';
    charon.ephemTier = () => SAMPLED.validity('charon', this.jd) === 'sampled' ? 'JPL Horizons sampled (interpolated)' : 'mean elements (approximate)';
    // Nix & Hydra are sampled about the Pluto–Charon barycentre: convert to Pluto-centred
    for (const [id, sid] of [['sat902', 'nix'], ['sat903', 'hydra']]) {
      const b = this.byId.get(id); if (!b || !SAMPLED.has(sid)) continue;
      const fb = b.ephem;
      b.ephem = (jd) => { const p = SAMPLED.pos(sid, jd); return p ? add(p, scale(chRel(jd), q)) : fb(jd); };
    }
    for (const id of ['io', 'europa', 'ganymede', 'callisto']) {
      const b = this.byId.get(id)!; const t = b.ephemTier;
      b.ephemTier = () => SAMPLED.validity(id, this.jd) === 'sampled' ? t() : 'Lieske E5 analytic theory';
    }
    this.byId.get('moon')!.ephemTier = () => 'ELP/MPP02 analytic (precessed to J2000)';
    // Planets: Horizons-sampled heliocentric positions inside the window. Earth and the giants are sampled as SYSTEM
    // barycentres (smooth two-body motion, accurate interpolation) and the planet centre is recovered by removing the
    // mass-weighted offset of its major moons (R-007 in docs/rnd-ledger.md). Mercury, Venus and Mars are sampled directly.
    const MOON_GM: Record<string, [string, number][]> = {
      earth: [['moon', 4902.800066]], jupiter: [['io', 5959.916], ['europa', 3202.739], ['ganymede', 9887.834], ['callisto', 7179.289]],
      saturn: [['titan', 8978.14], ['rhea', 153.94], ['iapetus', 120.52], ['dione', 73.11], ['tethys', 41.21], ['enceladus', 7.21], ['mimas', 2.5]],
      uranus: [['titania', 226.94], ['oberon', 205.32], ['umbriel', 85.09], ['ariel', 83.46], ['miranda', 4.3]], neptune: [['triton', 1428.5]],
    };
    const PLANET_GM: Record<string, number> = { earth: 398600.435436, jupiter: 126686531.9, saturn: 37931206.234, uranus: 5793951.3, neptune: 6835099.5 };
    for (const b of this.bodies) if (b.kind === 'planet') {
      const vsop = b.ephem, sid = MOON_GM[b.id] ? `${b.id}-bary` : b.id;
      const moons = (MOON_GM[b.id] ?? []).map(([id, gm]) => [this.byId.get(id)!, gm] as [Body, number]);
      const Mtot = (PLANET_GM[b.id] ?? 0) + moons.reduce((a, [, gm]) => a + gm, 0);
      b.ephem = (jd) => {
        if (SAMPLED.validity(sid, jd) !== 'sampled') return vsop(jd);
        let p = SAMPLED.pos(sid, jd)!;
        for (const [m, gm] of moons) p = sub(p, scale(m.ephem(jd), gm / Mtot));
        return p;
      };
      b.ephemTier = () => { const t = SAMPLED.tier(sid, this.jd); return t === 'sampled' ? (moons.length ? 'JPL Horizons sampled barycentre − moon offsets' : 'JPL Horizons sampled (interpolated)') : t === 'sampled-ext' ? 'JPL Horizons DE441 barycentre, 1900–2200 long-window sample − moon offsets' : 'VSOP87B analytic'; };
    }
  }
  add(b: Body) { this.bodies.push(b); this.byId.set(b.id, b); return b; }
  get(id: string) { return this.byId.get(id); }

  private wire() {
    for (const b of this.bodies) {
      const d = b.def;
      if (d.parent) { b.parent = this.byId.get(d.parent)!; b.parent.children.push(b); }
      else if (b.id !== 'sun') { b.parent = this.sun; this.sun.children.push(b); }
      // rotation
      if (d.rot && ROT[d.rot]) b.rotModel = ROT[d.rot];
      else if (d.periodH && d.pole) b.rotModel = simpleRot(d.pole[0], d.pole[1], d.periodH);
      // ephemeris
      if (b.kind === 'planet') {
        b.ephem = (jd) => planetHelio(b.id, jd);
        b.orbitEl = (jd) => this.osculating(b, jd, GM_SUN + b.GM);
      } else if (b.id === 'moon') {
        b.ephem = (jd) => moonGeocentric(jd);
        b.orbitEl = (jd) => this.osculating(b, jd, b.parent!.GM + b.GM);
      } else if (d.sbdb && this.featured[d.sbdb]) {
        const f = this.featured[d.sbdb];
        b.sbdbClass = f.c; b.info.designation = f.n;
        const q = f.q ?? f.a * (1 - f.e);
        let tp = f.tp;
        if (!tp && f.ma !== undefined && f.a > 0) { const n = GAUSS_K / Math.pow(f.a, 1.5) / DEG; tp = f.ep - f.ma / n; }
        b.ephem = (jd) => conicPos(q * AU, f.e, f.i, f.om, f.w, tp, jd);
        b.orbitEl = () => ({ el: { a: (f.e < 1 ? q / (1 - f.e) : -q / (f.e - 1)) * AU, e: f.e, i: deg(f.i), node: deg(f.om), peri: deg(f.w), M: 0 }, frame: [1, 0, 0, 0, 1, 0, 0, 0, 1], mu: GM_SUN, hyper: f.e >= 1 });
        if (f.H) b.H = parseFloat(f.H);
        if (f.GM) b.GM = parseFloat(f.GM);
        if (f.rot_per && !b.rotModel) b.rotModel = simpleRot(0, 90, parseFloat(f.rot_per));
      } else if (b.parent && b.parent !== this.sun) {
        const s = this.sats.find(s => s.name.toLowerCase() === b.name.toLowerCase());
        if (s) this.bindSat(b, s);
        const gk = ['io', 'europa', 'ganymede', 'callisto'].indexOf(b.id);
        if (gk >= 0) { b.ephem = (jd) => galilean(jd, gk); b.orbitEl = (jd) => this.osculating(b, jd, b.parent!.GM); }
      }
      if (!b.rotModel && b.kind === 'moon') b.synchronous = true;
    }
    // Pluto–Charon: the SBDB orbit is the system barycentre; both bodies circle it.
    const pluto = this.byId.get('pluto')!, charon = this.byId.get('charon')!;
    const bary = pluto.ephem, q = charon.GM / (pluto.GM + charon.GM);
    const chRel = charon.ephem;   // Charon relative to Pluto (JPL mean elements, Pluto equator)
    pluto.ephem = (jd) => sub(bary(jd), scale(chRel(jd), q));
    (pluto as any).baryEphem = bary;
    charon.ephem = (jd) => chRel(jd);
  }
  // JPL mean satellite elements (Laplace / equatorial / ecliptic frames) with apsidal & nodal precession
  bindSat(b: Body, s: SatEl) {
    const parent = b.parent!; (b as any).satEl = s;
    let F: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    if (s.frame === 'laplace' && s.lra !== undefined) F = mulMM(EQ2ECL, poleFrameEq(s.lra, s.ldec!));
    else if (s.frame === 'equatorial' && parent.rotModel) {
      const [a, de] = parent.rotModel(s.epoch - J2000, (s.epoch - J2000) / 36525);
      F = mulMM(EQ2ECL, poleFrameEq(a, de));
    }
    const n = 360 / s.P, ci = Math.cos(deg(s.i));
    const wd = s.Pw ? 360 / (s.Pw * 365.25) : 0, Od = s.Pn ? -Math.sign(ci || 1) * 360 / (s.Pn * 365.25) : 0;
    const elAt = (jd: number): Elements => {
      const t = jd - s.epoch;
      // P is the sidereal period: the mean longitude advances at 360/P, so precession is taken out of M
      const dw = wd * t, dO = Od * t, retro = s.i > 90;
      return { a: s.a, e: s.e, i: deg(s.i), node: deg(s.node + dO), peri: deg(s.w + dw), M: deg(s.M + n * t - (retro ? 0 : dw + dO)) };
    };
    b.ephem = (jd) => {
      const el = elAt(jd), E = solveKepler(el.M, el.e);
      return mulMV(F, rotOrbit(el.a * (Math.cos(E) - el.e), el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E), el));
    };
    b.orbitEl = (jd) => ({ el: elAt(jd), frame: F, mu: (parent.GM || 1) });
    if (s.GM) b.GM = s.GM;
    if (s.R && !b.def.radius) b.radius = s.R;
    b.info.jplCode = String(s.code);
  }
  private osculating(b: Body, jd: number, mu: number) {
    const dt = 0.01, p0 = b.ephem(jd - dt), p1 = b.ephem(jd + dt), p = b.ephem(jd);
    const v = scale(sub(p1, p0), 1 / (2 * dt * 86400));
    const el = stateToElements(p, v, mu);
    return { el, frame: [1, 0, 0, 0, 1, 0, 0, 0, 1] as M3, mu, hyper: el.hyper };
  }
  // Every other moon in the JPL table becomes a lightweight body (point + orbit), sized from the physical table.
  private addMinorMoons() {
    const parents: Record<string, string> = { Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturn', Uranus: 'uranus', Neptune: 'neptune', Pluto: 'pluto' };
    const seen = new Set(this.bodies.map(b => b.name.toLowerCase()));
    const byCode = new Map<number, SatEl>();
    for (const s of this.sats) { const o = byCode.get(s.code); if (!o || s.epoch > o.epoch) byCode.set(s.code, s); }
    for (const s of byCode.values()) {
      if (seen.has(s.name.toLowerCase()) || s.name === 'Moon') continue;
      const pid = parents[s.planet]; if (!pid) continue;
      const parent = this.byId.get(pid)!;
      // v3.8 DEF-38-008: 414 of the 460 JPL-table satellites have no radius; v3.3–3.7.1 gave every one of them 2.5–8 km
      // by orbit class, so Sycorax (Herschel D ≈ 165 km) and Siarnaq (≈ 39 km) were drawn as 2.5-km pebbles. Sizes now come
      // from src/data/satSizes.json (tools/ingest/sat_sizes.py): JPL Horizons radii, else the MPC absolute magnitude H with
      // the moon's own albedo (measured or dynamical-group prior): D = 1329 km / √pV · 10^(−H/5). Labelled ESTIMATED.
      const r0 = s.R ?? satRadius(s);
      const id = 'sat' + s.code;
      // v3.7.1 (visual identity): measured dimensions/albedo/colour where published, else a labelled dynamical-group prior
      // (src/data/smallMoons.ts). v3.3–3.7 gave all ~430 minor moons one albedo, one colour and one crater/roughness recipe.
      const M = resolveSmallMoon(s.name.replace(/_/g, ' '), s.planet, s.a, s.i ?? 0, r0);
      const r = M.radius;
      const shapeParams = M.shape === 'ridged' ? { ridge: 0.12 } : undefined;
      const b = new Body({ id, name: s.name.replace(/_/g, ' '), kind: 'moon', parent: pid, radius: r, radii: M.radii, albedo: M.albedo, color: M.tint,
        procedural: { seed: s.code % 997, craters: M.craters, rough: M.rough, tint: M.tint },
        identity: { tier: M.status.startsWith('MEASURED') ? 'C' : 'D', shape: M.shape === 'ridged' ? 'cratered' : M.shape, surface: M.surface, craterDensity: M.craters, roughness: M.rough, shapeParams,
          basis: `${M.basis} Properties: ${M.status}.`, sources: M.sources },
        ...(M.irregular ? { periodH: M.periodH ?? 12, pole: [0, 90] as [number, number] } : (M.periodH ? { periodH: M.periodH, pole: [0, 90] as [number, number] } : {})),
        subtitle: `Moon of ${parent.name}`, desc: '', priority: r > 50 ? 40 : 20 } as any);
      if ((b.def as any).periodH) b.rotModel = simpleRot(0, 90, (b.def as any).periodH);
      b.parent = parent; parent.children.push(b); b.synchronous = !b.rotModel;
      b.info.properties = M.status; b.info.moonClass = M.cls;
      { const z = (SAT_SIZES as any)[String(s.code)];
        b.info.sizeSource = s.R ? 'JPL physical table' : M.radii ? 'Published triaxial dimensions' : !z ? 'ESTIMATED by orbit class (no data)'
          : (z.rJPL && !z.rJPLapprox) ? 'JPL Horizons radius' : z.H != null ? `ESTIMATED from H = ${z.H} (${z.src.replace('H: ', '')}) and albedo ${M.albedo.toFixed(3)}` : 'Cassini/list diameter'; }
      if (M.irregular) b.info.note = M.periodH ? `Spin period ${M.periodH} h (light curve); spin axis unknown — placeholder` : 'Irregular satellite: rotation period and spin axis unknown — REPRESENTATIVE 12 h spin, placeholder axis (not synchronous)';
      this.bindSat(b, s);
      this.add(b);
      seen.add(s.name.toLowerCase());
    }
    // Moons of other dwarf planets — orbits from published astrometry (approximate orientations).
    const extra: [string, string, string, number, number, number, number, number, number, number, number][] = [
      // id, name, parent, a km, e, i(ecl,deg), Ω, ω, P days, radius, albedo
      ['dysnomia', 'Dysnomia', 'eris', 37273, 0.0062, 78.3, 126.1, 180.8, 15.78590, 307, 0.05],
      ['hiiaka', 'Hiʻiaka', 'haumea', 49880, 0.0513, 126.4, 206.8, 154.1, 49.462, 160, 0.8],
      ['namaka', 'Namaka', 'haumea', 25657, 0.249, 113.0, 205.0, 178.9, 18.2783, 85, 0.8],
      ['vanth', 'Vanth', 'orcus', 9000, 0.007, 90.5, 50.0, 0, 9.539, 221, 0.12],
      ['weywot', 'Weywot', 'quaoar', 13289, 0.056, 15, 0, 0, 12.4311, 85, 0.1],
      ['xiangliu', 'Xiangliu', 'gonggong', 24021, 0.29, 83, 0, 0, 25.22, 50, 0.1],
      ['mk2', 'MK2', 'makemake', 22250, 0, 63, 0, 0, 18.023, 87, 0.04],
      ['dactyl', 'Dactyl', 'ida', 108, 0.2, 8, 0, 0, 1.54, 0.7, 0.2],
      ['dimorphos', 'Dimorphos', 'didymos', 1.144, 0, 169, 0, 0, 0.4952, 0.0755, 0.15],
    ];
    for (const [id, name, pid, a, e, i, Om, w, P, R, alb] of extra) {
      const parent = this.byId.get(pid); if (!parent) continue;
      const b = new Body({ id, name, kind: 'moon', parent: pid, radius: R, albedo: alb, color: [0.55, 0.53, 0.5], procedural: { seed: id.length * 17, craters: 0.6, rough: 0.6 },
        subtitle: `Moon of ${parent.name}`, desc: '', priority: 35 });
      b.parent = parent; parent.children.push(b); b.synchronous = true;
      const n = 360 / P;
      const elAt = (jd: number): Elements => ({ a, e, i: deg(i), node: deg(Om), peri: deg(w), M: deg(n * (jd - J2000)) });
      b.ephem = (jd) => { const el = elAt(jd), E = solveKepler(el.M, e); return rotOrbit(a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E), el); };
      b.orbitEl = (jd) => ({ el: elAt(jd), frame: [1, 0, 0, 0, 1, 0, 0, 0, 1], mu: 1 });
      b.info.note = 'Orbit orientation approximate';
      this.add(b);
    }
  }

  // ── per-frame update ───────────────────────────────────────────────────
  update(jdTT: number, jdUT: number) {
    this.jd = jdTT; this.jdUT = jdUT;
    const order = this.bodies; // parents precede children in CATALOG; minor moons appended after parents
    for (const b of order) {
      if (b === this.sun) { b.pos = [0, 0, 0]; b.rel = [0, 0, 0]; }
      else if (b.kind === 'xstar') { b.rel = b.pos = b.ephem(jdTT); }
      else {
        b.rel = b.ephem(jdTT);
        b.pos = b.parent === this.sun || !b.parent ? b.rel : add(b.parent.pos, b.rel);
      }
    }
    // Pluto–Charon: Charon’s ephemeris is Pluto-relative; fix after Pluto is placed
    for (const b of order) if (b.kind !== 'xstar') this.updateRotation(b, jdTT, jdUT);
  }
  updateRotation(b: Body, jdTT: number, jdUT: number) {
    if (b.id === 'earth') { b.rot = earthRotation(jdTT, jdUT); return; }
    if (b.rotModel) { b.rot = rotationMatrix(b.rotModel, jdTT); return; }
    if (b.synchronous && b.parent) {
      // tidally locked: +x toward the parent (0° longitude = sub-planet point), z = orbit normal
      const r = b.rel, r2 = b.ephem(jdTT + 1e-3), v = sub(r2, r);
      const x = norm(scale(r, -1)), z = norm(cross(r, v)), y = cross(z, x);
      b.rot = fromCols(x, y, z);
    }
  }
  /** Add catalogue stars (Gaia/Hipparcos) as navigable bodies. Their "ephemeris" is linear space motion. */
  addStars(stars: { id: string; name: string; radius: number; pos: (jd: number) => V3; info: Record<string, string>; subtitle: string; desc: string; color: [number, number, number] }[]) {
    for (const st of stars) {
      if (this.byId.has(st.id)) continue;
      const b = new Body({ id: st.id, name: st.name, kind: 'xstar', radius: st.radius, albedo: 1, color: st.color, subtitle: st.subtitle, desc: st.desc, priority: 30 });
      b.parent = null; b.ephem = st.pos; Object.assign(b.info, st.info);
      b.ephemTier = () => 'Gaia DR3 / Hipparcos astrometry, linear space motion from J2016.0';
      this.add(b);
    }
  }
  // position at an arbitrary time without disturbing the current state (for trails, velocity, events)
  posAt(b: Body, jd: number): V3 {
    if (b === this.sun) return [0, 0, 0];
    const rel = b.ephem(jd);
    return b.parent && b.parent !== this.sun ? add(this.posAt(b.parent, jd), rel) : rel;
  }
  velocity(b: Body, jd: number, relTo?: Body): V3 {
    const h = 1 / 1440, a = this.posAt(b, jd - h), c = this.posAt(b, jd + h);
    let v = scale(sub(c, a), 1 / (2 * h * 86400));
    if (relTo) { const ra = this.posAt(relTo, jd - h), rc = this.posAt(relTo, jd + h); v = sub(v, scale(sub(rc, ra), 1 / (2 * h * 86400))); }
    return v;
  }
}
// Rough radius for small moons without measured size: H-less, so scale with semimajor-axis class (irregulars are typically 1–4 km).
export function satRadius(s: SatEl): number {
  const z = (SAT_SIZES as any)[String(s.code)];
  if (!z) return estimateRadius(s);
  if (z.rJPL && !z.rJPLapprox) return z.rJPL;
  if (z.H != null) {
    const cls = classifyMoon(s.planet, s.a, s.i ?? 0), m = SMALL_MOONS[s.name.replace(/_/g, ' ')];
    const pV = Math.min(1, m?.albedo ?? CLASS_PRIORS[cls].albedo);
    return 1329 / Math.sqrt(pV) * Math.pow(10, -z.H / 5) / 2;
  }
  if (z.rJPL) return z.rJPL;
  return z.dList ? z.dList / 2 : estimateRadius(s);   // Cassini-measured diameters of the tiny inner moonlets (Anthe, Aegaeon) have no H
}
function estimateRadius(s: SatEl) { return s.a > 3e6 ? 2.5 : s.a > 1e6 ? 5 : 8; }
