// Verifies Stage 02 on a site folder or URL: interactions + screenshots at 1440 / 820 / 390.
// NODE_PATH=<app>/node_modules node _tools/verify-stage02.cjs <siteDir|https://url> <outPrefix>   (screenshots: _tools/shots/)
const http = require('http'), fs = require('fs'), path = require('path');
const [TARGET, PREFIX = 'live'] = process.argv.slice(2);
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const T = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const start = () => new Promise((res) => {
  if (/^https?:/.test(TARGET)) return res({ base: TARGET.replace(/\/$/, ''), close: () => {} });
  const ROOT = path.resolve(TARGET);
  const srv = http.createServer((req, r) => {
    let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
    let f = path.join(ROOT, u); if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  }).listen(0, () => res({ base: 'http://localhost:' + srv.address().port, close: () => srv.close() }));
});
(async () => {
  const { base, close } = await start();
  const { chromium } = require('playwright-core');
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const fails = [], errs = [];
  const ok = (c, msg) => { if (!c) fails.push(msg); };
  const settle = async (p) => {
    await p.waitForTimeout(250);
    await p.evaluate(async () => { const r = document.getElementById('paths').getBoundingClientRect(); const y0 = scrollY + r.top; for (let y = 0; y < r.height; y += 400) { window.scrollTo(0, y0 + y); await new Promise((z) => setTimeout(z, 60)); } });
    await p.waitForFunction(() => [...document.querySelectorAll('#paths img')].filter((i) => i.offsetParent).every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 10000 }).catch(() => fails.push('images did not finish loading'));
    await p.waitForTimeout(250);
  };
  const shot = async (p, name) => { await settle(p); await (await p.$('#paths')).screenshot({ path: path.join(OUT, `${PREFIX}-${name}.jpg`), type: 'jpeg', quality: 82 }); };
  const state = (p) => p.evaluate(() => {
    const vis = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; };
    return { fit: vis('copyFit'), fight: vis('copyFight'), arcade: vis('copyArcade'), preview: vis('mcPreview'),
      title: (document.getElementById('mcTitle') || {}).textContent, backTo: (document.getElementById('mcBackTo') || {}).textContent,
      goal: (document.querySelector('.hub-goal.is-on') || {}).textContent, tab: (document.querySelector('.hub-tabs [aria-selected="true"]') || {}).id,
      picked: [...document.querySelectorAll('#paths .is-picked')].map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 20)) };
  });
  const click = (p, sel, text) => p.evaluate(([s, t]) => { const el = [...document.querySelectorAll(s)].find((e) => e.textContent.includes(t)); if (!el) throw new Error('no ' + t); el.click(); }, [sel, text]);

  for (const [w, h, tag] of [[1440, 900, 'desktop'], [820, 1180, 'tablet'], [390, 844, 'mobile']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(`${tag} pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag} console: ${m.text()}`); });
    p.on('response', (r) => { if (r.status() >= 400) errs.push(`${tag} HTTP ${r.status()} ${r.url()}`); });
    await p.goto(base + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
    await p.addStyleTag({ content: '.nav{position:static!important} html{scroll-behavior:auto!important}' });
    await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
    let s = await state(p);
    ok(s.fit && !s.fight && !s.arcade && !s.preview && s.goal === 'GET STRONGER' && s.tab === 'tabFit', `${tag} initial state ${JSON.stringify(s)}`);
    await shot(p, `fit-${tag}`);

    await click(p, '.hub-goal', 'LEARN TO FIGHT'); s = await state(p);
    ok(s.fight && !s.fit && !s.preview && s.tab === 'tabFight' && s.goal === 'LEARN TO FIGHT', `${tag} goal→fight ${JSON.stringify(s)}`);
    await shot(p, `fight-${tag}`);

    await click(p, '#hubFight .tm-band', 'TRAINING CAMP'); await p.waitForTimeout(500); s = await state(p);
    ok(s.preview && !s.fight && s.title === 'Train like you have a fight booked.' && s.backTo === 'FIGHT MODE' && s.picked.length === 1, `${tag} tap camp ${JSON.stringify(s)}`);
    ok(p.url().indexOf('features') === -1, `${tag} row tap navigated away`);
    await shot(p, `fight-camp-${tag}`);

    await p.click('#mcBack'); s = await state(p);
    ok(s.fight && !s.preview && s.picked.length === 0, `${tag} back ${JSON.stringify(s)}`);

    await click(p, '#hubFight .tm-tile', 'PRACTICE'); s = await state(p);
    ok(s.preview && s.title === 'Learn it right, then drill it.', `${tag} tap practice ${JSON.stringify(s)}`);
    await p.click('#tabArcade'); s = await state(p);
    ok(s.arcade && !s.preview && s.goal === 'PLAY THE GAME' && s.picked.length === 0, `${tag} tab→arcade ${JSON.stringify(s)}`);
    await shot(p, `arcade-${tag}`);

    await click(p, '.hub-goal', 'GET STRONGER'); await click(p, '#hubFit .tm-band', 'CARDIO'); s = await state(p);
    ok(s.preview && s.title === 'Run, ride, row.' && s.backTo === 'FIT MODE', `${tag} tap cardio ${JSON.stringify(s)}`);
    const img = await p.evaluate(() => document.getElementById('mcImg').getAttribute('src'));
    ok(/cardio-2026-10(-480)?\.webp$/.test(img), `${tag} preview image ${img}`);

    // keyboard on the tabs still works
    await p.focus('#tabFit'); await p.keyboard.press('ArrowRight'); s = await state(p);
    ok(s.tab === 'tabFight' && s.fight && !s.preview && s.goal === 'LEARN TO FIGHT', `${tag} keyboard ${JSON.stringify(s)}`);

    // START FREE opens the install sheet
    await p.evaluate(() => document.querySelector('#copyFight [data-install]').click()); await p.waitForTimeout(400);
    const modal = await p.evaluate(() => { const m = document.querySelector('.tmi'); return !!m && !m.hidden; });
    ok(modal, `${tag} START FREE did not open the install sheet`);
    const over = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    ok(!over, `${tag} horizontal overflow`);
    await ctx.close();
  }
  await b.close(); close();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console/page/HTTP errors');
  console.log(fails.length ? 'FAILED:\n' + fails.join('\n') : 'all interaction checks passed (3 widths)');
  process.exit(errs.length || fails.length ? 1 : 0);
})();
