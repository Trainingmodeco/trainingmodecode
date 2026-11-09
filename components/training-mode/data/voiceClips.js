import { phrasesOf, tokensOf, GAP_STRIKE } from './voicePhrases';
import { getAudioContext, getCueOut, getVoiceVolume, getAudioSettings, VOICE_MAX } from './audioEngine';

// The recorded coach voice: a bank of clips built into the app, one mp3 per
// phrase, under public/voice/<voice>/ with a manifest listing them.
//
// Why: the owner's phone's speech engine refuses every utterance
// (synthesis-failed on every voice, the default included), so the coach was
// silent. A line the coach says is cut into phrases (voicePhrases.js); when
// every phrase has a clip, the clips play back to back through Web Audio and
// the speech engine is not touched. Otherwise the line goes to the speech
// engine exactly as before.
//
// Manifest (fixed): GET /voice/<voice>/manifest.json
//   { "voice": "female"|"male", "version": 1,
//     "clips": { "<phrase as phrasesOf yields it>": { "file": "<slug>.mp3", "ms": <int> }, ... } }
// Clip URL: /voice/<voice>/<file>.

const BASE = '/voice/';
const banks = new Map(); // voice -> { status: 'loading'|'ready'|'missing', bank, promise }

function entryFor(voice) {
  const key = String(voice || 'female').toLowerCase();
  let e = banks.get(key);
  if (!e) { e = { status: 'none', bank: null, promise: null }; banks.set(key, e); }
  return { key, e };
}

export function bankStatus(voice) {
  const key = String(voice || 'female').toLowerCase();
  const e = banks.get(key);
  return e ? e.status : 'none';
}

export function getLoadedBank(voice) {
  const key = String(voice || 'female').toLowerCase();
  const e = banks.get(key);
  return e && e.status === 'ready' ? e.bank : null;
}

function validManifest(m, voice) {
  if (!m || typeof m !== 'object' || !m.clips || typeof m.clips !== 'object') return null;
  // No prototype: a phrase such as "constructor" must not read as present.
  const clips = Object.create(null);
  let count = 0;
  for (const k of Object.keys(m.clips)) {
    const c = m.clips[k];
    if (!c || typeof c.file !== 'string' || !c.file) continue;
    clips[k] = { file: c.file, ms: Math.max(0, Number(c.ms) || 0) };
    count += 1;
  }
  if (!count) return null;
  return {
    voice: typeof m.voice === 'string' && m.voice ? m.voice : voice,
    version: Number(m.version) || 1,
    clips,
    count,
    base: `${BASE}${voice}/`,
    buffers: new Map(), // key -> Promise<AudioBuffer>
  };
}

// Fetch and parse the manifest for `voice`; cached per voice in memory. Null
// on any failure (no fetch, offline, 404, bad JSON): the caller then speaks
// through the speech engine. The service worker caches the manifest and the
// clips like any other asset, so a second visit is offline-safe.
export function loadVoiceBank(voice) {
  const { key, e } = entryFor(voice);
  if (e.status === 'ready') return Promise.resolve(e.bank);
  if (e.promise) return e.promise;
  if (typeof fetch !== 'function') { e.status = 'missing'; return Promise.resolve(null); }
  e.status = 'loading';
  e.promise = (async () => {
    try {
      const res = await fetch(`${BASE}${key}/manifest.json`);
      if (!res || !res.ok) throw new Error('manifest ' + (res && res.status));
      const bank = validManifest(await res.json(), key);
      if (!bank) throw new Error('bad manifest');
      e.bank = bank;
      e.status = 'ready';
      return bank;
    } catch {
      e.bank = null;
      e.status = 'missing';
      return null;
    } finally {
      e.promise = null;
    }
  })();
  return e.promise;
}

// For tests and a future "reload" button: forget a bank so it loads again.
export function forgetVoiceBank(voice) {
  const key = String(voice || 'female').toLowerCase();
  banks.delete(key);
}

// A line -> the clips to play, in order, or null when any phrase has no clip
// (the whole line then goes to the speech engine). Each phrase is looked up
// whole; a phrase with a number in it is also tried as its parts ("plus",
// "20", "x p"), with GAP_STRIKE between the parts.
export function planClips(bank, line) {
  if (!bank || !bank.clips) return null;
  const phrases = phrasesOf(line);
  if (!phrases.length) return null;
  const plan = [];
  for (const ph of phrases) {
    const whole = bank.clips[ph.text];
    if (whole) { plan.push({ key: ph.text, file: whole.file, ms: whole.ms, gap: ph.gap }); continue; }
    if (!/\d/.test(ph.text)) return null;
    const toks = tokensOf(ph.text);
    if (!toks.length || !toks.every((t) => bank.clips[t])) return null;
    toks.forEach((t, i) => plan.push({ key: t, file: bank.clips[t].file, ms: bank.clips[t].ms, gap: i === 0 ? ph.gap : GAP_STRIKE }));
  }
  return plan;
}

// Milliseconds a plan takes at `rate`, from the manifest's clip lengths.
export function planMs(plan, rate = 1) {
  const r = rate > 0 ? rate : 1;
  return Math.round(plan.reduce((s, p) => s + (p.ms + p.gap * 1000) / r, 0));
}

// The decoded clip for `key`, fetched and decoded once per bank. A failed
// fetch is forgotten so the next line tries again (the phone may be back online).
export function getBuffer(bank, key) {
  if (!bank || !bank.clips || !bank.clips[key]) return Promise.reject(new Error('no clip: ' + key));
  const hit = bank.buffers.get(key);
  if (hit) return hit;
  const p = (async () => {
    const ctx = getAudioContext();
    if (!ctx) throw new Error('no audio context');
    if (typeof fetch !== 'function') throw new Error('no fetch');
    const res = await fetch(bank.base + bank.clips[key].file);
    if (!res || !res.ok) throw new Error('clip ' + (res && res.status));
    const data = await res.arrayBuffer();
    // Safari's decodeAudioData is callback-only on old versions; wrap both.
    return await new Promise((resolve, reject) => {
      let r;
      try { r = ctx.decodeAudioData(data, resolve, reject); } catch (err) { reject(err); return; }
      if (r && typeof r.then === 'function') r.then(resolve, reject);
    });
  })();
  bank.buffers.set(key, p);
  p.catch(() => { if (bank.buffers.get(key) === p) bank.buffers.delete(key); });
  return p;
}

// The lines a session asks for first: the count-in and the round calls.
// Decoded before the rest of the bank so they are ready when the clock starts.
export const HOT_KEYS = ['ready', 'three', 'two', 'one', 'go', 'begin', 'rest', 'halfway', 'last one', 'switch', 'time', 'done', 'work', 'hold', 'great work', 'free flow', 'round', '1', '2', '3', '4', '5', '10', '15', '20', '30'];

// Decode every clip of the bank in the background so the lines of a session
// do not wait on the network. opts.first lists keys to decode before the
// rest (default HOT_KEYS), opts.onlyFirst stops there; opts.gapMs (default 0)
// idles between clips so a
// full-bank decode never crowds out the screen that is starting. Never
// throws; calling it again only picks up clips that failed before.
export function prefetchBank(bank, opts = {}) {
  if (!bank || !bank.clips) return Promise.resolve();
  const concurrency = Math.max(1, opts.concurrency || 4);
  const gapMs = Math.max(0, opts.gapMs || 0);
  const first = (opts.first || HOT_KEYS).filter((k) => bank.clips[k]);
  const seen = new Set(first);
  const rest = opts.onlyFirst ? [] : Object.keys(bank.clips).filter((k) => !seen.has(k));
  const keys = first.concat(rest).filter((k) => !bank.buffers.has(k));
  let i = 0;
  const worker = async () => {
    while (i < keys.length) {
      const k = keys[i++];
      try { await getBuffer(bank, k); } catch { /* the line falls back to the speech engine */ }
      if (gapMs && i < keys.length) await wait(gapMs);
    }
  };
  const runners = [];
  for (let n = 0; n < concurrency; n++) runners.push(worker());
  return Promise.all(runners).then(() => undefined, () => undefined);
}

// VOICE fader times master, 0..2: clips go through the limiter, so unlike
// browser speech they are not capped at 1.0.
export function clipGain() {
  let v = 1, master = 1;
  try { v = Number(getVoiceVolume()); } catch { v = 1; }
  try { master = Number(getAudioSettings().masterVolume); } catch { master = 1; }
  if (!Number.isFinite(v)) v = 1;
  if (!Number.isFinite(master)) master = 1;
  const g = Math.max(0, Math.min(VOICE_MAX, v)) * Math.max(0, Math.min(1, master));
  return Number.isFinite(g) ? g : 1;
}

const STOP_RAMP_S = 0.01;
// How long the pre-schedule phase may take before the line goes to the speech
// engine instead: resuming a context the browser will not start, and fetching
// clips that were not prefetched. The engine would have started at once.
const RESUME_WAIT_MS = 300;
const BUFFER_WAIT_MIN_MS = 800;
// Polls of the context clock while waiting for the first clip to begin.
const START_POLL_MS = 50;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Play a plan back to back on the context clock. Returns a handle:
//   handle.done   resolves when the last clip has ended (or the line was
//                 stopped); rejects when a clip could not be fetched or the
//                 context is unusable, before anything has played, so the
//                 caller can say the line through the speech engine instead.
//   handle.stop() stops every scheduled clip at once (10 ms gain ramp, no click).
//   handle.started  true once the first clip has begun.
// opts: { bank, rate = 1, onStart, isCancelled }. `onStart` fires when the
// first clip actually begins; `isCancelled()` is checked before scheduling so
// a line pre-empted while its clips were loading never plays.
export function playPlan(plan, opts = {}) {
  const { bank, onStart, isCancelled } = opts;
  const rate = opts.rate > 0 ? opts.rate : 1;
  let stopped = false;
  let settled = false;
  let resolveDone, rejectDone;
  const done = new Promise((res, rej) => { resolveDone = res; rejectDone = rej; });
  const sources = [];
  const timers = [];
  let gainNode = null;
  let ctx = null;
  const handle = {
    done,
    started: false,
    stop() {
      if (stopped) return;
      stopped = true;
      for (const t of timers) clearTimeout(t);
      if (ctx && gainNode) {
        const t = ctx.currentTime;
        try {
          gainNode.gain.cancelScheduledValues(t);
          gainNode.gain.setValueAtTime(gainNode.gain.value, t);
          gainNode.gain.linearRampToValueAtTime(0, t + STOP_RAMP_S);
        } catch { try { gainNode.gain.value = 0; } catch { /* ignore */ } }
        for (const s of sources) { try { s.stop(t + STOP_RAMP_S + 0.002); } catch { /* not started yet or already ended */ } }
      }
      finish();
    },
  };
  const finish = () => { if (settled) return; settled = true; for (const t of timers) clearTimeout(t); resolveDone(); };
  const fail = (err) => { if (settled) return; settled = true; for (const t of timers) clearTimeout(t); rejectDone(err); };
  const cancelled = () => stopped || (typeof isCancelled === 'function' && isCancelled());
  const markStarted = () => {
    if (handle.started || stopped) return;
    handle.started = true;
    if (typeof onStart === 'function') { try { onStart(); } catch { /* the caller's problem */ } }
  };

  (async () => {
    try {
      if (!Array.isArray(plan) || !plan.length) throw new Error('empty plan');
      ctx = getAudioContext();
      if (!ctx) throw new Error('no audio context');
      if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
        // resume() can stay pending forever on a context the browser will not
        // start; give it a moment, then let the speech engine have the line.
        await Promise.race([Promise.resolve().then(() => ctx.resume()).catch(() => {}), wait(RESUME_WAIT_MS)]);
        if (ctx.state !== 'running') throw new Error('context ' + ctx.state);
      }
      const buffers = await Promise.race([
        Promise.all(plan.map((p) => getBuffer(bank, p.key))),
        wait(Math.max(BUFFER_WAIT_MIN_MS, planMs(plan, rate))).then(() => { throw new Error('clips slow'); }),
      ]);
      if (cancelled()) { finish(); return; }
      if (ctx.state !== 'running') throw new Error('context ' + ctx.state);

      gainNode = ctx.createGain();
      gainNode.gain.value = clipGain();
      let out = null;
      try { out = getCueOut(); } catch { out = null; }
      gainNode.connect(out || ctx.destination);

      const lead = 0.02;
      let t = ctx.currentTime + lead;
      let firstStart = null;
      const reached = () => ctx.state === 'running' && ctx.currentTime >= firstStart - 0.005;
      plan.forEach((p, i) => {
        const buf = buffers[i];
        t += p.gap / rate;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        try { src.playbackRate.value = rate; } catch { /* ignore */ }
        src.connect(gainNode);
        const dur = (buf && Number.isFinite(buf.duration) ? buf.duration : (p.ms || 0) / 1000) / rate;
        if (firstStart === null) firstStart = t;
        const last = i === plan.length - 1;
        src.onended = () => { if (reached()) markStarted(); if (last) finish(); };
        src.start(t);
        sources.push(src);
        t += dur;
      });
      const endAt = t;
      // The context clock is the truth: the first clip has begun only once the
      // clock has reached its start time while running. A suspended or
      // interrupted context (a call, another app taking audio) never gets
      // there, and the line must then NOT count as spoken. The timers are the
      // fallback for a source whose onended never fires.
      let polls = Math.ceil(((endAt - firstStart) * 1000 + 2000) / START_POLL_MS);
      const pollStart = () => {
        if (cancelled() || handle.started || settled) return;
        if (reached()) { markStarted(); return; }
        if (polls-- > 0) timers.push(setTimeout(pollStart, START_POLL_MS));
      };
      timers.push(setTimeout(pollStart, Math.max(0, (firstStart - ctx.currentTime) * 1000) + 5));
      timers.push(setTimeout(() => { if (ctx.currentTime >= firstStart) markStarted(); finish(); }, Math.max(0, (endAt - ctx.currentTime) * 1000) + 150));
    } catch (err) {
      fail(err);
    }
  })();

  return handle;
}
