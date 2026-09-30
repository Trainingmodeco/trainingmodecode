const STORAGE_KEY = 'tm_audio_settings';

// Cue-boost + EXTERNAL DUCKING. The athlete trains with their own music running
// (phone music player, Spotify, podcasts, any 3rd-party app) and our voice cues
// have to cut through it. Two levers:
//   1. Audio Session (below) — tells the OS to DUCK that other audio while a cue
//      plays, then restore it. This is the real fix for "turn their music down".
//   2. Cue boost — our own Web Audio cues run hot through a limiter, and the
//      voice defaults above 100% (browser TTS itself is capped at 1.0).
// voiceVolume is 0..VOICE_MAX (2.0); default 1.5. SETTINGS_VERSION bumps so
// existing athletes pick up the new louder default; anything they set after
// that is theirs and sticks.
export const VOICE_MAX = 2.0;
const SETTINGS_VERSION = 3;

// The app's own Web Audio cues — round-start bell, beeps, riser — sit at ONE
// fixed level, a touch above the spoken coach. They used to be tripled
// (CUE_BOOST 3.0) and multiplied by the VOICE fader on top, which is how the
// bell ended up deafening while the voice could not move: browser TTS is
// hard-capped at 1.0, so the same fader raised only the cues.
//
// Owner's call after playtest: no bell fader at all. A slider invites exactly
// the mistake the old shared one made — the bell should simply be right.
// 1.1 puts it ~10% above unity, so a round bell still reads as a marker over
// the voice instead of drowning it. The limiter below still catches peaks.
const BELL_LEVEL = 1.1;
const CUE_MAX = 6.0;

const DEFAULTS = {
  masterVolume: 1.0,
  sfxVolume: 1.0,
  voiceVolume: 1.5,
  musicVolume: 0.6,
  duckingEnabled: true,
  duckingStrength: 'normal',
  v: SETTINGS_VERSION,
};

const DUCK_PROFILES = {
  light:  { factor: 0.40, attackMs: 150, releaseMs: 800 },
  normal: { factor: 0.28, attackMs: 120, releaseMs: 700 },
  strong: { factor: 0.18, attackMs: 100, releaseMs: 600 },
};

const BELL_SEGMENTS = {
  1: { start: 0.05, duration: 1.25 },
  2: { start: 9.20, duration: 1.50 },
  3: { start: 17.70, duration: 2.10 },
};

const BELL_SRC = '/audio/boxing-bell-signals.mp3';

let audioCtx = null;
let settings = null;
let internalMusicNode = null;
let duckRestoreTimeout = null;
let preDuckVolume = null;
let bellBuffer = null;
let bellLoading = false;
let bellLoadQueue = [];
let masterLimiter = null;
let limiterCtx = null;
let externalRestoreTimeout = null;

// ── External audio session (the athlete's OWN music) ────────────────────────
// W3C Audio Session API (navigator.audioSession) — the standard way for a web
// app to tell the OS how it should mix with whatever else is playing:
//   'ambient'   → our audio plays ALONGSIDE their music (their music keeps going)
//   'transient' → our audio DUCKS their music while it plays, then it restores
// So we sit in 'ambient' during a session and flip to 'transient' around every
// cue: the phone's music player / Spotify / a podcast dips, the cue lands on
// top, then their audio comes back up. Progressive enhancement — where the API
// isn't implemented yet this is a no-op and nothing regresses (the native
// wrapper applies the same categories through the platform audio session).
const SESSION_IDLE = 'ambient';
const SESSION_DUCK = 'transient';

function audioSession() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) return navigator.audioSession;
  } catch { /* access can throw in locked-down webviews */ }
  return null;
}

export function audioSessionSupported() {
  return !!audioSession();
}

function setAudioSessionType(type) {
  const s = audioSession();
  if (!s) return false;
  try {
    if (s.type !== type) s.type = type;
    return true;
  } catch {
    return false;
  }
}

// Sit alongside the athlete's music instead of stopping it. Called on unlock so
// starting a session never kills what they're already listening to.
export function initExternalAudioSession() {
  return setAudioSessionType(SESSION_IDLE);
}

// Hand the athlete's music straight back (session ended / speech cancelled) so
// it doesn't sit ducked after the last cue.
export function releaseExternalAudio() {
  if (externalRestoreTimeout) {
    clearTimeout(externalRestoreTimeout);
    externalRestoreTimeout = null;
  }
  setAudioSessionType(SESSION_IDLE);
}

// Duck their music for ~durationMs, then hand it back. Overlapping cues just
// push the restore out rather than restoring early mid-sentence.
function duckExternalAudio(durationMs, profile) {
  if (!setAudioSessionType(SESSION_DUCK)) return;
  if (externalRestoreTimeout) clearTimeout(externalRestoreTimeout);
  externalRestoreTimeout = setTimeout(() => {
    setAudioSessionType(SESSION_IDLE);
    externalRestoreTimeout = null;
  }, durationMs + profile.releaseMs);
}

// Shared brick-wall-ish limiter for the boosted cues: lets us push cue gain to
// 300% for loudness while catching peaks so nothing hard-clips into distortion.
// Recreated if the AudioContext is replaced. Cues connect here, not straight to
// destination.
function cueOut() {
  const ctx = getCtx();
  if (!ctx) return null;
  if (masterLimiter && limiterCtx === ctx) return masterLimiter;
  try {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -4;
    comp.knee.value = 0;
    comp.ratio.value = 20;
    comp.attack.value = 0.002;
    comp.release.value = 0.14;
    comp.connect(ctx.destination);
    masterLimiter = comp;
    limiterCtx = ctx;
    return comp;
  } catch {
    return ctx.destination;
  }
}

function getSettings() {
  if (settings) return settings;

  let parsed = null;
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) parsed = JSON.parse(stored);
  } catch {
    parsed = null;
  }
  settings = parsed ? { ...DEFAULTS, ...parsed } : { ...DEFAULTS };

  // One-time cue-boost migration for older saved mixes. The version has to be
  // read off the STORED object — DEFAULTS carries the current version, so
  // checking the merged result would always look already-migrated. v3 also
  // floors the voice at the new 1.5 default so existing users get the boost.
  if (parsed && parsed.v !== SETTINGS_VERSION) {
    settings = {
      ...settings,
      sfxVolume: Math.max(parsed.sfxVolume ?? 0, DEFAULTS.sfxVolume),
      voiceVolume: Math.max(parsed.voiceVolume ?? 0, DEFAULTS.voiceVolume),
      v: SETTINGS_VERSION,
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      }
    } catch {}
  }
  return settings;
}

export function getAudioSettings() {
  return { ...getSettings() };
}

export function saveAudioSettings(newSettings) {
  settings = { ...getSettings(), ...newSettings };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {}
}

export function setMasterVolume(v) { saveAudioSettings({ masterVolume: Math.max(0, Math.min(1, v)) }); }
export function setSfxVolume(v) { saveAudioSettings({ sfxVolume: Math.max(0, Math.min(1, v)) }); }
// Voice can be set up to 200% — the boost above 100% is applied to the app's
// own Web Audio cues and takes full effect (incl. TTS + external ducking) in
// the native wrapper. Stored raw; consumers cap where the platform requires.
export function setVoiceVolume(v) { saveAudioSettings({ voiceVolume: Math.max(0, Math.min(VOICE_MAX, v)) }); }
export function setMusicVolume(v) { saveAudioSettings({ musicVolume: Math.max(0, Math.min(1, v)) }); }

// Raw voice setting (0..2.0) for the mixer UI and native gain.
export function getVoiceVolume() { return getSettings().voiceVolume; }


// True when the browser can actually duck other apps' audio. Android Chrome
// cannot (no navigator.audioSession), so any UI promising ducking has to say
// so rather than offering a switch that does nothing.
export function externalDuckingSupported() { return audioSessionSupported(); }

// For browser SpeechSynthesis, whose utterance.volume is capped at 1.0.
export function getEffectiveVoiceVolume() {
  const s = getSettings();
  return Math.min(1, s.masterVolume * s.voiceVolume);
}

// Gain for the app's own cue sounds (bells / beeps / riser). These play through
// Web Audio, so unlike browser TTS they CAN exceed 1.0 — the VOICE slider drives
// them across the full 0..200% range so cues audibly cut through even on web.
// Cue gain follows master volume and nothing else. Not the VOICE fader (that
// is what broke it), and not a bell fader (there isn't one by design).
function getCueGain() {
  const s = getSettings();
  return Math.max(0, Math.min(CUE_MAX, s.masterVolume * BELL_LEVEL));
}

export function getEffectiveMusicVolume() {
  const s = getSettings();
  return s.masterVolume * s.musicVolume;
}

function getCtx() {
  if (audioCtx && audioCtx.state !== 'closed') return audioCtx;
  if (typeof window === 'undefined') return null;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return null;
  }
  return audioCtx;
}

export function unlockAudio() {
  // Claim the session as 'ambient' before the context starts, so beginning a
  // workout mixes with the athlete's music instead of interrupting it.
  initExternalAudioSession();
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  loadBellBuffer();
}

export function registerInternalMusic(gainNode) {
  internalMusicNode = gainNode;
}

function fadeGain(node, targetValue, durationMs) {
  if (!node) return;
  const currentVal = node.gain.value;
  if (Math.abs(currentVal - targetValue) < 0.01) {
    node.gain.value = targetValue;
    return;
  }
  const steps = Math.max(4, Math.round(durationMs / 25));
  const stepMs = durationMs / steps;
  const diff = targetValue - currentVal;
  let step = 0;
  const interval = setInterval(() => {
    step++;
    if (step >= steps) {
      node.gain.value = targetValue;
      clearInterval(interval);
    } else {
      const t = step / steps;
      const ease = t * t * (3 - 2 * t);
      node.gain.value = currentVal + diff * ease;
    }
  }, stepMs);
}

export function duckAppAudio(durationMs = 1500) {
  const s = getSettings();
  if (!s.duckingEnabled) return;

  const profile = DUCK_PROFILES[s.duckingStrength] || DUCK_PROFILES.normal;

  // Duck the athlete's OWN music (phone player / Spotify / podcast) first. This
  // runs whether or not in-app music exists — it's the case that actually
  // matters today, since people train to their own playlist.
  duckExternalAudio(durationMs, profile);

  // In-app music (a Pro perk, not shipped yet) ducks through its gain node.
  if (!internalMusicNode) return;

  if (duckRestoreTimeout) {
    clearTimeout(duckRestoreTimeout);
  }
  if (preDuckVolume === null) {
    preDuckVolume = internalMusicNode.gain.value;
  }

  const duckedLevel = preDuckVolume * profile.factor;
  fadeGain(internalMusicNode, duckedLevel, profile.attackMs);

  duckRestoreTimeout = setTimeout(() => {
    if (internalMusicNode && preDuckVolume !== null) {
      fadeGain(internalMusicNode, preDuckVolume, profile.releaseMs);
    }
    preDuckVolume = null;
    duckRestoreTimeout = null;
  }, durationMs + profile.attackMs);
}

function loadBellBuffer() {
  if (bellBuffer || bellLoading) return;
  const ctx = getCtx();
  if (!ctx) return;
  bellLoading = true;
  fetch(BELL_SRC)
    .then(r => r.arrayBuffer())
    .then(buf => ctx.decodeAudioData(buf))
    .then(decoded => {
      bellBuffer = decoded;
      bellLoadQueue.forEach(fn => fn());
      bellLoadQueue = [];
    })
    .catch(() => { bellLoading = false; });
}

function playBellSegment(count) {
  const ctx = getCtx();
  if (!ctx || !bellBuffer) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const seg = BELL_SEGMENTS[count] || BELL_SEGMENTS[1];
  const vol = getCueGain();

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = bellBuffer;
  source.connect(gain);
  gain.connect(cueOut() || ctx.destination);
  gain.gain.value = vol;
  source.start(0, seg.start, seg.duration);
}

export function playBell(count = 1) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const seg = BELL_SEGMENTS[count] || BELL_SEGMENTS[1];
  duckAppAudio(Math.ceil(seg.duration * 1000) + 200);

  if (bellBuffer) {
    playBellSegment(count);
  } else {
    loadBellBuffer();
    bellLoadQueue.push(() => playBellSegment(count));
  }
}

function playTone(freq, duration, type, volume, startTime) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(cueOut() || ctx.destination);

  osc.type = type;
  osc.frequency.value = freq;

  const vol = volume * getCueGain();
  const t = startTime || ctx.currentTime;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.start(t);
  osc.stop(t + duration);
}

export function playBeep() {
  duckAppAudio(400);
  playTone(1200, 0.12, 'sine', 0.6, null);
}

// LT-2 — riser sting under the "RUSH MODE — GO!" call. Synthesised rather than
// shipped as an asset so it costs nothing in the bundle.
export function playRiser() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(cueOut() || ctx.destination);

  const t = ctx.currentTime;
  const peak = Math.max(0.0001, 0.32 * getCueGain());

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.5);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.34);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);

  osc.start(t);
  osc.stop(t + 0.7);
  duckAppAudio(800);
}

// Chase caught — a power-down: a sawtooth glide from 900 Hz to the floor with
// the filter closing as it falls, a sub thud under it and a snap of noise on
// the front. Synthesised in that spirit; not a sampled asset.
export function playPowerDown() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const t0 = ctx.currentTime;
  const dur = 0.55;
  const vol = Math.max(0.0001, 0.45 * getCueGain());
  const out = cueOut() || ctx.destination;

  // The glide.
  const osc = ctx.createOscillator();
  const filt = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(900, t0);
  osc.frequency.exponentialRampToValueAtTime(45, t0 + dur);
  filt.type = 'lowpass';
  filt.Q.value = 0.7;
  filt.frequency.setValueAtTime(2600, t0);
  filt.frequency.exponentialRampToValueAtTime(420, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(vol * 0.11, t0 + dur);
  gain.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.02);
  osc.connect(filt); filt.connect(gain); gain.connect(out);
  osc.start(t0); osc.stop(t0 + dur + 0.03);

  // The thud.
  const thud = ctx.createOscillator();
  const tg = ctx.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(55, t0);
  thud.frequency.exponentialRampToValueAtTime(30, t0 + 0.4);
  tg.gain.setValueAtTime(vol * 1.6, t0);
  tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
  thud.connect(tg); tg.connect(out);
  thud.start(t0); thud.stop(t0 + 0.46);

  // The snap.
  const len = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-60 * i / ctx.sampleRate);
  const src = ctx.createBufferSource();
  const ng = ctx.createGain();
  src.buffer = buf;
  ng.gain.value = vol * 0.5;
  src.connect(ng); ng.connect(out);
  src.start(t0);

  duckAppAudio(800);
}

// Chase escaped — a Genesis-style extra-life fanfare: a bright eight-note run
// into a held chord, with a short echo. Synthesised in that spirit; not a
// sampled asset.
export function playExtraLife() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const t0 = ctx.currentTime;
  const vol = Math.max(0.0001, 0.28 * getCueGain());
  const out = cueOut() || ctx.destination;

  // Dry + a two-tap echo, the way the console mixed it.
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(out);
  const delay = ctx.createDelay(0.5);
  delay.delayTime.value = 0.12;
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  bus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(out);

  const tone = (freq, at, dur, decay, level) => {
    [['square', 1, 1], ['sine', 2, 0.4]].forEach(([type, mul, amt]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq * mul;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(level * amt, at + 0.004);
      g.gain.setTargetAtTime(0.0001, at + 0.004, decay);
      osc.connect(g); g.connect(bus);
      osc.start(at); osc.stop(at + dur + decay * 3);
    });
  };

  // B4 D5 E5 F#5 B5 A5 F#5 A5, then B5 D6 F#6 held.
  const run = [493.88, 587.33, 659.25, 739.99, 987.77, 880, 739.99, 880];
  run.forEach((f, i) => tone(f, t0 + i * 0.09, 0.085, 0.09, vol));
  const chordAt = t0 + run.length * 0.09;
  [987.77, 1174.66, 1479.98].forEach(f => tone(f, chordAt, 0.6, 0.18, vol * 0.5));

  // Let the echo tail out, then close the bus.
  bus.gain.setValueAtTime(1, chordAt + 0.8);
  bus.gain.linearRampToValueAtTime(0.0001, chordAt + 1.1);
  duckAppAudio(1600);
}
