const q = new URLSearchParams(location.search);
const mode = q.get('tm') || 'neutral';
const T = window.__TSUKIMI.THREE;
if (mode === 'neutral') window.__TSUKIMI.renderer.toneMapping = T.NeutralToneMapping;
else if (mode === 'agx') window.__TSUKIMI.renderer.toneMapping = T.AgXToneMapping;
else if (mode === 'aces') window.__TSUKIMI.renderer.toneMapping = T.ACESFilmicToneMapping;
window.__TSUKIMI.renderer.toneMappingExposure = Number(q.get('exp') || 1.0);
mode;
