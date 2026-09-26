// usage: node run.mjs "<query>" <outName>   e.g. node run.mjs "model=models/x.pmx&motion=models/atk.vmd&frames=120" atk1
// Serves this folder on localhost (ES modules can't load from file://), renders in headless
// Chromium, writes out/<name>.json (joint tracks) and out/<name>.png (sprite-scale frames).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const root = path.dirname(new URL(import.meta.url).pathname);
const [, , qs = '', name = 'test'] = process.argv;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.bmp': 'image/bmp', '.tga': 'application/octet-stream' };
const srv = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0, async () => {
  const port = srv.address().port;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage();
  pg.on('pageerror', (e) => console.log('pageerror:', e.message));
  await pg.goto(`http://127.0.0.1:${port}/lab.html?${qs}`);
  await pg.waitForFunction(() => document.title !== 'model-lab', null, { timeout: 120000 });
  const t = await pg.title();
  if (t !== 'OK') { console.log(t); await b.close(); srv.close(); process.exit(1); }
  const out = await pg.evaluate(() => window.__out);
  fs.mkdirSync(path.join(root, 'out'), { recursive: true });
  const frames = out.frames; delete out.frames;
  fs.writeFileSync(path.join(root, 'out', name + '.json'), JSON.stringify(out));
  frames.forEach((d, i) => fs.writeFileSync(path.join(root, 'out', `${name}-f${String(i).padStart(3, '0')}.png`), Buffer.from(d.split(',')[1], 'base64')));
  console.log('bones', JSON.stringify(out.bones), 'frames', frames.length);
  await b.close(); srv.close();
});
