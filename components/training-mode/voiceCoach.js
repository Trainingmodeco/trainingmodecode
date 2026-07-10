import { getEffectiveVoiceVolume, duckAppAudio } from './data/audioEngine';

let voicesReady = false;
let voicesPromise = null;
let voicePrimed = false;
let currentVersion = 0;
let resumeInterval = null;
let selectedGender = 'female';

function getSynth() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  return window.speechSynthesis;
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
  const voices = synth.getVoices();
  if (voices.length === 0) return null;

  const cacheKey = `${selectedGender}_${voices.length}`;
  if (cachedVoice && cachedGenderKey === cacheKey) return cachedVoice;

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
      synth.resume();
    }
  }, 5000);
}

function stopResumeKeepAlive() {
  if (resumeInterval) {
    clearInterval(resumeInterval);
    resumeInterval = null;
  }
}

export async function primeSpeech() {
  const synth = getSynth();
  if (!synth) {
    voicePrimed = true;
    return { ready: false, reason: 'no_synth' };
  }

  try {
    synth.cancel();
    synth.resume();
    await ensureVoicesReady();

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (success) => {
        if (resolved) return;
        resolved = true;
        voicePrimed = true;
        clearTimeout(fallback);
        if (success) startResumeKeepAlive();
        resolve({ ready: success, reason: success ? 'ok' : 'timeout' });
      };

      // Silent primer — warms up the speech engine on the user gesture without
      // speaking an audible word ("Ready.").
      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0;
      primer.rate = 1.8;
      primer.pitch = 1.0;
      const v = pickVoice();
      if (v) primer.voice = v;

      primer.onend = () => finish(true);
      primer.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'audio-busy') {
          finish(false);
        } else {
          finish(true);
        }
      };

      const fallback = setTimeout(() => {
        // Even if the primer didn't fire onend, the synth may still be usable
        synth.cancel();
        finish(true);
      }, 2000);

      synth.speak(primer);
    });
  } catch (_e) {
    voicePrimed = true;
    return { ready: false, reason: 'error' };
  }
}

export function cancelSpeech() {
  const synth = getSynth();
  if (!synth) return;
  currentVersion++;
  synth.cancel();
}

export function stopVoiceSession() {
  cancelSpeech();
  stopResumeKeepAlive();
}

export async function speakAsync(text, opts = {}) {
  const synth = getSynth();
  if (!synth) return;

  await ensureVoicesReady();

  const speakVersion = ++currentVersion;

  // Cancel any current speech before starting new
  synth.cancel();
  synth.resume();

  return new Promise((resolve) => {
    if (speakVersion !== currentVersion) { resolve(); return; }

    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(fallback);
      resolve();
    };

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = opts.rate || 1.0;
    utter.pitch = opts.pitch || 1.05;
    const effectiveVol = opts.volume !== undefined ? opts.volume : getEffectiveVoiceVolume();
    utter.volume = Math.max(0, Math.min(1, effectiveVol));

    const voice = pickVoice();
    if (voice) utter.voice = voice;

    const wordCount = text.split(/\s+/).length;
    const rate = opts.rate || 1.0;
    const estimatedMs = Math.max(1500, (wordCount * 600) / rate + 800);
    duckAppAudio(estimatedMs);

    utter.onend = done;
    utter.onerror = (e) => {
      if (e.error === 'canceled' || speakVersion !== currentVersion) {
        done();
        return;
      }
      done();
    };

    const fallback = setTimeout(() => {
      if (speakVersion === currentVersion) synth.cancel();
      done();
    }, estimatedMs);

    synth.speak(utter);
  });
}

export async function speakOrDelay(text, minMs, opts = {}) {
  const voiceEnabled = opts.voice !== false;
  const synth = getSynth();

  if (!voiceEnabled || !synth) {
    await delay(minMs);
    return;
  }

  // Resume before every speak call to combat Chrome suspension
  synth.resume();

  const speechDone = speakAsync(text, opts).catch(() => {});
  const minWait = delay(minMs);

  await Promise.all([speechDone, minWait]);
}

export function isVoicePrimed() {
  return voicePrimed;
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
