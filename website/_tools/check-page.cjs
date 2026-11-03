// node check-page.cjs <siteDir> <pagePath>  (run with NODE_PATH pointing at the app project's node_modules)
// Serves <siteDir>, opens <pagePath> at 1440px and 390px, prints console/page errors, missing images and heights.
const http = require('http'), fs = require('fs'), path = require('path');
const [ROOTARG, PAGE] = process.argv.slice(2);
const ROOT = path.resolve(ROOTARG);
const T = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  let f = path.join(ROOT, u); if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f = f + '.html';
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0, async () => {
  const base = 'http://localhost:' + srv.address().port;
  const url = base + '/' + (PAGE || 'index.html').replace(/^\/+/, '');
  const { chromium } = require('playwright-core');
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let problems = 0;
  for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message).slice(0, 200)));
    p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
    p.on('requestfailed', (r) => errs.push('request failed: ' + r.url().replace(base, '')));
    p.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()}: ` + r.url().replace(base, '')); });
    await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    await p.evaluate(async () => { document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')); window.scrollTo(0, document.body.scrollHeight); await new Promise((r) => setTimeout(r, 600)); window.scrollTo(0, 0); });
    await p.waitForTimeout(600);
    const info = await p.evaluate(() => ({
      height: document.body.scrollHeight,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      brokenImgs: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')).slice(0, 10),
      stages: [...document.querySelectorAll('.stage, section')].length,
      title: document.title,
    }));
    console.log(`[${tag}] ${PAGE}: height ${info.height}px, sections ${info.stages}, overflow-x ${info.overflowX ? 'YES (bad)' : 'no'}, title "${info.title}"`);
    if (info.brokenImgs.length) { problems++; console.log(`[${tag}] broken images: ${info.brokenImgs.join(', ')}`); }
    if (info.overflowX) problems++;
    for (const e of [...new Set(errs)]) { problems++; console.log(`[${tag}] ${e}`); }
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(problems ? `check-page: ${problems} problem(s)` : 'check-page: OK — no errors, no broken images, no horizontal overflow');
  process.exit(problems ? 1 : 0);
});
