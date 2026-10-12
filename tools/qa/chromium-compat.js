// QA-only shim for the headless Chromium build bundled with playwright-core (v141). three.js r186 always sends
// GPUTextureViewDescriptor.swizzle = 'rgba' (the current WebGPU spec string form); Chromium 141 implemented an older
// dictionary form and throws, which leaves undefined views and loses the device. 'rgba' is the identity swizzle, so
// deleting it is behaviour-preserving. Loaded only by tools/qa harnesses via addInitScript, never by the application.
(() => {
  if (!self.GPUTexture) return;
  const cv = GPUTexture.prototype.createView;
  GPUTexture.prototype.createView = function (desc) {
    if (desc && desc.swizzle === 'rgba') { desc = { ...desc }; delete desc.swizzle; }
    return desc === undefined ? cv.call(this) : cv.call(this, desc);
  };
})();
