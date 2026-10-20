/* 无头渲染截图工具（开发用）
   用法:
     node tools/shot.js --out output/shot.png [--wait 12000] [--dpr 1]
                        [--eval "window.__cam && window.__cam(...)"] [--url ...]
*/
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright-core'));

const args = {};
process.argv.slice(2).forEach(function (a, i, arr) {
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = arr[i + 1];
    args[key] = (next && !next.startsWith('--')) ? next : true;
  }
});

const ROOT = path.resolve(__dirname, '..');
const out = path.resolve(ROOT, args.out || 'output/shot.png');
fs.mkdirSync(path.dirname(out), { recursive: true });

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--allow-file-access-from-files',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

  const url = args.url || ('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(parseInt(args.wait || '12000', 10));

  if (args.eval) {
    const r = await page.evaluate(args.eval);
    console.log('eval -> ' + JSON.stringify(r));
    await page.waitForTimeout(parseInt(args.after || '1500', 10));
  }
  const cam = await page.evaluate("(() => window.__dio ? window.__dio.camera.position.toArray().map(v=>v.toFixed(2)).join(',') : 'NO_DIO')()");
  console.log('camera -> ' + cam);

  const title = await page.title();
  await page.screenshot({ path: out });
  console.log('title: ' + title);
  console.log('saved: ' + out);
  if (errors.length) console.log('errors:\n' + errors.slice(0, 10).join('\n'));
  else console.log('errors: none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
