// Native-WebGPU gate. SOL never runs on WebGL/WebGL2: this module verifies a real WebGPU adapter before the renderer is
// created, and Engine.init() disables three.js's automatic WebGL2 fallback and asserts the live backend afterwards.
// Software adapters (SwiftShader, `isFallbackAdapter`) are refused unless the explicit QA flag `?qa-software-gpu=1` is
// present — used only by the automated smoke/golden harness (tools/qa), never as a user-facing fallback.
export interface GpuInfo { vendor: string; architecture: string; device: string; description: string; fallback: boolean; features: string[]; limits: Record<string, number>; qaSoftware: boolean }
export class GpuUnavailable extends Error { constructor(public title: string, msg: string) { super(msg); } }
export const QA = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export async function probeNativeWebGPU(): Promise<GpuInfo> {
  const gpu = (navigator as any).gpu;
  if (!gpu) throw new GpuUnavailable('WebGPU is not available', 'SOL runs only on native WebGPU in desktop Google Chrome (113+) with hardware acceleration enabled. Check chrome://gpu → “WebGPU: Hardware accelerated”.');
  const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new GpuUnavailable('No WebGPU adapter', 'Chrome could not provide a WebGPU adapter. Open chrome://gpu, enable “Use graphics acceleration when available”, and update your GPU driver.');
  const i = adapter.info ?? {};
  const fallback = !!(i.isFallbackAdapter ?? adapter.isFallbackAdapter);
  const qaSoftware = QA.get('qa-software-gpu') === '1';
  if (fallback && !qaSoftware) throw new GpuUnavailable('Software WebGPU adapter refused', 'Chrome is offering only a software (CPU) WebGPU adapter. SOL requires a hardware-accelerated GPU; enable hardware acceleration in Chrome settings.');
  const limits: Record<string, number> = {};
  for (const k of ['maxTextureDimension2D', 'maxBufferSize', 'maxStorageBufferBindingSize', 'maxComputeWorkgroupStorageSize']) limits[k] = adapter.limits?.[k];
  return { vendor: i.vendor ?? '', architecture: i.architecture ?? '', device: i.device ?? '', description: i.description ?? '', fallback, features: [...(adapter.features ?? [])], limits, qaSoftware };
}
