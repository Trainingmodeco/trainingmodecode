// Scratch: a few behaviours not covered by the smoke test.
const L = require('../qa2/lib.cjs');
const A = { id: 'a', folder: 'push-ups', file: 'IMG_0101.MOV', dur: 118, tag: 'P' }, B = { id: 'b', folder: 'squats', file: 'IMG_0202.MOV', dur: 195, tag: 'L' };
(async () => {
  const { srv, base } = await L.serve(); const b = await L.launch();
  const { p, errs } = await L.open(b, base, { w: 390, tab: 'raw' });
  const segs = {
    'a-01': L.mkSeg(A, 1, { start: 12, end: 31, kind: 'junk', reps: null, hold: [14, 30], why: 'Still for 16 s', guess: { name: 'Plank', entryId: null, confidence: 0.4, view: 'side' } }),
    'a-02': L.mkSeg(A, 2, { start: 40, end: 60, guess: { name: 'Wide Push-Ups', entryId: 'chest_wide_push_ups_core', confidence: 0.8, view: 'side' } }),
    'b-01': L.mkSeg(B, 1, { start: 20, end: 35, state: 'review', loop: L.bid('loopA'), cost: 6 }),
  };
  const items = { 'seg.b-01': L.own('b-01', { name: 'Goblet Squats', queued: true }) };
  await L.seed(p, segs, items); await p.waitForSelector('#sgc-a-02'); await p.waitForTimeout(300);
  const item = (id) => p.evaluate((id) => window.__mock.store('items')['seg.' + id] || null, id);
  const say = (n, ok, extra) => console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? ' :: ' + JSON.stringify(extra) : ''));
  // (a) the hold tick on a card that only shows Claude's guess does not take the guess as the name
  await p.locator('details.junk > summary').click();
  await p.locator('#sg-hold-a-01').click(); await p.waitForTimeout(250);
  let d = await item('a-01'); say('hold tick with only a guess on screen saves hold and no name', d && d.hold === true && d.name === '', d);
  await p.locator('#sg-hold-a-01').click(); await p.waitForTimeout(250);
  d = await item('a-01'); say('unticking Hold saves hold: false', d.hold === false && !(await p.locator('#sg-hold-a-01').isChecked()), d);
  // hold box inside FIX THE CUT on an ordinary card
  await p.locator('details[data-cut="a-02"] > summary').click(); await p.locator('#sg-hold-a-02').click(); await p.waitForTimeout(250);
  d = await item('a-02'); say('the hold box inside FIX THE CUT saves hold on an ordinary card, without naming it', d.hold === true && d.name === '' && (await p.locator('details[data-cut="a-02"]').evaluate((e) => e.open)), d);
  // (d) a stretch with a loop cannot lose its name
  await p.locator('#sg-name-b-01').fill(''); await p.locator('#sg-name-b-01').press('Enter'); await p.waitForTimeout(250);
  say('a name cannot be removed once a loop was made under it', (await p.locator('#sgerr-b-01').textContent()) === 'This one has a loop already. Rename it instead.' && (await item('b-01')).name === 'Goblet Squats', await p.locator('#sgerr-b-01').textContent());
  await p.locator('#sg-name-b-01').fill('Goblet Squats'); await p.locator('h1').click(); await p.waitForTimeout(500);
  // (b) the quiet moment after an answer
  await p.locator('button[data-tab="review"]').click(); await p.waitForTimeout(700);
  await p.locator('[data-rv="approved"][data-id="b-01"]').click(); await p.waitForTimeout(150);
  await p.locator('[data-rv="clear"][data-id="b-01"]').click(); await p.waitForTimeout(250);
  say('a press on "Change my answer" right after Approve is not taken', (await item('b-01')).verdict === 'approved', await item('b-01'));
  await p.waitForTimeout(700);
  await p.locator('[data-rv="clear"][data-id="b-01"]').click(); await p.waitForTimeout(250);
  say('a moment later it is', (await item('b-01')).verdict === null);
  await p.waitForTimeout(800);
  await p.locator('[data-rv="rejected"][data-id="b-01"]').click(); await p.waitForTimeout(250);
  say('and Reject right after "Change my answer" is taken (only the button on the same spot is held)', (await item('b-01')).verdict === 'rejected');
  say('no page errors', errs.length === 0, errs);
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
