// The cut editor's fixes after the independent check of 2026-11-18 (review findings 0.x, break-test findings 1.x), each replayed. Phone context with real touch events.
// Run: node test/build.cjs && node test/cut-fixes.cjs
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const blob = u.startsWith('/_blob/') ? u.slice(7) : null;
  const made = blob && /^[A-Za-z0-9]+$/.test(blob) ? ['.jpg', '.mp4'].map((x) => path.join(ROOT, 'blobs', blob + x)).find((x) => fs.existsSync(x)) : null;
  if (blob && !made) { res.writeHead(200, { 'Content-Type': 'video/mp4' }); return res.end(Buffer.alloc(16)); }
  const f = made || path.join(ROOT, u.replace(/^\//, '') || 'index.html');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(f).size, m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const type = TYPES[path.extname(f)] || 'application/octet-stream';
  if (m) { const a = +m[1] || 0, b = m[2] ? +m[2] : size - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(f, { start: a, end: b }).pipe(res); }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(res);
});
const PROXY = 'proxyC00000000000000000000000000';
const NOW = () => new Date().toISOString();
const seg = (o) => Object.assign({ clipId: 'c1', folder: 'bodyweight', file: 'IMG_0300.MOV', clipDur: 18, idx: 1, start: 1, end: 16.4, period: 0.92, reps: 16, kind: 'exercise', group: 0, guess: { name: 'Vertical Leg Crunches', entryId: null, confidence: 0.7, view: 'front' }, hold: null, warn: [], why: '' }, o);
const out = [], errs = [];
const ok = (name, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond && !extra ? '' : ' ' + (extra || ''))); };

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  // One fresh page per scenario: the mock keeps its store in sessionStorage per page.
  async function page(segs, clips) {
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(base + 'index.html#raw'); await p.waitForSelector('#tabs button');
    await p.evaluate(() => sessionStorage.clear());
    const k = mk(p);
    await k.seed('segs', segs); await k.seed('clips', clips || { c1: { clipId: 'c1', dur: 18, proxy: PROXY, w: 480, h: 270, fps: 15, updatedAt: NOW() } });
    await p.waitForSelector('#sgc-' + Object.keys(segs)[0]);
    return k;
  }
  const mk = (p) => {
    const wait = (ms) => p.waitForTimeout(ms || 200);
    const k = {
      p, wait,
      seed: async (col, docs) => { await p.evaluate(([c, d]) => Object.keys(d).forEach((x) => window.__mock.seed(c, x, d[x])), [col, docs]); await wait(250); },
      store: () => p.evaluate(() => JSON.parse(JSON.stringify(window.__mock.store()))),
      item: async (x) => (await k.store())[x] || null,
      live: () => p.evaluate(() => document.getElementById('live').textContent),
      vt: () => p.evaluate(() => { const v = document.querySelector('video[data-cxv]'); return v ? Math.round(v.currentTime * 100) / 100 : null; }),
      seek: async (t) => { await p.evaluate((t) => { const v = document.querySelector('video[data-cxv]'); v.pause(); v.currentTime = t; }, t); await wait(250); },
      attr: (sel, a) => p.locator(sel).getAttribute(a),
      now: (sid, w) => p.locator('[data-cxh="' + w + '"][data-id="' + sid + '"]').getAttribute('aria-valuenow').then(Number),
      open: async (sid) => {
        if ((await p.locator('details[data-cut="' + sid + '"]').getAttribute('open')) === null) { await p.locator('summary[data-cutsum="' + sid + '"]').click(); await wait(400); }
        if (!(await p.locator('#sgc-' + sid + ' video[data-cxv]').count())) { await p.locator('[data-cxa="open"][data-id="' + sid + '"]').click(); await wait(400); }
        await p.waitForFunction(() => { const v = document.querySelector('video[data-cxv]'); return v && v.readyState >= 1; }, null, { timeout: 8000 }).catch(() => {});
        await p.locator('[data-cxbar="' + sid + '"]').scrollIntoViewIfNeeded(); await wait(300);
      },
      cdp: null,
      touch: async (pts) => { if (!k.cdp) k.cdp = await ctx.newCDPSession(p); for (const [type, x, y] of pts) { await k.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] }); await p.waitForTimeout(20); } await wait(250); },
      swipe: async (x0, y0, x1, y1, n) => { n = n || 10; const pts = [['touchStart', x0, y0]]; for (let i = 1; i <= n; i++) pts.push(['touchMove', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); pts.push(['touchEnd']); await k.touch(pts); },
      tap: async (x, y) => k.touch([['touchStart', x, y], ['touchEnd']]),
      box: (sel) => p.locator(sel).boundingBox(),
    };
    return k;
  };

  // ---------- 0.1 / 1.5 / 1.6: taps, swipes and short stretches on a phone ----------
  {
    const k = await page({ 'c1-01': seg({ start: 2, end: 14 }) }); const p = k.p;
    await k.open('c1-01');
    const bar = await k.box('[data-cxbar="c1-01"]'), h = await k.box('[data-cxh="from"][data-id="c1-01"]'), cx = h.x + h.width / 2, cy = bar.y + bar.height / 2;
    await k.tap(cx + 6, cy);
    ok('[0.1] a tap 6 px off the start handle does not move the start', (await k.now('c1-01', 'from')) === 2 && !(await p.evaluate(() => document.getElementById('sg-from-c1-01').value)), String(await k.now('c1-01', 'from')));
    ok('[0.1] a tap on a handle takes the play mark to that end', Math.abs((await k.vt()) - 2) < 0.1, String(await k.vt()));
    await k.tap(cx + 25, cy);
    ok('[0.1] a tap 25 px right of the start handle (past its grip) only moves the play mark', (await k.now('c1-01', 'from')) === 2 && (await k.vt()) > 2.1, (await k.now('c1-01', 'from')) + ' / ' + (await k.vt()));
    const y0 = await p.evaluate(() => window.scrollY), toBefore = await k.now('c1-01', 'to'), hb = await k.box('[data-cxh="to"][data-id="c1-01"]');
    await k.swipe(hb.x + hb.width / 2 + 12, cy, hb.x + hb.width / 2 + 12, cy - 200, 12);
    const y1 = await p.evaluate(() => window.scrollY);
    ok('[1.5] an upward swipe that starts on the bar scrolls the page', y1 > y0 + 50, y0 + ' -> ' + y1);
    ok('[1.5] and leaves the cut alone', (await k.now('c1-01', 'to')) === toBefore && !(await p.evaluate(() => document.getElementById('sg-to-c1-01').value)));
    await k.open('c1-01');
    const h2 = await k.box('[data-cxh="from"][data-id="c1-01"]'), bar2 = await k.box('[data-cxbar="c1-01"]');
    await k.swipe(h2.x + h2.width / 2, bar2.y + bar2.height / 2, h2.x + h2.width / 2 + 60, bar2.y + bar2.height / 2, 10);
    const f2 = await k.now('c1-01', 'from'), want = 2 + 60 / bar2.width * 18;
    ok('[0.1] a sideways drag of the start handle moves it by the drag, with no jump', Math.abs(f2 - want) < 0.35, f2 + ' vs ' + want.toFixed(2));
    await p.close();
  }
  {
    const k = await page({ 'c1-01': seg({ start: 4, end: 4.7 }) }); const p = k.p;
    await k.open('c1-01');
    const h = await k.box('[data-cxh="from"][data-id="c1-01"]'), bar = await k.box('[data-cxbar="c1-01"]'), cy = bar.y + bar.height / 2;
    await k.swipe(h.x + h.width / 2, cy, h.x + h.width / 2 - 48, cy, 10);
    const f = await k.now('c1-01', 'from'), t = await k.now('c1-01', 'to');
    ok('[1.6] on a 0.7 s stretch, dragging the start handle left widens the start (the end stays)', f < 3.5 && t === 4.7, f + ' / ' + t);
    await p.close();
  }

  // ---------- 0.2 / 1.2: a split never leaves two stretches over the same seconds ----------
  {
    const k = await page({ 'c1-01': seg({}) }); const p = k.p;
    await k.open('c1-01'); await k.seek(8);
    await p.evaluate(() => window.__mock.failNext(1, 'unavailable'));
    await p.evaluate(() => window.__mock.failNext(2, 'resource_exhausted'));
    await p.locator('[data-cxa="split"][data-id="c1-01"]').click(); await k.wait(900);
    let st = await k.store();
    ok('[0.2] when the first write of a split fails, nothing is split', !st['add.c1-u01'] && !(st['seg.c1-01'] && st['seg.c1-01'].to != null), JSON.stringify(st));
    await p.evaluate(() => { window.__mock.failNext(0); window.__mock.delay = 300; }); await k.seek(8);
    await p.locator('[data-cxa="split"][data-id="c1-01"]').click(); await k.wait(450);
    await p.evaluate(() => window.__mock.failNext(1, 'resource_exhausted'));
    await k.wait(1600);
    st = await k.store();
    ok('[0.2] when the second write fails, the stretch gets its end back and nothing is added', !Object.keys(st).some((x) => x.startsWith('add.')) && st['seg.c1-01'] && st['seg.c1-01'].to === null, JSON.stringify(st));
    ok('[0.2] and the owner is told the split did not go through', /did not go through/.test(await k.live()), await k.live());
    await p.evaluate(() => { window.__mock.failNext(0); window.__mock.delay = 600; }); await k.seek(8);
    await p.locator('[data-cxa="split"][data-id="c1-01"]').click(); await k.wait(120);
    ok('[1.2] while a split is being saved, Save cut on that card is not pressable', await p.locator('[data-cxa="save"][data-id="c1-01"]').isDisabled());
    await p.locator('[data-cxa="save"][data-id="c1-01"]').click({ force: true }).catch(() => {}); await k.wait(2200);
    st = await k.store();
    const adds = Object.keys(st).filter((x) => x.startsWith('add.'));
    ok('[1.2] the split lands whole: one added part from 8 s and the first part ends at 8 s', adds.length === 1 && st[adds[0]].start === 8 && st['seg.c1-01'].to === 8, JSON.stringify(st));
    await p.evaluate(() => { window.__mock.delay = 0; });
    await p.close();
  }

  // ---------- 1.1 / 0.9: Remove takes two taps, a double tap reaches nothing else, the first part gets its seconds back ----------
  {
    const k = await page({ 'c1-01': seg({}) }); const p = k.p;
    await k.open('c1-01'); await k.seek(7);
    await p.locator('[data-cxa="split"][data-id="c1-01"]').click(); await k.wait(700);
    await p.locator('#sg-name-c1-u01').fill('Scissor Kicks'); await p.locator('[data-sgsave="c1-u01"]').click(); await k.wait(400);
    await k.seek(12.5);
    await p.locator('[data-cxa="add"][data-id="c1-u01"]').click(); await k.wait(700);
    ok('two added stretches are on the board', !!(await k.item('add.c1-u01')) && !!(await k.item('add.c1-u02')));
    await p.locator('[data-cxa="del"][data-id="c1-u02"]').scrollIntoViewIfNeeded(); await k.wait(300);
    const rb = await k.box('[data-cxa="del"][data-id="c1-u02"]');
    await k.tap(rb.x + rb.width / 2, rb.y + rb.height / 2); await k.wait(120); await k.tap(rb.x + rb.width / 2, rb.y + rb.height / 2); await k.wait(150); await k.tap(rb.x + rb.width / 2, rb.y + rb.height / 2); await k.wait(700);
    const st = await k.store();
    ok('[1.1] a triple tap on Remove removes that one stretch only', !st['add.c1-u02'] && !!st['add.c1-u01'] && st['seg.c1-u01'] && st['seg.c1-u01'].name === 'Scissor Kicks', Object.keys(st).join(','));
    await k.wait(900);
    const rb1 = p.locator('[data-cxa="del"][data-id="c1-u01"]');
    await rb1.click(); await k.wait(200); await rb1.click(); await k.wait(700);
    const s2 = await k.store();
    ok('[0.9] removing the part split off gives the first part its end back', !s2['add.c1-u01'] && s2['seg.c1-01'] && s2['seg.c1-01'].to === null, JSON.stringify(s2['seg.c1-01']));
    await p.close();
  }

  // ---------- 0.9: Auto cut on a stretch that was split ----------
  {
    const k = await page({ 'c1-01': seg({}) }); const p = k.p;
    await k.open('c1-01'); await k.seek(8);
    await p.locator('[data-cxa="split"][data-id="c1-01"]').click(); await k.wait(700);
    await k.open('c1-01');
    await p.locator('[data-cxa="auto"][data-id="c1-01"]').click(); await k.wait(400);
    ok('[0.9] Auto cut on a split stretch is refused, so the two never overlap', (await k.item('seg.c1-01')).to === 8 && /split off into its own card/.test(await p.locator('#sgerr-c1-01').innerText()));
    await p.close();
  }

  // ---------- 0.3 / 1.3: the play mark ----------
  {
    const k = await page({ 'c1-01': seg({}) }); const p = k.p;
    await k.open('c1-01');
    ok('[1.3] the editor opens at the start of the cut', Math.abs((await k.vt()) - 1) < 0.1, String(await k.vt()));
    await k.seek(9); await p.locator('[data-cxa="to"][data-id="c1-01"]').click(); await k.wait(200);
    await p.locator('[data-cxa="save"][data-id="c1-01"]').click(); await k.wait(500);
    const tv = await p.locator('[data-cxbar="c1-01"]').evaluate((e) => e.style.getPropertyValue('--t'));
    ok('[0.3] after Save cut the play mark stays where the video is', Math.abs(parseFloat(tv) - 50) < 1.5 && (await p.locator('[data-cxnow="c1-01"]').innerText()) === '0:09', tv + ' ' + (await p.locator('[data-cxnow="c1-01"]').innerText()));
    await k.seek(5);
    await p.locator('[data-cxa="split"][data-id="c1-01"]').click(); await k.wait(900);
    ok('[1.3] after Split the new card\'s video opens at the split point', Math.abs((await k.vt()) - 5) < 0.15 && (await p.locator('#sgc-c1-u01 video[data-cxv]').count()) === 1, String(await k.vt()));
    await p.close();
  }

  // ---------- 0.4: a split under a search ----------
  {
    const k = await page({ 'c1-01': seg({}), 'c2-01': seg({ clipId: 'c2', file: 'IMG_0301.MOV', guess: { name: 'Swings', confidence: 0.9 } }) }); const p = k.p;
    await p.locator('#f-q').fill('crunch'); await k.wait(500);
    await k.open('c1-01'); await k.seek(8);
    await p.locator('[data-cxa="split"][data-id="c1-01"]').click(); await k.wait(800);
    ok('[0.4] under a search, the part split off stays on screen with the editor', (await p.locator('#sgc-c1-u01 video[data-cxv]').count()) === 1);
    await p.close();
  }

  // ---------- 0.5: Claude's copy of an added stretch cannot be removed ----------
  {
    const k = await page({ 'c1-01': seg({}) }); const p = k.p;
    await k.seed('items', { 'add.c1-u01': { kind: 'add', segId: 'c1-u01', clipId: 'c1', folder: 'bodyweight', file: 'IMG_0300.MOV', clipDur: 18, start: 8, end: 15, fromSeg: 'c1-01', createdAt: NOW(), updatedAt: NOW() }, 'seg.c1-u01': { kind: 'seg', segId: 'c1-u01', name: 'Vertical Leg Crunches', entryId: null, from: 8.5, to: 15, skip: false, queued: false, verdict: null, note: 'use the second rep', updatedAt: NOW() } });
    ok('an added stretch of the owner\'s own has Remove', (await p.locator('[data-cxa="del"][data-id="c1-u01"]').count()) === 1);
    await k.seed('segs', { 'c1-u01': seg({ idx: 101, start: 8, end: 15, guess: null, added: true }) });
    ok('[0.5] Claude\'s copy of it has no Remove', (await p.locator('[data-cxa="del"][data-id="c1-u01"]').count()) === 0 && (await p.locator('#sgc-c1-u01').count()) === 1);
    await p.close();
  }

  // ---------- 0.6: an added stretch removed elsewhere leaves nothing behind ----------
  {
    const k = await page({ 'c1-01': seg({}) }); const p = k.p;
    await k.open('c1-01'); await k.seek(12);
    await p.locator('[data-cxa="add"][data-id="c1-01"]').click(); await k.wait(700);
    await p.locator('#sg-note-c1-u01').fill('left side only'); await k.wait(100);
    await p.evaluate(() => window.__mock.remove('items', 'add.c1-u01')); await k.wait(400);
    await p.locator('#sg-name-c1-01').click(); await k.wait(300);
    await k.open('c1-01'); await k.seek(2);
    await p.locator('[data-cxa="add"][data-id="c1-01"]').click(); await k.wait(700);
    const st = await k.store(), adds = Object.keys(st).filter((x) => x.startsWith('add.'));
    ok('[0.6] the next added stretch gets a new id and none of the old typed text', adds.length === 1 && adds[0] !== 'add.c1-u01' && !(await p.locator('#out').innerText()).includes('left side only') && !(await p.locator('textarea, input').evaluateAll((els) => els.some((e) => e.value === 'left side only'))), adds.join(','));
    await p.close();
  }

  // ---------- 0.7 / 1.4 / 1.7 / 1.8 / 1.9: bad times ----------
  {
    const k = await page({ 'c1-01': seg({}) }, { c1: { clipId: 'c1', dur: 18.4, proxy: PROXY, w: 480, h: 270, fps: 15, updatedAt: NOW() } }); const p = k.p;
    await k.open('c1-01');
    await p.locator('[data-cxh="to"][data-id="c1-01"]').focus(); await p.keyboard.press('End'); await k.wait(200);
    ok('[1.8] the end can go no further than the shorter of the two lengths (18 s)', (await k.now('c1-01', 'to')) === 18, String(await k.now('c1-01', 'to')));
    await p.locator('[data-cxa="save"][data-id="c1-01"]').click(); await k.wait(400);
    ok('[1.8] and that end saves', (await k.item('seg.c1-01')).to === 18, JSON.stringify(await k.item('seg.c1-01')));
    await p.locator('#sg-from-c1-01').fill('17.9'); await k.wait(150);
    const h = await k.box('[data-cxh="to"][data-id="c1-01"]'), bar = await k.box('[data-cxbar="c1-01"]');
    await p.mouse.move(h.x + h.width / 2, bar.y + bar.height / 2); await p.mouse.down(); await p.mouse.move(h.x - 40, bar.y + bar.height / 2, { steps: 6 }); await p.mouse.up(); await k.wait(200);
    ok('[1.4] the end never goes past the video, whatever the start', (await k.now('c1-01', 'to')) <= 18, String(await k.now('c1-01', 'to')));
    await p.locator('#sg-from-c1-01').fill('1:05'); await k.wait(150);
    ok('[1.7] a start outside the video is called that, not a negative length', /outside the video/.test(await p.locator('[data-cxcut="c1-01"]').innerText()) && (await k.now('c1-01', 'from')) <= 18, await p.locator('[data-cxcut="c1-01"]').innerText());
    await p.locator('#sg-from-c1-01').fill('17'); await p.locator('#sg-to-c1-01').fill('5'); await k.wait(150);
    ok('[1.7] a start after the end is called that', /start has to come before the end/.test(await p.locator('[data-cxcut="c1-01"]').innerText()), await p.locator('[data-cxcut="c1-01"]').innerText());
    await p.locator('[data-cxa="play"][data-id="c1-01"]').click(); await k.wait(1200);
    const seeks = await p.evaluate(() => new Promise((r) => { const v = document.querySelector('video[data-cxv]'); let n = 0; const f = () => n++; v.addEventListener('seeking', f); setTimeout(() => { v.removeEventListener('seeking', f); r({ n, paused: v.paused }); }, 800); }));
    ok('[0.7] Play the cut with the ends crossed is refused, and the video is not left seeking', seeks.n < 3 && /Fix the cut first/.test(await p.locator('#sgerr-c1-01').innerText()), JSON.stringify(seeks));
    await p.locator('#sg-from-c1-01').fill('1'); await p.locator('#sg-to-c1-01').fill('16'); await k.wait(150);
    await p.locator('[data-cxa="play"][data-id="c1-01"]').click(); await k.wait(300);
    await p.locator('#sg-to-c1-01').fill('4'); await k.wait(4500);
    const t9 = await k.vt();
    ok('[1.9] Play the cut follows a cut changed while it plays', t9 >= 0.9 && t9 <= 4.2, String(t9));
    await p.close();
  }

  // ---------- 1.10: Claude starts while a drag is unsaved ----------
  {
    const k = await page({ 'c1-01': seg({}) }); const p = k.p;
    await k.open('c1-01'); await k.seek(7);
    await p.locator('[data-cxa="to"][data-id="c1-01"]').click(); await k.wait(200);
    await k.seed('segs', { 'c1-01': seg({ state: 'generating', updatedAt: NOW() }) });
    ok('[1.10] while a loop is made, an unsaved change is said not to be used', /was not used/.test(await p.locator('#sgc-c1-01').innerText()));
    await p.close();
  }

  // ---------- 1.11: closing the group of stretches with no exercise ----------
  {
    const k = await page({ 'c1-01': seg({}), 'c1-02': seg({ idx: 2, start: 16.5, end: 17.9, kind: 'junk', guess: null, why: 'Too short to be a rep' }) }); const p = k.p;
    await p.locator('summary[data-junksum="c1"]').click(); await k.wait(300);
    await k.open('c1-02');
    await p.locator('[data-cxa="play"][data-id="c1-02"]').click(); await k.wait(300);
    await p.locator('summary[data-junksum="c1"]').click(); await k.wait(800);
    ok('[1.11] closing the group pauses the video inside it', await p.evaluate(() => { const v = document.querySelector('video[data-cxv]'); return !v || v.paused; }));
    await p.close();
  }

  // ---------- 0.8: a view that may not save ----------
  {
    const k = await page({ 'c1-01': seg({}) }); const p = k.p;
    await k.open('c1-01'); await k.seek(6);
    await p.evaluate(() => window.__mock.failNext(5, 'invalid_argument'));
    await p.locator('[data-cxa="add"][data-id="c1-01"]').click(); await k.wait(900);
    ok('[0.8] a refused add takes the editor and the controls away', (await p.locator('#out [data-cxa]').count()) === 0);
    await p.close();
  }

  ok('no console errors', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n'));
  console.error('cut fix checks: ' + out.filter((l) => l.startsWith('PASS')).length + ' pass, ' + out.filter((l) => l.startsWith('FAIL')).length + ' fail');
  await b.close(); srv.close();
})().catch((e) => { console.log(out.join('\n')); console.error(e); process.exit(1); });
