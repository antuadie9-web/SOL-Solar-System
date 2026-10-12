// Contract 7 — quality evidence (spec D1.7, F5 "Asset/license and quality-evidence contract").
// Every claim in docs/ carries one of these statuses; every capture carries its metadata so a software-adapter frame
// can never be presented as hardware validation.
export type EvidenceStatus =
  | 'verified'                 // automated test or measured reference comparison passes
  | 'verified-software'        // rendered & inspected on a software WebGPU adapter only (no real-GPU look/perf claim)
  | 'pending-hardware'         // needs a real GPU run (benchmark protocol) before it can be called done
  | 'implemented-unapproved'   // code exists, owner visual sign-off pending
  | 'partial' | 'open' | 'blocked' | 'physically-unknown';
export interface SceneFixture {
  id: string; target: string; epochUtc: string;
  camera: { distKm?: number; altKm?: number; radii?: number; yaw?: number; pitch?: number; fovDeg: number; lookPitch?: number };
  preset: { quality: string; sunLook?: string; guides?: string; labels: boolean; exposure: 'settled-auto' | number };
  tolerance?: { metric: 'ssim' | 'mean-abs' | 'none'; max?: number };
}
export interface CaptureMeta {
  fixture: string; app: string; version: string; when: string;
  adapter: { vendor: string; architecture: string; description: string; fallback: boolean };
  viewport: [number, number]; dpr: number; qaFlags: string[];
  settings: Record<string, unknown>;
  status: EvidenceStatus;      // 'verified-software' whenever adapter.fallback is true
}
export function statusForAdapter(fallback: boolean, passed: boolean): EvidenceStatus {
  if (!passed) return 'open';
  return fallback ? 'verified-software' : 'verified';
}
/** Frame-time percentiles from a ring buffer of frame durations (ms). Median and 99th (≈"1 % low").
 *  v3.5 (AUD-06): nearest-rank percentiles (index ⌈p·n⌉−1). The v3.4 formula ⌊p·(n−1)⌋ never reached the slowest frame
 *  for n < 100, so a single 40 ms hitch in 8 frames reported p99 = 18 ms — hidden by a tautological test assertion. */
export function frameStats(ms: number[]) {
  const a = ms.filter(Number.isFinite).slice().sort((x, y) => x - y); if (!a.length) return { n: 0, p50: NaN, p99: NaN, fps50: NaN, fps1low: NaN };
  const q = (p: number) => a[Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1))];
  return { n: a.length, p50: q(0.5), p99: q(0.99), fps50: 1000 / q(0.5), fps1low: 1000 / q(0.99) };
}
