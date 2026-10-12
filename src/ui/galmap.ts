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
    this.el.innerHTML = `<header><h2>Galactic context</h2><span class="badge rec" title="Inferred structure from published fits — not an observed 3-D map">Model</span><button class="tb sm close" aria-label="Close Galactic context">×</button></header>
      <canvas width="264" height="264" aria-hidden="true"></canvas><div class="gm-info num" aria-live="off"></div>
      <p class="note">Arms: Reid et al. 2019 (masers; dotted = extrapolated). Discs & bar: Bland-Hawthorn & Gerhard 2016. Sun–centre distance ${MW.R0_kpc.value} kpc (GRAVITY). The sky you see is the observed Gaia panorama.</p>`;
    parent.appendChild(this.el);
    this.cv = this.el.querySelector('canvas')!; this.info = this.el.querySelector('.gm-info')!;
    (this.el.querySelector('.close') as HTMLButtonElement).onclick = () => { this.toggle(false); this.auto = false; };
  }
  toggle(on = !this.open) { this.open = on; this.el.classList.toggle('open', on); if (on) this.bg = null; }
  /** face-on background (drawn once): disc glow, bar, arms, GC */
  private drawBg(ctx: CanvasRenderingContext2D, W: number) {
    const s = W / 34, c = W / 2;   // ±17 kpc
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
    ctx.fillStyle = '#ffd9a3'; ctx.beginPath(); ctx.arc(X(0), Y(0), 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = '10px Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(238,240,244,0.7)'; ctx.fillText('Sgr A*', X(0) + 5, Y(0) - 4);
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
    ctx.fillStyle = '#f2c27f'; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(238,240,244,0.85)'; ctx.font = '10px Inter, system-ui, sans-serif'; ctx.fillText('Sun', sx - 22, sy + 14);
    // local inset (±6 pc, Galactic x→GC up… drawn with GC toward the right as in the main map)
    const iw = 92, ix = W - iw - 6, iy = W - iw - 6, ic = iw / 2, ps = ic / 6;
    ctx.fillStyle = 'rgba(3,4,7,0.82)'; ctx.fillRect(ix, iy, iw, iw); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, iw - 1);
    const toInset = (g: [number, number, number]) => [ix + ic + (g[0] / PC) * ps, iy + ic - (g[1] / PC) * ps] as [number, number];
    for (const b of stars) {
      if (b.info?.dsoKind) continue; const g = eclToGal(b.pos as any); if (Math.hypot(g[0], g[1]) > 6 * PC) continue;
      const [px, py] = toInset(g); ctx.fillStyle = b === target ? '#ffd9a3' : 'rgba(200,215,240,0.8)'; ctx.fillRect(px - 1, py - 1, 2, 2);
    }
    ctx.fillStyle = '#f2c27f'; ctx.fillRect(ix + ic - 1.5, iy + ic - 1.5, 3, 3);
    const gc = eclToGal(camKm), [cx, cy] = toInset(gc);
    ctx.strokeStyle = '#8fd9b0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(Math.max(ix + 3, Math.min(ix + iw - 3, cx)), Math.max(iy + 3, Math.min(iy + iw - 3, cy)), 3.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(238,240,244,0.6)'; ctx.font = '9px Inter, system-ui, sans-serif'; ctx.fillText('±6 pc · camera ◯', ix + 4, iy + 11);
    const lbd = galacticLBD(camKm), R = Math.hypot(-MW.R0_kpc.value + gc[0] / PC / 1000, gc[1] / PC / 1000);
    this.info.textContent = `camera  l ${lbd.l.toFixed(2)}°  b ${lbd.b.toFixed(2)}°  ${(lbd.d / PC).toFixed(4)} pc from the Sun\nGalactocentric R ${R.toFixed(4)} kpc · z ${((gc[2] / PC) + MW.zSun_pc.value).toFixed(2)} pc (model frame)`;
    void azimuthToXY;
  }
}
