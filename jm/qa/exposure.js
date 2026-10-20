const e = Number(new URLSearchParams(location.search).get('exp') || 1.0);
window.__TSUKIMI.renderer.toneMappingExposure = e;
e;
