const path = require('path');
const { chromium } = require(path.join(
  process.env.APPDATA || 'C:/Users/21921/AppData/Roaming',
  'npm/node_modules/playwright'
));

const shots = [
  { name: 'frontA', cam: [6.0, 5.2, 17.0, -2.9, 2.4, 0.2, 36] },
  { name: 'frontB', cam: [6.0, 4.2, 16.0, -2.9, 2.3, 0.3, 34] },
  { name: 'frontC', cam: [4.0, 4.8, 18.0, -2.9, 2.4, 0.3, 34] },
  { name: 'frontD', cam: [7.0, 5.6, 16.0, -2.9, 2.5, 0.3, 36] },
  { name: 'frontE', cam: [5.5, 6.2, 14.4, -2.9, 2.6, 0.5, 38] },
  { name: 'frontF', cam: [5.8, 5.5, 19.5, -2.9, 2.7, 0.5, 31] },
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
  await page.waitForTimeout(2600);
  for (const s of shots) {
    await page.evaluate((cam) => window.__TSUKIMI.setCamera(...cam), s.cam);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `qa/${s.name}.png` });
    console.log('shot', s.name);
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
