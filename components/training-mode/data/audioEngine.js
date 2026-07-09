const STORAGE_KEY = 'tm_audio_settings';

const DEFAULTS = {
  masterVolume: 1.0,
  sfxVolume: 0.9,
  voiceVolume: 1.0,
  musicVolume: 0.6,
  duckingEnabled: true,
  duckingStrength: 'normal',
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
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    settings = stored ? { ...DEFAULTS, ...JSON.parse(stored) } : { ...DEFAULTS };
  } catch {
    settings = { ...DEFAULTS };
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
