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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file:///' + path.resolve('index.html').replace(/\\/g, '/') + '?skipIntro=1', { waitUntil: 'load' });
  await page.waitForTimeout(3200);

  const initial = await page.evaluate(() => {
    const c = window.__TSUKIMI.camera;
    return {
      pos: c.position.toArray().map((n) => +n.toFixed(2)),
      dist: +c.position.distanceTo(window.__TSUKIMI.controls.target).toFixed(2),
      canvas: { w: document.querySelector('canvas').clientWidth, h: document.querySelector('canvas').clientHeight },
      bodyChildren: [...document.body.children].map((n) => n.tagName),
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      viewport: [innerWidth, innerHeight],
      cursor: getComputedStyle(document.querySelector('canvas')).cursor,
    };
  });

  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.mouse.move(970, 520, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1400);
  const afterDrag = await page.evaluate(() => ({
    pos: window.__TSUKIMI.camera.position.toArray().map((n) => +n.toFixed(2)),
    cursor: getComputedStyle(document.querySelector('canvas')).cursor,
  }));

  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, -650);
  await page.waitForTimeout(1400);
  const afterWheel = await page.evaluate(() => {
    const s = window.__TSUKIMI;
    return {
      pos: s.camera.position.toArray().map((n) => +n.toFixed(2)),
      dist: +s.camera.position.distanceTo(s.controls.target).toFixed(2),
    };
  });

  await page.screenshot({ path: 'qa/interacted.png' });
  console.log(JSON.stringify({ initial, afterDrag, afterWheel, errors }, null, 2));
  await browser.close();
})();
