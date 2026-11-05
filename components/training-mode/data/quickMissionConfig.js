import { CADENCE_PRESETS } from '../shared/CadenceSlider';

// The Quick Mission config, built in one place.
//
// It used to be assembled only inside QuickMissionSetup's START handler. The
// revamp lets the Fit hub start a mission in one tap — without the setup
// screen — so both doors now build it here and cannot drift. QuickMissionActive
// and its timer are untouched: they receive exactly the shape they always did.
// The lengths the Fit hub's and Home's SURPRISE deal from.
export const QM_LENGTHS = [5, 10, 15, 20, 30];
// The setup screen's TIME slider: 10 to 60 minutes in 5-minute steps, with
// labels under these marks.
export const QM_TIME_MIN = 10;
export const QM_TIME_MAX = 60;
export const QM_TIME_STEP = 5;
export const QM_TIMES = Array.from({ length: (QM_TIME_MAX - QM_TIME_MIN) / QM_TIME_STEP + 1 }, (_, i) => QM_TIME_MIN + i * QM_TIME_STEP);
export const QM_TIME_TICKS = [10, 20, 30, 45, 60];
// Any number onto the slider: the nearest step, inside 10 to 60. null for
// anything that is not a number.
export function snapQuickMissionTime(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.min(QM_TIME_MAX, Math.max(QM_TIME_MIN, Math.round(n / QM_TIME_STEP) * QM_TIME_STEP));
}
export const QM_FOCI = ['FULL BODY', 'UPPER', 'LOWER', 'CORE', 'COMBAT'];
export const QM_INTENSITY = ['EASY', 'NORMAL', 'HARD'];
// The owner's words for the levels. 'NORMAL' stays the stored id (the
// generator, DIFFICULTY_CONFIG and saved sessions read it); MEDIUM is what
// the setup screen and its Mission Library print, on ADJUST and the tags.
export const QM_LEVEL_WORD = { EASY: 'EASY', NORMAL: 'MEDIUM', HARD: 'HARD' };
// The setup screen's GEAR. Bodyweight is every caller's default, so the
// hub, Home and Programs keep starting exactly what they did.
export const QM_TYPES = ['Bodyweight', 'Weighted', 'Hybrid'];

const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// focus/difficulty accept either the setup screen's chip labels ('FULL BODY',
// 'HARD') or the display form ('Full Body', 'Hard').
export function quickMissionConfig({ duration = 10, focus = 'Full Body', difficulty = 'Normal', workoutType = 'Bodyweight', cardioAddon = null } = {}) {
  const f = String(focus).toUpperCase();
  return {
    workoutType: QM_TYPES.includes(workoutType) ? workoutType : 'Bodyweight', duration,
    difficulty: cap(String(difficulty).toUpperCase()),
    focus: f === 'FULL BODY' ? 'Full Body' : cap(f), format: 'Auto',
    cardioFinisher: false, cadenceCount: true, cadencePreset: 'moderate',
    cadenceMs: CADENCE_PRESETS.moderate, voiceOn: true, cardioAddon,
  };
}

export function surpriseQuickMission() {
  return quickMissionConfig({ duration: rand(QM_LENGTHS), focus: rand(QM_FOCI), difficulty: rand(QM_INTENSITY) });
}

// "12 min · Easy · Full Body · Bodyweight" — the line the Fit hub prints under
// a mission, so what it says is what START runs. Quick Mission v2 says
// "No gear" for a bodyweight mission, the word its LOADOUT row uses. When START
// runs it AT YOUR PACE (the choice saved on the Quick Mission page) the line
// ends "· At your pace".
export function quickMissionLine(cfg, { v2 = false, atYourPace = false } = {}) {
  const type = cfg.workoutType || 'Bodyweight';
  return `${cfg.duration} min · ${cfg.difficulty} · ${cfg.focus} · ${type === 'Bodyweight' && v2 ? 'No gear' : type}${atYourPace ? ' · At your pace' : ''}`;
}

// The setup screen's choices, remembered per viewer: GEAR and TIME on the
// page, LEVEL and FOCUS behind ADJUST. In the screen's own vocabulary:
// 'NORMAL' and 'FULL BODY', not the config's display forms. Anything
// unreadable comes back as the defaults; a stored length from the old keys
// (5 to 30) lands on the nearest slider step.
export const QM_KEYS_KEY = 'tm_qm_keys_v1';
const KEY_DEFAULTS = { workoutType: 'Bodyweight', difficulty: 'NORMAL', duration: 20, focus: 'FULL BODY' };
function cleanKeys(k) {
  return {
    workoutType: QM_TYPES.includes(k?.workoutType) ? k.workoutType : KEY_DEFAULTS.workoutType,
    difficulty: QM_INTENSITY.includes(k?.difficulty) ? k.difficulty : KEY_DEFAULTS.difficulty,
    duration: snapQuickMissionTime(k?.duration) ?? KEY_DEFAULTS.duration,
    focus: QM_FOCI.includes(k?.focus) ? k.focus : KEY_DEFAULTS.focus,
  };
}
export function loadQuickMissionKeys() {
  try {
    const raw = localStorage.getItem(QM_KEYS_KEY);
    return cleanKeys(raw ? JSON.parse(raw) : null);
  } catch { return cleanKeys(null); }
}
export function saveQuickMissionKeys(keys) {
  const next = cleanKeys(keys);
  try { localStorage.setItem(QM_KEYS_KEY, JSON.stringify(next)); } catch { /* storage full or blocked */ }
  return next;
}
