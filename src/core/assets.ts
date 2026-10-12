// Asset fetching: bounded concurrency, retry with back-off, abort, byte accounting. Runtime assets are ordinary
// app-hosted files under public/assets (never inlined into the bundle).
import * as THREE from 'three/webgpu';

const BASE = 'assets/';
const MAX_CONCURRENT = 6;
let active = 0; const queue: (() => void)[] = [];
export const netStats = { requests: 0, bytes: 0, failures: 0, inFlight: 0, queued: 0 };
async function slot<T>(fn: () => Promise<T>, priority = false): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>(r => { priority ? queue.unshift(r) : queue.push(r); netStats.queued = queue.length; });
  active++; netStats.inFlight = active;
  try { return await fn(); } finally { active--; netStats.inFlight = active; const n = queue.shift(); netStats.queued = queue.length; n?.(); }
}
export async function fetchAsset(url: string, opts: { signal?: AbortSignal; retries?: number; priority?: boolean } = {}): Promise<Response> {
  return slot(async () => {
    let lastErr: unknown;
    for (let k = 0; k <= (opts.retries ?? 2); k++) {
      try {
        const r = await fetch(BASE + url, { signal: opts.signal });
        netStats.requests++;
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        const len = +(r.headers.get('content-length') ?? 0); netStats.bytes += len;
        return r;
      } catch (e: any) { lastErr = e; if (e?.name === 'AbortError' || /HTTP 404/.test(String(e?.message))) break; await new Promise(s => setTimeout(s, 300 * 2 ** k)); }
    }
    netStats.failures++; throw lastErr;
  }, opts.priority);
}
export async function loadBinary(url: string, signal?: AbortSignal) { return new Float32Array(await (await fetchAsset(url, { signal })).arrayBuffer()); }
export async function loadArrayBuffer(url: string, signal?: AbortSignal, priority = false) { return (await fetchAsset(url, { signal, priority })).arrayBuffer(); }
export async function loadJSON<T = any>(url: string, signal?: AbortSignal): Promise<T> { return (await fetchAsset(url, { signal })).json(); }
export async function decodeImage(url: string, opts: { premultiply?: boolean; signal?: AbortSignal; priority?: boolean } = {}) {
  const blob = await (await fetchAsset(url, { signal: opts.signal, priority: opts.priority })).blob();
  return createImageBitmap(blob, { imageOrientation: 'flipY', colorSpaceConversion: 'none', premultiplyAlpha: opts.premultiply === false ? 'none' : 'default' } as any);
}
export function configureMapTexture(t: THREE.Texture, srgb: boolean) {
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 16; t.generateMipmaps = true;
  t.flipY = false; t.needsUpdate = true;
  return t;
}
export async function loadTexture(name: string, opts: { srgb?: boolean; hi?: boolean } = {}) {
  const bmp = await decodeImage(`tex/${name}${opts.hi ? '_hi' : ''}.jpg`);
  return configureMapTexture(new THREE.Texture(bmp as any), opts.srgb !== false);
}
export async function loadPNGTexture(url: string) {
  const blob = await (await fetchAsset(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' } as any);
  const t = new THREE.Texture(bmp as any); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
