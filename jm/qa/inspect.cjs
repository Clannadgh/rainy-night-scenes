const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(
  process.env.APPDATA || 'C:/Users/21921/AppData/Roaming',
  'npm/node_modules/playwright'
));

(async () => {
  const query = process.argv[2] || '?skipIntro=1';
  const out = process.argv[3] || 'qa/inspect.png';
  let script = process.argv[4] || '';
  if (script.startsWith('@')) script = fs.readFileSync(script.slice(1), 'utf8');
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--use-angle=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1480, height: 960 }, deviceScaleFactor: 1 });
  const messages = [];
  page.on('console', (msg) => messages.push(`[console:${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => messages.push(`[pageerror] ${err.stack || err.message}`));
  await page.goto('file:///' + path.resolve('dev.html').replace(/\\/g, '/') + query, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  if (script) {
    try {
      const result = await page.evaluate(script);
      console.log('EVAL:', JSON.stringify(result));
    } catch (e) {
      console.log('EVAL ERROR:', e.message);
    }
    await page.waitForTimeout(2600);
  }
  await page.screenshot({ path: out });
  console.log(messages.join('\n') || 'no console messages');
  await browser.close();
})();
