// Number/unit formatting shared by the interface (pure; unit-tested in tests/ui/format.test.ts).
import { AU } from '../astro/constants';
import { LENGTH_UNITS_KM } from '../contracts/precision';

export const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export function fmtDist(km: number, units = 'metric') {
  const a = Math.abs(km);
  if (a >= 0.5 * LENGTH_UNITS_KM.pc) return `${fmt(a / LENGTH_UNITS_KM.pc, a / LENGTH_UNITS_KM.pc < 10 ? 3 : 1)} pc`;
  if (a >= 0.05 * 63241 * AU) return `${fmt(a / LENGTH_UNITS_KM.ly, a / LENGTH_UNITS_KM.ly < 10 ? 2 : 1)} ly`;
  if (a >= 0.02 * AU) return `${fmt(a / AU, a / AU < 10 ? 3 : 2)} AU`;
  if (units === 'imperial') return a >= 1 / 1.609344 ? `${fmt(a / 1.609344, 0)} mi` : `${fmt(a * 3280.84, 0)} ft`;
  if (a >= 1e6) return `${fmt(a / 1e6, 2)} million km`;
  if (a >= 10) return `${fmt(a, 0)} km`;
  if (a >= 1) return `${fmt(a, 2)} km`;
  return `${fmt(a * 1000, 0)} m`;
}
export function fmtDur(s: number) {
  const a = Math.abs(s);
  if (a < 1) return `${fmt(a * 1000, 0)} ms`; if (a < 60) return `${fmt(a, 2)} s`; if (a < 3600) return `${Math.floor(a / 60)} min ${Math.round(a % 60)} s`;
  if (a < 86400) return `${Math.floor(a / 3600)} h ${Math.round((a % 3600) / 60)} min`; if (a < 86400 * 400) return `${fmt(a / 86400, 2)} d`; return `${fmt(a / 31557600, 2)} yr`;
}
export function sci(x: number) {
  if (!(x > 0)) return '—';
  const e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e);
  const sup = String(e).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? (c === '-' ? '⁻' : c)).join('');
  return `${m.toFixed(3)} × 10${sup}`;
}
export function splitU(s: string): [string, string] { const m = s.match(/^([-\d.,—]+)\s*(.*)$/); return m ? [m[1], m[2]] : [s, '']; }
/** A "nice" ruler length (1, 2 or 5 × 10ⁿ) close to `raw`. */
export function niceLength(raw: number) {
  const p10 = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-12))));
  return [1, 2, 5, 10].map(m => m * p10).find(v => v >= raw * 0.6) ?? p10;
}
export const hex = (c: number[]) => '#' + c.map(x => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('');
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
