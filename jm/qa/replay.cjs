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
  await page.waitForTimeout(2800);
  const before = await page.evaluate(() => ({
    intro: window.__TSUKIMI.getIntro(),
    cam: window.__TSUKIMI.camera.position.toArray().map((n) => +n.toFixed(2)),
  }));
  await page.keyboard.press('r');
  await page.waitForTimeout(4200);
  const after = await page.evaluate(() => ({
    intro: +window.__TSUKIMI.getIntro().toFixed(2),
    cam: window.__TSUKIMI.camera.position.toArray().map((n) => +n.toFixed(2)),
    labels: [...document.querySelectorAll('body > *')].map((n) => n.tagName),
  }));
  await page.screenshot({ path: 'qa/replay.png' });
  console.log(JSON.stringify({ before, after, errors }, null, 2));
  await browser.close();
})();
