// SOL v3.8 (PERF-009): family-shape generation (craters, facets, boulders per vertex) off the main thread. v3.3–3.7 ran
// familyGeometry() synchronously inside engine.getView(): 160–300 ms per irregular moon/asteroid on the software adapter
// (Janus, Amalthea, Puck, Miranda in the travel profile). Deterministic: same profile + segment count → same mesh.
import { familyGeometry } from './geometry';
self.onmessage = (ev: MessageEvent<{ key: string; profile: any; seg: number }>) => {
  const { key, profile, seg } = ev.data, t0 = performance.now();
  const fg = familyGeometry(profile, seg), g: any = fg.geo;
  const pos = g.attributes.position.array as Float32Array, nrm = g.attributes.normal.array as Float32Array, idx = g.index.array as Uint32Array | Uint16Array;
  const P = new Float32Array(pos), N = new Float32Array(nrm), I = new Uint32Array(idx);
  (self as any).postMessage({ key, P, N, I, stats: fg.stats, ms: performance.now() - t0 }, [P.buffer, N.buffer, I.buffer]);
};
