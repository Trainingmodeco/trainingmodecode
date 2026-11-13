// The recorded coach voice (components/training-mode/data/voiceClips.js) and
// its wiring into the spoken coach (voiceCoach.js), in node — no browser.
// A fake fetch serves a tiny manifest and "clips" (JSON standing in for mp3
// bytes), and a fake AudioContext schedules sources on a real clock so order,
// gaps, cancellation and the start/end signals can be checked.
// Run: npm run test:clips   (also in check:all)
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  constructor() { this.t0 = nowMs(); this.state = 'running'; this.destination = { kind: 'destination' }; this.log = { started: [], stopped: [], ramps: 0, resumes: 0 }; this.listeners = {}; FakeAudioContext.last = this; }
  get currentTime() { return (nowMs() - this.t0) / 1000; }
  resume() { this.log.resumes += 1; this.state = 'running'; return Promise.resolve(); }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  fire(type) { for (const fn of this.listeners[type] || []) fn({ type }); }
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
// The page, for the audio recovery listeners (visibility, the next touch).
globalThis.document = {
  visibilityState: 'visible', listeners: {},
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
  fire(type) { for (const fn of this.listeners[type] || []) fn({ type }); },
};

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

await test('normalizeSpeech: a range says "to", a chain or punch call says the numbers', async () => {
  const n = phrases.normalizeSpeech;
  assert.equal(n('20-40s'), '20 to 40 seconds');
  assert.equal(n('6-12 reps'), '6 to 12 reps');
  assert.equal(n('hold 2-3 min'), 'hold 2 to 3 min');
  assert.equal(n('then 1-2'), 'then 1 2');
  assert.equal(n('5-10-5 pro agility'), '5 10 5 pro agility');
  assert.equal(n('Y-W-T'), 'y w t');
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

await test('prefetchBank: decodes the hot keys, only downloads the rest, safe to repeat', async () => {
  clips.forgetVoiceBank('male');
  globalThis.fetch = makeFetch(['female', 'male'], new Set(['x p']));
  const male = await clips.loadVoiceBank('male');
  await clips.prefetchBank(male, { concurrency: 4 });
  const hot = PHRASES.filter((p) => clips.HOT_KEYS.includes(p));
  assert.ok(hot.length > 0 && hot.length < PHRASES.length);
  assert.equal(male.buffers.size, hot.length, 'only the hot keys are unpacked');
  assert.equal(male.warmed.size, PHRASES.length - hot.length - 1, 'the rest is downloaded, and the failed clip is not marked');
  await clips.prefetchBank(male);
  const fetched = globalThis.fetch.log.filter((u) => u.startsWith('/voice/male/') && !u.endsWith('manifest.json'));
  assert.equal(fetched.length, PHRASES.length + 1, 'only the failed clip is fetched again');
  globalThis.fetch = makeFetch();
  clips.forgetVoiceBank('male');
});

await test('getBuffer: the hot keys and only the most recent clips stay unpacked', async () => {
  // A bank far bigger than the cap: the whole bank unpacked is over a
  // gigabyte on a phone, so what stays decoded must be bounded.
  const N = clips.MAX_DECODED + 60;
  const keys = Array.from({ length: N }, (_, i) => `line ${i}`);
  const big = { voice: 'female', base: '/voice/big/', buffers: new Map(), warmed: new Set(), clips: Object.fromEntries(keys.concat(['go', 'rest']).map((k) => [k, { file: k.replace(/ /g, '_') + '.mp3', ms: MS }])) };
  const saved = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ key: String(url), ms: MS })).buffer });
  await clips.getBuffer(big, 'go');
  await clips.getBuffer(big, 'rest');
  for (const k of keys.slice(0, 200)) await clips.getBuffer(big, k);
  await clips.getBuffer(big, 'line 0');                 // used again: now the youngest
  for (const k of keys.slice(200)) await clips.getBuffer(big, k);
  assert.equal(big.buffers.size, clips.MAX_DECODED + 2, 'the cap, plus the two hot keys');
  assert.ok(big.buffers.has('go') && big.buffers.has('rest'), 'hot keys are never dropped');
  assert.ok(big.buffers.has('line 0'), 'a clip used again is kept over older ones');
  assert.ok(!big.buffers.has('line 1'), 'the oldest unused clip was dropped');
  assert.ok(big.buffers.has(`line ${N - 1}`), 'the newest clip is kept');
  const again = await clips.getBuffer(big, 'line 1');     // a dropped clip decodes again on demand
  assert.ok(again && big.buffers.has('line 1'));
  globalThis.fetch = saved;
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


// ── numbers said from parts ──────────────────────────────────────────────
// A small bank: the composer needs only the part clips.
const numBank = { clips: Object.fromEntries(['100', '300', '1000', '2000', '5', '50', '120', 'seconds', 'rest', 'up next', 'goblet squats'].map((k) => [k, { file: k + '.mp3', ms: MS }])) };

await test('piecesFor: a number with no clip of its own is said from thousands, hundreds and the rest', async () => {
  assert.deepEqual(clips.piecesFor(numBank, '105 seconds'), ['100', '5', 'seconds']);
  assert.deepEqual(clips.piecesFor(numBank, '2350'), ['2000', '300', '50']);
  assert.deepEqual(clips.piecesFor(numBank, '1005'), ['1000', '5']);
  assert.deepEqual(clips.piecesFor(numBank, '1300'), ['1000', '300']);
  assert.deepEqual(clips.piecesFor(numBank, '120 seconds'), ['120', 'seconds'], 'a number with its own clip keeps it');
  assert.equal(clips.piecesFor(numBank, '700'), null, 'a missing part: no plan');
  assert.equal(clips.piecesFor(numBank, '05'), null, 'zero-padded is not a number to compose');
  assert.equal(clips.piecesFor(numBank, '10000'), null, 'over 9999 is not composed');
  assert.equal(clips.numberParts(numBank, '100'), null, '100 and below come from their own clips');
  const plan = clips.planClips(numBank, 'Rest. 105 seconds. Up next: Goblet Squats.');
  assert.deepEqual(plan.map((p) => p.key), ['rest', '100', '5', 'seconds', 'up next', 'goblet squats']);
});

// The clips the orchestrator records for this work (record list); counted
// as present so the check passes before and after they land in the banks.
const RECORDED = ['1000', '2000', '3000', '4000', '5000', '6000', '7000', '8000', '9000', '700', 'voice check'];
await test('real banks: every whole number 101..9999 is said from clips, given the recorded parts', async () => {
  for (const voice of ['female', 'male']) {
    const m = JSON.parse(fs.readFileSync(new URL(`../public/voice/${voice}/manifest.json`, import.meta.url), 'utf8'));
    const real = { clips: Object.assign(Object.create(null), m.clips) };
    // The part keys the composer needs that the bank lacks are exactly the
    // recorded number parts: the record list is the smallest that works.
    const need = new Set();
    for (let n = 101; n <= 9999; n++) {
      if (real.clips[String(n)]) continue;
      const parts = [];
      if (n >= 1000) parts.push(String(Math.floor(n / 1000) * 1000));
      if (n % 1000 >= 100) parts.push(String(Math.floor((n % 1000) / 100) * 100));
      if (n % 100) parts.push(String(n % 100));
      for (const k of parts) if (!real.clips[k]) need.add(k);
    }
    assert.deepEqual([...need].sort(), RECORDED.filter((k) => /^\d+$/.test(k)).filter((k) => !real.clips[k]).sort(), `${voice}: number parts to record`);
    for (const k of RECORDED) if (!real.clips[k]) real.clips[k] = { file: k + '.mp3', ms: MS };
    const lost = [];
    for (let n = 101; n <= 9999; n++) if (!clips.planClips(real, `Rest. ${n} seconds.`)) lost.push(n);
    assert.deepEqual(lost.slice(0, 10), [], `${voice}: ${lost.length} numbers have no plan`);
    assert.ok(clips.planClips(real, 'Rest. 105 seconds. Up next: Goblet Squats.'), `${voice}: the Up next line`);
    assert.deepEqual(clips.planClips(real, 'Voice check. Three. Two. One. Go!').map((p) => p.key), ['voice check', 'three', 'two', 'one', 'go'], `${voice}: the VOICE CHECK line`);
  }
});

// ── a phrase with no clip, the miss log ──────────────────────────────────
const missesNow = () => JSON.parse(globalThis.localStorage.getItem('tm_voice_misses') || '[]');

await test('planLine: the phrases with clips, and the ones without', async () => {
  const r = clips.planLine(bank, 'Keep your hands up. Jab Cross. Breathe.');
  assert.deepEqual(r.plan.map((p) => p.key), ['jab', 'cross']);
  assert.deepEqual(r.plan.map((p) => p.gap), [0, phrases.GAP_STRIKE], 'the first phrase that plays starts at once');
  assert.deepEqual(r.missing, ['keep your hands up', 'breathe']);
  assert.equal(clips.planClips(bank, 'Keep your hands up. Jab Cross. Breathe.'), null, 'no full plan: the engine gets it while it works');
});

await test('no speech engine: the phrases that have clips play, the line is kept as partial', async () => {
  const { vc } = await loadCoach({ synth: null });
  await vc.primeSpeech();
  await clips.loadVoiceBank('female');
  vc.clearVoiceMisses();
  const unheard = vc.getSpeechHealth().unheard;
  const n = ctxLog().started.length;
  await vc.speakAsync('Round 3. Keep your hands up. Jab Cross.');
  assert.deepEqual(sinceStarted(n).map((x) => x.key), ['round 3', 'jab', 'cross']);
  const h = vc.getSpeechHealth();
  assert.equal(h.unheard, unheard + 1, 'a line said in part counts as lost');
  assert.equal(h.misses.count, 1);
  assert.deepEqual(h.misses.list.map((m) => [m.line, m.reason]), [['round 3. keep your hands up. jab cross.', 'partial']]);
  assert.deepEqual(missesNow().map((m) => m.reason), ['partial'], 'kept on the device');
  // Nothing in the line has a clip: nothing plays, and it is kept as no-clip.
  await vc.speakAsync('Keep your hands up');
  assert.deepEqual(vc.getSpeechHealth().misses.list.map((m) => m.reason), ['no-clip', 'partial']);
  vc.clearVoiceMisses();
  assert.deepEqual(vc.getSpeechHealth().misses, { count: 0, list: [] });
  assert.equal(globalThis.localStorage.getItem('tm_voice_misses'), null);
});

await test('silent engine: a line with a missing phrase plays its clips and is not sent to the engine', async () => {
  const { synth, vc } = await loadCoach();
  await vc.primeSpeech();
  await clips.loadVoiceBank('female');
  const realSpeak = synth.speak.bind(synth);
  let swallow = 2;
  synth.speak = (u) => { if (swallow > 0) { swallow--; synth.log.speaks.push({ text: u.text }); return; } realSpeak(u); };
  await vc.speakAsync('keep your hands up and breathe');
  await vc.speakAsync('circle out and reset');
  assert.equal(vc.getSpeechHealth().silent, true);
  vc.clearVoiceMisses();
  const speaks = synth.log.speaks.length;
  const n = ctxLog().started.length;
  await vc.speakAsync('Jab Cross. Keep your hands up.');
  assert.deepEqual(sinceStarted(n).map((x) => x.key), ['jab', 'cross']);
  assert.equal(synth.log.speaks.length, speaks, 'the engine was not given the line');
  assert.equal(vc.getSpeechHealth().misses.list[0].reason, 'partial');
});

await test('miss log: a working engine says the whole line (no-clip); a failed clip is late; distinct and capped', async () => {
  const { synth, vc } = await loadCoach({ fetchFn: makeFetch(['female'], new Set(['cross'])) });
  await vc.primeSpeech();
  await clips.loadVoiceBank('female');
  vc.clearVoiceMisses();
  const unheard = vc.getSpeechHealth().unheard;
  await vc.speakAsync('Jab. Keep your hands up.');
  assert.ok(synth.log.started.includes('jab. keep your hands up.'), 'the engine got the whole line');
  await vc.speakAsync('Jab Cross');
  assert.ok(synth.log.started.includes('jab cross'));
  let h = vc.getSpeechHealth();
  assert.deepEqual(h.misses.list.map((m) => [m.line, m.reason]), [['jab cross', 'late'], ['jab. keep your hands up.', 'no-clip']]);
  assert.equal(h.unheard, unheard, 'the engine said both: nothing was lost');
  await vc.speakAsync('Jab. Keep your hands up.');
  h = vc.getSpeechHealth();
  assert.equal(h.misses.count, 3, 'every line is counted');
  assert.equal(h.misses.list.length, 2, 'the list keeps distinct lines');
  assert.equal(h.misses.list[0].line, 'jab. keep your hands up.', 'a line seen again moves to the front');
  const m = await import('../components/training-mode/data/voiceMisses.js');
  for (let i = 0; i < 40; i++) m.noteVoiceMiss(`line ${i}`, 'no-clip');
  assert.equal(missesNow().length, m.MAX_MISSES);
  assert.equal(missesNow()[0].line, 'line 39');
  assert.ok(missesNow().every((x) => typeof x.at === 'number' && x.at > 0));
  m.noteVoiceMiss('anything', 'made-up reason');
  assert.equal(missesNow()[0].line, 'line 39', 'only the four reasons are kept');
  vc.clearVoiceMisses();
});

await test('miss log: a queued line replaced by a newer one is kept as dropped', async () => {
  const { vc } = await loadCoach();
  await vc.primeSpeech();
  await clips.loadVoiceBank('female');
  await sleep(400);
  vc.clearVoiceMisses();
  const n = ctxLog().started.length;
  const a = vc.speakAsync('Round 3. High guard defense. Hands glued to your temples.');
  await sleep(50);
  const b = vc.speakAsync('Jab Cross');
  const c = vc.speakAsync('Rush held. Plus 20 X P.');
  await Promise.all([a, b, c]);
  const keys = sinceStarted(n).map((x) => x.key);
  assert.ok(keys.includes('rush held') && !keys.includes('jab'), `played: ${keys}`);
  assert.deepEqual(vc.getSpeechHealth().misses.list.map((m) => [m.line, m.reason]), [['jab cross', 'dropped']]);
  vc.clearVoiceMisses();
});

await test('speakTest: clips whose sound never started are not a pass; a line with no clip says so', async () => {
  const { vc } = await loadCoach();
  vc.setVoiceGender('female');
  await clips.loadVoiceBank('female');
  const ctx = FakeAudioContext.last;
  const frozenAt = ctx.currentTime;
  Object.defineProperty(ctx, 'currentTime', { configurable: true, get: () => frozenAt });
  let r;
  try { r = await vc.speakTest('Voice check. Three. Two. One. Go!'); } finally { delete ctx.currentTime; }
  assert.equal(r.engine, 'clips');
  assert.equal(r.started, false);
  assert.equal(r.ended, false, 'not reported as spoken');
  assert.equal(r.error, 'no_sound');
  assert.equal(r.clipLine, true);
  const t = await vc.speakTest('Say something the bank does not hold');
  assert.equal(t.engine, 'tts');
  assert.equal(t.clipLine, false);
  assert.equal(t.clipError, 'no clip for this line');
});

await test('mixer warning: lines lost after clips have played still count as unheard', async () => {
  const { synth, vc } = await loadCoach();
  await vc.primeSpeech();
  await clips.loadVoiceBank('female');
  await vc.speakAsync('Jab Cross');
  assert.ok(vc.getSpeechHealth().clipsSpoken > 0);
  const unheard = vc.getSpeechHealth().unheard;
  synth.speak = (u) => { synth.log.speaks.push({ text: u.text }); };   // the engine goes quiet
  await vc.speakAsync('keep your hands up and breathe');
  await vc.speakAsync('circle out and reset');
  await vc.speakAsync('stay light on your feet');
  assert.equal(vc.getSpeechHealth().unheard, unheard + 3, 'each engine line that never started is lost');
  vc.clearVoiceMisses();
});

// ── audio recovery after a call, Siri or a Bluetooth switch ──────────────
await test('audio recovery: an interrupted context resumes on statechange, on return to the page, and on the next touch', async () => {
  const ctx = audio.getAudioContext();
  assert.equal(ctx, FakeAudioContext.last);
  let resumes = ctx.log.resumes;
  ctx.state = 'interrupted'; ctx.fire('statechange');
  assert.equal(ctx.log.resumes, resumes + 1, 'statechange while visible');
  assert.equal(ctx.state, 'running');
  // Hidden page: wait for it to come back, then resume.
  globalThis.document.visibilityState = 'hidden';
  ctx.state = 'interrupted'; ctx.fire('statechange');
  resumes = ctx.log.resumes;
  assert.equal(ctx.state, 'interrupted', 'not while the page is hidden');
  globalThis.document.visibilityState = 'visible';
  globalThis.document.fire('visibilitychange');
  assert.equal(ctx.log.resumes, resumes + 1, 'back on screen');
  // The next touch anywhere.
  ctx.state = 'suspended';
  resumes = ctx.log.resumes;
  globalThis.document.fire('pointerdown');
  assert.equal(ctx.log.resumes, resumes + 1, 'the next touch');
  globalThis.document.fire('pointerdown');
  assert.equal(ctx.log.resumes, resumes + 1, 'a running context is left alone');
  // A bell on an interrupted context wakes it (it used to check only 'suspended').
  ctx.state = 'interrupted';
  resumes = ctx.log.resumes;
  try { audio.playBell(1); } catch { /* the fake has no bell file */ }
  assert.equal(ctx.log.resumes, resumes + 1, 'the bell resumed it');
  ctx.state = 'running';
});

// ── takes recorded inside a sentence: the planning rules ─────────────────
// A small bank with every kind of key: plain 'pace', mid 'pace,', closing
// '50 seconds per mile.', sentence 'drive the arms, the legs will follow'.
const takeBank = (keys) => ({ clips: Object.assign(Object.create(null), Object.fromEntries(keys.map((k, i) => [k, { file: phrases.clipFileFor(k), ms: 100 + i }]))) });
const keysOf = (bank, line) => clips.planClips(bank, line)?.map((p) => p.key) ?? null;
const gapsOf = (bank, line) => clips.planClips(bank, line)?.map((p) => p.gap) ?? null;
const { GAP_SENTENCE, GAP_STRIKE, GAP_COMMA, GAP_COLON } = phrases;

await test('take keys: names, kinds and file names', async () => {
  assert.equal(phrases.midKey('20 minutes'), '20 minutes,');
  assert.equal(phrases.closingKey('32 seconds'), '32 seconds.');
  assert.equal(phrases.sentenceKey(['drive the arms', 'the legs will follow']), 'drive the arms, the legs will follow');
  assert.equal(phrases.sentenceKey(phrases.phrasesOf('Drive the arms, the legs will follow.')), 'drive the arms, the legs will follow');
  assert.deepEqual(['pace', 'pace,', '50 seconds per mile.', 'a, b', '3.5 seconds'].map(phrases.keyKind), ['plain', 'mid', 'closing', 'sentence', 'plain']);
  assert.equal(phrases.clipFileFor('pace'), 'pace.mp3');
  assert.equal(phrases.clipFileFor('20 minutes,'), '20_minutes__mid.mp3');
  assert.equal(phrases.clipFileFor('32 seconds.'), '32_seconds__end.mp3');
  assert.equal(phrases.clipFileFor('drive the arms, the legs will follow'), 'drive_the_arms_the_legs_will_follow__s.mp3');
  assert.equal(clips.clipFileFor, phrases.clipFileFor, 'the clips module lends the same helper');
});

await test('phrasesOf: each phrase knows its sentence, its place and the mark after it', async () => {
  const ph = phrases.phrasesOf('Pace: 9 minutes, 50 seconds per mile. Ahead; now — go');
  assert.deepEqual(ph.map((p) => [p.text, p.sentence, p.phrase, p.phrases, p.last, p.sep]), [
    ['pace', 0, 0, 3, false, ':'], ['9 minutes', 0, 1, 3, false, ','], ['50 seconds per mile', 0, 2, 3, true, ''],
    ['ahead', 1, 0, 2, false, ';'], ['now', 1, 1, 2, true, ''], ['go', 2, 0, 1, true, ''],
  ]);
  assert.deepEqual(ph.map((p) => p.gap), [0, GAP_SENTENCE, GAP_SENTENCE, GAP_SENTENCE, GAP_SENTENCE, GAP_SENTENCE], 'the gaps are as they always were');
  assert.deepEqual(phrases.phrasesOf('3.5 seconds, rest').map((p) => [p.text, p.sep]), [['3.5 seconds', ','], ['rest', '']], 'a decimal point is not a sentence end');
  assert.deepEqual(phrases.phrasesOf('Rest,').map((p) => [p.text, p.last]), [['rest', true]], 'the end of the line ends the sentence');
  assert.deepEqual(phrases.phrasesOf('Throw it: jab cross').map((p) => p.kind), ['text', 'strike', 'strike']);
  assert.deepEqual(phrases.phrasesOf('Round 3. one, two').map((p) => p.kind), ['text', 'call', 'call'], 'the first call of a NUMBERS run is a call too');
  assert.deepEqual(phrases.sentencesOf('Pace: 9 minutes. Go').map((s) => s.map((p) => p.text)), [['pace', '9 minutes'], ['go']]);
});

await test('planLine: a sentence take beats the phrase takes', async () => {
  const b = takeBank(['drive the arms, the legs will follow', 'drive the arms,', 'the legs will follow.', 'drive the arms', 'the legs will follow', 'go']);
  assert.deepEqual(keysOf(b, 'Drive the arms, the legs will follow. Go!'), ['drive the arms, the legs will follow', 'go']);
  assert.deepEqual(gapsOf(b, 'Drive the arms, the legs will follow. Go!'), [0, GAP_SENTENCE]);
  assert.deepEqual(keysOf(b, 'Go! Drive the arms, the legs will follow.'), ['go', 'drive the arms, the legs will follow']);
  assert.deepEqual(gapsOf(b, 'Go! Drive the arms, the legs will follow.'), [0, GAP_SENTENCE]);
  assert.equal(clips.planDetail(b, 'Drive the arms, the legs will follow.').parts[0].how, 'sentence');
  // A sentence take is a sentence of two or more phrases: 'go' alone is its plain clip.
  const one = takeBank(['go', 'go.']);
  assert.deepEqual(keysOf(one, 'Go.'), ['go']);
});

await test('planLine: inside a sentence the mid take, at its end the closing take, with comma and colon gaps', async () => {
  const b = takeBank(['pace,', 'pace', '9 minutes,', '9 minutes', '50 seconds per mile.', '50 seconds per mile', 'ahead,', 'now.']);
  assert.deepEqual(keysOf(b, 'Pace: 9 minutes, 50 seconds per mile.'), ['pace,', '9 minutes,', '50 seconds per mile.']);
  assert.deepEqual(gapsOf(b, 'Pace: 9 minutes, 50 seconds per mile.'), [0, GAP_COLON, GAP_COMMA]);
  assert.deepEqual(gapsOf(b, 'Ahead; now.'), [0, GAP_COMMA], 'a semicolon takes the comma gap');
  // Between sentences: the sentence gap, whatever came before.
  assert.deepEqual(gapsOf(b, 'Ahead, now. Pace: 9 minutes, 50 seconds per mile.'), [0, GAP_COMMA, GAP_SENTENCE, GAP_COLON, GAP_COMMA]);
  const d = clips.planDetail(b, 'Pace: 9 minutes, 50 seconds per mile.');
  assert.deepEqual(d.parts.map((p) => p.how), ['mid', 'mid', 'closing']);
});

await test('planLine: a phrase inside a sentence falls back to its plain clip, its pieces, then its closing take', async () => {
  // no 'pace,': the plain clip, and the next phrase keeps the sentence gap
  let b = takeBank(['pace', '9 minutes.']);
  assert.deepEqual(keysOf(b, 'Pace: 9 minutes.'), ['pace', '9 minutes.']);
  assert.deepEqual(gapsOf(b, 'Pace: 9 minutes.'), [0, GAP_SENTENCE]);
  // no whole clip: the fewest pieces, strike gaps between them
  b = takeBank(['average', 'pace', '9 minutes.']);
  assert.deepEqual(keysOf(b, 'Average pace: 9 minutes.'), ['average', 'pace', '9 minutes.']);
  assert.deepEqual(gapsOf(b, 'Average pace: 9 minutes.'), [0, GAP_STRIKE, GAP_SENTENCE]);
  // nothing but a closing take of it
  b = takeBank(['pace.', '9 minutes.']);
  assert.deepEqual(keysOf(b, 'Pace: 9 minutes.'), ['pace.', '9 minutes.']);
  assert.deepEqual(gapsOf(b, 'Pace: 9 minutes.'), [0, GAP_SENTENCE], 'a closing take is not a mid take: the usual gap');
});

await test('planLine: the last phrase falls back to its plain clip, its pieces, then its mid take', async () => {
  let b = takeBank(['pace,', '9 minutes', '9 minutes,']);
  assert.deepEqual(keysOf(b, 'Pace: 9 minutes.'), ['pace,', '9 minutes']);
  assert.deepEqual(gapsOf(b, 'Pace: 9 minutes.'), [0, GAP_COLON]);
  b = takeBank(['pace,', '9', 'minutes']);
  assert.deepEqual(keysOf(b, 'Pace: 9 minutes.'), ['pace,', '9', 'minutes']);
  assert.deepEqual(gapsOf(b, 'Pace: 9 minutes.'), [0, GAP_COLON, GAP_STRIKE]);
  b = takeBank(['pace,', '9 minutes,', 'go']);
  assert.deepEqual(keysOf(b, 'Pace: 9 minutes. Go.'), ['pace,', '9 minutes,', 'go']);
  assert.deepEqual(gapsOf(b, 'Pace: 9 minutes. Go.'), [0, GAP_COLON, GAP_SENTENCE], 'a new sentence after a mid take: the sentence gap');
});

await test('planLine: a sentence of one phrase is its plain clip, else its closing take, else its pieces, never a mid take', async () => {
  assert.deepEqual(keysOf(takeBank(['29 minutes', '29 minutes.']), '29 minutes.'), ['29 minutes']);
  assert.deepEqual(keysOf(takeBank(['29 minutes.', '29', 'minutes']), '29 minutes.'), ['29 minutes.']);
  assert.deepEqual(keysOf(takeBank(['29', 'minutes', '29 minutes,']), '29 minutes.'), ['29', 'minutes']);
  assert.equal(keysOf(takeBank(['29 minutes,']), '29 minutes.'), null);
});

await test('planLine: combos and NUMBERS calls are planned as always', async () => {
  const b = takeBank(['jab', 'cross', 'body hook', 'jab,', 'jab.', 'cross.', 'throw it,', 'one', 'two', 'three', 'one,', 'two,', 'three.', 'one, two, three']);
  assert.deepEqual(keysOf(b, 'Jab Cross Body Hook'), ['jab', 'cross', 'body hook']);
  assert.deepEqual(gapsOf(b, 'Jab Cross Body Hook'), [0, GAP_STRIKE, GAP_STRIKE]);
  assert.deepEqual(keysOf(b, 'one, two, three'), ['one', 'two', 'three'], 'no takes, no sentence take for a punch call');
  assert.deepEqual(gapsOf(b, 'one, two, three'), [0, GAP_STRIKE, GAP_STRIKE]);
  // A combo after a lead-in said from its mid take keeps its own gap.
  assert.deepEqual(keysOf(b, 'Throw it: jab cross.'), ['throw it,', 'jab', 'cross']);
  assert.deepEqual(gapsOf(b, 'Throw it: jab cross.'), [0, GAP_SENTENCE, GAP_STRIKE]);
});

await test('planLine: a partial plan lists the phrases it cannot say; planMs counts the new gaps', async () => {
  const b = takeBank(['pace,', '50 seconds per mile.', 'go']);
  const r = clips.planLine(b, 'Pace: 9 minutes, 50 seconds per mile. Go.');
  assert.deepEqual(r.missing, ['9 minutes']);
  assert.deepEqual(r.plan.map((p) => [p.key, p.gap]), [['pace,', 0], ['50 seconds per mile.', GAP_SENTENCE], ['go', GAP_SENTENCE]], 'after a skipped phrase, the usual gap');
  assert.equal(clips.planClips(b, 'Pace: 9 minutes, 50 seconds per mile. Go.'), null);
  assert.deepEqual(Object.keys(r.plan[0]).sort(), ['file', 'gap', 'key', 'ms'], 'plan entries keep their shape');
  const r2 = clips.planLine(b, 'Nothing here: 9 minutes, 50 seconds per mile.');
  assert.deepEqual(r2.plan.map((p) => [p.key, p.gap]), [['50 seconds per mile.', 0]], 'the first clip that plays starts at once');
  const full = takeBank(['pace,', '9 minutes,', '50 seconds per mile.']);
  const plan = clips.planClips(full, 'Pace: 9 minutes, 50 seconds per mile.');
  assert.equal(clips.planMs(plan), Math.round(plan[0].ms + plan[1].ms + plan[2].ms + (GAP_COLON + GAP_COMMA) * 1000));
  assert.equal(clips.planMs(plan, 2), Math.round((plan[0].ms + plan[1].ms + plan[2].ms + (GAP_COLON + GAP_COMMA) * 1000) / 2));
});

await test('takes with marks in their keys are fetched, decoded and kept like any clip', async () => {
  const keys = ['go', 'pace,', '9 minutes,', '50 seconds per mile.', 'drive the arms, the legs will follow'];
  const b = { voice: 'female', base: '/voice/takes/', buffers: new Map(), warmed: new Set(), clips: Object.fromEntries(keys.map((k) => [k, { file: phrases.clipFileFor(k), ms: MS }])) };
  const saved = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url) => { asked.push(String(url)); return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ key: String(url), ms: MS })).buffer }; };
  try {
    await clips.prefetchBank(b, { concurrency: 2 });
    assert.ok(b.buffers.has('go'), 'the hot key is decoded');
    assert.deepEqual([...b.warmed].sort(), keys.filter((k) => k !== 'go').sort(), 'every take is downloaded');
    assert.ok(asked.includes('/voice/takes/9_minutes__mid.mp3') && asked.includes('/voice/takes/50_seconds_per_mile__end.mp3') && asked.includes('/voice/takes/drive_the_arms_the_legs_will_follow__s.mp3'), asked.join(' '));
    const buf = await clips.getBuffer(b, 'pace,');
    assert.equal(buf.key, '/voice/takes/pace__mid.mp3');
    assert.ok(b.buffers.has('pace,'));
    const n = ctxLog().started.length;
    await clips.playPlan(clips.planClips(b, 'Pace: 9 minutes, 50 seconds per mile.'), { bank: b }).done;
    assert.equal(ctxLog().started.length - n, 3);
  } finally { globalThis.fetch = saved; }
});

// ── the real banks plan every line exactly as before ─────────────────────
// A frozen copy of the planner as it was before takes existed (phrases split
// at every . ! ? ; : , and dash, each phrase whole else from the fewest
// pieces, gaps 0.28 between phrases and 0.03 between strikes and pieces).
// With today's banks, which hold only plain clips, the planner must give the
// same clips, gaps and missing list for every line the coach can say.
const FROZEN_GAP_STRIKE = 0.03, FROZEN_GAP_SENTENCE = 0.28;
function frozenPhrasesOf(line) {
  const text = phrases.normalizeSpeech(line).replace(/(\d)\.(\d)/g, '$1\u0001$2').replace(/[—–]/g, '.');
  const sentences = text.split(/[.!?;:,]+\s*/).map((s) => s.replace(/\u0001/g, '.').trim()).filter(Boolean);
  const out = [];
  sentences.forEach((s, si) => {
    const words = s.split(/\s+/);
    if (words.length > 1 && words.every((w) => phrases.STRIKE_WORDS.has(w))) {
      phrases.strikePieces(words).forEach((p, pi) => out.push({ text: p, gap: si === 0 && pi === 0 ? 0 : pi === 0 ? FROZEN_GAP_SENTENCE : FROZEN_GAP_STRIKE }));
    } else if (si > 0 && phrases.isNumberCall(s) && phrases.isNumberCall(sentences[si - 1])) {
      out.push({ text: s, gap: FROZEN_GAP_STRIKE });
    } else out.push({ text: s, gap: si === 0 ? 0 : FROZEN_GAP_SENTENCE });
  });
  return out;
}
function frozenPlanLine(bank, line) {
  if (!bank || !bank.clips) return null;
  const list = frozenPhrasesOf(line);
  if (!list.length) return null;
  const plan = [];
  const missing = [];
  for (const ph of list) {
    const gap = plan.length ? ph.gap : 0;
    const whole = bank.clips[ph.text];
    if (whole) { plan.push({ key: ph.text, file: whole.file, ms: whole.ms, gap }); continue; }
    const keys = clips.piecesFor(bank, ph.text);
    if (!keys) { missing.push(ph.text); continue; }
    keys.forEach((t, i) => plan.push({ key: t, file: bank.clips[t].file, ms: bank.clips[t].ms, gap: i === 0 ? gap : FROZEN_GAP_STRIKE }));
  }
  return { plan, missing };
}

// The real banks gain takes as they are recorded. Each take key must be
// stored under the file its kind names (clipFileFor), and that file must be
// on disk, so a take never shadows or overwrites a plain clip.
await test('real banks: every take key is stored under the file its kind names, and the file is there', async () => {
  for (const voice of ['female', 'male']) {
    const m = JSON.parse(fs.readFileSync(new URL(`../public/voice/${voice}/manifest.json`, import.meta.url), 'utf8'));
    const bad = [];
    for (const [k, c] of Object.entries(m.clips)) {
      if (phrases.keyKind(k) === 'plain') continue;
      if (c.file !== phrases.clipFileFor(k)) bad.push(`${k} -> ${c.file}, want ${phrases.clipFileFor(k)}`);
      else if (!fs.existsSync(new URL(`../public/voice/${voice}/${c.file}`, import.meta.url))) bad.push(`${k} -> ${c.file} is not on disk`);
    }
    assert.deepEqual(bad, [], `${voice}: take keys`);
  }
});

// The plain clips of a real bank: what today's planner knew. Takes recorded
// later are left out, so the frozen planner stays a fair yardstick.
const plainBankOf = (clipsObj) => ({ clips: Object.assign(Object.create(null), Object.fromEntries(Object.entries(clipsObj).filter(([k]) => phrases.keyKind(k) === 'plain'))) });

await test('equality bank: a recorded take is left out, so the plain plan is still compared', () => {
  const m = JSON.parse(fs.readFileSync(new URL('../public/voice/female/manifest.json', import.meta.url), 'utf8'));
  const withTake = { ...m.clips, 'rest,': { file: 'rest__mid.mp3', ms: 400 } };
  const bank = plainBankOf(withTake);
  assert.equal(bank.clips['rest,'], undefined);
  assert.deepEqual(clips.planLine(bank, 'Rest: 30 seconds.'), frozenPlanLine(bank, 'Rest: 30 seconds.'));
  // With the take in, the new planner does use it: the comparison would not hold.
  const full = { clips: Object.assign(Object.create(null), withTake) };
  assert.equal(clips.planLine(full, 'Rest: 30 seconds.').plan[0].key, 'rest,');
});

let equalityNote = '';
await test('real banks: every line the coach can say plans exactly as before, in both voices', async () => {
  // The content modules the gatherer loads listen on the page: give the
  // fake page the listener calls while they load.
  const savedWindow = globalThis.window;
  globalThis.window = { ...savedWindow, addEventListener() {}, removeEventListener() {} };
  let features;
  try {
    const { gatherFeatures } = await import('./voice-coverage.mjs');
    ({ features } = await gatherFeatures());
  } finally { globalThis.window = savedWindow; }
  // Cardio Mode builds over a hundred thousand lines from its sweeps: an even
  // spread of a few thousand of them keeps this quick and covers every shape.
  const CARDIO_CAP = 4000;
  const corpus = [];
  for (const [feature, lines] of Object.entries(features)) {
    const all = [...lines];
    if (feature === 'Cardio Mode' && all.length > CARDIO_CAP) {
      const step = all.length / CARDIO_CAP;
      for (let i = 0; i < CARDIO_CAP; i++) corpus.push(all[Math.floor(i * step)]);
    } else corpus.push(...all);
  }
  // Plus the shapes the tests above lean on.
  corpus.push('Round 3. one, two', 'one, two, three to the body, two', 'Go!. Rest,', 'Throw it: jab cross body hook.', '3.5 seconds, rest', 'Rest. 105 seconds. Up next: Goblet Squats.', ':', '');
  assert.ok(corpus.length > 5000, `corpus of ${corpus.length} lines`);
  let checked = 0;
  for (const line of corpus) {
    assert.deepEqual(phrases.phrasesOf(line).map((p) => ({ text: p.text, gap: p.gap })), frozenPhrasesOf(line), `phrasesOf "${line}"`);
  }
  for (const voice of ['female', 'male']) {
    const m = JSON.parse(fs.readFileSync(new URL(`../public/voice/${voice}/manifest.json`, import.meta.url), 'utf8'));
    const real = plainBankOf(m.clips);
    for (const line of corpus) {
      assert.deepEqual(clips.planLine(real, line), frozenPlanLine(real, line), `${voice}: "${line}"`);
      checked += 1;
    }
  }
  equalityNote = `(${checked} line plans compared with the frozen planner, ${corpus.length} lines per voice)`;
});

await test('voice:coverage names something to record for every phrase that does not plan', async () => {
  const savedWindow = globalThis.window;
  globalThis.window = { ...savedWindow, addEventListener() {}, removeEventListener() {} };
  let recordPartsOf;
  try { ({ recordPartsOf } = await import('./voice-coverage.mjs')); } finally { globalThis.window = savedWindow; }
  const bank = { clips: Object.assign(Object.create(null), { go: { file: 'go.mp3', ms: 1 }, 5: { file: '5.mp3', ms: 1 } }) };
  assert.deepEqual(recordPartsOf(bank, 'drive on'), ['drive on']);
  assert.deepEqual(recordPartsOf(bank, 'go 5 far'), ['far']);
  // Each token plans (40 words, then 5), but 41 words are too many to tile: the whole phrase.
  const long = Array(40).fill('go').join(' ') + ' 5';
  assert.equal(clips.planClips(bank, long), null);
  assert.deepEqual(recordPartsOf(bank, long), [long]);
});

console.log(results.join('\n'));
if (equalityNote) console.log(`     ${equalityNote}`);
if (failures) { console.error(`\n${failures} voice clips test(s) failed`); process.exit(1); }
console.log(`\nvoice clips: ${results.length} tests passed`);
process.exit(0);
