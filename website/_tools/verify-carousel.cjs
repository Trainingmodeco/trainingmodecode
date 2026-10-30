// Verifies the Stage 03 saga carousel + follow links on a site folder or URL; writes shots/<prefix>-*.jpg
// NODE_PATH=<app>/node_modules node _tools/verify-carousel.cjs <siteDir|https://url> <prefix>   (screenshots: _tools/shots/)
const http = require('http'), fs = require('fs'), path = require('path');
const [TARGET, PREFIX = 'local'] = process.argv.slice(2);
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
  const state = (p) => p.evaluate(() => {
    const on = document.querySelector('#sagaCar .saga.is-on');
    const slides = [...document.querySelectorAll('#sagaCar .saga')];
    return { idx: slides.indexOf(on), title: on && on.querySelector('.saga__title').textContent, dot: [...document.querySelectorAll('.saga-car__dot')].findIndex((d) => d.classList.contains('is-on')),
      toast: (() => { const t = document.querySelector('.saga-car__toast'); return t.hidden ? null : t.textContent; })(),
      modal: (() => { const m = document.querySelector('.tmi'); return !!m && !m.hidden; })(),
      paused: document.querySelector('.saga-car__pause').getAttribute('aria-pressed'),
      loaded: slides.filter((s) => !s.classList.contains('is-far')).every((s) => { const i = s.querySelector('img'); return i.complete && i.naturalWidth > 0; }) };
  });
  const toArcade = async (p) => { await p.evaluate(() => document.getElementById('arcade').scrollIntoView({ block: 'start' })); await p.mouse.move(2, 2); await p.waitForTimeout(300); };
  const shot = async (p, sel, name) => { await p.waitForTimeout(700); await (await p.$(sel)).screenshot({ path: path.join(OUT, `${PREFIX}-${name}.jpg`), type: 'jpeg', quality: 82 }); };
  const watch = (p, tag) => {
    p.on('pageerror', (e) => errs.push(`${tag} pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag} console: ${m.text()}`); });
    p.on('response', (r) => { if (r.status() >= 400) errs.push(`${tag} HTTP ${r.status()} ${r.url()}`); });
  };

  // ---------- desktop ----------
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  let p = await ctx.newPage(); watch(p, 'desktop');
  await p.goto(base + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: '.nav{position:static!important} html{scroll-behavior:auto!important}' });
  await toArcade(p);
  let s = await state(p);
  ok(s.idx === 0 && s.title === 'One Hundred' && s.dot === 0 && s.paused === 'false', 'desktop initial ' + JSON.stringify(s));
  ok(s.loaded, 'desktop visible posters not loaded');
  await shot(p, '#arcade', 'arcade-desktop');
  await p.waitForTimeout(4200); s = await state(p);
  ok(s.idx === 1 && s.title === 'The Gravity Chamber', 'desktop autoplay did not advance ' + JSON.stringify(s));
  const box = await (await p.$('.saga-car__view')).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + 60); await p.waitForTimeout(4500); s = await state(p);
  ok(s.idx === 1, 'desktop hover did not pause ' + JSON.stringify(s));
  await p.mouse.move(2, 2); await p.waitForTimeout(4300); s = await state(p);
  ok(s.idx === 2, 'desktop did not resume after hover ' + JSON.stringify(s));
  await p.click('.saga-car__pause'); await p.mouse.move(2, 2); await p.waitForTimeout(4300); s = await state(p);
  ok(s.idx === 2 && s.paused === 'true', 'desktop pause button ' + JSON.stringify(s));
  await p.click('.saga-car__dot:nth-child(1)'); await p.click('.saga-car__arrow--prev'); s = await state(p);
  ok(s.idx === 12 && s.title === 'The Dragon', 'desktop prev wrap ' + JSON.stringify(s));
  await p.click('.saga-car__arrow--next'); await p.click('.saga-car__arrow--next'); s = await state(p);
  ok(s.idx === 1, 'desktop next wrap ' + JSON.stringify(s));
  // locked centre card → toast, no install sheet
  await p.click('.saga-car__dot:nth-child(6)'); await p.waitForTimeout(700);
  await p.click('#sagaCar .saga.is-on .saga__card'); s = await state(p);
  ok(s.title === 'The Struggler' && s.toast === 'UNDER CONSTRUCTION' && !s.modal, 'desktop locked tap ' + JSON.stringify(s));
  await shot(p, '.stage__grid:has(#sagaCar)', 'locked-desktop');
  // a side card → slides to centre, no sheet
  const side = await p.evaluate(() => { const sl = [...document.querySelectorAll('#sagaCar .saga')]; const r = sl[6].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.click(side.x, side.y); await p.waitForTimeout(700); s = await state(p);
  ok(s.idx === 6 && !s.modal, 'desktop side card ' + JSON.stringify(s));
  // drag to the next saga
  await p.mouse.move(box.x + box.width / 2 + 80, box.y + 200); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 - 60, box.y + 205, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(300); s = await state(p);
  ok(s.idx === 7 && !s.modal, 'desktop drag ' + JSON.stringify(s));
  // keyboard
  await p.focus('.saga-car__arrow--next'); await p.keyboard.press('ArrowLeft'); s = await state(p);
  ok(s.idx === 6, 'desktop keyboard ' + JSON.stringify(s));
  // live centre card → install sheet
  await p.click('.saga-car__dot:nth-child(4)'); await p.waitForTimeout(700);
  await p.click('#sagaCar .saga.is-on .saga__card'); await p.waitForTimeout(400); s = await state(p);
  ok(s.title === 'The Destroyer' && s.modal, 'desktop live tap did not open the install sheet ' + JSON.stringify(s));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.tm-tile.follow').scrollIntoView({ block: 'center' }));
  await shot(p, '#contact .stage__grid', 'follow-desktop');
  const links = await p.evaluate(() => [...document.querySelectorAll('.follow__link')].map((a) => ({ t: a.textContent, h: a.href, border: getComputedStyle(a).borderTopWidth })));
  ok(links.length === 4 && links.every((l) => l.border === '0px'), 'follow links ' + JSON.stringify(links));
  await ctx.close();

  // ---------- phone ----------
  ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p = await ctx.newPage(); watch(p, 'mobile');
  await p.goto(base + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
  await p.addStyleTag({ content: '.nav{position:static!important} html{scroll-behavior:auto!important}' });
  await toArcade(p);
  await p.evaluate(() => document.getElementById('sagaCar').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  s = await state(p); ok(s.idx === 0 && s.loaded, 'mobile initial ' + JSON.stringify(s));
  await p.waitForTimeout(4200); s = await state(p);
  ok(s.idx === 1, 'mobile autoplay ' + JSON.stringify(s));
  await p.evaluate(() => document.getElementById('arcade').scrollIntoView({ block: 'start' }));
  await shot(p, '#arcade', 'arcade-mobile');
  await p.evaluate(() => document.querySelector('.tm-tile.follow').scrollIntoView({ block: 'center' }));
  await shot(p, '.tm-tile.follow', 'follow-mobile');
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'mobile horizontal overflow');
  await ctx.close();

  // ---------- reduced motion: starts paused ----------
  ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  p = await ctx.newPage(); watch(p, 'reduced');
  await p.goto(base + '/?v=' + Date.now(), { waitUntil: 'networkidle' }); await toArcade(p);
  await p.waitForTimeout(4200); s = await state(p);
  ok(s.idx === 0 && s.paused === 'true', 'reduced motion should not auto-rotate ' + JSON.stringify(s));
  await ctx.close();

  await b.close(); close();
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console/page/HTTP errors');
  console.log(fails.length ? 'FAILED:\n' + fails.join('\n') : 'all carousel + follow checks passed');
  process.exit(errs.length || fails.length ? 1 : 0);
})();
