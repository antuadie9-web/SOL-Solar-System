// Simulation clock in TT Julian days; rate = simulated seconds per real second.
import { utcToTT, jdFromDate } from '../astro/time';
export const RATES = [-31557600, -2629800, -604800, -86400, -3600, -60, -1, 1, 60, 600, 3600, 21600, 86400, 604800, 2629800, 31557600];
export class Clock {
  rate = 1; paused = false; listeners = new Set<() => void>();
  constructor(public jd: number) {}
  tick(dt: number) { if (!this.paused) this.jd += this.rate * dt / 86400; }
  setRate(r: number) { this.rate = r; this.paused = false; this.emit(); }
  toggle() { this.paused = !this.paused; this.emit(); }
  now() { this.jd = utcToTT(jdFromDate(new Date())); this.rate = 1; this.paused = false; this.emit(); }
  set(jd: number) { this.jd = jd; this.emit(); }
  faster() { const i = RATES.findIndex(r => r >= this.rate); this.setRate(RATES[Math.min(RATES.length - 1, (i < 0 ? RATES.length - 1 : RATES[i] === this.rate ? i + 1 : i))]); }
  slower() { const i = RATES.findIndex(r => r >= this.rate); this.setRate(RATES[Math.max(0, (i < 0 ? RATES.length - 1 : i) - 1)]); }
  emit() { this.listeners.forEach(f => f()); }
}
export function rateLabel(r: number) {
  const a = Math.abs(r), s = r < 0 ? '−' : '';
  if (a === 1) return r < 0 ? 'Reverse real time' : 'Real time';
  const u: [number, string][] = [[31557600, 'yr'], [2629800, 'mo'], [604800, 'wk'], [86400, 'day'], [3600, 'hr'], [60, 'min'], [1, 's']];
  for (const [v, n] of u) if (a >= v) { const k = a / v; return `${s}${Number.isInteger(k) ? k : k.toFixed(1)} ${n}${k !== 1 && n !== 's' ? (n === 'day' ? 's' : 's') : ''} / s`; }
  return `${r}×`;
}
