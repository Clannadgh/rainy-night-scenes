new Promise((resolve) => {
  const renderer = window.__TSUKIMI.renderer;
  const info = () => ({
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    memory: { ...renderer.info.memory },
    drawingBuffer: { w: renderer.domElement.width, h: renderer.domElement.height },
  });
  let frames = 0;
  const start = performance.now();
  function tick() {
    frames += 1;
    const dt = performance.now() - start;
    if (dt < 4000) requestAnimationFrame(tick);
    else resolve({ frames, seconds: +(dt / 1000).toFixed(2), fps: +(frames / (dt / 1000)).toFixed(2), info: info(), introElapsed: window.__TSUKIMI.getIntro ? window.__TSUKIMI.getIntro() : null });
  }
  requestAnimationFrame(tick);
});
