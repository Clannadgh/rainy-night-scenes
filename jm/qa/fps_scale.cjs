const path = require('path');
const { chromium } = require(path.join(process.env.APPDATA || 'C:/Users/21921/AppData/Roaming','npm/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=angle','--enable-webgl','--ignore-gpu-blocklist'] });
  for (const [w,h] of [[800,450],[400,225]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto('file:///' + path.resolve('index.html').replace(/\\/g,'/') + '?skipIntro=1', { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    const fps = await page.evaluate(() => new Promise((res) => { let f=0; const t0=performance.now(); function t(){f++; if(performance.now()-t0>2000) res(f/(performance.now()-t0)*1000); else requestAnimationFrame(t);} requestAnimationFrame(t); }));
    console.log(w+'x'+h, fps.toFixed(1));
    await page.close();
  }
  await browser.close();
})();
