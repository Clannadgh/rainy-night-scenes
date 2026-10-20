const path = require('path');
const { chromium } = require(path.join(
  process.env.APPDATA || 'C:/Users/21921/AppData/Roaming',
  'npm/node_modules/playwright'
));

const shots = [
  { name: 'in_leftwall', cam: [2.2, 3.0, 10.5, -6.8, 1.4, -0.4, 30] },
  { name: 'in_back', cam: [2.0, 3.6, 9.0, -1.0, 1.6, -6.0, 32] },
  { name: 'in_door2', cam: [3.6, 3.2, 9.6, 0.2, 1.5, -2.2, 32] },
  { name: 'in_mid', cam: [3.2, 3.2, 11.4, -4.2, 1.5, -4.0, 30] },
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
  await page.goto('file:///' + path.resolve('dev.html').replace(/\\/g, '/') + '?skipIntro=1&hideGlass=1', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  if (await page.evaluate(() => typeof window.__TSUKIMI.hideGlass === 'function')) {
    await page.evaluate(() => window.__TSUKIMI.hideGlass());
  }
  for (const s of shots) {
    await page.evaluate((cam) => window.__TSUKIMI.setCamera(...cam), s.cam);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `qa/${s.name}.png`, timeout: 120000, animations: 'disabled' });
    console.log('shot', s.name);
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
