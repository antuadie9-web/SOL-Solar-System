// SOL v3.8 — Galactic context card (spec §35 "Galactic context", §25). Face-on schematic of the Milky Way drawn from the
// PARAMETRIC model in galaxy/milkyWayModel.ts (Reid et al. 2019 arms, Bland-Hawthorn & Gerhard 2016 discs/bar), the
// Sun's place in it, and a local inset with the camera and the nearest navigable stars, with the camera's Galactic
// coordinates. Labelled as a MODEL: it is inferred structure, not an observed map. Opens with the M key or automatically
// once the camera is beyond 2,000 AU; it never captures the keyboard.
import { ARMS, armPolyline, MW, azimuthToXY } from '../galaxy/milkyWayModel';
import { ECL_TO_ICRS, ICRS_TO_GAL, mul } from '../contracts/frames';
import type { Body } from '../astro/system';
const PC = 3.0856775814913673e13, AU = 149597870.7;
const ECL_TO_GAL = mul(ICRS_TO_GAL, ECL_TO_ICRS);
export function eclToGal(v: [number, number, number]): [number, number, number] {
  const M = ECL_TO_GAL; return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
}
/** heliocentric Galactic (l°, b°, distance km) of an ecliptic-J2000 heliocentric position */
export function galacticLBD(p: [number, number, number]) {
  const g = eclToGal(p), d = Math.hypot(g[0], g[1], g[2]) || 1;
  return { l: ((Math.atan2(g[1], g[0]) * 180 / Math.PI) + 360) % 360, b: Math.asin(g[2] / d) * 180 / Math.PI, d };
}
export class GalMap {
  el: HTMLElement; cv: HTMLCanvasElement; info: HTMLElement; open = false; auto = true; private bg: ImageData | null = null; private dpr = 1;
  constructor(parent: HTMLElement) {
    this.el = document.createElement('section'); this.el.id = 'galmap'; this.el.className = 'panel galmap'; this.el.setAttribute('aria-label', 'Galactic context');
    // v3.8.1 GAL-381-01: legible, provenance-first card — truth legend, scale bar, l-direction ticks, enlarge (2×) toggle,
    // HiDPI canvas. It remains a SCHEMATIC of a parametric model: SOL has no navigable 3-D Galaxy yet (v3.9).
    this.el.innerHTML = `<header><h2>Galactic context</h2><span class="badge rec" title="Inferred structure from published fits — not an observed 3-D map">Model · schematic</span><button class="tb sm grow" aria-label="Enlarge Galactic context" aria-pressed="false" title="Enlarge (2×)">⤢</button><button class="tb sm close" aria-label="Close Galactic context">×</button></header>
      <canvas width="296" height="296" aria-hidden="true"></canvas><div class="gm-info num" aria-live="off"></div>
      <ul class="gm-legend" aria-label="Legend">
        <li><i class="lg arm"></i><span>Spiral arm traced by maser parallaxes (Reid et al. 2019) — <b>measured</b></span></li>
        <li><i class="lg ext"></i><span>Arm model extrapolated beyond the data — <b>inferred</b></span></li>
        <li><i class="lg bar"></i><span>Bar &amp; exponential discs (Bland-Hawthorn &amp; Gerhard 2016) — <b>model fit</b></span></li>
        <li><i class="lg cov"></i><span>Dense parallax coverage (≈ 5 kpc around the Sun)</span></li>
      </ul>
      <p class="note">Sun–centre distance ${MW.R0_kpc.value} kpc (GRAVITY 2019). The sky behind you is the <b>observed 2-D Gaia panorama</b>, not this model; a navigable 3-D Milky Way is planned for v3.9.</p>`;
    parent.appendChild(this.el);
    this.cv = this.el.querySelector('canvas')!; this.info = this.el.querySelector('.gm-info')!;
    (this.el.querySelector('.close') as HTMLButtonElement).onclick = () => { this.toggle(false); this.auto = false; };
    const grow = this.el.querySelector('.grow') as HTMLButtonElement;
    grow.onclick = () => { const big = !this.el.classList.contains('big'); this.el.classList.toggle('big', big); grow.setAttribute('aria-pressed', String(big)); this.resizeCanvas(); };
    this.resizeCanvas();
  }
  /** HiDPI backing store: CSS size × devicePixelRatio (v3.8.0 drew a 264-px canvas stretched on 2× displays) */
  resizeCanvas() {
    const css = this.el.classList.contains('big') ? 592 : 296; this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cv.style.width = this.cv.style.height = css + 'px'; this.cv.width = this.cv.height = Math.round(css * this.dpr); this.bg = null;
  }
  toggle(on = !this.open) { this.open = on; this.el.classList.toggle('open', on); if (on) this.bg = null; }
  /** face-on background (drawn once): disc glow, bar, arms, GC */
  private drawBg(ctx: CanvasRenderingContext2D, W: number) {
    const s = W / 34, c = W / 2;   // ±17 kpc (W in device pixels)
    const u = this.dpr;
    const X = (x: number) => c + x * s, Y = (y: number) => c - y * s;
    const img = ctx.createImageData(W, W);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const x = (i - c) / s, y = (c - j) / s, R = Math.hypot(x, y);
      // thin+thick disc surface density (vertical integral ∝ h_z): exponential in R; bar boost near the centre (display)
      const sd = Math.exp(-R / MW.thinDisc.scaleLength_kpc.value), a = Math.min(1, 1.8 * Math.pow(sd, 0.55));
      const k = (j * W + i) * 4; img.data[k] = 120 * a + 8; img.data[k + 1] = 112 * a + 9; img.data[k + 2] = 98 * a + 14; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // bar (half-length 5 kpc, 27° from the Sun–GC line; near end in the 1st quadrant)
    const ang = MW.bar.angleDeg.value * Math.PI / 180, L = MW.bar.halfLength_kpc.value;
    ctx.save(); ctx.translate(X(0), Y(0)); ctx.rotate(-(Math.PI - ang)); ctx.fillStyle = 'rgba(255,220,170,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, L * s, 1.4 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    for (const a of ARMS) {
      const ext = armPolyline(a, 1, 60), obs = armPolyline(a, 1, 0);
      ctx.strokeStyle = 'rgba(156,200,239,0.35)'; ctx.setLineDash([2, 4]); ctx.lineWidth = 1; ctx.beginPath(); ext.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke();
      ctx.setLineDash([]); ctx.strokeStyle = 'rgba(170,215,255,0.85)'; ctx.lineWidth = Math.max(1.2, a.width * s * 0.9); ctx.beginPath(); obs.forEach(([x, y], i) => i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))); ctx.stroke();
    }
    // dense-parallax coverage (~5 kpc around the Sun; Reid et al. 2019 maser sample) — where the arm geometry is measured
    ctx.setLineDash([3 * u, 3 * u]); ctx.strokeStyle = 'rgba(143,217,176,0.55)'; ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.arc(X(-MW.R0_kpc.value), Y(0), 5 * s, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffd9a3'; ctx.beginPath(); ctx.arc(X(0), Y(0), 2.5 * u, 0, Math.PI * 2); ctx.fill();
    ctx.font = `${10 * u}px Inter, system-ui, sans-serif`; ctx.fillStyle = 'rgba(238,240,244,0.8)'; ctx.fillText('Sgr A* (centre)', X(0) + 5 * u, Y(0) - 4 * u);
    // arm names at their outer measured ends
    ctx.font = `${9 * u}px Inter, system-ui, sans-serif`; ctx.fillStyle = 'rgba(190,220,250,0.75)';
    // labels placed at the outer measured end, skipped if they would overlap an already placed label (cp2 legibility review)
    const placed: [number, number, number, number][] = [[X(0) - 4 * u, Y(0) - 16 * u, 90 * u, 14 * u]];
    const free = (x: number, y: number, w: number, h: number) => !placed.some(([a, b, c, d]) => x < a + c && a < x + w && y < b + d && b < y + h);
    for (const a of ARMS) {
      const obs = armPolyline(a, 1, 0); if (!obs.length) continue; const name = a.name.replace(/ \(.*\)/, '');
      const w = ctx.measureText(name).width + 4 * u, h = 11 * u;
      for (const f of [1, 0.8, 0.6, 0.4]) {
        const [x, y] = obs[Math.min(obs.length - 1, Math.floor((obs.length - 1) * f))], lx = X(x) + 3 * u, ly = Y(y) - 9 * u;
        if (lx + w < W && free(lx, ly, w, h)) { ctx.fillText(name, lx, ly + 9 * u); placed.push([lx, ly, w, h]); break; }
      }
    }
    // 5 kpc scale bar
    const sbx = 8 * u, sby = W - 10 * u; ctx.strokeStyle = 'rgba(238,240,244,0.8)'; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(sbx, sby); ctx.lineTo(sbx + 5 * s, sby); ctx.stroke();
    ctx.fillStyle = 'rgba(238,240,244,0.8)'; ctx.font = `${9 * u}px Inter, system-ui, sans-serif`; ctx.fillText('5 kpc', sbx, sby - 4 * u);
    this.bg = ctx.getImageData(0, 0, W, W);
  }
  /** per-frame (cheap): Sun & camera markers, local inset, coordinates */
  update(camKm: [number, number, number], stars: Body[], target: Body | null) {
    const far = Math.hypot(...camKm) > 2000 * AU;
    if (this.auto && far !== this.open) this.toggle(far);
    if (!this.open) return;
    const ctx = this.cv.getContext('2d')!, W = this.cv.width;
    if (!this.bg) this.drawBg(ctx, W); else ctx.putImageData(this.bg, 0, 0);
    const s = W / 34, c = W / 2, X = (x: number) => c + x * s, Y = (y: number) => c - y * s;
    // Sun in the face-on frame: (−R0, 0); arrow toward l = 90° (+y) = direction of Galactic rotation
    const sx = X(-MW.R0_kpc.value), sy = Y(0);
    const u = this.dpr;
    ctx.fillStyle = '#f2c27f'; ctx.beginPath(); ctx.arc(sx, sy, 3 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(238,240,244,0.9)'; ctx.font = `${10 * u}px Inter, system-ui, sans-serif`; ctx.fillText('Sun', sx - 22 * u, sy + 14 * u);
    // Galactic longitude directions from the Sun (l = 0° toward the centre, 90° = direction of rotation)
    ctx.font = `${8 * u}px Inter, system-ui, sans-serif`; ctx.fillStyle = 'rgba(238,240,244,0.55)';
    for (const [l, dx, dy] of [[0, 1, 0], [90, 0, -1], [180, -1, 0], [270, 0, 1]] as [number, number, number][]) ctx.fillText(`${l}°`, sx + dx * 16 * u - 6 * u, sy + dy * 16 * u + 3 * u);
    // local inset (±6 pc, Galactic x→GC up… drawn with GC toward the right as in the main map)
    const iw = Math.round(W * 0.36), ix = W - iw - 6 * u, iy = W - iw - 6 * u, ic = iw / 2, ps = ic / 6;
    ctx.fillStyle = 'rgba(3,4,7,0.82)'; ctx.fillRect(ix, iy, iw, iw); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, iw - 1);
    const toInset = (g: [number, number, number]) => [ix + ic + (g[0] / PC) * ps, iy + ic - (g[1] / PC) * ps] as [number, number];
    const insetPlaced: [number, number, number][] = [];
    for (const b of stars) {
      if (b.info?.dsoKind) continue; const g = eclToGal(b.pos as any); if (Math.hypot(g[0], g[1]) > 6 * PC) continue;
      const [px, py] = toInset(g); ctx.fillStyle = b === target ? '#ffd9a3' : 'rgba(200,215,240,0.8)'; ctx.fillRect(px - u, py - u, 2 * u, 2 * u);
      if (b === target || /Proxima|Sirius|Barnard|Wolf 359|Procyon|Altair/.test(b.name)) {
        ctx.font = `${8 * u}px Inter, system-ui, sans-serif`; const nm = b.name.replace("Centauri", "Cen").replace(" Star", ""), tw = ctx.measureText(nm).width, lx = Math.max(ix + 2 * u, Math.min(px + 3 * u, ix + iw - tw - 2 * u)), ly = py - 9 * u;
        if (!insetPlaced.some(([a, c, d]) => Math.abs(ly - c) < 9 * u && lx < a + d && a < lx + tw)) { ctx.fillStyle = 'rgba(220,228,240,0.8)'; ctx.fillText(nm, lx, py - 2 * u); insetPlaced.push([lx, ly, tw]); }
      }
    }
    ctx.fillStyle = '#f2c27f'; ctx.fillRect(ix + ic - 1.5 * u, iy + ic - 1.5 * u, 3 * u, 3 * u);
    const gc = eclToGal(camKm), [cx, cy] = toInset(gc);
    ctx.strokeStyle = '#8fd9b0'; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.arc(Math.max(ix + 3 * u, Math.min(ix + iw - 3 * u, cx)), Math.max(iy + 3 * u, Math.min(iy + iw - 3 * u, cy)), 3.5 * u, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(238,240,244,0.7)'; ctx.font = `${9 * u}px Inter, system-ui, sans-serif`; ctx.fillText('±6 pc · measured stars', ix + 4 * u, iy + 11 * u);
    const lbd = galacticLBD(camKm), R = Math.hypot(-MW.R0_kpc.value + gc[0] / PC / 1000, gc[1] / PC / 1000);
    this.info.textContent = `Camera  l ${lbd.l.toFixed(2)}°  b ${lbd.b.toFixed(2)}°\n${(lbd.d / PC).toFixed(4)} pc from the Sun\nGalactocentric R ${R.toFixed(4)} kpc · z ${((gc[2] / PC) + MW.zSun_pc.value).toFixed(2)} pc (model frame)`;
    void azimuthToXY;
  }
}
