// usage: node run.js outdir view1 view2 ...   (view "tex" dumps the albedo maps)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const root = __dirname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);

(async () => {
  const port = server.address().port;
  const [outdir, ...views] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[err]', e.message));
  await page.goto(`http://localhost:${port}/scene.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
  for (const v of views) {
    const t = Date.now();
    if (v === 'tex') {
      for (const [w, m] of [['upper', 'albedo'], ['lower', 'albedo']]) {
        const url = await page.evaluate(([w, m]) => window.textureDataURL(w, m), [w, m]);
        fs.writeFileSync(path.join(outdir, `tex_${w}_${m}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
      }
      continue;
    }
    const [name, ...kv] = v.split(':');
    const opts = {}; kv.forEach(s => { const [k, val] = s.split('='); opts[k] = isNaN(+val) ? (val === 'true' ? true : val) : +val; });
    const url = await page.evaluate(([n, o]) => window.renderView(n, o), [name, opts]);
    const ext = url.startsWith('data:image/png') ? 'png' : 'jpg';
    const file = path.join(outdir, `${opts.out || name}.${ext}`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', file, ((Date.now() - t) / 1000).toFixed(1) + 's');
  }
  await browser.close(); server.close();
})();
