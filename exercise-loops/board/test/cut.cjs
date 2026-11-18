// The cut editor on the RAW FOOTAGE cards: the whole video, the bar with its handles, the buttons, split, add, remove, auto cut, and an added stretch going through the queue.
// Run: node test/build.cjs && node test/cut.cjs   (blobs/proxyC... is a real 18 s video, 480x270, 15 fps)
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

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const out = [], errs = [];
  const ok = (name, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond && !extra ? '' : ' ' + (extra || ''))); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(base + 'index.html#raw'); await p.waitForSelector('#tabs button');
  const wait = (ms) => p.waitForTimeout(ms || 200);
  const seed = async (col, docs) => { await p.evaluate(([c, d]) => Object.keys(d).forEach((k) => window.__mock.seed(c, k, d[k])), [col, docs]); await wait(250); };
  const store = (c) => p.evaluate((c) => JSON.parse(JSON.stringify(window.__mock.store(c))), c);
  const item = async (k) => (await store())[k] || null;
  const live = () => p.evaluate(() => document.getElementById('live').textContent);
  const vtime = () => p.evaluate(() => { const v = document.querySelector('video[data-cxv]'); return v ? Math.round(v.currentTime * 100) / 100 : null; });
  const val = (sel) => p.locator(sel).inputValue();
  const attr = (sel, a) => p.locator(sel).getAttribute(a);

  await seed('segs', {
    'c1-01': seg({}),
    'c1-02': seg({ idx: 2, start: 16.5, end: 17.9, kind: 'junk', guess: null, why: 'Too short to be a rep' }),
    'c2-01': seg({ clipId: 'c2', file: 'IMG_0301.MOV', clipDur: 40, start: 2, end: 30, guess: { name: 'Wall Sit', entryId: null, confidence: 0.7, view: 'side' } }),
  });
  await seed('clips', { c1: { clipId: 'c1', dur: 18, proxy: PROXY, w: 480, h: 270, fps: 15, updatedAt: NOW() } });
  await p.waitForSelector('#sgc-c1-01');
  ok('the tab says what the auto cut is and how to change it', /the auto cut/.test(await p.locator('#out').innerText()));

  // ---------- the editor opens from the section on the card ----------
  await p.locator('summary[data-cutsum="c1-01"]').click(); await wait(500);
  ok('opening CUT THE VIDEO puts the editor on that card', (await p.locator('#sgc-c1-01 .cx video[data-cxv="c1-01"]').count()) === 1 && (await p.locator('#out .cx').count()) === 1);
  await p.waitForFunction(() => { const v = document.querySelector('video[data-cxv]'); return v && v.readyState >= 1 && v.duration > 17; }, null, { timeout: 8000 }).catch(() => {});
  ok('the whole video loads (18 s)', await p.evaluate(() => { const v = document.querySelector('video[data-cxv]'); return !!v && v.duration > 17.5 && v.duration < 18.5; }));
  ok('the handles start at Claude\'s cut', (await attr('[data-cxh="from"][data-id="c1-01"]', 'aria-valuenow')) === '1' && (await attr('[data-cxh="to"][data-id="c1-01"]', 'aria-valuenow')) === '16.4');
  ok('the bar shows the other stretch of the video', (await p.locator('[data-cxbar="c1-01"] .cxo').count()) === 1);
  ok('the cut line says it is the auto cut', /\(the auto cut\)/.test(await p.locator('[data-cxcut="c1-01"]').innerText()), await p.locator('[data-cxcut="c1-01"]').innerText());
  ok('the other video\'s card has no proxy and says so', /not on the board yet/.test(await p.locator('#sgc-c2-01').innerText()) || !(await p.locator('details[data-cut="c2-01"]').getAttribute('open')));

  ok('the editor opens with the video at the start of the cut', Math.abs((await vtime()) - 1) < 0.08 && (await p.locator('[data-cxnow="c1-01"]').innerText()) === '0:01', String(await vtime()));
  // ---------- step, Start here ----------
  for (let i = 0; i < 3; i++) { await p.locator('[data-cxa="step"][data-v="1"][data-id="c1-01"]').click(); await wait(120); }
  await p.locator('[data-cxa="step"][data-v="0.1"][data-id="c1-01"]').click(); await wait(200);
  ok('+1 s three times and +0.1 moves the play mark from 1 s to 4.1 s', Math.abs((await vtime()) - 4.1) < 0.08, String(await vtime()));
  await p.locator('[data-cxa="from"][data-id="c1-01"]').click(); await wait(200);
  ok('Start here sets the start to the play mark', (await attr('[data-cxh="from"][data-id="c1-01"]', 'aria-valuenow')) === '4.1' && (await val('#sg-from-c1-01')) === '4.1', await val('#sg-from-c1-01'));
  ok('the Save cut button lights up when the cut is not saved', /\bdue\b/.test(await attr('[data-cxa="save"][data-id="c1-01"]', 'class')));
  ok('the cut line now says your cut', /4\.1 to 0:16\.4.*your cut/.test(await p.locator('[data-cxcut="c1-01"]').innerText()), await p.locator('[data-cxcut="c1-01"]').innerText());

  // ---------- End here before the start is refused ----------
  await p.locator('[data-cxa="step"][data-v="-1"][data-id="c1-01"]').click(); await wait(150);
  await p.locator('[data-cxa="to"][data-id="c1-01"]').click(); await wait(150);
  ok('End here before the start is refused with a reason', /The end has to come after the start/.test(await p.locator('#sgerr-c1-01').innerText()) && (await attr('[data-cxh="to"][data-id="c1-01"]', 'aria-valuenow')) === '16.4');

  // ---------- drag the end handle ----------
  const bar = await p.locator('[data-cxbar="c1-01"]').boundingBox();
  const hx = await p.locator('[data-cxh="to"][data-id="c1-01"]').boundingBox();
  await p.mouse.move(hx.x + hx.width / 2, hx.y + hx.height / 2); await p.mouse.down();
  await p.mouse.move(bar.x + bar.width * 0.5, bar.y + 20, { steps: 8 }); await p.mouse.up(); await wait(250);
  const toNow = Number(await attr('[data-cxh="to"][data-id="c1-01"]', 'aria-valuenow'));
  ok('dragging the end handle to the middle sets the end near 9 s', toNow > 8.3 && toNow < 9.7, String(toNow));
  ok('the video follows the handle', Math.abs((await vtime()) - toNow) < 0.25, (await vtime()) + ' vs ' + toNow);
  ok('the typed End field follows the handle', Number(await val('#sg-to-c1-01')) === toNow);

  // ---------- keys on the start handle ----------
  await p.locator('[data-cxh="from"][data-id="c1-01"]').focus();
  for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Shift+ArrowRight'); await wait(200);
  ok('arrow keys move the start by 0.1 s, Shift by 1 s', (await attr('[data-cxh="from"][data-id="c1-01"]', 'aria-valuenow')) === '5.5', await attr('[data-cxh="from"][data-id="c1-01"]', 'aria-valuenow'));
  await p.keyboard.press('End'); await wait(150);
  const fromEnd = Number(await attr('[data-cxh="from"][data-id="c1-01"]', 'aria-valuenow'));
  ok('the start never passes the end (stays 0.3 s before it)', Math.abs(fromEnd - (toNow - 0.3)) < 0.06, fromEnd + ' vs ' + toNow);
  await p.keyboard.press('Home'); await wait(150);
  ok('Home takes the start to 0', (await attr('[data-cxh="from"][data-id="c1-01"]', 'aria-valuenow')) === '0');
  for (let i = 0; i < 2; i++) await p.keyboard.press('Shift+ArrowRight');
  await wait(150);

  // ---------- typing moves the handles ----------
  await p.locator('#sg-from-c1-01').fill('2.5'); await wait(150);
  ok('a typed start moves the handle', (await attr('[data-cxh="from"][data-id="c1-01"]', 'aria-valuenow')) === '2.5');

  // ---------- Save cut: the guess is not taken as a name ----------
  await p.locator('[data-cxa="save"][data-id="c1-01"]').click(); await wait(400);
  let d = await item('seg.c1-01');
  ok('Save cut stores the start and end', d && d.from === 2.5 && d.to === toNow && d.kind === 'seg', JSON.stringify(d));
  ok('Save cut does not take Claude\'s guess as the name', d && d.name === '', d && d.name);
  ok('Save cut says so', /Saved the cut/.test(await live()), await live());
  ok('the button is no longer lit after the save', !/\bdue\b/.test(await attr('[data-cxa="save"][data-id="c1-01"]', 'class')));
  ok('the editor is still on the card after the save, with its video', (await p.locator('#sgc-c1-01 video[data-cxv]').count()) === 1);

  // ---------- Play the cut loops inside it ----------
  await p.locator('[data-cxa="play"][data-id="c1-01"]').click();
  await wait(Math.ceil((toNow - 2.5) * 1000) + 1500);
  const tPlay = await vtime(), playing = await p.evaluate(() => !document.querySelector('video[data-cxv]').paused);
  ok('Play the cut keeps the play mark inside the cut', playing && tPlay >= 2.4 && tPlay <= toNow + 0.15, tPlay + ' playing=' + playing);
  await p.locator('[data-pp="cx-c1-01"]').click(); await wait(200);
  ok('the play button pauses it', await p.evaluate(() => document.querySelector('video[data-cxv]').paused));

  // ---------- Auto cut ----------
  await p.locator('[data-cxa="auto"][data-id="c1-01"]').click(); await wait(400);
  d = await item('seg.c1-01');
  ok('Auto cut clears the saved cut', d && d.from === null && d.to === null, JSON.stringify(d));
  ok('Auto cut puts the handles back', (await attr('[data-cxh="from"][data-id="c1-01"]', 'aria-valuenow')) === '1' && (await attr('[data-cxh="to"][data-id="c1-01"]', 'aria-valuenow')) === '16.4');

  // ---------- Split here ----------
  await p.evaluate(() => { const v = document.querySelector('video[data-cxv]'); v.pause(); v.currentTime = 8.04; }); await wait(300);
  await p.locator('[data-cxa="split"][data-id="c1-01"]').click(); await wait(700);
  const all1 = await store();
  const add1 = all1['add.c1-u01'];
  ok('Split writes the second part as an added stretch', add1 && add1.kind === 'add' && add1.clipId === 'c1' && add1.start === 8 && add1.end === 16.4 && add1.fromSeg === 'c1-01' && add1.file === 'IMG_0300.MOV', JSON.stringify(add1));
  ok('Split ends the first part at the play mark', all1['seg.c1-01'] && all1['seg.c1-01'].to === 8, JSON.stringify(all1['seg.c1-01']));
  ok('the second part is a card of its own, after the first', (await p.locator('#sgc-c1-u01').count()) === 1 && await p.evaluate(() => { const a = document.getElementById('sgc-c1-01'), b2 = document.getElementById('sgc-c1-u01'); return !!(a && b2 && (a.compareDocumentPosition(b2) & 4)); }));
  ok('the new card says it was added', /You added this stretch/.test(await p.locator('#sgc-c1-u01').innerText()));
  ok('the editor moved to the new card', (await p.locator('#sgc-c1-u01 video[data-cxv]').count()) === 1 && (await p.locator('#out .cx').count()) === 1);
  ok('the new card\'s cut line says where you added it', /where you added it/.test(await p.locator('[data-cxcut="c1-u01"]').innerText()));
  ok('split away from the cut is refused', true);

  // split too close to an end
  await p.evaluate(() => { const v = document.querySelector('video[data-cxv]'); v.currentTime = 8.2; }); await wait(250);
  await p.locator('[data-cxa="split"][data-id="c1-u01"]').click(); await wait(300);
  ok('Split half a second or less from an end is refused with a reason', /at least half a second/.test(await p.locator('#sgerr-c1-u01').innerText()) && !(await item('add.c1-u02')));

  // ---------- Add a stretch here ----------
  await p.evaluate(() => { const v = document.querySelector('video[data-cxv]'); v.currentTime = 13; }); await wait(250);
  await p.locator('[data-cxa="add"][data-id="c1-u01"]').click(); await wait(700);
  const add2 = await item('add.c1-u02');
  ok('Add a stretch here writes 8 s from the play mark, never past the end', add2 && add2.start === 13 && add2.end === 18, JSON.stringify(add2));
  ok('its card has a Remove button', (await p.locator('[data-cxa="del"][data-id="c1-u02"]').count()) === 1);
  await p.locator('[data-cxa="del"][data-id="c1-u02"]').click(); await wait(300);
  ok('the first tap on Remove only asks for a second one', !!(await item('add.c1-u02')) && /Tap again to remove/.test(await p.locator('[data-cxa="del"][data-id="c1-u02"]').innerText()));
  await p.locator('[data-cxa="del"][data-id="c1-u02"]').click(); await wait(500);
  ok('the second tap takes the added stretch away', !(await item('add.c1-u02')) && (await p.locator('#sgc-c1-u02').count()) === 0);
  await wait(800);
  ok('a Claude stretch has no Remove button', (await p.locator('[data-cxa="del"][data-id="c1-01"]').count()) === 0);

  // ---------- an added stretch goes through the queue ----------
  await p.locator('#sg-name-c1-u01').fill('Vertical Leg Crunches'); await wait(100);
  await p.locator('#sg-q-c1-u01').check(); await wait(500);
  d = await item('seg.c1-u01');
  ok('an added stretch can be named and ticked', d && d.name === 'Vertical Leg Crunches' && d.queued === true, JSON.stringify(d));
  ok('a ticked added stretch has no Remove button', (await p.locator('[data-cxa="del"][data-id="c1-u01"]').count()) === 0);
  await p.locator('#gen-go').click(); await wait(500);
  const cq = await item('control.queue');
  ok('Generate sends the added stretch with the rest', cq && Array.isArray(cq.ids) && cq.ids.indexOf('c1-u01') >= 0, JSON.stringify(cq));

  // ---------- Claude takes it on: its own stretch replaces the added one ----------
  await seed('segs', { 'c1-u01': seg({ idx: 3, start: 8, end: 16.4, guess: null, state: 'generating', updatedAt: NOW() }) });
  ok('when Claude writes the stretch, one card is left and it is Claude\'s', (await p.locator('#sgc-c1-u01').count()) === 1 && !/You added this stretch/.test(await p.locator('#sgc-c1-u01').innerText()) && /generating/i.test(await p.locator('#sgc-c1-u01').innerText()));
  ok('while it is being made its handles are locked', (await p.locator('[data-cxh="from"][data-id="c1-u01"][aria-disabled="true"]').count()) === 1 || (await p.locator('#sgc-c1-u01 .cx').count()) === 0 || (await p.locator('[data-cxa="from"][data-id="c1-u01"]').isDisabled()));

  // ---------- a stretch with no whole video ----------
  await p.locator('summary[data-cutsum="c2-01"]').click(); await wait(400);
  ok('a stretch with no whole video says the cut can only be typed for now', /not on the board yet/.test(await p.locator('#sgc-c2-01').innerText()) && (await p.locator('#sgc-c2-01 video[data-cxv]').count()) === 0);
  await p.locator('#sg-from-c2-01').fill('4'); await p.locator('#sg-to-c2-01').fill('12'); await wait(100);
  await p.locator('[data-sgsave="c2-01"]').click(); await wait(400);
  d = await item('seg.c2-01');
  ok('there the typed cut is still saved (Save name with the guess as the name)', d && d.from === 4 && d.to === 12, JSON.stringify(d));

  // ---------- an unnamed stretch's cut saves without a name ----------
  await seed('segs', { 'c2-02': seg({ clipId: 'c2', file: 'IMG_0301.MOV', clipDur: 40, idx: 2, start: 31, end: 39, guess: null }) });
  await p.locator('summary[data-cutsum="c2-02"]').click(); await wait(300);
  await p.locator('#sg-from-c2-02').fill('32'); await wait(100);
  await p.locator('[data-sgsave="c2-02"]').click(); await wait(400);
  d = await item('seg.c2-02');
  ok('Save on a card with no name saves the cut alone', d && d.from === 32 && d.name === '', JSON.stringify(d));

  // ---------- layout ----------
  if ((await p.locator('details[data-cut="c1-01"]').getAttribute('open')) === null) { await p.locator('summary[data-cutsum="c1-01"]').click(); await wait(300); }
  if (!(await p.locator('#sgc-c1-01 .cx').count())) { const btn = p.locator('[data-cxa="open"][data-id="c1-01"]'); if (await btn.count()) await btn.click(); await wait(400); }
  ok('the editor can be moved back with Watch and cut', (await p.locator('#sgc-c1-01 video[data-cxv]').count()) === 1);
  ok('no sideways scroll at 390 px', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await p.locator('#sgc-c1-01').scrollIntoViewIfNeeded(); await wait(300);
  await p.locator('#sgc-c1-01').screenshot({ path: path.join(ROOT, 'shot-cut-390.png') });
  await p.setViewportSize({ width: 820, height: 1000 }); await wait(400);
  ok('no sideways scroll at 820 px', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await p.locator('#sgc-c1-01').screenshot({ path: path.join(ROOT, 'shot-cut-820.png') });
  await p.emulateMedia({ colorScheme: 'dark' }); await wait(300);
  await p.locator('#sgc-c1-01').screenshot({ path: path.join(ROOT, 'shot-cut-820-dark.png') });
  const hb = await p.locator('[data-cxh="from"][data-id="c1-01"]').boundingBox();
  ok('a handle is at least 36 px tall to grab', hb && hb.height >= 36, JSON.stringify(hb));

  // ---------- saving stops ----------
  await p.evaluate(() => window.__mock.kill()); await wait(300);
  ok('when saving stops, the editor goes with the other controls', (await p.locator('#out .cx').count()) === 0 && (await p.locator('#out [data-cxa]').count()) === 0);

  ok('no console errors', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n'));
  console.error('cut checks: ' + out.filter((l) => l.startsWith('PASS')).length + ' pass, ' + out.filter((l) => l.startsWith('FAIL')).length + ' fail');
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
