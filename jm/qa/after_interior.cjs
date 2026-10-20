const path = require('path');
const { chromium } = require(path.join(
  process.env.APPDATA || 'C:/Users/21921/AppData/Roaming',
  'npm/node_modules/playwright'
));

const shots = [
  { name: 'after_default', cam: null },
  { name: 'after_front', cam: [5.8, 5.6, 17.5, -2.6, 2.35, 0.6, 36] },
  { name: 'after_window', cam: [5.4, 4.0, 13.2, -2.0, 1.9, 1.3, 32] },
  { name: 'after_door', cam: [8.4, 4.6, 13.4, 0.6, 1.8, -1.2, 32] },
  { name: 'after_glass2', cam: [4.2, 3.9, 14.6, -0.7, 2.0, 1.0, 31] },
];

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
  await page.waitForTimeout(3200);
  for (const s of shots) {
    if (s.cam) {
      await page.evaluate((cam) => window.__TSUKIMI.setCamera(...cam), s.cam);
      await page.waitForTimeout(350);
    }
    await page.screenshot({ path: `qa/${s.name}.png`, timeout: 120000, animations: 'disabled' });
    console.log('shot', s.name);
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
