const path = require('path');
const { chromium } = require(path.join(
  process.env.APPDATA || 'C:/Users/21921/AppData/Roaming',
  'npm/node_modules/playwright'
));

const shots = [
  { name: 'windowA', cam: [5.8, 4.1, 13.8, -2.2, 1.9, 1.4, 32] },
  { name: 'windowB', cam: [6.2, 3.4, 14.6, -1.8, 2.0, 1.2, 30] },
  { name: 'insideA', cam: [6.0, 4.0, 12.8, -0.2, 1.8, 0.4, 30] },
  { name: 'checkoutA', cam: [10.0, 4.0, 10.0, 2.7, 1.8, -1.4, 30] },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-angle=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file:///' + path.resolve('dev.html').replace(/\\/g, '/') + '?skipIntro=1', { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  for (const s of shots) {
    await page.evaluate((cam) => window.__TSUKIMI.setCamera(...cam), s.cam);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `qa/${s.name}.png` });
    console.log('shot', s.name);
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
