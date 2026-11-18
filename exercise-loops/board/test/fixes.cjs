// Checks added with the fixes that followed the QA pass on the two footage tabs (the numbers in the names are the QA finding numbers).
// Run from smoke.cjs. Claude's seg documents carry NO updatedAt here, so the page has to cope with the contract's older shape too.
module.exports = async function fixes(ctx, base, ok, watch, ROOT) {
  const bid = (s) => (s + '0'.repeat(32)).slice(0, 32), NOW = () => new Date().toISOString();
  const A = { id: 'a', folder: 'push-ups', file: 'IMG_0101.MOV', dur: 118, tag: 'P' }, B = { id: 'b', folder: 'squats', file: 'IMG_0202.MOV', dur: 195, tag: 'L' };
  const mk = (clip, n, o) => Object.assign({ clipId: clip.id, folder: clip.folder, file: clip.file, clipDur: clip.dur, idx: n, start: n * 10, end: n * 10 + 8, period: 3.1, reps: 6, kind: 'exercise', group: n, guess: { name: null, entryId: null, confidence: 0.2, view: 'other' }, strip: bid('strip' + clip.tag), preview: bid('preview' + clip.tag), state: 'ready', loop: null, poster: null, cost: null, error: null, score: 0.8 }, o);
  const own = (segId, o) => Object.assign({ kind: 'seg', segId, name: '', entryId: null, from: null, to: null, skip: false, queued: false, verdict: null, note: '', updatedAt: NOW() }, o);
  const open = async (hash, w) => { const p = await ctx.newPage(); watch(p); await p.setViewportSize({ width: w || 390, height: 844 }); await p.goto(base + 'index.html#' + hash); await p.waitForSelector('#tabs button'); return p; };
  const kit = (p) => {
    const wait = (ms) => p.waitForTimeout(ms || 150);
    return {
      wait,
      seed: async (col, docs) => { await p.evaluate(([c, d]) => Object.keys(d).forEach((k) => window.__mock.seed(c, k, d[k])), [col, docs]); await wait(150); },
      // What Claude does to one stretch: change some fields, never adding a time stamp.
      claude: async (id, patch) => { await p.evaluate(([id, patch]) => { const S = window.__mock.store('segs'); window.__mock.seed('segs', id, Object.assign({}, S[id], patch)); }, [id, patch]); await wait(180); },
      item: (id) => p.evaluate((id) => window.__mock.store()['seg.' + id] || null, id),
      all: () => p.evaluate(() => JSON.parse(JSON.stringify(window.__mock.store()))),
      tc: (sel) => p.locator(sel).textContent(),
      tab: (t) => p.locator('#tabs button[data-tab="' + t + '"]').innerText(),
      go: async (t) => { await p.locator('button[data-tab="' + t + '"]').click(); await wait(200); },
      active: () => p.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName.toLowerCase() + Object.keys(a.dataset).map((k) => '[' + k + '=' + a.dataset[k] + ']').join('')) : ''; }),
      live: () => p.evaluate(() => document.getElementById('live').textContent),
    };
  };

  // ---------- page 1: names, the tick, slow saves, the new fields ----------
  {
    const p = await open('raw'), k = kit(p);
    await k.seed('segs', {
      'a-01': mk(A, 1, { guess: { name: 'Diamond Push-Ups', entryId: 'chest_diamond_push_ups_core', confidence: 0.82, view: 'side' } }),
      'a-02': mk(A, 2, { guess: { name: 'Wide Push-Ups', entryId: 'chest_wide_push_ups_core', confidence: 0.45, view: 'front' } }),
      'a-03': mk(A, 3, { start: 70, end: 95, reps: null, kind: 'junk', why: 'The picture holds still for 20 s: a rest, or a hold exercise', hold: [72, 92] }),
      'a-04': mk(A, 4, { start: 100, end: 108, guess: { name: 'pike push-ups', entryId: null, confidence: 0.9, view: 'side' } }),
      'a-05': mk(A, 5, { start: 109, end: 117, warn: ['The camera moved', 'Very dark', 7, ''] }),
      'a-06': mk(A, 6, { clipId: 'a2', file: 'IMG_0102.MOV', start: 3, end: 9, reps: null, kind: 'junk', why: 'Too short to be a rep' }),
      'b-05': mk(B, 5, { start: 150, end: 160, state: 'review', loop: 'not-an-asset' }),
    });
    await p.waitForSelector('#sgc-a-01');
    // [16] the guess on screen can be ticked as it is, and there is one button for all the sure guesses
    ok('[16] fix: the bar offers "Accept Claude\'s names" with the count of sure guesses', (await k.tc('#gen-acc')) === 'Accept Claude\'s names (2)' && (await p.locator('#gen-acc').isVisible()) && !(await p.locator('#gen-acc').isDisabled()), await k.tc('#gen-acc'));
    await p.locator('#sg-q-a-01').click(); await k.wait();
    let d = await k.item('a-01');
    ok('[16] fix: ticking a card that shows Claude\'s guess saves that name and queues it', d && d.name === 'Diamond Push-Ups' && d.entryId === 'chest_diamond_push_ups_core' && d.queued === true && /Queued/i.test(await k.tc('#sgc-a-01 .pill')) && (await k.active()) === 'sg-q-a-01', JSON.stringify(d));
    ok('[16] fix: the count on the button follows', (await k.tc('#gen-acc')) === 'Accept Claude\'s names (1)', await k.tc('#gen-acc'));
    // [3] what is typed is what gets queued
    await p.fill('#sg-name-a-02', 'Archer Push-Ups');
    await p.locator('#sg-q-a-02').click(); await k.wait();
    d = await k.item('a-02');
    ok('[3] fix: the tick queues the name typed on the card, not an older one', d && d.name === 'Archer Push-Ups' && d.queued === true && (await p.inputValue('#sg-name-a-02')) === 'Archer Push-Ups', JSON.stringify(d));
    await p.fill('#sg-name-a-02', 'Clap Push-Ups');
    const w0 = await p.evaluate(() => window.__mock.writes);
    await p.locator('#gen-go').click(); await k.wait(250);
    ok('[3] fix: Generate will not send a queued card with unsaved text, and says which', (await p.evaluate(() => window.__mock.writes)) === w0 && !(await k.all())['control.queue'] && /^Save what you typed on IMG_0101\.MOV, 0:20 to 0:28 first\./.test(await k.tc('#gen-err')) && /Not saved yet/.test(await k.tc('#sgerr-a-02')) && (await k.active()) === 'button[sgsave=a-02]', (await k.tc('#gen-err')) + ' / ' + (await k.active()));
    await p.keyboard.press('Enter'); await k.wait();
    await p.locator('#gen-go').click(); await k.wait(250);
    ok('[3] fix: after Save name, Generate sends it under the new name', JSON.stringify(((await k.all())['control.queue'] || {}).ids) === '["a-01","a-02"]' && (await k.item('a-02')).name === 'Clap Push-Ups' && (await k.tc('#gen-err')) === '', JSON.stringify((await k.all())['control.queue']));
    // an empty field: the box is off and says why, and comes on while typing
    ok('[16] fix: with no name on screen the box is off and says why', (await p.locator('#sg-q-a-05').isDisabled()) && (await p.locator('#sg-qh-a-05').isVisible()));
    await p.locator('#sg-name-a-05').pressSequentially('Burp');
    ok('[16] fix: the box comes on as soon as a name is typed', !(await p.locator('#sg-q-a-05').isDisabled()) && !(await p.locator('#sg-qh-a-05').isVisible()));
    await p.fill('#sg-name-a-05', 'Burpees'); await p.press('#sg-name-a-05', 'Enter'); await k.wait();
    // [8] a name can be taken away, and the counts follow
    const sumNamed = await k.tc('#raw-sum');
    await p.fill('#sg-name-a-05', ''); await p.press('#sg-name-a-05', 'Enter'); await k.wait();
    d = await k.item('a-05');
    ok('[8] fix: an emptied name field takes the name away', d.name === '' && d.entryId === null && d.queued === false && /No name yet/i.test(await k.tc('#sgc-a-05 .pill')) && /Name removed\./.test(await k.live()), JSON.stringify(d) + ' ' + (await k.live()));
    ok('[8] fix: the counts follow', /5 exercises found · 3 named/.test(sumNamed) && /5 exercises found · 2 named/.test(await k.tc('#raw-sum')), sumNamed + ' -> ' + (await k.tc('#raw-sum')));
    await p.press('#sg-name-a-05', 'Enter'); await k.wait();
    ok('[8] fix: with no name saved and none typed, Save still asks for one', (await k.tc('#sgerr-a-05')) === 'Type a name first.', await k.tc('#sgerr-a-05'));
    await p.locator('.vgrp[data-clip="a2"] details.junk > summary').click();
    await p.fill('#sg-name-a-06', 'Oops'); await p.press('#sg-name-a-06', 'Enter'); await k.wait();
    const sumOops = await k.tc('#raw-sum');
    await p.fill('#sg-name-a-06', ''); await p.press('#sg-name-a-06', 'Enter'); await k.wait();
    ok('[8] fix: a "no exercise" stretch named by mistake goes back to no exercise', /6 exercises found · 3 named/.test(sumOops) && /5 exercises found · 2 named/.test(await k.tc('#raw-sum')) && (await p.locator('.vgrp[data-clip="a2"] details.junk #sgc-a-06').count()) === 1 && (await k.item('a-06')).name === '', sumOops + ' -> ' + (await k.tc('#raw-sum')));
    // [contract] why, hold, warn
    ok('[new fields] a "no exercise" stretch says why', /The picture holds still for 20 s: a rest, or a hold exercise\./.test(await k.tc('#sgc-a-03')) && /Too short to be a rep\./.test(await k.tc('#sgc-a-06')));
    ok('[new fields] the section header says a hold may be inside', (await k.tc('.vgrp[data-clip="a"] details.junk > summary')) === '1 stretch with no exercise found · 1 may be a hold', await k.tc('.vgrp[data-clip="a"] details.junk > summary'));
    await p.locator('.vgrp[data-clip="a"] details.junk > summary').click();
    ok('[new fields] a still stretch is offered as a hold', /Held still from 1:12 to 1:32\. If this is a hold exercise \(plank, wall sit, hang\), name it and tick Hold\./.test(await k.tc('#sgc-a-03')) && (await p.locator('#sg-hold-a-03').isVisible()) && (await k.tc('label[for="sg-hold-a-03"]')) === 'This is a hold' && (await p.locator('details[data-cut="a-03"] #sg-hold-a-03').count()) === 0);
    ok('[new fields] every other card offers the hold box inside FIX THE CUT', (await p.locator('details[data-cut="a-01"] #sg-hold-a-01').count()) === 1 && !(await p.locator('#sg-hold-a-01').isVisible()));
    await p.fill('#sg-name-a-03', 'Plank'); await p.locator('#sg-hold-a-03').click(); await k.wait();
    d = await k.item('a-03');
    ok('[new fields] "name it and tick Hold" saves the name and hold: true', d && d.name === 'Plank' && d.hold === true && d.queued === false && Object.keys(d).sort().join() === 'entryId,from,hold,kind,name,note,queued,segId,skip,to,updatedAt,verdict', JSON.stringify(d));
    ok('[new fields] a named hold counts like any named exercise, and its card leaves the "no exercise" section', /6 exercises found · 3 named/.test(await k.tc('#raw-sum')) && (await p.locator('.vgrp[data-clip="a"] > #sgc-a-03').count()) === 1 && (await p.locator('.vgrp[data-clip="a"] details.junk').count()) === 0 && (await p.locator('#sg-hold-a-03').isChecked()) && /You marked it as a hold\./.test(await k.tc('#sgc-a-03')) && (await k.tc('#gen-all')) === 'Queue all named (1)', (await k.tc('#raw-sum')) + ' / ' + (await k.tc('#gen-all')));
    await p.locator('#sg-q-a-03').click(); await k.wait();
    ok('[new fields] the hold flag stays on the document through later saves', (await k.item('a-03')).hold === true && (await k.item('a-03')).queued === true && /4 queued|3 queued/.test(await k.tc('#raw-sum')), JSON.stringify(await k.item('a-03')));
    ok('[new fields] each warning from the splitter is a line on the card, and only text is shown', (await p.locator('#sgc-a-05 .ln.muted').allTextContents()).join('|') === 'Heads up: The camera moved.|Heads up: Very dark.', (await p.locator('#sgc-a-05 .ln.muted').allTextContents()).join('|'));
    // [11] time fields
    await p.locator('details[data-cut="a-05"] > summary').click();
    ok('[11] fix: the cut fields are text fields with a number pad', (await p.getAttribute('#sg-from-a-05', 'type')) === 'text' && (await p.getAttribute('#sg-from-a-05', 'inputmode')) === 'decimal');
    await p.fill('#sg-name-a-05', 'Burpees'); await p.fill('#sg-from-a-05', '12-5'); await p.press('#sg-from-a-05', 'Enter'); await k.wait();
    ok('[11] fix: a time that cannot be read is refused with a message and stays in the field', /^Type the time in seconds, like 12\.5, or as minutes and seconds, like 1:05\.$/.test(await k.tc('#sgerr-a-05')) && (await k.item('a-05')).name === '' && (await p.inputValue('#sg-from-a-05')) === '12-5', await k.tc('#sgerr-a-05'));
    await p.fill('#sg-from-a-05', '1:50'); await p.fill('#sg-to-a-05', '1:55,5'); await p.press('#sg-to-a-05', 'Enter'); await k.wait();
    d = await k.item('a-05');
    ok('[11] fix: 1:50 and 1:55,5 are saved as 110 and 115.5 seconds', d.from === 110 && d.to === 115.5 && d.name === 'Burpees' && /Your cut: 1:50 to 1:55\.5/.test(await k.tc('#sgc-a-05')), JSON.stringify(d));
    await p.fill('#sg-from-a-05', '111,25'); await p.fill('#sg-to-a-05', '114.5'); await p.press('#sg-to-a-05', 'Enter'); await k.wait();
    d = await k.item('a-05');
    ok('[11] fix: 111,25 and 114.5 are saved as numbers', d.from === 111.25 && d.to === 114.5, JSON.stringify(d));
    // [4] a slow save: text typed while it is on its way is kept, and a second Save is not dropped
    await p.evaluate(() => { window.__mock.delay = 700; });
    await p.fill('#sg-name-a-04', 'Pike Push-Usp'); await p.press('#sg-name-a-04', 'Enter'); await k.wait(150);
    ok('[4] the Save button says Saving and can still be pressed', (await k.tc('[data-sgsave="a-04"]')) === 'Saving…' && !(await p.locator('[data-sgsave="a-04"]').isDisabled()) && (await p.locator('[data-sg="skip"][data-id="a-04"]').isDisabled()));
    await p.locator('details[data-cut="a-04"] > summary').click();
    await p.fill('#sg-note-a-04', 'use the second rep');
    await p.fill('#sg-name-a-04', 'Pike Push-Ups'); await p.press('#sg-name-a-04', 'Enter');
    await k.wait(900);
    const mid = { stored: (await k.item('a-04')), name: await p.inputValue('#sg-name-a-04'), note: await p.inputValue('#sg-note-a-04') };
    ok('[4] fix: when the first save lands, what was typed since is still in the fields', mid.name === 'Pike Push-Ups' && mid.note === 'use the second rep', JSON.stringify(mid));
    await k.wait(1100);
    d = await k.item('a-04');
    ok('[4] fix: the second Save went out after the first and both the name and the note are stored', d.name === 'Pike Push-Ups' && d.entryId === 'shoulders_pike_push_ups_core' && d.note === 'use the second rep' && (await p.inputValue('#sg-name-a-04')) === 'Pike Push-Ups' && (await k.tc('[data-sgsave="a-04"]')) === 'Save name', JSON.stringify(d));
    // [12] a card pressed during "Queue all named" is told to wait, and the message goes when the batch ends
    await p.evaluate(() => { window.__mock.delay = 250; });
    ok('[12] two named cards wait to be queued', (await k.tc('#gen-all')) === 'Queue all named (2)', await k.tc('#gen-all'));
    await p.locator('#gen-all').click(); await k.wait(80);
    await p.evaluate(() => document.querySelector('[data-sg="skip"][data-id="a-01"]').click()); await k.wait(60);
    const during = { msg: await k.tc('#sgerr-a-01'), btn: await k.tc('#gen-all') };
    await p.waitForFunction(() => !/Ticking/.test(document.getElementById('gen-all').textContent), null, { timeout: 8000 }); await k.wait(200);
    ok('[12] fix: the "queue is still being changed" message leaves the card when the batch ends', /still being changed/.test(during.msg) && /^Ticking… \d of 2$/.test(during.btn) && (await k.tc('#sgerr-a-01')) === '' && (await k.item('a-04')).queued === true && (await k.item('a-05')).queued === true, JSON.stringify(during) + ' -> "' + (await k.tc('#sgerr-a-01')) + '"');
    await p.evaluate(() => { window.__mock.delay = 0; });
    // [13] an error thrown at once by the store is a failed save, not a stuck card
    await p.evaluate(() => { window.__mock.throwNext = 1; });
    await p.locator('[data-sg="skip"][data-id="a-05"]').click(); await k.wait(250);
    ok('[13] fix: a write the store throws on at once shows as a failed save and frees the card', (await k.tc('#sgerr-a-05')) === 'That did not save. Check your connection and try again.' && !(await p.locator('[data-sg="skip"][data-id="a-05"]').isDisabled()) && (await k.tc('[data-sgsave="a-05"]')) === 'Save name' && (await k.item('a-05')).skip === false, await k.tc('#sgerr-a-05'));
    // [17] a stretch marked ready to review with no loop file is not a dead end
    ok('[17] fix: "review" with no loop file shows as failed, with a way on', /Failed/i.test(await k.tc('#sgc-b-05 .pill')) && /It failed: The loop file is missing\./.test(await k.tc('#sgc-b-05')) && (await p.locator('#sgc-b-05 [data-sg="retry"]').isDisabled()) && (await p.locator('#sgc-b-05 [data-sg="skip"]').count()) === 1 && /Save a name first/.test(await k.tc('#sgc-b-05')));
    await p.fill('#sg-name-b-05', 'Goblet Squats'); await p.press('#sg-name-b-05', 'Enter'); await k.wait();
    await p.locator('#sgc-b-05 [data-sg="retry"]').click(); await k.wait();
    d = await k.item('b-05');
    ok('[17] fix: once named, Try again puts it back in the next Generate', d.verdict === 'redo' && d.queued === true && d.forLoop === null && (await p.evaluate(() => /Generate \d loops?/.test(document.getElementById('gen-go').textContent))) && /Redo asked/i.test(await k.tc('#sgc-b-05 .pill')), JSON.stringify(d));
    // [14] both warnings at once
    await p.fill('#sg-name-a-01', 'Alligator Push-Ups'); await p.press('#sg-name-a-01', 'Enter'); await k.wait();
    await p.fill('#sg-name-a-02', 'Alligator Push-Ups'); await p.press('#sg-name-a-02', 'Enter'); await k.wait();
    const dup = await k.tc('#sgc-a-02 .warnnote');
    ok('[14] fix: a name that has a loop and is queued twice shows both lines', /Alligator Push-Ups already has a loop\. Making another replaces nothing until you approve it\. Alligator Push-Ups is queued twice\. Both get made, and you choose between them in REVIEW\./.test(dup), dup);
    // [9] [10] a stretch Claude removed
    await p.locator('#sg-name-a-02').click(); await p.keyboard.press('Control+a'); await p.keyboard.type('Doomed name');
    await p.evaluate(() => window.__mock.remove('segs', 'a-02')); await k.wait(250);
    const held = await p.locator('#sgc-a-02').count();
    await p.keyboard.press('Enter'); await k.wait(300);
    ok('[9] fix: Enter on a card whose stretch is gone says so and takes the card away', held === 1 && (await p.locator('#sgc-a-02').count()) === 0 && /That stretch is no longer in the footage\./.test(await k.live()), held + ' ' + (await k.live()));
    await k.seed('segs', { 'a-02': mk(A, 2, { guess: { name: 'Decline Push-Ups', entryId: null, confidence: 0.9, view: 'front' } }) });
    ok('[10] fix: a new stretch under the same id does not show the text typed on the old one', (await p.inputValue('#sg-name-a-02')) !== 'Doomed name', await p.inputValue('#sg-name-a-02'));
    // [5] focus stays on its own card through a redraw
    await p.locator('details[data-cut="a-04"] > summary').focus();
    await k.claude('b-05', { score: 0.1 });
    const f1 = await p.evaluate(() => { const a = document.activeElement; return a.tagName + ' ' + ((a.closest('.sgc') || {}).id || ''); });
    await p.locator('#sgc-a-04 .pp').focus();
    await k.claude('a-04', { reps: 9 });
    const f2 = await p.evaluate(() => { const a = document.activeElement; return (a.dataset.pp || '') + ' ' + ((a.closest('.sgc') || {}).id || ''); });
    ok('[5] fix: the focus stays on the same card\'s section header and play button through a redraw', f1 === 'SUMMARY sgc-a-04' && f2 === 'pv-a-04 sgc-a-04', f1 + ' / ' + f2);
    ok('[5] fix: every play button and section header has a hook of its own', await p.evaluate(() => { const v = [].map.call(document.querySelectorAll('#out .pp'), (b) => b.dataset.pp).concat([].map.call(document.querySelectorAll('#out summary'), (s) => 'c' + (s.dataset.cutsum || '') + 'j' + (s.dataset.junksum || ''))); return v.every((x) => x && x !== 'cj') && new Set(v).size === v.length; }));
    // [2] a snapshot changes only the card it is about; one that changes nothing touches nothing
    await p.evaluate(() => { [].forEach.call(document.querySelectorAll('#out .sgc, #out .strip, #out .stage, #out h2, #out section'), (e) => { e.__m = 1; }); window.__muts = 0; new MutationObserver((m) => { window.__muts += m.length; }).observe(document.getElementById('out'), { childList: true, subtree: true, attributes: true, characterData: true }); });
    await k.claude('a-05', { reps: 4 });
    const one = await p.evaluate(() => ({ cards: [].filter.call(document.querySelectorAll('#out .sgc'), (e) => !e.__m).map((e) => e.id), strips: [].filter.call(document.querySelectorAll('#out .strip, #out .stage'), (e) => !e.__m).length, frame: [].filter.call(document.querySelectorAll('#out h2, #out section'), (e) => !e.__m).length, text: /about 4 reps/.test(document.getElementById('sgc-a-05').textContent) }));
    ok('[2] fix: a snapshot about one stretch rebuilds that card only, and keeps its strip and preview', one.cards.join() === 'sgc-a-05' && one.strips === 0 && one.frame === 0 && one.text, JSON.stringify(one));
    await p.evaluate(() => { window.__muts = 0; });
    await k.claude('a-05', {});
    await p.evaluate(() => { const S = window.__mock.store(); window.__mock.seed('items', 'seg.a-05', S['seg.a-05']); }); await k.wait(200);
    ok('[2] fix: a snapshot that changes nothing leaves the page untouched', (await p.evaluate(() => window.__muts)) === 0, String(await p.evaluate(() => window.__muts)));
    await p.evaluate(() => { window.__muts = 0; [].forEach.call(document.querySelectorAll('#out .sgc'), (e) => { e.__m = 1; }); });
    await p.locator('[data-sg="skip"][data-id="a-05"]').click(); await k.wait(250);
    const own1 = await p.evaluate(() => [].filter.call(document.querySelectorAll('#out .sgc'), (e) => !e.__m).map((e) => e.id).join());
    ok('[2] fix: the page\'s own save rebuilds only its card', own1 === 'sgc-a-05' && (await k.item('a-05')).skip === true, own1);
    // [9 small] the search text of one tab does not filter another
    await k.go('submit'); await p.fill('#f-q', 'zzzz'); await k.wait(300);
    await k.go('raw');
    ok('[small] a search typed on TO SUBMIT does not filter RAW FOOTAGE', (await p.inputValue('#f-q')) === '' && (await p.locator('#out .sgc').count()) >= 6, (await p.inputValue('#f-q')) + ' ' + (await p.locator('#out .sgc').count()));
    await p.fill('#f-q', 'img_0102'); await k.wait(300);
    await k.go('loops');
    const lq = await p.inputValue('#f-q');
    await k.go('submit');
    ok('[small] each tab keeps its own search text', lq === '' && (await p.inputValue('#f-q')) === 'zzzz', lq + ' / ' + (await p.inputValue('#f-q')));
    await p.fill('#f-q', ''); await k.go('raw'); await p.fill('#f-q', ''); await k.wait(300);
    // [15] a view that may not save goes read-only after the first refusal
    await p.evaluate(() => window.__mock.failNext(1, 'invalid_argument'));
    await p.locator('[data-sg="skip"][data-id="a-05"]').click(); await k.wait(300);
    ok('[15] fix: after the store refuses a write as view-only, the controls go and the state line says so', (await p.locator('#out form, #out button:not([data-pp]), #out input, #gen-go, #gen-all, #gen-acc, #gen-clear').count()) === 0 && /View only here\. This view cannot save changes\./.test(await k.tc('#state')) && (await p.locator('#out .sgc').count()) >= 6, (await k.tc('#state')) + ' ' + (await p.locator('#out form, #out button:not([data-pp]), #out input').count()));
    await p.close();
  }

  // ---------- page 2: the review flow with no time stamps from Claude, the double tap, loops that keep playing ----------
  {
    const p = await open('raw'), k = kit(p);
    const segs = { 'a-01': mk(A, 1, { guess: { name: 'Diamond Push-Ups', entryId: 'chest_diamond_push_ups_core', confidence: 0.82, view: 'side' } }), 'a-02': mk(A, 2, { guess: { name: 'Wide Push-Ups', entryId: 'chest_wide_push_ups_core', confidence: 0.8, view: 'side' } }) };
    const items = {};
    for (let i = 1; i <= 4; i++) { segs['b-0' + i] = mk(B, i, { state: 'review', loop: bid(i % 2 ? 'loopA' : 'loopB'), cost: 6 }); items['seg.b-0' + i] = own('b-0' + i, { name: 'Squat ' + i, queued: true }); }
    await k.seed('items', items); await k.seed('segs', segs);
    await p.waitForSelector('#sgc-a-01');
    // [0] the redo flow, Claude writing no updatedAt at all
    await p.locator('#gen-acc').click(); await k.wait(300);
    ok('[16] fix: Accept Claude\'s names names every sure guess with its catalog entry, and queues nothing', (await k.item('a-01')).name === 'Diamond Push-Ups' && (await k.item('a-01')).entryId === 'chest_diamond_push_ups_core' && (await k.item('a-02')).name === 'Wide Push-Ups' && (await k.item('a-01')).queued === false && (await k.tc('#gen-acc')) === 'Accept Claude\'s names (0)' && (await p.locator('#gen-acc').isVisible()) && (await p.locator('#gen-acc').isDisabled()) && (await k.tc('#gen-all')) === 'Queue all named (2)', (await k.tc('#gen-acc')) + ' / ' + (await k.tc('#gen-all')));
    await p.locator('#sg-q-a-01').click(); await k.wait();
    await p.locator('#gen-go').click(); await k.wait(250);
    await k.claude('a-01', { state: 'generating' });
    ok('[0] no time stamp: a stretch Claude took from the list is progress, not a change', /^Claude is making 1 now\.$/.test(await k.tc('#gen-msg')), await k.tc('#gen-msg'));
    await k.claude('a-01', { state: 'review', loop: bid('loopA'), cost: 6.2 });
    ok('[0] no time stamp: the finished loop waits in REVIEW and the sent list is not called out of date', (await k.tab('review')) === 'REVIEW 5' && !/You changed things/.test(await k.tc('#gen-msg')), (await k.tab('review')) + ' / ' + (await k.tc('#gen-msg')));
    await k.go('review');
    await p.locator('[data-rv="redo"][data-id="a-01"]').click(); await p.fill('#rv-note-a-01', 'knees cave in'); await p.press('#rv-note-a-01', 'Enter'); await k.wait(250);
    let d = await k.item('a-01');
    ok('[0] fix: a redo is stored with the loop it was asked about', d.verdict === 'redo' && d.forLoop === bid('loopA') && d.note === 'knees cave in' && (await k.tab('review')) === 'REVIEW 4', JSON.stringify(d));
    await k.go('raw');
    await p.locator('#gen-go').click(); await k.wait(250);
    ok('[0] the redo goes out with Generate', JSON.stringify(((await k.all())['control.queue'] || {}).ids) === '["a-01"]');
    await k.claude('a-01', { state: 'generating' });
    await k.claude('a-01', { state: 'review', loop: bid('loopB'), cost: 12.4 });
    ok('[0] fix: with no time stamp, a new loop id answers the redo: it waits for a verdict and is not sent again', (await k.tab('review')) === 'REVIEW 5' && /Ready to review/i.test(await k.tc('#sgc-a-01 .pill')) && (await k.tc('#gen-go')) === 'Generate 0 loops', (await k.tab('review')) + ' / ' + (await k.tc('#sgc-a-01 .pill')) + ' / ' + (await k.tc('#gen-go')));
    await k.go('review');
    ok('[0] fix: the answered redo is under WAITING FOR YOU with Approve', (await p.locator('.grid[data-k="g0"] #sgc-a-01 [data-rv="approved"]').count()) === 1);
    await p.locator('[data-rv="approved"][data-id="a-01"]').click(); await k.wait(250);
    d = await k.item('a-01');
    ok('[0] fix: approving it stores the verdict with the new loop', d.verdict === 'approved' && d.forLoop === bid('loopB'), JSON.stringify(d));
    // the same loop id coming back (nothing new) does not answer a redo
    await p.locator('[data-rv="redo"][data-id="b-01"]').click(); await p.press('#rv-note-b-01', 'Enter'); await k.wait(250);
    await k.claude('b-01', { state: 'review', cost: 6.1 });
    ok('[0] a redo is not answered by the same loop coming back', /Redo asked/i.test(await k.tc('#sgc-b-01 .pill')) && (await k.item('b-01')).verdict === 'redo');
    await k.go('raw'); await k.go('review');
    // [1] two taps at the same spot answer one loop
    const first = await p.evaluate(() => document.querySelector('.grid[data-k="g0"] .rvc').id.slice(4));
    await p.locator('[data-rv="approved"][data-id="' + first + '"]').scrollIntoViewIfNeeded(); await k.wait(300);
    const box = await p.locator('[data-rv="approved"][data-id="' + first + '"]').boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    const top0 = await p.evaluate(() => [].map.call(document.querySelectorAll('.grid[data-k="g0"] .rvc'), (c) => c.id + '@' + Math.round(c.getBoundingClientRect().top)).join());
    await p.mouse.click(x, y); await k.wait(120); await p.mouse.click(x, y); await k.wait(400);
    const verdicts = await p.evaluate(() => { const E = window.__mock.store(), o = {}; Object.keys(E).forEach((key) => { if (/^seg\.b-/.test(key) && E[key].verdict === 'approved') o[key.slice(4)] = 1; }); return Object.keys(o); });
    const top1 = await p.evaluate(() => [].map.call(document.querySelectorAll('.grid[data-k="g0"] .rvc'), (c) => c.id + '@' + Math.round(c.getBoundingClientRect().top)).join());
    ok('[1] fix: two taps on Approve at the same spot approve one loop, and no card moves', verdicts.join() === first && top0 === top1, verdicts.join() + ' | ' + top0 + ' | ' + top1);
    ok('[1] fix: the answered card stays in place with its new pill; the heading counts the ones truly waiting', /Approved/i.test(await k.tc('#sgc-' + first + ' .pill')) && /^WAITING FOR YOU · 2$/.test(await p.locator('#out h2.grp').first().textContent()) && (await p.locator('.grid[data-k="g0"] .rvc').count()) === 3 && (await k.tab('review')) === 'REVIEW 2', (await p.locator('#out h2.grp').allTextContents()).join('|') + ' / ' + (await k.tab('review')));
    await p.keyboard.press('Tab');
    const next = await p.evaluate(() => (document.activeElement.closest('.sgc') || {}).id || 'none');
    ok('[6] fix: after Approve, one Tab leads to the next loop still waiting, and it is on screen', next !== 'sgc-' + first && /^sgc-b-0\d$/.test(next) && await p.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }), next);
    // [7] loops keep playing through a snapshot and through an answer on their own card
    const pick = await p.evaluate(() => { const g = document.querySelector('.grid[data-k="g0"]'), c = [].filter.call(g.querySelectorAll('.rvc'), (e) => e.querySelector('[data-rv="approved"]'))[0]; c.scrollIntoView({ block: 'center' }); return c.id.slice(4); });
    await k.wait(1300);
    const v0 = await p.evaluate((id) => { const v = document.querySelector('#sgc-' + id + ' .stage.sq video'); v.__m = 1; window.__pauses = 0; v.addEventListener('pause', () => { window.__pauses++; }); return { playing: !v.paused, t: v.currentTime }; }, pick);
    await k.claude('a-02', { score: 0.3 });
    await k.claude(pick, { score: 0.4 });
    const v1 = await p.evaluate((id) => { const v = document.querySelector('#sgc-' + id + ' .stage.sq video'); return { same: v.__m === 1, playing: !v.paused, t: v.currentTime }; }, pick);
    ok('[7] fix: a snapshot leaves a playing loop alone (same element, still playing, not back at the start)', v0.playing && v1.same && v1.playing && v1.t > 0.05, JSON.stringify([v0, v1]));
    await p.locator('[data-rv="rejected"][data-id="' + pick + '"]').click(); await k.wait(500);
    const v2 = await p.evaluate((id) => { const v = document.querySelector('#sgc-' + id + ' .stage.sq video'); return { same: v.__m === 1, playing: !v.paused, t: v.currentTime, pill: document.querySelector('#sgc-' + id + ' .pill').textContent }; }, pick);
    ok('[7] fix: answering a loop keeps its video (same element, playing on)', v2.same && v2.playing && /Rejected/i.test(v2.pill), JSON.stringify(v2));
    // [9] saving stops while a redo note is open and focused
    const last = await p.evaluate(() => { const c = [].filter.call(document.querySelectorAll('#out .rvc'), (e) => e.querySelector('[data-rv="redo"]'))[0]; return c ? c.id.slice(4) : null; });
    await p.locator('[data-rv="redo"][data-id="' + last + '"]').click(); await p.keyboard.type('hold');
    await p.evaluate(() => window.__mock.kill()); await k.wait(250);
    ok('[9] fix: when saving stops, an open and focused form goes away at once', (await p.locator('#out form, #out [data-rv]').count()) === 0 && /Live saving stopped/.test(await k.tc('#state')), String(await p.locator('#out form, #out [data-rv]').count()));
    await p.close();
  }

  // ---------- page 3: boxes that do not change size when the pictures arrive, and the small things at 360 px ----------
  {
    const p = await ctx.newPage(); watch(p); await p.setViewportSize({ width: 390, height: 844 });
    // The pictures are held back, so the page is first laid out without them. Content-visibility is switched off to see the true layout, as on a browser without it.
    let hold = true; const waiting = [];
    await p.route('**/_blob/strip*', (route) => { if (hold) waiting.push(route); else route.continue(); });
    await p.goto(base + 'index.html#raw'); await p.waitForSelector('#tabs button');
    await p.addStyleTag({ content: '.vgrp{content-visibility:visible!important}' });
    const k = kit(p);
    await k.seed('segs', { 'a-01': mk(A, 1, { guess: { name: 'Diamond Push-Ups', entryId: null, confidence: 0.82, view: 'side' } }), 'a-02': mk(A, 2, {}), 'b-01': mk(B, 1, {}), 'b-02': mk(B, 2, { kind: 'junk', reps: null }) });
    await p.waitForSelector('#sgc-a-01'); await k.wait(400);
    const size = () => p.evaluate(() => ({ page: document.documentElement.scrollHeight, cards: [].map.call(document.querySelectorAll('#out .vgrp > .sgc'), (c) => Math.round(c.getBoundingClientRect().height * 10) / 10).join(), known: document.querySelectorAll('#out .strip.known').length, strip: Math.round(document.querySelector('#sgc-a-01 .strip').getBoundingClientRect().height), stage: Math.round(document.querySelector('#sgc-b-01 .stage.pvw').getBoundingClientRect().width) }));
    const s0 = await size();
    hold = false; waiting.forEach((r) => r.continue());
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((f) => setTimeout(f, 80)); } window.scrollTo(0, 0); });
    await p.waitForFunction(() => document.querySelectorAll('#out .vgrp > .sgc .strip.known').length >= 3, null, { timeout: 8000 }); await k.wait(300);
    const s1 = await size();
    ok('[18] fix: the cards and the page are the same height before and after the strips load', s0.known === 0 && s1.known >= 3 && s0.cards === s1.cards && s0.page === s1.page && s0.strip >= 60, JSON.stringify([s0, s1]));
    const fit = await p.evaluate(() => { const q = (sel) => { const e = document.querySelector(sel).getBoundingClientRect(); return [Math.round(e.width), Math.round(e.height)]; }; return { up: q('#sgc-a-01 .strip .fr'), upBox: q('#sgc-a-01 .strip'), wide: q('#sgc-b-01 .strip .fr'), wideBox: q('#sgc-b-01 .strip'), rows: getComputedStyle(document.querySelector('#sgc-b-01 .strip .b')).display, stUp: q('#sgc-a-01 .stage.pvw .fr'), stWide: q('#sgc-b-01 .stage.pvw .fr'), box: q('#sgc-a-01 .stage.pvw') }; });
    ok('[18] the pictures fit inside their fixed boxes: an upright strip in one row, a wide one in two, the preview frame at the footage\'s own shape', fit.up[1] <= fit.upBox[1] + 1 && fit.up[0] <= fit.upBox[0] + 1 && fit.wide[1] <= fit.wideBox[1] + 1 && fit.rows === 'block' && fit.stUp[0] < fit.stUp[1] && fit.stWide[0] > fit.stWide[1] && fit.stUp[1] <= fit.box[1] + 1 && fit.stWide[0] <= fit.box[0] + 1, JSON.stringify(fit));
    // small things at 360 px
    await p.setViewportSize({ width: 360, height: 800 }); await k.wait(200);
    const small = await p.evaluate(() => { const i = document.getElementById('f-q'), cs = getComputedStyle(i), c = document.createElement('canvas').getContext('2d'); c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; const intro = document.querySelector('header p'), lh = parseFloat(getComputedStyle(intro).lineHeight), lines = Math.round(intro.getBoundingClientRect().height / lh), now = intro.textContent; intro.textContent = 'Which exercises have a violet animated loop, which still need a video from you, the new exercises to approve and the squats to name. Nothing goes into the app until you say push.'; const was = Math.round(intro.getBoundingClientRect().height / lh); intro.textContent = now; return { was, need: Math.ceil(c.measureText(i.placeholder).width), room: Math.floor(i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)), lines, intro: now, scroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth }; });
    ok('[small] the "Search footage" hint fits its box at 360 px', small.need <= small.room && small.scroll, JSON.stringify({ need: small.need, room: small.room }));
    ok('[small] the intro mentions raw footage and takes no more lines than the old wording at 360 px', /raw footage/.test(small.intro) && small.lines <= small.was, small.lines + ' lines (was ' + small.was + '): ' + small.intro);
    await p.close();
  }
};
