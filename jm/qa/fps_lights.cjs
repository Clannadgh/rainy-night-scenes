const path = require('path');
const { chromium } = require(path.join(process.env.APPDATA || 'C:/Users/21921/AppData/Roaming','npm/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=angle','--enable-webgl','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.resolve('index.html').replace(/\\/g,'/') + '?skipIntro=1', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const measure = () => new Promise((res) => { let f=0; const t0=performance.now(); function t(){f++; if(performance.now()-t0>2000) res(f/(performance.now()-t0)*1000); else requestAnimationFrame(t);} requestAnimationFrame(t); });
  const withLights = await page.evaluate(measure);
  const noLights = await page.evaluate(async () => {
    window.__TSUKIMI.scene.traverse((o) => { if (o.isPointLight || o.isDirectionalLight || o.isHemisphereLight || o.isAmbientLight) o.visible = false; });
    return await new Promise((res) => { let f=0; const t0=performance.now(); function t(){f++; if(performance.now()-t0>2000) res(f/(performance.now()-t0)*1000); else requestAnimationFrame(t);} requestAnimationFrame(t); });
  });
  console.log(JSON.stringify({ withLights: +withLights.toFixed(2), noLights: +noLights.toFixed(2) }));
  await browser.close();
})();
