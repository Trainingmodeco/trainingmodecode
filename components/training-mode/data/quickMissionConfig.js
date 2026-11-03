import { CADENCE_PRESETS } from '../shared/CadenceSlider';

// The Quick Mission config, built in one place.
//
// It used to be assembled only inside QuickMissionSetup's START handler. The
// revamp lets the Fit hub start a mission in one tap — without the setup
// screen — so both doors now build it here and cannot drift. QuickMissionActive
// and its timer are untouched: they receive exactly the shape they always did.
export const QM_LENGTHS = [5, 10, 15, 20, 30];
export const QM_FOCI = ['FULL BODY', 'UPPER', 'LOWER', 'CORE', 'COMBAT'];
export const QM_INTENSITY = ['EASY', 'NORMAL', 'HARD'];
// The setup screen's GEAR key. Bodyweight is every caller's default, so the
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
// "No gear" for a bodyweight mission, the word its LOADOUT row uses.
export function quickMissionLine(cfg, { v2 = false } = {}) {
  const type = cfg.workoutType || 'Bodyweight';
  return `${cfg.duration} min · ${cfg.difficulty} · ${cfg.focus} · ${type === 'Bodyweight' && v2 ? 'No gear' : type}`;
}

// The setup screen's keys (GEAR · LEVEL · TIME · FOCUS), remembered per
// viewer. In the screen's own vocabulary: 'NORMAL' and 'FULL BODY', not the
// config's display forms. Anything unreadable comes back as the defaults.
export const QM_KEYS_KEY = 'tm_qm_keys_v1';
const KEY_DEFAULTS = { workoutType: 'Bodyweight', difficulty: 'NORMAL', duration: 10, focus: 'FULL BODY' };
function cleanKeys(k) {
  return {
    workoutType: QM_TYPES.includes(k?.workoutType) ? k.workoutType : KEY_DEFAULTS.workoutType,
    difficulty: QM_INTENSITY.includes(k?.difficulty) ? k.difficulty : KEY_DEFAULTS.difficulty,
    duration: QM_LENGTHS.includes(k?.duration) ? k.duration : KEY_DEFAULTS.duration,
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
