const path = require('path');
const { chromium } = require(path.join(
  process.env.APPDATA || 'C:/Users/21921/AppData/Roaming',
  'npm/node_modules/playwright'
));

const shots = [
  { name: 'compA', cam: [9.5, 8.2, 23.5, -2.8, 3.0, 0.4, 34] },
  { name: 'compB', cam: [8.6, 7.3, 22.5, -2.8, 2.8, 0.4, 35] },
  { name: 'compC', cam: [11.2, 8.4, 23.0, -2.8, 3.0, 0.2, 36] },
  { name: 'compD', cam: [8.0, 7.0, 21.0, -2.7, 2.7, 0.3, 36] },
  { name: 'compE', cam: [10.2, 9.0, 24.5, -2.9, 3.1, 0.3, 38] },
  { name: 'compF', cam: [7.2, 6.2, 20.5, -2.6, 2.6, 0.4, 37] },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-angle=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file:///' + path.resolve('dev.html').replace(/\\/g, '/') + '?skipIntro=1', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  for (const s of shots) {
    await page.evaluate((cam) => window.__TSUKIMI.setCamera(...cam), s.cam);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `qa/${s.name}.png` });
    console.log('shot', s.name);
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
