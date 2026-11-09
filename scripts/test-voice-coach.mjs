// The spoken coach's engine rules (components/training-mode/voiceCoach.js) on
// a fake speechSynthesis, in node — no browser. Three engine models:
//   real          start 80 ms after speak(), end after the line's length
//   android-drop  like real, but a speak() within 150 ms of a cancel() is
//                 dropped with no events (Android Chrome + the phone's TTS)
//   dead          no events at all, ever
// Run: npm run test:voice   (also in check:all)
import assert from 'node:assert/strict';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowMs = () => performance.now();

function makeEngine(model, voiceList) {
  const log = { speaks: [], cancels: [], started: [], dropped: [] };
  let current = null, queue = [], timer = null, lastCancel = -Infinity;
  const voices = model === 'dead' ? [] : (voiceList || [{ name: 'English United Kingdom', lang: 'en-GB', default: true, localService: true, voiceURI: 'en-gb' }]);
  const fire = (u, type, extra) => { const fn = u['on' + type]; if (typeof fn === 'function') fn(Object.assign({ type, utterance: u }, extra || {})); };
  const startNext = () => {
    if (current || !queue.length) return;
    const u = (current = queue.shift());
    if (model === 'dead') return; // nothing ever happens
    const dur = Math.max(300, u.text.trim() ? u.text.split(/\s+/).length * 350 : 30) / (u.rate || 1);
    const startDelay = model === 'android-drop' ? 250 : 80;
    timer = setTimeout(() => {
      if (current !== u) return;
      log.started.push(u.text);
      fire(u, 'start');
      timer = setTimeout(() => {
        if (current !== u) return;
        current = null; timer = null;
        fire(u, 'end', { elapsedTime: dur / 1000 });
        startNext();
      }, dur);
    }, startDelay);
  };
  const synth = {
    speak(u) {
      log.speaks.push({ text: u.text, t: nowMs(), voice: u.voice ? u.voice.name : null, volume: u.volume, sinceCancel: nowMs() - lastCancel });
      if (model === 'android-drop' && nowMs() - lastCancel < 150) { log.dropped.push(u.text); return; }
      if (model !== 'dead' && u.voice && (synth.failVoice || (synth.failNames && synth.failNames.has(u.voice.name)))) { setTimeout(() => fire(u, 'error', { error: 'synthesis-failed' }), 20); return; }
      queue.push(u); startNext();
    },
    cancel() {
      lastCancel = nowMs();
      log.cancels.push({ t: lastCancel, wasSpeaking: !!current });
      const q = queue; queue = [];
      const u = current;
      if (u) { current = null; clearTimeout(timer); timer = null; if (model !== 'dead') fire(u, 'error', { error: 'canceled' }); }
      for (const x of q) fire(x, 'error', { error: 'canceled' });
      if (model === 'dead') current = null;
    },
    pause() {}, resume() {},
    getVoices() { return voices; },
    get speaking() { return model === 'dead' ? false : !!current; },
    get pending() { return queue.length > 0; },
    addEventListener() {}, removeEventListener() {},
    failVoice: false,
    log,
  };
  return synth;
}

class Utter {
  constructor(text = '') { this.text = String(text); this.voice = null; this.volume = 1; this.rate = 1; this.pitch = 1; this.lang = ''; }
}

let failures = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`ok   ${name}`); }
  catch (e) { failures++; results.push(`FAIL ${name}\n     ${e.message}`); }
}

// Fresh module state per engine: import the engine once per model via a query.
async function load(model, voiceList) {
  const synth = makeEngine(model, voiceList);
  globalThis.localStorage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
  globalThis.window = { speechSynthesis: synth };
  globalThis.SpeechSynthesisUtterance = Utter;
  const mod = await import(`../components/training-mode/voiceCoach.js?${model}-${Math.random()}`);
  return { synth, vc: mod };
}

// 1. A healthy engine: 3-2-1 spoken in order; cancelSpeech on an idle engine issues no cancel().
await test('real: count-in spoken in order, no cancel() on an idle engine', async () => {
  const { synth, vc } = await load('real');
  vc.cancelSpeech();
  assert.equal(synth.log.cancels.length, 0, 'idle cancelSpeech must not call synth.cancel()');
  await vc.primeSpeech();
  for (const n of ['3', '2', '1']) await vc.speakOrDelay(n, 200);
  assert.deepEqual(synth.log.started.filter((t) => t.trim()), ['3', '2', '1']);
  assert.equal(synth.log.cancels.length, 0);
});

// 2. Android: a cancel while a line plays, then the next line waits the gap and is heard.
await test('android-drop: a line after a cancel waits CANCEL_GAP_MS and is not dropped', async () => {
  const { synth, vc } = await load('android-drop');
  await vc.primeSpeech();
  const long = vc.speakAsync('this is a long motivational line that keeps going for a while');
  await sleep(400); // it is speaking
  vc.cancelSpeech();
  assert.equal(synth.log.cancels.length, 1, 'a busy engine is cancelled');
  for (const n of ['3', '2', '1']) await vc.speakOrDelay(n, 200);
  await long;
  const digits = synth.log.speaks.filter((s) => /^[123]$/.test(s.text));
  assert.equal(digits.length, 3);
  assert.ok(digits[0].sinceCancel >= vc.CANCEL_GAP_MS - 5, `first digit ${digits[0].sinceCancel.toFixed(0)} ms after cancel`);
  assert.deepEqual(synth.log.dropped, [], `dropped: ${synth.log.dropped}`);
  assert.deepEqual(synth.log.started.filter((t) => /^[123]$/.test(t)), ['3', '2', '1']);
});

// 3. Android: pre-empting (rush call over a quote) waits the gap too.
await test('android-drop: a pre-empting line is heard', async () => {
  const { synth, vc } = await load('android-drop');
  await vc.primeSpeech();
  vc.speakAsync('keep your hands up and breathe through the round', { priority: 1 });
  await sleep(500);
  await vc.speakAsync('rush mode go', { priority: 3, preempt: true });
  assert.ok(synth.log.started.includes('rush mode go'), `started: ${synth.log.started}`);
  assert.deepEqual(synth.log.dropped, []);
});

// 4. Dead engine: a session is not held for seconds per line.
await test('dead: silent mode after two no-start lines; the count-in costs little', async () => {
  const { synth, vc } = await load('dead');
  const t0 = nowMs();
  const prime = await vc.primeSpeech();
  const primeMs = nowMs() - t0;
  assert.ok(primeMs < 3600, `primeSpeech took ${primeMs.toFixed(0)} ms (voices wait 2.5 s + primer 0.6 s at most)`);
  const t1 = nowMs();
  for (const n of ['3', '2', '1', 'round 1. straight punches only.', 'go!']) await vc.speakOrDelay(n, 0);
  const total = nowMs() - t1;
  // two lines at the 1.5 s fallback, then silent mode at ~0.35 s a line
  assert.ok(total < 5200, `five lines took ${total.toFixed(0)} ms on a dead engine`);
  assert.equal(vc.getSpeechHealth().silent, true, 'silent mode on');
  assert.equal(synth.log.speaks.filter((s) => s.text.trim()).length, 5, 'lines are still issued in silent mode');
  assert.equal(prime.reason, 'no_events');
});

// 5. Silent mode ends on the first 'start' and the engine is trusted again.
await test('real after dead-like start: a start event clears silent mode', async () => {
  const { synth, vc } = await load('real');
  // Force silent mode by making the engine swallow two lines.
  const realSpeak = synth.speak.bind(synth);
  let swallow = 2;
  synth.speak = (u) => { if (swallow > 0) { swallow--; synth.log.speaks.push({ text: u.text, t: nowMs(), sinceCancel: Infinity }); return; } realSpeak(u); };
  await vc.speakAsync('one');
  await vc.speakAsync('two');
  assert.equal(vc.getSpeechHealth().silent, true);
  await vc.speakAsync('three');
  await sleep(600);
  assert.equal(vc.getSpeechHealth().silent, false, 'a started line leaves silent mode');
  assert.ok(synth.log.started.includes('three'));
});

// 6. A voice that fails before a word is said is retried with the device voice.
await test('real: synthesis-failed on the chosen voice retries with voice = null', async () => {
  const { synth, vc } = await load('real');
  synth.failVoice = true;
  await vc.speakAsync('jab cross');
  const tries = synth.log.speaks.filter((s) => s.text === 'jab cross');
  assert.equal(tries.length, 2, `tries: ${tries.length}`);
  assert.equal(tries[0].voice, 'English United Kingdom');
  assert.equal(tries[1].voice, null);
  assert.ok(synth.log.started.includes('jab cross'));
  assert.equal(vc.getSpeechHealth().errors, 1);
});

// 6b. A phone with many voices: the first English one fails (network voice, no data); the next is used and remembered.
await test('real: a failing first voice is skipped, the next one speaks, and it is remembered', async () => {
  const voices = [
    { name: 'English United Kingdom', lang: 'en-GB', localService: false, voiceURI: 'net-gb' },
    { name: 'English United States', lang: 'en-US', localService: true, voiceURI: 'loc-us' },
    { name: 'English India', lang: 'en-IN', localService: true, voiceURI: 'loc-in' },
  ];
  const { synth, vc } = await load('real', voices);
  // On-phone voices are preferred, so the local US voice is picked before the network UK one.
  await vc.speakAsync('jab cross');
  assert.equal(synth.log.speaks[0].voice, 'English United States', 'a voice stored on the phone comes first');
  // Now make that one fail too: the walk goes on to the next.
  synth.failNames = new Set(['English United States']);
  await vc.speakAsync('hook');
  const hook = synth.log.speaks.filter((s) => s.text === 'hook').map((s) => s.voice);
  assert.deepEqual(hook, ['English United States', 'English India'], `hook tried with ${hook}`);
  assert.ok(synth.log.started.includes('hook'));
  // The bad voice is not tried again.
  await vc.speakAsync('cross');
  assert.deepEqual(synth.log.speaks.filter((s) => s.text === 'cross').map((s) => s.voice), ['English India']);
});

// 6c. Every voice fails: the device default is tried last, and the test reports each attempt.
await test('real: speakTest reports every voice tried and ends on the device default', async () => {
  const voices = [
    { name: 'A', lang: 'en-GB', localService: true, voiceURI: 'a' },
    { name: 'B', lang: 'en-US', localService: true, voiceURI: 'b' },
  ];
  const { synth, vc } = await load('real', voices);
  synth.failVoice = true; // any named voice fails; no voice (the default) works
  const r = await vc.speakTest('voice check');
  assert.equal(r.started || r.ended, true, 'the default voice spoke');
  assert.deepEqual(r.tried.map((t) => t.voice), ['A', 'B', 'phone default']);
  assert.equal(r.voice, 'phone default');
});

// 7. A queued line is abandoned by cancelSpeech (ENG-07).
await test('real: cancelSpeech abandons a queued line', async () => {
  const { synth, vc } = await load('real');
  vc.speakAsync('a long quote about never slowing down in the final round of the night');
  await sleep(200);
  const queued = vc.speakAsync('rush held. plus 20 x p.', { priority: 1 });
  await sleep(100);
  vc.cancelSpeech();
  await queued;
  await sleep(600);
  assert.ok(!synth.log.speaks.some((s) => s.text.startsWith('rush held')), 'the queued line must not be spoken after a cancel');
});

// 8. Graceful stop lets the playing line finish.
await test('real: stopVoiceSession({ graceful: true }) lets the closing line finish', async () => {
  const { synth, vc } = await load('real');
  const closing = vc.speakAsync('session complete. good work.');
  await sleep(150);
  vc.stopVoiceSession({ graceful: true });
  await closing;
  assert.equal(synth.log.cancels.length, 0, 'no cancel');
  assert.ok(synth.log.started.includes('session complete. good work.'));
});

// 9. Empty text never reaches the engine; the primer is never counted as dropped.
await test('real: empty or undefined text is a no-op', async () => {
  const { synth, vc } = await load('real');
  await vc.speakAsync('');
  await vc.speakAsync(undefined);
  await vc.speakAsync('   ');
  assert.equal(synth.log.speaks.length, 0);
});

// 10. normalizeSpeech
await test('normalizeSpeech: brackets, slashes, seconds, hyphens, the multiplication sign', async () => {
  const { vc } = await load('real');
  assert.equal(vc.normalizeSpeech('Push-Ups (Flat/Incline) 3.5s'), 'push ups 3.5 seconds');
  assert.equal(vc.normalizeSpeech('Step In / Step Out'), 'step in or step out');
  assert.equal(vc.normalizeSpeech('Sprint 8 × 30s'), 'sprint 8 by 30 seconds');
  assert.equal(vc.normalizeSpeech(null), '');
});

console.log(results.join('\n'));
if (failures) { console.error(`\n${failures} voice coach test(s) failed`); process.exit(1); }
console.log(`\nvoice coach: ${results.length} tests passed`);
// The engine's keep-alive interval would hold node open.
process.exit(0);
