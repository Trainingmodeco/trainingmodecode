const STORAGE_KEY = 'tm_audio_settings';

// LT-1 — cue-boost. A web PWA can't duck the phone's own music player, so the
// only lever we have is making our own cues as loud and clear as possible:
// voice and SFX both sit at full master. SETTINGS_VERSION bumps once so
// athletes who already had the quieter 0.9 mix get the boost too; anything
// they change after that is theirs and sticks.
const SETTINGS_VERSION = 2;

const DEFAULTS = {
  masterVolume: 1.0,
  sfxVolume: 1.0,
  voiceVolume: 1.0,
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

  // One-time cue-boost migration for mixes saved before LT-1. The version has
  // to be read off the STORED object — DEFAULTS carries the current version, so
  // checking the merged result would always look already-migrated.
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
export function setVoiceVolume(v) { saveAudioSettings({ voiceVolume: Math.max(0, Math.min(1, v)) }); }
export function setMusicVolume(v) { saveAudioSettings({ musicVolume: Math.max(0, Math.min(1, v)) }); }

export function getEffectiveVoiceVolume() {
  const s = getSettings();
  return Math.min(1, s.masterVolume * s.voiceVolume);
}

function getEffectiveSfxVolume() {
  const s = getSettings();
  return s.masterVolume * s.sfxVolume;
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
  if (!s.duckingEnabled || !internalMusicNode) return;

  const profile = DUCK_PROFILES[s.duckingStrength] || DUCK_PROFILES.normal;

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
  const vol = getEffectiveSfxVolume();

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = bellBuffer;
  source.connect(gain);
  gain.connect(ctx.destination);
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
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.value = freq;

  const vol = volume * getEffectiveSfxVolume();
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
  gain.connect(ctx.destination);

  const t = ctx.currentTime;
  const peak = Math.max(0.0001, 0.32 * getEffectiveSfxVolume());

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
