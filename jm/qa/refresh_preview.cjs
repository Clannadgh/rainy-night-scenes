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
  await page.goto('file:///' + path.resolve('dev.html').replace(/\\/g, '/') + '?skipIntro=1', { waitUntil: 'load' });
  await page.waitForTimeout(3600);
  await page.screenshot({ path: 'preview.png', timeout: 120000, animations: 'disabled' });
  await page.evaluate(() => window.__TSUKIMI.setCamera(5.4, 4.0, 13.2, -2.0, 1.9, 1.3, 32));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'preview-detail.png', timeout: 120000, animations: 'disabled' });
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
