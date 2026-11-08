import { getEffectiveVoiceVolume, duckAppAudio, releaseExternalAudio } from './data/audioEngine';

// The spoken coach, on top of the browser's speechSynthesis.
//
// What the 2026-11 voice audit found and this file now guards against
// (scripts/voice-probe.mjs replays every screen against four engine models;
// scripts/test-voice-coach.mjs checks the rules below on a fake engine):
//
// 1. Android Chrome hands speech to the phone's TTS engine, and a speak()
//    issued within a few tens of milliseconds after cancel() is dropped with
//    no start, end or error event. Every path here used to do exactly that
//    (the primer, the count-in after cancelSpeech(), the pre-empt path, and
//    the fallback timer's own cancel()), so one dropped line silenced the
//    next: the whole 3-2-1 went quiet. Now cancel() is only called when the
//    engine really has something playing or queued, and every speak() waits
//    until CANCEL_GAP_MS have passed since the last cancel().
// 2. An engine that fires no events (no voice installed, a stuck engine) used
//    to cost the full estimated length of every line, so a session started
//    10 s late and MAX OUT sat on PREPARING for half a minute. Now two
//    consecutive lines with no 'start' event put the engine in silent mode:
//    lines are still issued (the engine may wake up), but the session waits
//    SILENT_RESOLVE_MS for them, not seconds. Any 'start' event leaves it.
// 3. The primer (a silent utterance on the START tap, which gives the page
//    the user activation Chrome wants and warms the engine) used to block for
//    2 s when it got no events. It now resolves as soon as it has been
//    issued and had PRIMER_WAIT_MS to start.
// 4. A voice object cached from an old getVoices() list can be stale after
//    'voiceschanged', and a voice whose data is not installed fails with
//    'synthesis-failed'. The cache is cleared on 'voiceschanged', and a line
//    that errors before it starts is retried once with the device's default
//    voice.
// 5. Failures used to be invisible. getSpeechHealth() reports what happened
//    (attempted, spoken, dropped, errors, silent mode, muted) for the VOICE
//    CHECK in Profile and the speaker icon in the session corner.

export const CANCEL_GAP_MS = 250;       // gap from synth.cancel() to the next speak()
const PRIMER_WAIT_MS = 600;             // how long the primer may take to start before we move on
const SILENT_AFTER = 2;                 // consecutive lines with no 'start' → silent mode
const SILENT_RESOLVE_MS = 350;          // in silent mode a line resolves this long after speak()
const RETRY_ERRORS = /voice-unavailable|synthesis-failed|language-unavailable|invalid-argument|synthesis-unavailable|audio-hardware/;

let voicesReady = false;
let voicesPromise = null;
let voicePrimed = false;
let primeInFlight = null;
let currentVersion = 0;   // bumps on every utterance and every cancel: stale handlers see it and stand down
let cancelGen = 0;        // bumps only on cancelSpeech(): queued waiters abandon their line
let resumeInterval = null;
let selectedGender = 'female';
let lastCancelAt = -Infinity;
let noStartStreak = 0;
let engineSilent = false;
let voicesListenerOn = false;

const health = {
  supported: null,
  voicesCount: 0,
  voiceName: null,
  primed: false,
  primedReason: null,
  attempted: 0,
  spoken: 0,
  dropped: 0,
  errors: 0,
  lastError: null,
  lastSpeakAt: 0,
  lastStartAt: 0,
  lastText: '',
};
const healthListeners = new Set();

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

function getSynth() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const synth = window.speechSynthesis;
  if (!voicesListenerOn) {
    voicesListenerOn = true;
    // A new voice list invalidates the cached voice object (platform fact: the
    // objects can be replaced), and may make the engine usable again.
    try { synth.addEventListener('voiceschanged', () => { cachedVoice = null; cachedGenderKey = ''; notifyHealth(); }); } catch { /* old engines: no addEventListener */ }
  }
  return synth;
}

function notifyHealth() {
  if (!healthListeners.size) return;
  const snap = getSpeechHealth();
  for (const fn of healthListeners) { try { fn(snap); } catch { /* a listener's problem */ } }
}

export function getSpeechHealth() {
  const synth = getSynth();
  let voicesCount = 0;
  try { voicesCount = synth ? synth.getVoices().length : 0; } catch { voicesCount = 0; }
  let effective = 1;
  try { effective = getEffectiveVoiceVolume(); } catch { effective = 1; }
  return {
    ...health,
    supported: !!synth,
    voicesCount,
    silent: engineSilent,
    muted: effective <= 0,
    primed: voicePrimed && health.primed,
  };
}

// Subscribe to health changes (the session speaker icon). Returns the unsubscribe.
export function onSpeechHealth(fn) {
  healthListeners.add(fn);
  return () => healthListeners.delete(fn);
}

export function resetSpeechHealth() {
  noStartStreak = 0;
  engineSilent = false;
  Object.assign(health, { attempted: 0, spoken: 0, dropped: 0, errors: 0, lastError: null, lastText: '' });
  notifyHealth();
}

export function ensureVoicesReady() {
  if (voicesReady) return Promise.resolve();
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise((resolve) => {
    const synth = getSynth();
    if (!synth) {
      voicesReady = true;
      resolve();
      return;
    }

    const voices = synth.getVoices();
    if (voices.length > 0) {
      voicesReady = true;
      resolve();
      return;
    }

    const onVoicesChanged = () => {
      const v = synth.getVoices();
      if (v.length > 0) {
        voicesReady = true;
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        clearTimeout(timer);
        resolve();
      }
    };
    synth.addEventListener('voiceschanged', onVoicesChanged);

    const timer = setTimeout(() => {
      voicesReady = true;
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve();
    }, 2500);
  });

  return voicesPromise;
}

export function setVoiceGender(gender) {
  selectedGender = (gender || 'female').toLowerCase();
  cachedVoice = null;
  cachedGenderKey = '';
}

let cachedVoice = null;
let cachedGenderKey = '';

function pickVoice() {
  const synth = getSynth();
  if (!synth) return null;
  let voices = [];
  try { voices = synth.getVoices() || []; } catch { voices = []; }
  if (voices.length === 0) return null;

  const cacheKey = `${selectedGender}_${voices.length}`;
  if (cachedVoice && cachedGenderKey === cacheKey && voices.includes(cachedVoice)) return cachedVoice;

  let chosen = null;

  if (selectedGender === 'female') {
    const priorityNames = [
      'google uk english female',
      'sonia online',
      'microsoft sonia',
      'hazel desktop',
      'microsoft hazel',
    ];
    for (const pName of priorityNames) {
      const v = voices.find(v => v.name.toLowerCase().includes(pName));
      if (v) { chosen = v; break; }
    }
    if (!chosen) {
      chosen = voices.find(v => /en[-_]gb/i.test(v.lang) && /female|woman/i.test(v.name));
    }
    if (!chosen) {
      chosen = voices.find(v => /en[-_]gb/i.test(v.lang));
    }
    if (!chosen) {
      const femaleNames = /samantha|victoria|karen|tessa|susan|zira|female|fiona|moira/i;
      chosen = voices.find(v => femaleNames.test(v.name) && /en[-_]/i.test(v.lang));
    }
  } else {
    const maleNames = /daniel|alex|fred|david|mark|george|male/i;
    chosen = voices.find(v => maleNames.test(v.name) && /en[-_]/i.test(v.lang));
  }

  if (!chosen) {
    chosen = voices.find(v => /en[-_]/i.test(v.lang));
  }

  cachedVoice = chosen || null;
  cachedGenderKey = cacheKey;
  return cachedVoice;
}

// Chrome suspends speechSynthesis after ~15s of inactivity.
// This keeps it alive during active sessions.
function startResumeKeepAlive() {
  stopResumeKeepAlive();
  resumeInterval = setInterval(() => {
    const synth = getSynth();
    if (synth && synth.speaking) {
      try { synth.resume(); } catch { /* ignore */ }
    }
  }, 5000);
}

function stopResumeKeepAlive() {
  if (resumeInterval) {
    clearInterval(resumeInterval);
    resumeInterval = null;
  }
}

// cancel() only when the engine has something to cancel. On Android every
// cancel() opens a window in which the next speak() is dropped, so an idle
// engine is left alone; when a cancel is needed, every speak() afterwards
// waits out CANCEL_GAP_MS (awaitCancelGap).
function hardCancel(synth) {
  if (!synth) return;
  let busy = false;
  try { busy = !!(synth.speaking || synth.pending); } catch { busy = true; }
  if (!busy) return;
  lastCancelAt = now();
  try { synth.cancel(); } catch { /* ignore */ }
}

async function awaitCancelGap() {
  const wait = lastCancelAt + CANCEL_GAP_MS - now();
  if (wait > 0) await delay(wait);
}

function noteStart(utterText) {
  noStartStreak = 0;
  if (engineSilent) engineSilent = false;
  health.spoken += 1;
  health.lastStartAt = now();
  if (utterText !== undefined) health.lastText = utterText;
  notifyHealth();
}

function noteNoStart() {
  noStartStreak += 1;
  health.dropped += 1;
  if (noStartStreak >= SILENT_AFTER && !engineSilent) engineSilent = true;
  notifyHealth();
}

export async function primeSpeech() {
  const synth = getSynth();
  if (!synth) {
    voicePrimed = true;
    health.supported = false;
    return { ready: false, reason: 'no_synth' };
  }
  health.supported = true;
  if (primeInFlight) return primeInFlight;

  primeInFlight = (async () => {
    try {
      try { synth.resume(); } catch { /* ignore */ }
      await ensureVoicesReady();
      await awaitCancelGap();

      return await new Promise((resolve) => {
        let settled = false;
        let timer = null;
        const finish = (ready, reason) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          voicePrimed = true;
          health.primed = ready;
          health.primedReason = reason;
          if (ready) startResumeKeepAlive();
          notifyHealth();
          resolve({ ready, reason });
        };

        // Silent primer — warms up the speech engine on the user gesture without
        // speaking an audible word.
        const primer = new SpeechSynthesisUtterance(' ');
        primer.volume = 0;
        primer.rate = 1.8;
        primer.pitch = 1.0;
        const v = pickVoice();
        if (v) primer.voice = v;

        primer.onstart = () => { noteStart(); finish(true, 'ok'); };
        primer.onend = () => finish(true, 'ok');
        primer.onerror = (e) => {
          const err = (e && e.error) || 'error';
          if (err === 'not-allowed' || err === 'audio-busy') {
            health.errors += 1;
            health.lastError = { error: err, text: '(primer)', at: Date.now() };
            finish(false, err);
          } else {
            finish(true, err);
          }
        };

        // The primer is a warm-up, not a gate: whatever the engine does with
        // it, the session goes on after PRIMER_WAIT_MS.
        timer = setTimeout(() => finish(true, 'no_events'), PRIMER_WAIT_MS);

        health.attempted += 1;
        health.lastSpeakAt = now();
        try { synth.speak(primer); } catch (_err) { finish(false, 'error'); }
      });
    } catch (_e) {
      voicePrimed = true;
      return { ready: false, reason: 'error' };
    } finally {
      primeInFlight = null;
    }
  })();
  return primeInFlight;
}

export function cancelSpeech() {
  const synth = getSynth();
  if (!synth) return;
  currentVersion++;
  cancelGen++;
  currentSpeechPromise = null;
  currentSpeechPriority = -1;
  hardCancel(synth);
}

// End of a session's voice. Default: cut whatever is playing (PAUSE, END,
// leaving the screen). { graceful: true }: let the line that is playing finish
// (a closing line such as "Session complete. Good work."), drop what is
// queued, and hand the athlete's music back once it has ended.
export function stopVoiceSession(opts = {}) {
  stopResumeKeepAlive();
  if (opts && opts.graceful === true && currentSpeechPromise) {
    cancelGen++;
    const p = currentSpeechPromise;
    p.then(() => releaseExternalAudio(), () => releaseExternalAudio());
    return;
  }
  cancelSpeech();
  // Session over — un-duck the athlete's music right away.
  releaseExternalAudio();
}

// TTS voices misread hyphenated / title-cased words — "Push-Ups" gets split at
// the hyphen and "Ups" is read as the initialism "U-P-S". De-hyphenate between
// letters and lowercase everything; speech doesn't need casing.
// Exercise names and cadence labels carry notation that reads fine on screen
// and badly out loud: "(Flat/Incline/Decline)", "Step In / Step Out", "3.5s",
// "3 × 10". Strip the brackets, say "or" for a slash, "seconds" for a
// trailing s and "by" for a multiplication sign.
export function normalizeSpeech(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\/\s*/g, ' or ')
    .replace(/\s*×\s*/g, ' by ')
    .replace(/(\d+(?:\.\d+)?)\s*s\b/g, '$1 seconds')
    .replace(/([a-zA-Z])-([a-zA-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── Priority-aware scheduler ────────────────────────────────────────────
//
// A single lock tracks who owns the mic. Callers pick from three modes.
//
//   opts.preempt   — cancel whatever is playing, take the mic (critical
//                    events: Rush activation, round-end horn, session
//                    complete).
//   opts.dropIfBusy — if someone else is talking, drop THIS message
//                    silently. For time-sensitive lines whose window
//                    passes if delayed (a combo call arrives on the
//                    cadence beat; a queued combo delivered three
//                    seconds late is wrong).
//   default        — queue: wait for the current speaker to finish,
//                    then talk. For motivational quotes and coach flow
//                    lines that stay relevant even a few seconds later.
//
// opts.priority (0..3) lets a higher-priority queued line pre-empt a
// lower-priority speaker mid-sentence even without opts.preempt. Rush
// countdowns are priority 3; combos are 2; quotes and cadence counts
// are 1; the default is 1.

let currentSpeechPromise = null;
let currentSpeechPriority = -1;

export function isSpeechBusy() { return currentSpeechPromise !== null; }
export function currentSpeechLevel() { return currentSpeechPriority; }

function estimateMs(text, rate) {
  const wordCount = text.split(/\s+/).length;
  return Math.max(1500, Math.max(wordCount * 600, text.length * 85) / rate + 800);
}

// One utterance on the engine. Resolves when it ends, errors, is cancelled,
// or its fallback decides it never will. `retry` allows one re-issue with the
// device's default voice when the chosen voice fails before it starts.
function issueUtterance(synth, text, opts, speakVersion, resolve, retry) {
  let resolved = false;
  let started = false;
  let graces = 0;
  let fallback = null;
  let silentTimer = null;
  const done = () => {
    if (resolved) return;
    resolved = true;
    clearTimeout(fallback);
    clearTimeout(silentTimer);
    resolve();
  };

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = opts.rate || 1.0;
  utter.pitch = opts.pitch || 1.05;
  const effectiveVol = opts.volume !== undefined ? opts.volume : getEffectiveVoiceVolume();
  utter.volume = Math.max(0, Math.min(1, Number.isFinite(effectiveVol) ? effectiveVol : 1));

  const voice = retry ? pickVoice() : null;
  if (voice) utter.voice = voice;
  health.voiceName = voice ? voice.name : null;

  const rate = opts.rate || 1.0;
  const estimatedMs = estimateMs(text, rate);
  duckAppAudio(engineSilent ? SILENT_RESOLVE_MS : estimatedMs);

  utter.onstart = () => {
    if (speakVersion !== currentVersion) return;
    started = true;
    noteStart(text);
  };
  utter.onend = () => {
    if (!started && speakVersion === currentVersion) { started = true; noteStart(text); }
    done();
  };
  utter.onerror = (e) => {
    const err = (e && e.error) || 'error';
    if (err === 'canceled' || err === 'interrupted' || speakVersion !== currentVersion) { done(); return; }
    health.errors += 1;
    health.lastError = { error: err, text, at: Date.now() };
    notifyHealth();
    // The chosen voice failed before a word was said: say it with the
    // device's own voice instead (stale voice object, voice data missing).
    if (!started && retry && voice && RETRY_ERRORS.test(err)) {
      clearTimeout(fallback);
      clearTimeout(silentTimer);
      cachedVoice = null;
      cachedGenderKey = '';
      setTimeout(() => {
        if (resolved) return;
        if (speakVersion !== currentVersion) { done(); return; }
        issueUtterance(synth, text, opts, speakVersion, resolve, false);
      }, 60);
      return;
    }
    done();
  };

  // The fallback exists for engines that never fire onend. Estimate by
  // characters as well as words, allow start-up time, and if the engine is
  // still speaking when the timer fires, give it grace before cutting. A
  // line that never started gets no cancel() — there is nothing to cancel,
  // and on Android the cancel itself would drop the next line.
  const onFallback = () => {
    if (speakVersion !== currentVersion) { done(); return; }
    let speaking = false;
    try { speaking = !!synth.speaking; } catch { speaking = false; }
    // Grace only while the engine is really talking; a line that sits
    // "pending" for its whole estimate is not coming.
    if (graces < 2 && speaking) {
      graces += 1;
      fallback = setTimeout(onFallback, Math.round(estimatedMs * 0.6));
      return;
    }
    if (!started) noteNoStart();
    hardCancel(synth);   // only acts when something is playing or queued
    done();
  };
  fallback = setTimeout(onFallback, estimatedMs);

  // Silent mode: the engine has not started a line for a while. Issue the
  // line anyway (it may wake up), but do not hold the session for it.
  if (engineSilent) {
    silentTimer = setTimeout(() => { if (!started) done(); }, SILENT_RESOLVE_MS);
  }

  health.attempted += 1;
  health.lastSpeakAt = now();
  try {
    synth.speak(utter);
  } catch (_err) {
    health.errors += 1;
    health.lastError = { error: 'speak-threw', text, at: Date.now() };
    notifyHealth();
    done();
  }
}

function speakUtterance(rawText, opts) {
  const synth = getSynth();
  if (!synth) return Promise.resolve();
  const text = normalizeSpeech(rawText);
  if (!text) return Promise.resolve();

  const speakVersion = ++currentVersion;

  return new Promise((resolve) => {
    (async () => {
      // Never speak inside the window after a cancel() (platform fact: Android
      // drops it). Nothing waits when there was no recent cancel.
      await awaitCancelGap();
      if (speakVersion !== currentVersion) { resolve(); return; }
      try { synth.resume(); } catch { /* ignore */ }
      issueUtterance(synth, text, opts, speakVersion, resolve, true);
    })();
  });
}

export async function speakAsync(rawText, opts = {}) {
  const synth = getSynth();
  if (!synth) return;

  const gen = cancelGen;
  await ensureVoicesReady();
  if (cancelGen !== gen) return;

  const priority = Number.isFinite(opts.priority) ? opts.priority : 1;
  const preempt = opts.preempt === true;
  const dropIfBusy = opts.dropIfBusy === true;

  // Someone's currently talking. Decide fast.
  if (currentSpeechPromise) {
    const shouldPreempt = preempt || priority > currentSpeechPriority;
    if (shouldPreempt) {
      // Take the mic. The gap after the cancel is waited out in speakUtterance.
      currentVersion++;
      hardCancel(synth);
    } else if (dropIfBusy) {
      return;
    } else {
      // queue behind the current speaker; a cancel while we wait abandons us
      try { await currentSpeechPromise; } catch { /* ignore */ }
      if (cancelGen !== gen) return;
    }
  }

  currentSpeechPriority = priority;
  const p = speakUtterance(rawText, opts).finally(() => {
    // Only clear the lock if this promise is still the one holding it —
    // a pre-empter may already have replaced it.
    if (currentSpeechPromise === p) {
      currentSpeechPromise = null;
      currentSpeechPriority = -1;
    }
  });
  currentSpeechPromise = p;
  return p;
}

export async function speakOrDelay(text, minMs, opts = {}) {
  const voiceEnabled = opts.voice !== false;
  const synth = getSynth();

  if (!voiceEnabled || !synth) {
    await delay(minMs);
    return;
  }

  const speechDone = speakAsync(text, opts).catch(() => {});
  const minWait = delay(minMs);

  await Promise.all([speechDone, minWait]);
}

// A test line for the VOICE CHECK: speaks `text` outside the session lock and
// reports exactly what the engine did with it.
export async function speakTest(text = 'Voice check. Three, two, one. Go!', opts = {}) {
  const synth = getSynth();
  if (!synth) return { supported: false, started: false, ended: false, error: 'no_synth', ms: 0, voice: null, voices: 0 };
  await ensureVoicesReady();
  await awaitCancelGap();
  cancelSpeech();
  await awaitCancelGap();
  const t0 = now();
  return new Promise((resolve) => {
    let started = false, settled = false;
    const utter = new SpeechSynthesisUtterance(normalizeSpeech(text));
    utter.rate = opts.rate || 1.0;
    utter.pitch = opts.pitch || 1.05;
    utter.volume = Math.max(0, Math.min(1, getEffectiveVoiceVolume()));
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    let voices = 0;
    try { voices = synth.getVoices().length; } catch { voices = 0; }
    const finish = (res) => { if (settled) return; settled = true; clearTimeout(t); resolve({ supported: true, voices, voice: voice ? voice.name : null, volume: utter.volume, ms: Math.round(now() - t0), ...res }); };
    utter.onstart = () => { started = true; noteStart(utter.text); };
    utter.onend = () => finish({ started, ended: true, error: null });
    utter.onerror = (e) => finish({ started, ended: false, error: (e && e.error) || 'error' });
    const t = setTimeout(() => { if (!started) noteNoStart(); finish({ started, ended: false, error: started ? 'no_end' : 'no_events' }); }, 8000);
    health.attempted += 1;
    health.lastSpeakAt = now();
    try { synth.resume(); synth.speak(utter); } catch (_err) { finish({ started: false, ended: false, error: 'speak-threw' }); }
  });
}

export function isVoicePrimed() {
  return voicePrimed;
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
