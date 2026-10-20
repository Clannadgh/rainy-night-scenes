const path = require('path');
const { chromium } = require(path.join(
  process.env.APPDATA || 'C:/Users/21921/AppData/Roaming',
  'npm/node_modules/playwright'
));

(async () => {
  const query = process.argv[2] || '?skipIntro=1';
  const out = process.argv[3] || 'qa/shot.png';
  const width = Number(process.argv[4] || 1480);
  const height = Number(process.argv[5] || 960);
  const waitMs = Number(process.argv[6] || 2600);
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-angle=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const messages = [];
  page.on('console', (msg) => messages.push(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => messages.push(`[pageerror] ${err.stack || err.message}`));
  page.on('requestfailed', (req) => messages.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`));
  await page.goto('file:///' + path.resolve('dev.html').replace(/\\/g, '/') + query, { waitUntil: 'load' });
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: out, timeout: 120000, animations: 'disabled' });
  console.log(messages.join('\n') || 'no console messages');
  await browser.close();
})();
