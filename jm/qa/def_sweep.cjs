const path = require('path');
const { chromium } = require(path.join(
  process.env.APPDATA || 'C:/Users/21921/AppData/Roaming',
  'npm/node_modules/playwright'
));

const shots = [
  { name: 'defA', cam: [6.6, 6.0, 18.9, -2.75, 2.5, 0.5, 36] },
  { name: 'defB', cam: [7.2, 6.4, 20.0, -2.75, 2.55, 0.45, 36] },
  { name: 'defC', cam: [6.0, 5.7, 17.8, -2.7, 2.45, 0.6, 36] },
  { name: 'defD', cam: [7.8, 6.8, 20.8, -2.8, 2.65, 0.4, 36] },
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
  await page.waitForTimeout(3000);
  for (const s of shots) {
    await page.evaluate((cam) => window.__TSUKIMI.setCamera(...cam), s.cam);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `qa/${s.name}.png`, timeout: 120000, animations: 'disabled' });
    console.log('shot', s.name);
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
