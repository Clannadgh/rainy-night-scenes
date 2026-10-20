const t = Number(new URLSearchParams(location.search).get('intro') || 1.2);
window.__TSUKIMI.freezeIntro = true;
window.__TSUKIMI.setIntro(t);
'ok ' + t;
