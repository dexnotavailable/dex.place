// usage: node render.js <srcDir> <out.png> [query]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const [,, src, out, qs] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto('file://' + path.resolve(__dirname, 'render.html') + '?src=' + encodeURIComponent(path.resolve(src)) + '&' + (qs || ''));
  await p.waitForFunction(() => document.title !== '', null, { timeout: 10000 });
  const t = await p.title();
  if (t !== 'OK') { console.log(t); process.exit(1); }
  const data = await p.evaluate(() => window.__png);
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  await b.close();
})();
