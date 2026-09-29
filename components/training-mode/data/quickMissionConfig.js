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

const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// focus/difficulty accept either the setup screen's chip labels ('FULL BODY',
// 'HARD') or the display form ('Full Body', 'Hard').
export function quickMissionConfig({ duration = 10, focus = 'Full Body', difficulty = 'Normal', cardioAddon = null } = {}) {
  const f = String(focus).toUpperCase();
  return {
    workoutType: 'Bodyweight', duration,
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
// a mission, so what it says is what START runs.
export function quickMissionLine(cfg) {
  return `${cfg.duration} min · ${cfg.difficulty} · ${cfg.focus} · Bodyweight`;
}
