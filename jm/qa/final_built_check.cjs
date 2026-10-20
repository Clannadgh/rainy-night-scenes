const path = require('path');
const { chromium } = require(path.join(
  process.env.APPDATA || 'C:/Users/21921/AppData/Roaming',
  'npm/node_modules/playwright'
));

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-angle=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('file:///' + path.resolve('index.html').replace(/\\/g, '/') + '?skipIntro=1', { waitUntil: 'load' });
  await page.waitForTimeout(3600);
  // sample frame timing
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const t0 = performance.now();
    function tick() {
      frames++;
      if (performance.now() - t0 > 2000) resolve((frames / (performance.now() - t0)) * 1000);
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }));
  await page.screenshot({ path: 'qa/final_built.png', timeout: 120000, animations: 'disabled' });
  const info = await page.evaluate(() => ({
    camera: window.__TSUKIMI.camera.position.toArray().map((n) => +n.toFixed(2)),
    target: window.__TSUKIMI.controls.target.toArray().map((n) => +n.toFixed(2)),
    children: window.__TSUKIMI.scene.children.length,
  }));
  console.log(JSON.stringify({ errors, fps: +fps.toFixed(1), info }, null, 2));
  await browser.close();
})();
