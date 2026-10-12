// Injected before page scripts (QA only): surfaces WebGPU validation errors and WGSL compile errors in the console.
(() => {
  if (!self.GPUAdapter) return;
  const rd = GPUAdapter.prototype.requestDevice;
  GPUAdapter.prototype.requestDevice = async function (...a) {
    const d = await rd.apply(this, a);
    d.addEventListener('uncapturederror', e => console.error('[gpu-uncaptured] ' + (e.error?.message ?? e.error)));
    const csm = d.createShaderModule.bind(d);
    d.createShaderModule = (desc) => { const m = csm(desc); m.getCompilationInfo().then(ci => { for (const msg of ci.messages) if (msg.type === 'error') console.error('[wgsl-error] ' + msg.lineNum + ':' + msg.linePos + ' ' + msg.message + ' :: ' + (desc.code.split('\n')[msg.lineNum - 1] || '').trim().slice(0, 160)); }); return m; };
    return d;
  };
})();
