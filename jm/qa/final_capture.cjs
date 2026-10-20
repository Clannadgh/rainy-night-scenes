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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file:///' + path.resolve('index.html').replace(/\\/g, '/') + '?skipIntro=1', { waitUntil: 'load' });
  await page.waitForTimeout(3200);
  await page.screenshot({ path: 'preview.png' });
  await page.evaluate(() => {
    window.__TSUKIMI.setCamera(9, 7.5, 18, -3.4, 3, -0.7, 36);
  });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'preview-detail.png' });
  const state = await page.evaluate(() => ({
    children: [...document.body.children].map((n) => n.tagName),
    canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height],
    camera: window.__TSUKIMI.camera.position.toArray().map((n) => +n.toFixed(2)),
  }));
  console.log(JSON.stringify({ state, errors }, null, 2));
  await browser.close();
})();
