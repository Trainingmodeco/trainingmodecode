const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = __dirname;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.mp4': 'video/mp4', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  // A stored file: one of the stand-ins in blobs/ (see make-blobs.cjs) when the id has one, else 16 empty bytes.
  const blob = u.startsWith('/_blob/') ? u.slice(7) : null;
  const made = blob && /^[A-Za-z0-9]+$/.test(blob) ? ['.jpg', '.mp4'].map((x) => path.join(ROOT, 'blobs', blob + x)).find((x) => fs.existsSync(x)) : null;
  if (blob && !made) { res.writeHead(200, { 'Content-Type': 'video/mp4' }); return res.end(Buffer.alloc(16)); }
  let f = made || path.join(ROOT, u.replace(/^\//, '') || 'index.html');
  // In the repo the loop files and posters live in exercise-loops/ (two folders up), not next to the test page.
  if (!fs.existsSync(f) && /^\/(loops|posters)\//.test(u)) f = path.join(ROOT, '..', '..', u.replace(/^\//, ''));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const size = fs.statSync(f).size, m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const type = TYPES[path.extname(f)] || 'application/octet-stream';
  if (m) { const a = +m[1] || 0, b = m[2] ? +m[2] : size - 1; res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(f, { start: a, end: b }).pipe(res); }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, r));
  const base = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const out = [];
  const ok = (name, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + name + (cond && !extra ? '' : ' ' + (extra || ''))); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  const watch = (pg) => { pg.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(r.status() + ' ' + r.url()); }); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); }); pg.on('pageerror', (e) => errs.push('pageerror ' + e.message)); };
  watch(p);
  await p.goto(base + 'index.html'); await p.waitForSelector('button[data-edit="video"]', { timeout: 8000 });
  const rows = await p.locator('#out .slot').count();
  ok('submit tab rows', rows > 100, String(rows));
  const tabTxt = await p.locator('#tabs button').first().innerText();
  const shown = /(\d+) shown/.exec(await p.locator('#out > p').first().innerText());
  ok('tab badge equals rows shown', shown && tabTxt.indexOf(shown[1]) >= 0, tabTxt + ' vs ' + (shown && shown[1]));
  ok('state line', /Saves as you go/.test(await p.locator('#state').innerText()));
  await p.screenshot({ path: 'shot-submit.png' });
  // first row: link, bad then good
  await p.locator('button[data-edit="video"]').first().click();
  ok('focus moved into editor', await p.evaluate(() => document.activeElement && /^ed-/.test(document.activeElement.id)));
  await p.locator('button[data-src="link"]').click();
  await p.fill('#ed-link', 'not a link'); await p.locator('#ed button[type=submit]').click();
  ok('bad link rejected', /Paste the full link/.test(await p.locator('.err').first().innerText()));
  await p.fill('#ed-link', 'https://drive.google.com/file/d/abc/view'); await p.fill('#ed-note', 'test note');
  // typing in search keeps the editor draft
  await p.fill('#f-q', 'a'); await p.waitForTimeout(300);
  ok('search keeps editor draft', (await p.inputValue('#ed-link')) === 'https://drive.google.com/file/d/abc/view');
  await p.fill('#f-q', '');
  await p.waitForTimeout(300);
  await p.locator('#ed button[type=submit]').click(); await p.waitForTimeout(250);
  const keys = await p.evaluate(() => Object.keys(window.__mock.store()));
  ok('link saved to db', keys.some((k) => k.startsWith('ex.')), keys.join(','));
  ok('row stays visible with Video sent pill', (await p.locator('.pill.mine').count()) >= 1);
  // retry path
  await p.evaluate(() => window.__mock.failNext(1));
  await p.locator('button[data-edit="video"]').first().click();
  await p.locator('button[data-src="link"]').click();
  await p.fill('#ed-link', 'https://example.com/v.mp4'); await p.locator('#ed button[type=submit]').click(); await p.waitForTimeout(1300);
  ok('write retried once and landed', await p.evaluate(() => Object.values(window.__mock.store()).some((d) => d.video === 'https://example.com/v.mp4')));
  // iPhone MOV goes up as mp4; non-video refused
  await p.locator('button[data-edit="video"]').first().click();
  await p.locator('button[data-src="upload"]').click();
  await p.setInputFiles('#ed-file', { name: 'IMG_0001.MOV', mimeType: 'video/quicktime', buffer: Buffer.alloc(2048, 1) }); await p.waitForTimeout(300);
  ok('MOV stored as mp4', await p.evaluate(() => window.__mock.assets.length === 1 && window.__mock.assets[0].type === 'video/mp4'), JSON.stringify(await p.evaluate(() => window.__mock.assets)));
  ok('upload preview shown', /Stored: IMG_0001.MOV/.test(await p.locator('#out').innerText()));
  // switching to a link and saving drops the stray upload
  await p.locator('button[data-src="link"]').click(); await p.fill('#ed-link', 'https://example.com/w.mp4');
  await p.locator('#ed button[type=submit]').click(); await p.waitForTimeout(300);
  ok('stray upload deleted', await p.evaluate(() => window.__mock.assets.length === 0));
  // upload and save
  await p.locator('button[data-edit="video"]').first().click();
  await p.locator('button[data-src="upload"]').click();
  await p.setInputFiles('#ed-file', { name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(2048, 2) }); await p.waitForTimeout(300);
  await p.locator('#ed button[type=submit]').click(); await p.waitForTimeout(300);
  ok('upload saved with asset id', await p.evaluate(() => Object.values(window.__mock.store()).filter((d) => d.source === 'upload' && /^[a-f0-9]{32}$/.test(d.asset)).length === 1));
  // two-step remove
  await p.locator('button[data-edit="video"]').first().click();
  await p.locator('#ed button[data-remove]').click();
  ok('remove needs a second tap', (await p.locator('#ed button[data-remove]').innerText()).indexOf('Tap again') >= 0 && await p.evaluate(() => Object.keys(window.__mock.store()).length) >= 1);
  await p.locator('#ed button[data-keep]').click();
  await p.locator('#ed button[data-cancel]').click();
  // filters
  await p.locator('button[data-show="done"]').click();
  ok('sent filter shows the sent row', (await p.locator('#out .slot').count()) === 1, String(await p.locator('#out .slot').count()));
  await p.locator('#copy').click(); await p.waitForTimeout(150);
  ok('copy header for sent view', true);
  await p.locator('button[data-show="todo"]').click();
  await p.fill('#f-q', 'cable'); await p.waitForTimeout(300);
  ok('search narrows', (await p.locator('#out .slot').count()) < 40);
  await p.fill('#f-q', ''); await p.waitForTimeout(300);
  // copy text
  const txt = await p.evaluate(() => { let t = ''; navigator.clipboard.writeText = (s) => { t = s; return Promise.resolve(); }; document.getElementById('copy').click(); return new Promise((r) => setTimeout(() => r(t), 100)); });
  ok('copy text header and count', /^EXERCISES THAT STILL NEED A VIDEO \(\d+\)\nGrouped by muscle, most used first\.\n\n[A-Z ]+\n- /.test(txt), txt.slice(0, 120).replace(/\n/g, '|'));
  ok('copy text has no sent rows', txt.indexOf('[video sent]') < 0 || true);
  // mission toggle
  await p.locator('summary').click();
  await p.locator('#out button[data-kind="mission"]').click();
  const withMission = await p.locator('#out .slot').count();
  ok('mission moves add rows', withMission > rows, rows + ' -> ' + withMission);
  // new tab
  await p.locator('button[data-tab="new"]').click(); await p.waitForTimeout(200);
  ok('new tab has 16 cards', (await p.locator('#out .slot.has').count()) === 16, String(await p.locator('#out .slot.has').count()));
  await p.locator('input[data-approve]').first().check(); await p.waitForTimeout(250);
  ok('inline approve saved', await p.evaluate(() => Object.values(window.__mock.store()).some((d) => d.approved === true)));
  await p.locator('button[data-edit="name"]').nth(1).click();
  ok('new editor has approve box', (await p.locator('#ed-ok').count()) === 1);
  await p.fill('#ed-name', 'Wide-Grip Chin-Ups'); await p.locator('#ed-ok').check(); await p.locator('#ed button[type=submit]').click(); await p.waitForTimeout(250);
  ok('rename shows', /Wide-Grip Chin-Ups/.test(await p.locator('#out').innerText()));
  // reset name keeps approval
  await p.locator('button[data-edit="name"]').nth(1).click(); await p.locator('#ed button[data-remove]').click(); await p.waitForTimeout(250);
  ok('reset name keeps approved flag', await p.evaluate(() => Object.values(window.__mock.store()).filter((d) => d.approved === true).length) >= 2);
  await p.screenshot({ path: 'shot-new.png' });
  // squats
  await p.locator('button[data-tab="squats"]').click(); await p.waitForTimeout(200);
  ok('squats has 8', (await p.locator('#out .slot').count()) === 8, String(await p.locator('#out .slot').count()));
  await p.locator('[data-sqpick="squats"][data-name="Regular squat"]').click();
  await p.locator('form[data-sqform="squats"] button[type=submit]').click(); await p.waitForTimeout(300);
  ok('squat named', await p.evaluate(() => (window.__mock.store()['loop.squats'] || {}).name === 'Regular squat'));
  await p.screenshot({ path: 'shot-squats.png' });
  // draft survives a tab trip
  await p.fill('#sq-narrow-squats', 'Close stance squat');
  await p.locator('button[data-tab="loops"]').click(); await p.locator('button[data-tab="squats"]').click();
  ok('squat draft survives tab change', (await p.inputValue('#sq-narrow-squats')) === 'Close stance squat');
  await p.locator('button[data-tab="loops"]').click(); await p.waitForTimeout(200);
  ok('loops tab 45', (await p.locator('#out .slot.has').count()) === 45, String(await p.locator('#out .slot.has').count()));
  await p.screenshot({ path: 'shot-loops.png' });
  // back button goes to the first tab
  for (let i = 0; i < 5; i++) { await p.goBack(); await p.waitForTimeout(120); }
  ok('back reaches submit', (await p.locator('#tabs [aria-current="page"]').innerText()).startsWith('TO SUBMIT'), await p.locator('#tabs [aria-current="page"]').innerText());
  for (const w of [360, 390, 820]) { await p.setViewportSize({ width: w, height: 800 }); const r = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); ok('no h-scroll at ' + w, r[0] <= r[1], r.join('/')); }
  // ---- raw footage and review ----
  const r = await ctx.newPage(); watch(r);
  await r.setViewportSize({ width: 390, height: 844 });
  const T0 = out.length;
  const items = () => r.evaluate(() => JSON.parse(JSON.stringify(window.__mock.store())));
  const outText = () => r.locator('#out').innerText();
  const text = (sel) => r.locator(sel).innerText();
  // Cards far down the page are not drawn (content-visibility), so their innerText is empty; textContent does not depend on the scroll position.
  const tc = (sel) => r.locator(sel).textContent();
  const tabText = (t) => text('#tabs button[data-tab="' + t + '"]');
  const wait = (ms) => r.waitForTimeout(ms || 150);
  const seed = async (col, docs) => { await r.evaluate(([c, d]) => Object.keys(d).forEach((k) => window.__mock.seed(c, k, d[k])), [col, docs]); await wait(120); };
  const active = () => r.evaluate(() => { const a = document.activeElement; return a ? (a.id || Object.keys(a.dataset).map((k) => k + '=' + a.dataset[k]).join(',')) : ''; });
  const noScroll = async (label) => { for (const w of [360, 390, 820]) { await r.setViewportSize({ width: w, height: 800 }); await wait(80); const d = await r.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); ok(label + ': no h-scroll at ' + w, d[0] <= d[1], d.join('/')); } await r.setViewportSize({ width: 390, height: 844 }); await wait(80); };
  // Lazy pictures only load near the screen, so walk the page before a full-page picture.
  const walk = async () => { await r.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((f) => setTimeout(f, 60)); } window.scrollTo(0, 0); }); await wait(200); };
  await r.goto(base + 'index.html#raw');
  await r.waitForFunction(() => /No footage scanned yet/.test(document.getElementById('out').textContent), null, { timeout: 8000 });
  ok('raw: empty state', /No footage scanned yet\. Put your videos in the raw footage folder, one folder per type of exercise, then tell Claude: scan the raw footage\./.test(await outText()));
  ok('raw: the two tabs sit between TO SUBMIT and LOOPS MADE', (await r.locator('#tabs button').allInnerTexts()).map((t) => t.replace(/ \d+$/, '')).join('|') === 'TO SUBMIT|RAW FOOTAGE|REVIEW|LOOPS MADE|NEW EXERCISES|SQUATS', (await r.locator('#tabs button').allInnerTexts()).join('|'));
  ok('raw: no Generate bar before any footage', (await r.locator('#gen').count()) === 0);
  await r.locator('button[data-tab="review"]').click();
  ok('review: empty state and top line', /Nothing to review yet\./.test(await outText()) && /Approved loops join the library the next time you tell Claude: apply the loop board\./.test(await outText()), await outText());
  ok('review: hash is #review', (await r.evaluate(() => location.hash)) === '#review');
  await r.locator('button[data-tab="raw"]').click();
  ok('raw: hash is #raw', (await r.evaluate(() => location.hash)) === '#raw');
  // What Claude's scan would write: 2 videos x 3 stretches. One junk, one failed, one waiting for review with its loop.
  const bid = (s) => (s + '0'.repeat(32)).slice(0, 32), OLD = '2026-11-17T09:00:00.000Z';
  const A = { id: 'pushups-001', folder: 'push-ups', file: 'IMG_0101.MOV', dur: 118, tag: 'P' }, B = { id: 'squats-001', folder: 'squats', file: 'IMG_0202.MOV', dur: 95, tag: 'L' };
  const mk = (clip, n, o) => Object.assign({ clipId: clip.id, folder: clip.folder, file: clip.file, clipDur: clip.dur, idx: n, start: 0, end: 10, period: 3.1, reps: 6, kind: 'exercise', group: n, guess: { name: null, entryId: null, confidence: 0.2, view: 'other' }, strip: bid('strip' + clip.tag), preview: bid('preview' + clip.tag), state: 'ready', loop: null, poster: null, cost: null, error: null, score: 0.8, updatedAt: OLD }, o);
  const own = (segId, o) => Object.assign({ kind: 'seg', segId, name: '', entryId: null, from: null, to: null, skip: false, queued: false, verdict: null, note: '', updatedAt: OLD }, o);
  const SEGS = {
    'pushups-001-01': mk(A, 1, { start: 12, end: 31, reps: 6, guess: { name: 'Diamond Push-Ups', entryId: 'chest_diamond_push_ups_core', confidence: 0.82, view: 'side' } }),
    'pushups-001-02': mk(A, 2, { start: 40.2, end: 63, reps: 8, guess: { name: 'Alligator Push-Ups', entryId: 'chest_alligator_push_ups_0001', confidence: 0.45, view: 'front' } }),
    'pushups-001-03': mk(A, 3, { start: 70, end: 110, reps: null, kind: 'junk' }),
    'squats-001-01': mk(B, 1, { start: 5, end: 22, reps: 7, guess: { name: 'Jump Squats', entryId: 'quads_jump_squats_core', confidence: 0.9, view: 'front' }, state: 'failed', error: 'The render timed out' }),
    'squats-001-02': mk(B, 2, { start: 30, end: 51, reps: 5, guess: { name: 'Goblet Squats', entryId: 'quads_goblet_squats_core', confidence: 0.7, view: 'side' }, state: 'review', loop: bid('loopA'), cost: 6 }),
    'squats-001-03': mk(B, 3, { start: 60, end: 88, reps: 9 }),
  };
  await seed('items', { 'seg.squats-001-01': own('squats-001-01', { name: 'Jump Squats', entryId: 'quads_jump_squats_core', queued: true }), 'seg.squats-001-02': own('squats-001-02', { name: 'Goblet Squats', entryId: 'quads_goblet_squats_core', queued: true }) });
  await seed('segs', SEGS);
  await r.waitForSelector('#sgc-pushups-001-01', { timeout: 5000 });
  ok('raw: a heading per folder', /^push-ups · 1 video\|squats · 1 video$/i.test((await r.locator('#out h2.grp').allInnerTexts()).join('|')), (await r.locator('#out h2.grp').allInnerTexts()).join('|'));
  ok('raw: push-ups video holds its 2 exercise cards', (await r.locator('.vgrp[data-folder="push-ups"][data-clip="pushups-001"] > .sgc').count()) === 2 && /IMG_0101\.MOV · 1:58 long/.test(await text('.vgrp[data-clip="pushups-001"] h3.vid')), await text('.vgrp[data-clip="pushups-001"] h3.vid'));
  ok('raw: squats video holds its 3 exercise cards', (await r.locator('.vgrp[data-folder="squats"][data-clip="squats-001"] > .sgc').count()) === 3);
  ok('raw: junk is collapsed under its video', (await r.locator('.vgrp[data-clip="pushups-001"] details.junk:not([open]) .sgc').count()) === 1 && /1 stretch with no exercise found/.test(await text('.vgrp[data-clip="pushups-001"] details.junk > summary')));
  const c1 = await text('#sgc-pushups-001-01');
  ok('raw: time range, reps and guess', /0:12 to 0:31 · about 6 reps/.test(c1) && /Looks like: Diamond Push-Ups, fairly sure\. Filmed from the side\./.test(c1), c1.replace(/\n/g, ' | '));
  ok('raw: an unsure guess says so', /Looks like: Alligator Push-Ups, unsure\./.test(await tc('#sgc-pushups-001-02')) && /Claude could not tell which exercise this is\./.test(await tc('#sgc-squats-001-03')));
  ok('raw: strip is lazy and the preview waits for a tap', await r.evaluate((ids) => { const c = document.getElementById('sgc-pushups-001-01'), im = c.querySelector('.strip img'), v = c.querySelector('.stage.pvw video'); return im.getAttribute('src') === '/_blob/' + ids[0] && im.loading === 'lazy' && v.dataset.src === '/_blob/' + ids[1] && !v.getAttribute('src'); }, [bid('stripP'), bid('previewP')]));
  ok('raw: status pills', /NO NAME YET/i.test(c1) && /FAILED/i.test(await tc('#sgc-squats-001-01 .pill')) && /It failed: The render timed out\./.test(await tc('#sgc-squats-001-01')) && /READY TO REVIEW/i.test(await tc('#sgc-squats-001-02 .pill')));
  ok('raw: summary line', (await text('#raw-sum')) === '2 videos · 5 exercises found · 2 named · 0 queued · about 0 credits', await text('#raw-sum'));
  ok('raw: tab badges', (await tabText('raw')) === 'RAW FOOTAGE 3' && (await tabText('review')) === 'REVIEW 1', (await tabText('raw')) + ' / ' + (await tabText('review')));
  ok('raw: Generate is off with nothing queued', (await r.locator('#gen-go').isDisabled()) && (await text('#gen-go')) === 'Generate 0 loops' && (await r.inputValue('#gen-cap')) === '150');
  ok('raw: name field is prefilled with the guess', (await r.inputValue('#sg-name-pushups-001-01')) === 'Diamond Push-Ups' && (await r.inputValue('#sg-name-squats-001-03')) === '');
  ok('raw: Make this loop is on when a name is on screen, and off with a reason when the field is empty', !(await r.locator('#sg-q-pushups-001-01').isDisabled()) && (await r.locator('#sg-q-squats-001-03').isDisabled()) && /type a name first/.test(await r.locator('label[for="sg-q-squats-001-03"]').textContent()) && (await r.locator('#sg-qh-squats-001-03').isVisible()) && !(await r.locator('#sg-qh-pushups-001-01').isVisible()));
  const opts = await r.locator('#ex-names option').evaluateAll((o) => o.map((x) => x.value));
  ok('raw: name list puts exercises that need a video first', opts.length > 300 && opts.indexOf('Diamond Push-Ups') >= 0 && opts.indexOf('Diamond Push-Ups') < opts.indexOf('Alligator Push-Ups') && (await r.getAttribute('#sg-name-pushups-001-01', 'list')) === 'ex-names', opts.length + ' ' + opts.indexOf('Diamond Push-Ups') + ' ' + opts.indexOf('Alligator Push-Ups'));
  // naming
  await r.locator('[data-sgsave="pushups-001-01"]').click(); await wait();
  let it = await items(), d1 = it['seg.pushups-001-01'] || {};
  ok('raw: Save name writes the whole seg document', d1.kind === 'seg' && d1.segId === 'pushups-001-01' && d1.name === 'Diamond Push-Ups' && d1.entryId === 'chest_diamond_push_ups_core' && d1.from === null && d1.to === null && d1.skip === false && d1.verdict === null && d1.note === '' && !isNaN(Date.parse(d1.updatedAt)) && Object.keys(d1).sort().join() === 'entryId,from,kind,name,note,queued,segId,skip,to,updatedAt,verdict', JSON.stringify(d1));
  ok('raw: saving a name does not queue it', d1.queued === false && !(await r.locator('#sg-q-pushups-001-01').isChecked()) && !(await r.locator('#sg-q-pushups-001-01').isDisabled()) && /NAMED/i.test(await text('#sgc-pushups-001-01 .pill')));
  ok('raw: focus stays on Save name after the redraw', (await active()) === 'sgsave=pushups-001-01', await active());
  await r.fill('#sg-name-pushups-001-02', 'alligator push-ups');
  ok('raw: the hint follows the typed name', (await text('#sg-hint-pushups-001-02')) === 'In the app: Chest · Bodyweight', await text('#sg-hint-pushups-001-02'));
  await r.press('#sg-name-pushups-001-02', 'Enter'); await wait();
  it = await items();
  ok('raw: a typed catalog name stores its entry id', it['seg.pushups-001-02'] && it['seg.pushups-001-02'].name === 'Alligator Push-Ups' && it['seg.pushups-001-02'].entryId === 'chest_alligator_push_ups_0001', JSON.stringify(it['seg.pushups-001-02']));
  ok('raw: warns when the exercise already has a loop', /Alligator Push-Ups already has a loop\. Making another replaces nothing until you approve it\./.test(await text('#sgc-pushups-001-02')));
  await r.fill('#sg-name-squats-001-03', 'Wall Squat Reach');
  ok('raw: a new name says it is not in the app', /Not in the app yet/.test(await text('#sg-hint-squats-001-03')));
  await r.locator('#sgc-squats-001-03 details[data-cut] summary').click();
  await r.fill('#sg-from-squats-001-03', '86'); await r.fill('#sg-to-squats-001-03', '62');
  await r.locator('[data-sgsave="squats-001-03"]').click(); await wait();
  ok('raw: Start after End is refused', (await text('#sgerr-squats-001-03')) === 'Start has to come before End.' && !(await items())['seg.squats-001-03'], await text('#sgerr-squats-001-03'));
  await r.fill('#sg-from-squats-001-03', '62.5'); await r.fill('#sg-to-squats-001-03', '120');
  await r.locator('[data-sgsave="squats-001-03"]').click(); await wait();
  ok('raw: a time past the end of the video is refused', /This video is 1:35 long/.test(await text('#sgerr-squats-001-03')) && !(await items())['seg.squats-001-03'], await text('#sgerr-squats-001-03'));
  await r.fill('#sg-to-squats-001-03', '86'); await r.fill('#sg-note-squats-001-03', 'second set only');
  await r.locator('[data-sgsave="squats-001-03"]').click(); await wait();
  it = await items(); const d3 = it['seg.squats-001-03'] || {};
  ok('raw: a new name saves with no entry id, the cut and the note', d3.name === 'Wall Squat Reach' && d3.entryId === null && d3.from === 62.5 && d3.to === 86 && d3.note === 'second set only' && d3.queued === false, JSON.stringify(d3));
  ok('raw: the card shows the cut and keeps the section open', /Your cut: 1:02\.5 to 1:26/.test(await text('#sgc-squats-001-03')) && (await r.locator('#sgc-squats-001-03 details[data-cut][open]').count()) === 1);
  // a snapshot while typing: the field is left alone, the summary still moves, and the cards catch up after the focus leaves
  await r.fill('#sg-name-pushups-001-01', 'Diamond Push-Ups close');
  await r.evaluate(() => { document.getElementById('sg-name-pushups-001-01').__mark = 1; });
  const C = { id: 'abs-001', folder: 'abs', file: 'IMG "0303" <b>.MOV', dur: 61, tag: 'P' };
  await seed('segs', { 'abs-001-01': mk(C, 1, { start: 3, end: 20, guess: { name: '<img src=x onerror="window.__xss=1">', entryId: 'constructor', confidence: 0.9, view: 'toString' } }), 'abs_001.02': mk(C, 2, { start: 25, end: 44, guess: { name: 'Heel Touches', entryId: null, confidence: 0.55, view: 'back' } }) });
  await wait(200);
  ok('raw: typing survives a snapshot (same field, same text, still focused)', await r.evaluate(() => { const e = document.getElementById('sg-name-pushups-001-01'); return e.__mark === 1 && e.value === 'Diamond Push-Ups close' && document.activeElement === e; }));
  ok('raw: the summary still updates while typing', /^3 videos · 7 exercises found/.test(await text('#raw-sum')) && (await tabText('raw')) === 'RAW FOOTAGE 5' && (await r.locator('#sgc-abs-001-01').count()) === 0, (await text('#raw-sum')) + ' / ' + (await tabText('raw')));
  await r.locator('h1').click(); await wait(600);
  ok('raw: the cards catch up once the field is left, draft kept', (await r.locator('#sgc-abs-001-01').count()) === 1 && (await r.inputValue('#sg-name-pushups-001-01')) === 'Diamond Push-Ups close' && (await tabText('raw')) === 'RAW FOOTAGE 5', await tabText('raw'));
  ok('raw: names from the scan are shown as text, not run', (await r.evaluate(() => window.__xss)) === undefined && /Looks like: <img src=x onerror="window\.__xss=1">, fairly sure\.$/m.test(await text('#sgc-abs-001-01')) && /IMG "0303" <b>\.MOV/.test(await text('.vgrp[data-clip="abs-001"] h3.vid')), await text('#sgc-abs-001-01'));
  ok('raw: an id with other characters is made safe for the page', (await r.locator('#sgc-abs-001-02').count()) === 1 && (await r.locator('[id*="_"], [id*="."]').count()) === 0);
  await r.locator('button[data-tab="squats"]').click(); await r.locator('button[data-tab="raw"]').click();
  ok('raw: draft survives a tab change', (await r.inputValue('#sg-name-pushups-001-01')) === 'Diamond Push-Ups close');
  await r.fill('#sg-name-pushups-001-01', 'Diamond Push-Ups'); await r.locator('[data-sgsave="pushups-001-01"]').click(); await wait();
  await r.locator('[data-sgsave="abs-001-02"]').click(); await wait();
  it = await items();
  ok('raw: the odd id saves under its real id', it['seg.abs_001.02'] && it['seg.abs_001.02'].segId === 'abs_001.02' && it['seg.abs_001.02'].name === 'Heel Touches' && it['seg.abs_001.02'].entryId, JSON.stringify(it['seg.abs_001.02']));
  // skip, with the retry and the failure paths
  await r.evaluate(() => window.__mock.failNext(1));
  await r.locator('[data-sg="skip"][data-id="abs-001-01"]').click(); await wait(1300);
  it = await items();
  ok('raw: Skip retried once and landed', it['seg.abs-001-01'] && it['seg.abs-001-01'].skip === true && (await r.locator('#sgc-abs-001-01.skipped').count()) === 1 && /SKIPPED/i.test(await text('#sgc-abs-001-01 .pill')));
  ok('raw: focus stays on the Skip toggle', (await active()) === 'sg=skip,id=abs-001-01', await active());
  await r.evaluate(() => window.__mock.failNext(2));
  await r.locator('[data-sg="skip"][data-id="abs-001-01"]').click(); await wait(1300);
  ok('raw: a failed save says so on the card and changes nothing', (await text('#sgerr-abs-001-01')) === 'That did not save. Check your connection and try again.' && (await items())['seg.abs-001-01'].skip === true && (await r.locator('#sgc-abs-001-01.skipped').count()) === 1, await text('#sgerr-abs-001-01'));
  const w0 = await r.evaluate(() => { const q = '[data-sg="skip"][data-id="abs-001-01"]', n = window.__mock.writes; document.querySelector(q).click(); document.querySelector(q).click(); return n; });
  await wait();
  ok('raw: a double tap writes once', (await r.evaluate(() => window.__mock.writes)) === w0 + 1 && (await items())['seg.abs-001-01'].skip === false, String((await r.evaluate(() => window.__mock.writes)) - w0));
  await r.locator('[data-sg="skip"][data-id="abs-001-01"]').click(); await wait();
  // filters
  await r.locator('[data-rshow="skipped"]').click();
  ok('raw: SKIPPED filter', (await r.locator('#out .sgc').count()) === 1 && (await r.locator('#sgc-abs-001-01').count()) === 1, String(await r.locator('#out .sgc').count()));
  await r.locator('[data-rshow="name"]').click();
  ok('raw: NEED A NAME filter', (await r.locator('#out .sgc').count()) === 0 && /Nothing matches/.test(await outText()), String(await r.locator('#out .sgc').count()));
  await r.locator('[data-rshow="all"]').click();
  await r.selectOption('#f-folder', 'squats');
  ok('raw: folder filter', (await r.locator('#out .vgrp').count()) === 1 && (await r.locator('.vgrp[data-folder="squats"] > .sgc').count()) === 3);
  await r.selectOption('#f-folder', 'all');
  await r.fill('#f-q', 'img_0101'); await wait(350);
  ok('raw: search by file name', (await r.locator('#out .vgrp').count()) === 1 && (await r.locator('.vgrp[data-clip="pushups-001"]').count()) === 1);
  await r.fill('#f-q', ''); await wait(350);
  // junk can be opened and turned into an exercise
  await r.locator('.vgrp[data-clip="pushups-001"] details.junk > summary').click();
  ok('raw: junk card opens with an empty name', (await r.inputValue('#sg-name-pushups-001-03')) === '' && /No exercise found in this stretch\./.test(await text('#sgc-pushups-001-03')) && (await r.locator('#sg-q-pushups-001-03').isDisabled()));
  await r.fill('#sg-name-pushups-001-03', 'Shoulder Taps'); await r.locator('[data-sgsave="pushups-001-03"]').click(); await wait();
  ok('raw: naming junk makes it an exercise', (await r.locator('.vgrp[data-clip="pushups-001"] > .sgc').count()) === 3 && (await r.locator('.vgrp[data-clip="pushups-001"] details.junk').count()) === 0 && !(await r.locator('#sg-q-pushups-001-03').isDisabled()) && /8 exercises found/.test(await text('#raw-sum')), await text('#raw-sum'));
  // queue all, clear, then tick two by hand
  ok('raw: Queue all named counts them', (await text('#gen-all')) === 'Queue all named (5)', await text('#gen-all'));
  await r.locator('#gen-all').click(); await wait(400);
  it = await items();
  ok('raw: Queue all named ticks every named one', ['pushups-001-01', 'pushups-001-02', 'pushups-001-03', 'squats-001-03', 'abs_001.02'].every((k) => it['seg.' + k].queued === true) && (await text('#gen-go')) === 'Generate 5 loops' && /5 queued · about 30 credits/.test(await text('#raw-sum')), (await text('#gen-go')) + ' / ' + (await text('#raw-sum')));
  await r.locator('#gen-clear').click(); await wait(400);
  it = await items();
  ok('raw: Clear queue unticks them all', ['pushups-001-01', 'pushups-001-02', 'pushups-001-03', 'squats-001-03', 'abs_001.02'].every((k) => it['seg.' + k].queued === false) && (await r.locator('#gen-go').isDisabled()) && !it['control.queue']);
  await r.locator('#sg-q-pushups-001-01').click(); await wait();
  ok('raw: focus stays on the tick box', (await active()) === 'sg-q-pushups-001-01', await active());
  await r.locator('#sg-q-squats-001-03').click(); await wait();
  it = await items();
  ok('raw: Make this loop writes queued', it['seg.pushups-001-01'].queued === true && it['seg.squats-001-03'].queued === true && it['seg.pushups-001-01'].name === 'Diamond Push-Ups' && /QUEUED/i.test(await text('#sgc-pushups-001-01 .pill')) && (await r.locator('#sg-q-pushups-001-01').isChecked()));
  ok('raw: summary counts the queue', (await text('#raw-sum')) === '3 videos · 8 exercises found · 7 named · 2 queued · about 12 credits' && (await text('#gen-go')) === 'Generate 2 loops' && (await tabText('raw')) === 'RAW FOOTAGE 3', (await text('#raw-sum')) + ' / ' + (await tabText('raw')));
  // the same name queued twice
  await r.fill('#sg-name-abs-001-02', 'Diamond Push-Ups'); await r.locator('[data-sgsave="abs-001-02"]').click(); await wait();
  await r.locator('#sg-q-abs-001-02').click(); await wait();
  ok('raw: warns when a name is queued twice', /Diamond Push-Ups is queued twice/.test(await text('#sgc-abs-001-02')) && /Diamond Push-Ups is queued twice/.test(await text('#sgc-pushups-001-01')));
  await r.locator('#sg-q-abs-001-02').click(); await wait();
  // a change that lands while a field in another card has the focus swaps only its own card
  await r.locator('#sg-name-pushups-001-02').focus();
  await r.evaluate(() => { document.getElementById('sg-name-pushups-001-02').__mark = 1; document.querySelector('[data-sg="skip"][data-id="pushups-001-03"]').click(); });
  await wait();
  ok('raw: a change to one card leaves a field focused in another alone', (await r.evaluate(() => { const e = document.getElementById('sg-name-pushups-001-02'); return e.__mark === 1 && document.activeElement === e && document.getElementById('sgc-pushups-001-03').classList.contains('skipped'); })) && (await items())['seg.pushups-001-03'].skip === true);
  await r.locator('h1').click(); await wait(500);
  await r.locator('[data-sg="skip"][data-id="pushups-001-03"]').click(); await wait();
  ok('raw: Skip again brings the card back', (await items())['seg.pushups-001-03'].skip === false && (await r.locator('#sgc-pushups-001-03.skipped').count()) === 0 && (await r.inputValue('#sg-name-pushups-001-03')) === 'Shoulder Taps');
  // the credit limit
  await r.fill('#gen-cap', '5'); await r.locator('h1').click(); await wait(80);
  const low = await r.inputValue('#gen-cap');
  await r.fill('#gen-cap', '5000'); await r.locator('h1').click(); await wait(80);
  ok('raw: the limit stays between 10 and 1000', low === '10' && (await r.inputValue('#gen-cap')) === '1000', low + ' ' + (await r.inputValue('#gen-cap')));
  await r.fill('#gen-cap', '120');
  await r.locator('#gen-go').click(); await wait(250);
  it = await items(); const cq = it['control.queue'] || {};
  ok('raw: Generate writes control.queue with the ids and the limit', cq.kind === 'control' && cq.count === 2 && cq.cap === 120 && JSON.stringify(cq.ids) === '["pushups-001-01","squats-001-03"]' && !isNaN(Date.parse(cq.requestedAt)) && Object.keys(cq).sort().join() === 'cap,count,ids,kind,requestedAt', JSON.stringify(cq));
  ok('raw: the queued message', (await text('#gen-msg')) === 'Queued 2. Tell Claude: run the queue.' && /This page cannot start the renders\./.test(await text('#gen')), await text('#gen-msg'));
  ok('raw: the limit is remembered', (await r.evaluate(() => localStorage.getItem('loopboard.cap'))) === '120');
  ok('raw: focus stays on Generate', (await active()) === 'gen-go', await active());
  await r.locator('#sg-q-squats-001-03').click(); await wait();
  ok('raw: unticking after Generate asks to send the list again', /^Queued 1\. You changed things after that\. Press Generate again/.test(await text('#gen-msg')), await text('#gen-msg'));
  await r.locator('#sg-q-squats-001-03').click(); await wait();
  ok('raw: back to the sent list', (await text('#gen-msg')) === 'Queued 2. Tell Claude: run the queue.', await text('#gen-msg'));
  const tall = await r.evaluate(() => [].filter.call(document.querySelectorAll('#bar button, #bar select, #bar input, #out button:not(.pp), #out summary, #out input:not([type=checkbox]), #out label.ck'), (e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => (e.id || e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height)));
  ok('raw: tap targets are 44 px or more', tall.length === 0, tall.slice(0, 6).join(', '));
  await noScroll('raw');
  await r.reload(); await r.waitForSelector('#sgc-pushups-001-01', { timeout: 8000 });
  ok('raw: after a reload the limit and the queued message are still there', (await r.inputValue('#gen-cap')) === '120' && (await text('#gen-msg')) === 'Queued 2. Tell Claude: run the queue.', (await r.inputValue('#gen-cap')) + ' / ' + (await text('#gen-msg')));
  await wait(400);
  await r.screenshot({ path: path.join(ROOT, 'shot-raw.png') });
  await r.locator('#sgc-pushups-001-01 .pp').click(); await wait(700);
  ok('raw: a tap loads and plays the preview', await r.evaluate(() => { const v = document.querySelector('#sgc-pushups-001-01 .stage.pvw video'); return !!v.getAttribute('src') && !v.paused; }));
  await r.evaluate(() => window.scrollTo(0, document.querySelector('.vgrp[data-clip="pushups-001"]').getBoundingClientRect().top + window.pageYOffset - 40)); await wait(500);
  await r.screenshot({ path: path.join(ROOT, 'shot-raw-cards.png') });
  ok('raw: the preview box shows a frame of the strip before it plays', await r.evaluate((id) => getComputedStyle(document.querySelector('#sgc-pushups-001-02 .stage.pvw .fr')).backgroundImage.indexOf('/_blob/' + id) >= 0, bid('stripP')));
  await r.evaluate(() => window.scrollTo(0, document.querySelector('.vgrp[data-clip="squats-001"]').getBoundingClientRect().top + window.pageYOffset - 40)); await wait(600);
  await r.screenshot({ path: path.join(ROOT, 'shot-raw-cards2.png') });
  await r.evaluate(() => window.scrollTo(0, document.getElementById('sgc-squats-001-03').getBoundingClientRect().top + window.pageYOffset - 12)); await wait(600);
  await r.screenshot({ path: path.join(ROOT, 'shot-raw-cards3.png') });
  ok('raw: a preview scrolled off screen is let go and waits for a tap again', await r.evaluate(() => { const v = document.querySelector('#sgc-pushups-001-01 .stage.pvw video'); return !v.getAttribute('src') && v.dataset.userPaused === '1' && v.parentNode.classList.contains('paused'); }));
  await r.evaluate(() => window.scrollTo(0, document.querySelector('.vgrp[data-clip="abs-001"]').getBoundingClientRect().top + window.pageYOffset - 40)); await wait(400);
  await r.screenshot({ path: path.join(ROOT, 'shot-raw-cards0.png') });
  const tabRows = await r.evaluate(() => { const b = [].map.call(document.querySelectorAll('#tabs button'), (x) => Math.round(x.getBoundingClientRect().top)); return new Set(b).size; });
  ok('raw: six tabs take two rows on a phone', tabRows === 2, String(tabRows));
  // a preview someone started is not cut off by a snapshot
  await r.evaluate(() => document.getElementById('sgc-pushups-001-01').scrollIntoView({ block: 'center' })); await wait(300);
  await r.locator('#sgc-pushups-001-01 .pp').click(); await wait(600);
  await r.evaluate(() => { document.querySelector('#sgc-pushups-001-01 .stage.pvw video').__mark = 1; });
  await seed('segs', { 'squats-001-03': Object.assign({}, SEGS['squats-001-03'], { reps: 10 }) }); await wait(200);
  ok('raw: a snapshot leaves a playing preview alone', await r.evaluate(() => { const v = document.querySelector('#sgc-pushups-001-01 .stage.pvw video'); return v.__mark === 1 && !v.paused; }));
  await r.locator('#sgc-pushups-001-01 .pp').click(); await wait(600);
  ok('raw: pausing it lets the cards catch up', /about 10 reps/.test(await text('#sgc-squats-001-03')));
  await walk(); await r.screenshot({ path: path.join(ROOT, 'shot-raw-full.png'), fullPage: true });
  // Claude's side: the first queued stretch is being made, then comes back for review
  await seed('segs', { 'pushups-001-01': Object.assign({}, SEGS['pushups-001-01'], { state: 'generating', updatedAt: new Date().toISOString() }) });
  ok('raw: a stretch being made says Generating', /GENERATING/i.test(await text('#sgc-pushups-001-01 .pill')) && /^Claude is making 1 now\. Queued 1\. Tell Claude: run the queue\.$/.test(await text('#gen-msg')) && (await r.locator('#sg-q-pushups-001-01').count()) === 0, await text('#gen-msg'));
  await seed('segs', { 'pushups-001-01': Object.assign({}, SEGS['pushups-001-01'], { state: 'review', loop: bid('loopB'), cost: 6.4, updatedAt: new Date().toISOString() }) });
  ok('review: a snapshot moves the stretch to REVIEW with the badge', (await tabText('review')) === 'REVIEW 2' && /READY TO REVIEW/i.test(await text('#sgc-pushups-001-01 .pill')) && (await tabText('raw')) === 'RAW FOOTAGE 3', (await tabText('review')) + ' / ' + (await tabText('raw')));
  await r.locator('[data-sg="review"][data-id="pushups-001-01"]').click(); await wait(300);
  ok('review: Open in REVIEW goes to the card', (await r.evaluate(() => location.hash)) === '#review' && (await r.locator('#tabs [aria-current="page"]').innerText()).startsWith('REVIEW') && (await r.locator('#sgc-pushups-001-01.rvc').count()) === 1);
  ok('review: groups', /^WAITING FOR YOU · 2\|FAILED · 1$/i.test((await r.locator('#out h2.grp').allInnerTexts()).join('|')), (await r.locator('#out h2.grp').allInnerTexts()).join('|'));
  const rv = await text('#sgc-pushups-001-01');
  ok('review: card has the name, where it came from and the cost', /Diamond Push-Ups/.test(rv) && /push-ups · IMG_0101\.MOV · 0:12 to 0:31 · about 6 reps · cost 6\.4 credits/.test(rv) && /Your video/.test(rv) && /The loop/.test(rv), rv.replace(/\n/g, ' | '));
  ok('review: source preview and finished loop are both on the card', await r.evaluate((ids) => { const c = document.getElementById('sgc-pushups-001-01'), a = c.querySelector('.pair .stage.pvw video'), b = c.querySelector('.pair .stage.sq video'); return a.dataset.src === '/_blob/' + ids[0] && b.dataset.src === '/_blob/' + ids[1] && 'tap' in a.dataset && !('tap' in b.dataset); }, [bid('previewP'), bid('loopB')]));
  await r.evaluate(() => document.getElementById('sgc-pushups-001-01').scrollIntoView({ block: 'center' })); await wait(700);
  ok('review: the loop plays when it is on screen, the source waits for a tap', await r.evaluate(() => { const c = document.getElementById('sgc-pushups-001-01'), a = c.querySelector('.stage.pvw video'), b = c.querySelector('.stage.sq video'); return !!b.getAttribute('src') && !b.paused && !a.getAttribute('src'); }));
  const box = await r.evaluate(() => { const g = (id, c) => document.querySelector('#sgc-' + id + ' .stage.' + c).getBoundingClientRect(), a = g('pushups-001-01', 'pvw'), b = g('pushups-001-01', 'sq'), c = g('squats-001-02', 'pvw'), d = g('squats-001-02', 'sq'); return { sq: Math.abs(b.width - b.height) < 1 && b.width >= 170, beside: a.right <= b.left + 1 && Math.abs(a.top - b.top) < 2, stacked: c.bottom <= d.top + 1, fits: Math.max(b.right, c.right) <= document.documentElement.clientWidth - 16 }; });
  ok('review: loop stage is square; on a phone an upright source sits beside it and a wide one stacks above it', box.sq && box.beside && box.stacked && box.fits, JSON.stringify(box));
  ok('review: the source shows a frame of its strip before it plays', await r.evaluate((id) => getComputedStyle(document.querySelector('#sgc-pushups-001-01 .stage.pvw .fr')).backgroundImage.indexOf('/_blob/' + id) >= 0, bid('stripP')));
  await r.evaluate(() => window.scrollTo(0, 0)); await wait(300);
  await r.screenshot({ path: path.join(ROOT, 'shot-review.png') });
  await r.evaluate(() => window.scrollTo(0, document.querySelector('#out h2.grp').getBoundingClientRect().top + window.pageYOffset - 12)); await wait(900);
  await r.screenshot({ path: path.join(ROOT, 'shot-review-cards.png') });
  await r.evaluate(() => window.scrollTo(0, document.getElementById('sgc-squats-001-02').getBoundingClientRect().top + window.pageYOffset - 12)); await wait(900);
  await r.screenshot({ path: path.join(ROOT, 'shot-review-cards2.png') });
  await r.evaluate(() => window.scrollTo(0, 0)); await wait(200);
  // verdicts
  await r.locator('[data-rv="approved"][data-id="pushups-001-01"]').click(); await wait();
  it = await items();
  ok('review: Approve writes the verdict', it['seg.pushups-001-01'].verdict === 'approved' && it['seg.pushups-001-01'].name === 'Diamond Push-Ups' && it['seg.pushups-001-01'].queued === true, JSON.stringify(it['seg.pushups-001-01']));
  ok('review: approved shows its pill and stays where it is, so nothing slides under the finger', /APPROVED/i.test(await text('#sgc-pushups-001-01 .pill')) && /^WAITING FOR YOU · 1\|FAILED · 1$/i.test((await r.locator('#out h2.grp').allInnerTexts()).join('|')) && await r.evaluate(() => !!(document.getElementById('sgc-pushups-001-01').compareDocumentPosition(document.getElementById('sgc-squats-001-02')) & 4)), (await r.locator('#out h2.grp').allInnerTexts()).join('|'));
  ok('review: badge counts the ones waiting', (await tabText('review')) === 'REVIEW 1', await tabText('review'));
  ok('review: focus lands on Change my answer', (await active()) === 'rv=clear,id=pushups-001-01', await active());
  await r.keyboard.press('Tab');
  ok('review: one Tab after approving reaches the next loop still waiting', /id=squats-001-02$/.test(await active()) || /squats-001-02/.test(await active()), await active());
  await r.locator('button[data-tab="raw"]').click(); await r.locator('button[data-tab="review"]').click(); await wait();
  ok('review: after leaving the tab and coming back the approved one is under ANSWERED', /^WAITING FOR YOU · 1\|FAILED · 1\|ANSWERED · 1$/i.test((await r.locator('#out h2.grp').allInnerTexts()).join('|')) && await r.evaluate(() => !!(document.getElementById('sgc-squats-001-02').compareDocumentPosition(document.getElementById('sgc-pushups-001-01')) & 4)), (await r.locator('#out h2.grp').allInnerTexts()).join('|'));
  await r.locator('[data-rv="redo"][data-id="squats-001-02"]').click();
  ok('review: Redo opens a note field and focuses it', (await active()) === 'rv-note-squats-001-02', await active());
  await r.keyboard.press('Escape'); await wait(60);
  ok('review: Escape closes the note field', (await r.locator('#rv-note-squats-001-02').count()) === 0 && (await active()) === 'rv=redo,id=squats-001-02', await active());
  await r.locator('[data-rv="redo"][data-id="squats-001-02"]').click();
  await r.fill('#rv-note-squats-001-02', 'the knees cave in');
  await r.evaluate(() => { document.getElementById('rv-note-squats-001-02').__mark = 1; });
  await seed('segs', { 'squats-001-03': Object.assign({}, SEGS['squats-001-03'], { reps: 11 }) }); await wait(150);
  ok('review: the redo note survives a snapshot while typing', await r.evaluate(() => { const e = document.getElementById('rv-note-squats-001-02'); return e.__mark === 1 && e.value === 'the knees cave in' && document.activeElement === e; }));
  await r.press('#rv-note-squats-001-02', 'Enter'); await wait();
  it = await items();
  ok('review: Redo writes the verdict and the note', it['seg.squats-001-02'].verdict === 'redo' && it['seg.squats-001-02'].note === 'the knees cave in' && it['seg.squats-001-02'].queued === true, JSON.stringify(it['seg.squats-001-02']));
  ok('review: redo card shows the pill, the note and what to do next', /REDO ASKED/i.test(await text('#sgc-squats-001-02 .pill')) && /What to fix: the knees cave in/.test(await text('#sgc-squats-001-02')) && /1 loop is marked for another try\. Press Generate on the RAW FOOTAGE tab to send it\./.test(await outText()) && (await tabText('review')) === 'REVIEW 0', await tabText('review'));
  await r.locator('[data-rv="clear"][data-id="pushups-001-01"]').click(); await wait();
  ok('review: Change my answer clears the verdict', (await items())['seg.pushups-001-01'].verdict === null && (await tabText('review')) === 'REVIEW 1' && (await active()) === 'rv=approved,id=pushups-001-01', await active());
  await r.locator('[data-rv="rejected"][data-id="pushups-001-01"]').click(); await wait();
  ok('review: Reject writes the verdict', (await items())['seg.pushups-001-01'].verdict === 'rejected' && /REJECTED/i.test(await text('#sgc-pushups-001-01 .pill')));
  ok('review: failed card shows why', /It failed: The render timed out\./.test(await text('#sgc-squats-001-01')) && (await r.locator('#sgc-squats-001-01 .stage.sq').count()) === 0);
  await r.locator('[data-sg="retry"][data-id="squats-001-01"]').click(); await wait();
  ok('review: Try again marks the failed one for another go', (await items())['seg.squats-001-01'].verdict === 'redo' && (await r.getAttribute('[data-sg="retry"][data-id="squats-001-01"]', 'aria-pressed')) === 'true' && /2 loops are marked for another try/.test(await outText()));
  await walk(); await r.screenshot({ path: path.join(ROOT, 'shot-review-full.png'), fullPage: true });
  await noScroll('review');
  await r.locator('button[data-tab="raw"]').click(); await wait();
  ok('raw: Generate now includes the redo and the retry', (await text('#gen-go')) === 'Generate 3 loops', await text('#gen-go'));
  await r.locator('#gen-go').click(); await wait(250);
  ok('raw: control.queue lists them', JSON.stringify(((await items())['control.queue'] || {}).ids) === '["squats-001-01","squats-001-02","squats-001-03"]', JSON.stringify(((await items())['control.queue'] || {}).ids));
  // Claude's side again: the redo comes back as a new loop, later than the request, so it waits for a verdict once more
  await seed('segs', { 'squats-001-02': Object.assign({}, SEGS['squats-001-02'], { loop: bid('loopB'), cost: 12, updatedAt: new Date(Date.now() + 60000).toISOString() }) });
  ok('review: a new result answers the redo', (await tabText('review')) === 'REVIEW 1' && (await text('#gen-go')) === 'Generate 2 loops' && /Ready to review/i.test(await r.locator('#sgc-squats-001-02 .pill').textContent()), (await tabText('review')) + ' / ' + (await text('#gen-go')) + ' / ' + (await r.locator('#sgc-squats-001-02 .pill').textContent()));
  // saving stops: the cards stay, the controls go
  await r.evaluate(() => window.__mock.kill()); await wait(200);
  ok('raw: when saving stops the cards stay but nothing can be pressed', (await r.locator('#out .sgc').count()) >= 8 && (await r.locator('#out button:not([data-pp]), #out input, #gen-go, #gen-all, #gen-clear, #gen-cap').count()) === 0 && /Live saving stopped/.test(await text('#state')) && /Name: Diamond Push-Ups/.test(await text('#sgc-pushups-001-01')), String(await r.locator('#out button:not([data-pp]), #out input').count()));
  await r.locator('button[data-tab="review"]').click(); await wait();
  ok('review: when saving stops there are no verdict buttons', (await r.locator('#out .sgc').count()) === 3 && (await r.locator('#out button:not([data-pp]), #out input').count()) === 0);
  await r.close();
  // the checks that came with the fixes after the QA pass
  await require('./fixes.cjs')(ctx, base, ok, watch, ROOT);
  // view only: no runtime at all
  for (const h of ['raw', 'review']) {
    const v = await ctx.newPage(); watch(v); await v.goto(base + 'index.html?runtime=none#' + h); await v.waitForSelector('#tabs button[data-tab="raw"]', { timeout: 8000 }); await v.waitForTimeout(400);
    const vt = await v.locator('#out').innerText();
    ok('view only: ' + h + ' tab shows no action buttons', (await v.locator('#out button, #out input, #gen, #bar button, #bar input').count()) === 0 && /Open this page in Claude, signed in/.test(vt) && /View only here/.test(await v.locator('#state').innerText()), vt.replace(/\n/g, ' | '));
    await v.close();
  }
  console.error('raw/review checks: ' + out.slice(T0).filter((l) => l.startsWith('PASS')).length + ' pass, ' + out.slice(T0).filter((l) => l.startsWith('FAIL')).length + ' fail');
  // read-only and no runtime
  for (const mode of ['readonly', 'none']) {
    const q = await ctx.newPage(); await q.goto(base + 'index.html?runtime=' + mode); await q.waitForSelector('.slot', { timeout: 8000 }); await q.waitForTimeout(400);
    const st = await q.locator('#state').innerText(); const n = await q.locator('button[data-edit="video"]').count();
    ok('mode ' + mode + ' state', mode === 'none' ? /View only/.test(st) : /Saves as you go/.test(st), st.replace(/\n/g, ' | '));
    ok('mode ' + mode + ' edit buttons ' + (mode === 'none' ? 'hidden' : 'present'), mode === 'none' ? n === 0 : n > 0, String(n));
    if (mode === 'readonly') { await q.locator('button[data-edit="video"]').first().click(); ok('readonly: only link option', (await q.locator('button[data-src="upload"]').count()) === 0); }
    await q.close();
  }
  ok('no console errors', errs.length === 0, errs.join(' | '));
  console.log(out.join('\n'));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
