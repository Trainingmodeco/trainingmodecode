// The recorded coach voice (components/training-mode/data/voiceClips.js) and
// its wiring into the spoken coach (voiceCoach.js), in node — no browser.
// A fake fetch serves a tiny manifest and "clips" (JSON standing in for mp3
// bytes), and a fake AudioContext schedules sources on a real clock so order,
// gaps, cancellation and the start/end signals can be checked.
// Run: npm run test:clips   (also in check:all)
import assert from 'node:assert/strict';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowMs = () => performance.now();

// ── fixture: a bank the size of a few lines ──────────────────────────────
const MS = 300;
const PHRASES = ['jab', 'cross', 'body hook', 'round 3', 'high guard defense', 'hands glued to your temples', 'rush held', 'plus', '20', 'x p', 'voice check', 'three', 'two', 'one', 'go', '3', '2', '1'];
const manifest = (voice) => ({ voice, version: 1, clips: Object.fromEntries(PHRASES.map((p) => [p, { file: p.replace(/[^a-z0-9]+/g, '_') + '.mp3', ms: MS }])) });

// GET /voice/<voice>/manifest.json and /voice/<voice>/<file>. `serve` lists
// the voices that exist; anything else is a 404. A clip in `broken` fails.
function makeFetch(serve = ['female'], broken = new Set()) {
  const log = [];
  const fn = async (url) => {
    log.push(url);
    const m = String(url).match(/^\/voice\/([a-z]+)\/(.+)$/);
    if (!m || !serve.includes(m[1])) return { ok: false, status: 404, json: async () => { throw new Error('404'); }, arrayBuffer: async () => new ArrayBuffer(0) };
    const [, voice, file] = m;
    if (file === 'manifest.json') return { ok: true, status: 200, json: async () => manifest(voice) };
    const key = PHRASES.find((p) => manifest(voice).clips[p].file === file);
    if (!key || broken.has(key)) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ key, ms: MS })).buffer };
  };
  fn.log = log;
  return fn;
}

// A Web Audio context on the wall clock: start(when) fires onended at
// when + duration / playbackRate; stop() cancels it; decodeAudioData reads
// the fake clip bytes back into { duration, key }.
class FakeAudioContext {
  constructor() { this.t0 = nowMs(); this.state = 'running'; this.destination = { kind: 'destination' }; this.log = { started: [], stopped: [], ramps: 0 }; FakeAudioContext.last = this; }
  get currentTime() { return (nowMs() - this.t0) / 1000; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { const ctx = this; return { gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() { ctx.log.ramps += 1; } }, connect() {} }; }
  createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} }; }
  createBufferSource() {
    const ctx = this;
    const s = {
      buffer: null, playbackRate: { value: 1 }, onended: null, connect() {},
      start(when) {
        ctx.log.started.push({ key: s.buffer.key, at: when, rate: s.playbackRate.value });
        const delay = Math.max(0, when - ctx.currentTime) * 1000 + (s.buffer.duration / s.playbackRate.value) * 1000;
        s._t = setTimeout(() => { if (typeof s.onended === 'function') s.onended(); }, delay);
      },
      stop() { clearTimeout(s._t); ctx.log.stopped.push(s.buffer.key); },
    };
    return s;
  }
  decodeAudioData(ab) { const d = JSON.parse(new TextDecoder().decode(ab)); return Promise.resolve({ duration: d.ms / 1000, key: d.key }); }
}

// ── the fake speech engine (as in test-voice-coach.mjs, the 'real' model) ─
function makeEngine() {
  const log = { speaks: [], cancels: [], started: [] };
  let current = null, queue = [], timer = null;
  const voices = [{ name: 'English United Kingdom', lang: 'en-GB', default: true, localService: true, voiceURI: 'en-gb' }];
  const fire = (u, type, extra) => { const fn = u['on' + type]; if (typeof fn === 'function') fn(Object.assign({ type, utterance: u }, extra || {})); };
  const startNext = () => {
    if (current || !queue.length) return;
    const u = (current = queue.shift());
    const dur = Math.max(300, u.text.trim() ? u.text.split(/\s+/).length * 200 : 30) / (u.rate || 1);
    timer = setTimeout(() => {
      if (current !== u) return;
      log.started.push(u.text); fire(u, 'start');
      timer = setTimeout(() => { if (current !== u) return; current = null; timer = null; fire(u, 'end'); startNext(); }, dur);
    }, 80);
  };
  return {
    speak(u) { log.speaks.push({ text: u.text, t: nowMs() }); queue.push(u); startNext(); },
    cancel() { log.cancels.push(nowMs()); const q = queue; queue = []; const u = current; if (u) { current = null; clearTimeout(timer); timer = null; fire(u, 'error', { error: 'canceled' }); } for (const x of q) fire(x, 'error', { error: 'canceled' }); },
    pause() {}, resume() {},
    getVoices() { return voices; },
    get speaking() { return !!current; },
    get pending() { return queue.length > 0; },
    addEventListener() {}, removeEventListener() {},
    log,
  };
}
class Utter { constructor(text = '') { this.text = String(text); this.voice = null; this.volume = 1; this.rate = 1; this.pitch = 1; this.lang = ''; } }

let failures = 0;
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(`ok   ${name}`); }
  catch (e) { failures++; results.push(`FAIL ${name}\n     ${e.stack || e.message}`); }
}

globalThis.localStorage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
globalThis.SpeechSynthesisUtterance = Utter;
globalThis.window = { AudioContext: FakeAudioContext };

// The clips module and the audio engine are shared by every load below (same
// URL); the coach is re-imported per test for fresh lock / version state.
const clips = await import('../components/training-mode/data/voiceClips.js');
const phrases = await import('../components/training-mode/data/voicePhrases.js');
const audio = await import('../components/training-mode/data/audioEngine.js');
audio.getAudioContext(); // one fake context for the whole run (the engine caches it)
async function loadCoach({ synth = makeEngine(), fetchFn = makeFetch() } = {}) {
  globalThis.window = { AudioContext: FakeAudioContext, ...(synth ? { speechSynthesis: synth } : {}) };
  if (fetchFn) globalThis.fetch = fetchFn; else delete globalThis.fetch;
  for (const v of ['female', 'male']) clips.forgetVoiceBank(v);
  const vc = await import(`../components/training-mode/voiceCoach.js?${Math.random()}`);
  return { synth, vc, ctx: () => FakeAudioContext.last };
}
const ctxLog = () => FakeAudioContext.last.log;
const sinceStarted = (n) => ctxLog().started.slice(n);

// ── planClips ────────────────────────────────────────────────────────────
globalThis.fetch = makeFetch();
const bank = await clips.loadVoiceBank('female');

await test('loadVoiceBank: manifest parsed, cached, status ready', async () => {
  assert.ok(bank, 'bank loaded');
  assert.equal(bank.voice, 'female');
  assert.equal(bank.count, PHRASES.length);
  assert.equal(clips.bankStatus('female'), 'ready');
  assert.equal(clips.getLoadedBank('female'), bank);
  assert.equal(await clips.loadVoiceBank('female'), bank, 'cached: the same object');
  assert.equal(globalThis.fetch.log.filter((u) => u.endsWith('manifest.json')).length, 1, 'one manifest fetch');
});

await test('loadVoiceBank: 404, bad JSON and no fetch all give null / missing', async () => {
  assert.equal(clips.bankStatus('male'), 'none');
  assert.equal(await clips.loadVoiceBank('male'), null);
  assert.equal(clips.bankStatus('male'), 'missing');
  clips.forgetVoiceBank('male');
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } });
  assert.equal(await clips.loadVoiceBank('male'), null);
  assert.equal(clips.bankStatus('male'), 'missing');
  clips.forgetVoiceBank('male');
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  assert.equal(await clips.loadVoiceBank('male'), null);
  clips.forgetVoiceBank('male');
  const saved = globalThis.fetch; delete globalThis.fetch;
  assert.equal(await clips.loadVoiceBank('male'), null);
  assert.equal(clips.bankStatus('male'), 'missing');
  globalThis.fetch = saved;
  clips.forgetVoiceBank('male');
  globalThis.fetch = makeFetch();
});

await test('planClips: a combo is one clip per strike', async () => {
  const plan = clips.planClips(bank, 'Jab Cross Body Hook');
  assert.deepEqual(plan.map((p) => p.key), ['jab', 'cross', 'body hook']);
  assert.deepEqual(plan.map((p) => p.gap), [0, phrases.GAP_STRIKE, phrases.GAP_STRIKE]);
  assert.deepEqual(plan.map((p) => p.file), ['jab.mp3', 'cross.mp3', 'body_hook.mp3']);
});

await test('phrasesOf: a NUMBERS call is one combo with strike gaps', async () => {
  const ph = phrases.phrasesOf('one, two, three to the body, two');
  assert.deepEqual(ph.map((p) => p.text), ['one', 'two', 'three to the body', 'two']);
  assert.deepEqual(ph.map((p) => p.gap), [0, phrases.GAP_STRIKE, phrases.GAP_STRIKE, phrases.GAP_STRIKE]);
  // a number after a normal sentence still gets the sentence gap
  assert.deepEqual(phrases.phrasesOf('Round 3. one, two').map((p) => p.gap), [0, phrases.GAP_SENTENCE, phrases.GAP_STRIKE]);
});

await test('planClips: three sentences are three phrases with sentence gaps', async () => {
  const plan = clips.planClips(bank, 'Round 3. High guard defense. Hands glued to your temples.');
  assert.deepEqual(plan.map((p) => p.key), ['round 3', 'high guard defense', 'hands glued to your temples']);
  assert.deepEqual(plan.map((p) => p.gap), [0, phrases.GAP_SENTENCE, phrases.GAP_SENTENCE]);
});

await test('planClips: a phrase with a number falls back to its parts', async () => {
  const plan = clips.planClips(bank, 'Rush held. Plus 20 X P.');
  assert.deepEqual(plan.map((p) => p.key), ['rush held', 'plus', '20', 'x p']);
  assert.deepEqual(plan.map((p) => p.gap), [0, phrases.GAP_SENTENCE, phrases.GAP_STRIKE, phrases.GAP_STRIKE]);
});

await test('planClips: a sentence with no whole clip is said from the fewest pieces', async () => {
  const plan = clips.planClips(bank, 'Rush held plus 20 x p.');
  assert.deepEqual(plan.map((p) => p.key), ['rush held', 'plus', '20', 'x p']);
  assert.deepEqual(plan.map((p) => p.gap), [0, phrases.GAP_STRIKE, phrases.GAP_STRIKE, phrases.GAP_STRIKE]);
  assert.deepEqual(clips.piecesFor(bank, 'high guard defense jab'), ['high guard defense', 'jab']);
  assert.equal(clips.piecesFor(bank, 'jab and cross'), null);
});

await test('planClips: a line with a phrase the bank lacks is null', async () => {
  assert.equal(clips.planClips(bank, 'Keep your hands up and breathe'), null);
  assert.equal(clips.planClips(bank, 'Jab Cross. Plus 21 X P.'), null, 'a missing number part sinks the whole line');
  assert.equal(clips.planClips(bank, ''), null);
  assert.equal(clips.planClips(null, 'jab'), null);
});

// ── playPlan ─────────────────────────────────────────────────────────────
await test('playPlan: clips in order, gaps on the context clock, started then done', async () => {
  const plan = clips.planClips(bank, 'Jab Cross Body Hook');
  const n = ctxLog().started.length;
  let startedAt = 0;
  const t0 = nowMs();
  const h = clips.playPlan(plan, { bank, onStart: () => { startedAt = nowMs(); } });
  await h.done;
  const total = nowMs() - t0;
  const s = sinceStarted(n);
  assert.deepEqual(s.map((x) => x.key), ['jab', 'cross', 'body hook']);
  assert.ok(Math.abs((s[1].at - s[0].at) - (MS / 1000 + phrases.GAP_STRIKE)) < 0.002, `gap ${s[1].at - s[0].at}`);
  assert.ok(Math.abs((s[2].at - s[1].at) - (MS / 1000 + phrases.GAP_STRIKE)) < 0.002);
  assert.ok(h.started && startedAt > 0, 'onStart fired');
  assert.ok(startedAt - t0 < 200, `started ${(startedAt - t0).toFixed(0)} ms in`);
  const expect = 3 * MS + 2 * phrases.GAP_STRIKE * 1000;
  assert.ok(total >= expect - 20 && total < expect + 400, `done after ${total.toFixed(0)} ms (clips ${expect})`);
});

await test('playPlan: rate shortens the gaps and sets playbackRate', async () => {
  const plan = clips.planClips(bank, 'Jab Cross');
  const n = ctxLog().started.length;
  await clips.playPlan(plan, { bank, rate: 2 }).done;
  const s = sinceStarted(n);
  assert.equal(s[0].rate, 2);
  assert.ok(Math.abs((s[1].at - s[0].at) - (MS / 1000 + phrases.GAP_STRIKE) / 2) < 0.002, `gap ${s[1].at - s[0].at}`);
});

await test('playPlan: stop() cuts every scheduled clip with a ramp and resolves', async () => {
  const plan = clips.planClips(bank, 'Round 3. High guard defense. Hands glued to your temples.');
  const stoppedBefore = ctxLog().stopped.length;
  const ramps = ctxLog().ramps;
  const h = clips.playPlan(plan, { bank });
  await sleep(120);
  const t0 = nowMs();
  h.stop();
  await h.done;
  assert.ok(nowMs() - t0 < 50, 'done resolves at once on stop');
  assert.deepEqual(ctxLog().stopped.slice(stoppedBefore), ['round 3', 'high guard defense', 'hands glued to your temples']);
  assert.equal(ctxLog().ramps, ramps + 1, 'gain ramped down');
});

await test('playPlan: a clip that fails to load rejects before anything plays', async () => {
  clips.forgetVoiceBank('male');
  globalThis.fetch = makeFetch(['female', 'male'], new Set(['cross']));
  const male = await clips.loadVoiceBank('male');
  const plan = clips.planClips(male, 'Jab Cross');
  const n = ctxLog().started.length;
  await assert.rejects(clips.playPlan(plan, { bank: male }).done);
  assert.equal(ctxLog().started.length, n, 'nothing scheduled');
  // The good clip is cached; the failed one is forgotten so it is retried later.
  assert.ok(male.buffers.has('jab'));
  assert.ok(!male.buffers.has('cross'));
  globalThis.fetch = makeFetch();
});

await test('playPlan: a context that will not run never reports a start', async () => {
  const plan = clips.planClips(bank, 'Jab Cross');
  const ctx = FakeAudioContext.last;
  const n = ctxLog().started.length;
  // Frozen clock, as on a phone whose audio was taken by a call: the sources
  // are scheduled but the clock never reaches them.
  const frozenAt = ctx.currentTime;
  Object.defineProperty(ctx, 'currentTime', { configurable: true, get: () => frozenAt });
  let started = false;
  try {
    const h = clips.playPlan(plan, { bank, onStart: () => { started = true; } });
    await h.done;
    assert.equal(ctxLog().started.length - n, 2, 'scheduled');
    assert.equal(started, false, 'no start signal while the clock stood still');
    assert.equal(h.started, false);
  } finally {
    delete ctx.currentTime;
  }
  // resume() that never settles: the line is handed back for the engine fast.
  ctx.state = 'suspended';
  const realResume = ctx.resume;
  ctx.resume = () => new Promise(() => {});
  const t0 = nowMs();
  try {
    await assert.rejects(clips.playPlan(plan, { bank }).done, /context suspended/);
    assert.ok(nowMs() - t0 < 600, `gave up after ${(nowMs() - t0).toFixed(0)} ms`);
  } finally {
    ctx.resume = realResume; ctx.state = 'running';
  }
});

await test('playPlan: clips that are slow to arrive reject so the engine takes the line', async () => {
  clips.forgetVoiceBank('male');
  const base = makeFetch(['female', 'male']);
  globalThis.fetch = async (url) => { if (/\/male\/cross/.test(String(url))) await sleep(5000); return base(url); };
  globalThis.fetch.log = base.log;
  const male = await clips.loadVoiceBank('male');
  const plan = clips.planClips(male, 'Jab Cross');
  const t0 = nowMs();
  await assert.rejects(clips.playPlan(plan, { bank: male }).done, /clips slow/);
  const took = nowMs() - t0;
  assert.ok(took >= 700 && took < 1500, `rejected after ${took.toFixed(0)} ms`);
  globalThis.fetch = makeFetch();
  clips.forgetVoiceBank('male');
});

await test('planClips: a phrase named like an Object.prototype member is not a clip', async () => {
  assert.equal(clips.planClips(bank, 'constructor'), null);
  assert.equal(clips.planClips(bank, 'Jab. valueOf 3.'), null);
});

await test('prefetchBank: decodes every clip, never throws, safe to repeat', async () => {
  clips.forgetVoiceBank('male');
  globalThis.fetch = makeFetch(['female', 'male'], new Set(['x p']));
  const male = await clips.loadVoiceBank('male');
  await clips.prefetchBank(male, { concurrency: 4 });
  assert.equal(male.buffers.size, PHRASES.length - 1);
  await clips.prefetchBank(male);
  const fetched = globalThis.fetch.log.filter((u) => u.startsWith('/voice/male/') && !u.endsWith('manifest.json'));
  assert.equal(fetched.length, PHRASES.length + 1, 'only the failed clip is fetched again');
  globalThis.fetch = makeFetch();
  clips.forgetVoiceBank('male');
});

// ── the coach ────────────────────────────────────────────────────────────
await test('speakAsync: a line the bank holds plays from clips, a long line goes to the engine', async () => {
  const { synth, vc } = await loadCoach();
  vc.setVoiceGender('FEMALE');
  await vc.primeSpeech();
  assert.equal(vc.getSpeechHealth().clips.ready, true, 'primeSpeech waited for a quick manifest');
  assert.equal(vc.getSpeechHealth().clips.count, PHRASES.length);
  const n = ctxLog().started.length;
  await vc.speakAsync('Jab Cross Body Hook');
  assert.deepEqual(sinceStarted(n).map((x) => x.key), ['jab', 'cross', 'body hook']);
  assert.ok(!synth.log.speaks.some((s) => s.text === 'jab cross body hook'), 'the engine never saw the combo');
  let h = vc.getSpeechHealth();
  assert.equal(h.lastEngine, 'clips');
  assert.equal(h.clipsSpoken, 1);
  assert.equal(h.lastText, 'jab cross body hook');
  const spoken = h.spoken;
  await vc.speakAsync('Keep your hands up and breathe through the round');
  h = vc.getSpeechHealth();
  assert.equal(h.lastEngine, 'tts');
  assert.ok(synth.log.started.includes('keep your hands up and breathe through the round'));
  assert.equal(h.spoken, spoken + 1);
  assert.equal(synth.log.cancels.length, 0, 'no cancel() for clip lines');
});

await test('speakAsync: with no bank on this build every line goes to the engine', async () => {
  const { synth, vc } = await loadCoach({ fetchFn: makeFetch([]) });
  await vc.primeSpeech();
  await sleep(20);
  assert.equal(vc.getSpeechHealth().clips.ready, false);
  assert.equal(vc.getSpeechHealth().clips.status, 'missing');
  const n = ctxLog().started.length;
  await vc.speakAsync('Jab Cross Body Hook');
  assert.equal(ctxLog().started.length, n);
  assert.ok(synth.log.started.includes('jab cross body hook'));
  assert.equal(vc.getSpeechHealth().lastEngine, 'tts');
});

await test('speakAsync: a clip that will not load sends that line to the engine', async () => {
  const { synth, vc } = await loadCoach({ fetchFn: makeFetch(['female'], new Set(['cross'])) });
  await vc.primeSpeech();
  await clips.loadVoiceBank('female');
  const attempted = vc.getSpeechHealth().attempted; // the primer
  await vc.speakAsync('Jab Cross');
  assert.ok(synth.log.started.includes('jab cross'));
  assert.equal(vc.getSpeechHealth().lastEngine, 'tts');
  assert.equal(vc.getSpeechHealth().errors, 1);
  assert.equal(vc.getSpeechHealth().attempted, attempted + 1, 'counted once');
});

await test('no speechSynthesis at all: the coach still speaks from clips', async () => {
  const { vc } = await loadCoach({ synth: null });
  const prime = await vc.primeSpeech();
  assert.equal(prime.reason, 'no_synth');
  await clips.loadVoiceBank('female');
  assert.equal(vc.getSpeechHealth().supported, false);
  const n = ctxLog().started.length;
  const t0 = nowMs();
  await vc.speakOrDelay('Jab Cross', 0);
  assert.deepEqual(sinceStarted(n).map((x) => x.key), ['jab', 'cross']);
  assert.ok(nowMs() - t0 >= 2 * MS + phrases.GAP_STRIKE * 1000 - 20, 'waited for the clips');
  await vc.speakAsync('Round 3. High guard defense. Hands glued to your temples.');
  assert.equal(vc.getSpeechHealth().clipsSpoken, 2);
  // A line the bank lacks is a no-op here, as before.
  await vc.speakAsync('keep your hands up');
  assert.equal(vc.getSpeechHealth().lastEngine, 'clips');
});

await test('cancelSpeech and a pre-empt stop the playing clips', async () => {
  const { synth, vc } = await loadCoach();
  await vc.primeSpeech();
  await clips.loadVoiceBank('female');
  await sleep(400); // let the (silent) primer finish on the engine
  const stopped = ctxLog().stopped.length;
  const p = vc.speakAsync('Round 3. High guard defense. Hands glued to your temples.');
  await sleep(150);
  vc.cancelSpeech();
  const t0 = nowMs();
  await p;
  assert.ok(nowMs() - t0 < 50, 'the line resolves at once');
  assert.deepEqual(ctxLog().stopped.slice(stopped), ['round 3', 'high guard defense', 'hands glued to your temples']);
  assert.equal(synth.log.cancels.length, 0, 'nothing to cancel on the engine');
  // Pre-empt: a rush call over a clip line.
  const stopped2 = ctxLog().stopped.length;
  const q = vc.speakAsync('Round 3. High guard defense. Hands glued to your temples.', { priority: 1 });
  await sleep(150);
  const n = ctxLog().started.length;
  await vc.speakAsync('Rush held. Plus 20 X P.', { priority: 3, preempt: true });
  await q;
  assert.equal(ctxLog().stopped.length - stopped2, 3, 'the quote was cut');
  assert.deepEqual(sinceStarted(n).map((x) => x.key), ['rush held', 'plus', '20', 'x p']);
});

await test('a clip line that plays resets the no-start streak; silent mode is the engine’s alone', async () => {
  const { synth, vc } = await loadCoach();
  await vc.primeSpeech();
  await clips.loadVoiceBank('female');
  // Two swallowed engine lines: silent mode.
  const realSpeak = synth.speak.bind(synth);
  let swallow = 2;
  synth.speak = (u) => { if (swallow > 0) { swallow--; synth.log.speaks.push({ text: u.text }); return; } realSpeak(u); };
  await vc.speakAsync('keep your hands up and breathe');
  await vc.speakAsync('circle out and reset');
  assert.equal(vc.getSpeechHealth().silent, true);
  const dropped = vc.getSpeechHealth().dropped;
  await vc.speakAsync('Jab Cross');
  const h = vc.getSpeechHealth();
  assert.equal(h.dropped, dropped, 'a clip line is never a dropped line');
  assert.equal(h.silent, true, 'clips say nothing about the engine');
  await vc.speakAsync('three');
  // The engine is back: its own start clears silent mode.
  await vc.speakAsync('keep your hands up and breathe');
  assert.equal(vc.getSpeechHealth().silent, false);
});

await test('speakTest: reports engine clips when the test line is in the bank', async () => {
  const { synth, vc } = await loadCoach();
  // A cold open: setVoiceGender only starts the manifest fetch, and the test
  // follows at once. The bank is awaited, so the first test already uses it.
  vc.setVoiceGender('female');
  const r = await vc.speakTest('Voice check. Three. Two. One. Go!');
  assert.equal(r.engine, 'clips');
  assert.equal(r.started, true);
  assert.equal(r.ended, true);
  assert.equal(r.error, null);
  assert.ok(r.ms >= 5 * MS, `took ${r.ms} ms`);
  assert.equal(synth.log.speaks.length, 0, 'the engine was not asked');
  assert.ok(r.volume > 1, 'clips are not capped at 1.0 (VOICE defaults to 150%)');
  const t = await vc.speakTest('Say something the bank does not hold');
  assert.equal(t.engine, 'tts');
  assert.ok(t.started || t.ended);
});

console.log(results.join('\n'));
if (failures) { console.error(`\n${failures} voice clips test(s) failed`); process.exit(1); }
console.log(`\nvoice clips: ${results.length} tests passed`);
process.exit(0);
