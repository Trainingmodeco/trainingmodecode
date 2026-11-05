import { CADENCE_PRESETS } from '../shared/CadenceSlider';
import { loadStats } from './userStats';
import { athleteTier, normalizeTier, rollSurpriseTier } from './athleteLevel';

// The Quick Mission config, built in one place.
//
// It used to be assembled only inside QuickMissionSetup's START handler. The
// revamp lets the Fit hub start a mission in one tap — without the setup
// screen — so both doors now build it here and cannot drift. QuickMissionActive
// and its timer are untouched: they receive exactly the shape they always did.
// The lengths the Fit hub's and Home's SURPRISE deal from.
export const QM_LENGTHS = [5, 10, 15, 20, 30];
// The setup screen's TIME slider: 5 to 60 minutes in 1-minute steps, with
// labels under these marks. Quick Mission is for short notice: a person with 8
// minutes slides to 8 and the workout is built for exactly that.
export const QM_TIME_MIN = 5;
export const QM_TIME_MAX = 60;
export const QM_TIME_STEP = 1;
export const QM_TIMES = Array.from({ length: (QM_TIME_MAX - QM_TIME_MIN) / QM_TIME_STEP + 1 }, (_, i) => QM_TIME_MIN + i * QM_TIME_STEP);
export const QM_TIME_TICKS = [5, 10, 15, 20, 30, 45, 60];
// Any number onto the slider: the nearest step, inside 5 to 60. null for
// anything that is not a number. (A length stored by the old 5-minute-step
// slider is already a step.)
export function snapQuickMissionTime(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return Math.min(QM_TIME_MAX, Math.max(QM_TIME_MIN, Math.round(n / QM_TIME_STEP) * QM_TIME_STEP));
}
export const QM_FOCI = ['FULL BODY', 'UPPER', 'LOWER', 'CORE', 'COMBAT'];
// The setup screen's LEVEL, easiest first (data/athleteLevel TIERS). The page
// opens on the athlete's own level and ADJUST lets them scale it either way.
export const QM_INTENSITY = ['EASY', 'NORMAL', 'HARD', 'ADVANCED'];
// The owner's words for the levels. 'NORMAL' stays the stored id (the
// generator, DIFFICULTY_CONFIG and saved sessions read it); MEDIUM is what
// the setup screen and its Mission Library print, on ADJUST and the tags.
export const QM_LEVEL_WORD = { EASY: 'EASY', NORMAL: 'MEDIUM', HARD: 'HARD', ADVANCED: 'ADVANCED' };
// Any stored form of a level ('Normal', 'NORMAL', 'Advanced') as the word the
// athlete reads, in capitals: NORMAL reads MEDIUM everywhere, so both runs and
// the hub name a level the same way. An unknown word comes back as it was.
export const levelWord = (d) => QM_LEVEL_WORD[String(d ?? '').toUpperCase()] || String(d ?? '').toUpperCase();
// The setup screen's GEAR. Bodyweight is every caller's default, so the
// hub, Home and Programs keep starting exactly what they did.
export const QM_TYPES = ['Bodyweight', 'Weighted', 'Hybrid'];

const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// focus/difficulty accept either the setup screen's chip labels ('FULL BODY',
// 'HARD') or the display form ('Full Body', 'Hard'). No difficulty at all
// starts on the athlete's own level (data/athleteLevel, the Fit side): level 1
// never gets a hard workout. `stats` is for a caller that already has them
// (and for tests); otherwise they are read from storage.
export function quickMissionConfig({ duration = 10, focus = 'Full Body', difficulty, workoutType = 'Bodyweight', cardioAddon = null, stats } = {}) {
  const f = String(focus).toUpperCase();
  const level = difficulty == null ? athleteTier(stats ?? loadStats(), 'fit') : (normalizeTier(difficulty) || String(difficulty).toUpperCase());
  return {
    workoutType: QM_TYPES.includes(workoutType) ? workoutType : 'Bodyweight', duration,
    difficulty: cap(level),
    focus: f === 'FULL BODY' ? 'Full Body' : cap(f), format: 'Auto',
    cardioFinisher: false, cadenceCount: true, cadencePreset: 'moderate',
    cadenceMs: CADENCE_PRESETS.moderate, voiceOn: true, cardioAddon,
  };
}

// The Fit hub's and Home's SURPRISE: a length, a focus and a level one step
// either side of the athlete's own (data/athleteLevel surpriseTiers), so a
// level 1 athlete is never dealt a hard workout.
export function surpriseQuickMission({ stats, rng = Math.random } = {}) {
  const start = athleteTier(stats ?? loadStats(), 'fit');
  return quickMissionConfig({
    duration: rand(QM_LENGTHS), focus: rand(QM_FOCI), difficulty: rollSurpriseTier(start, { rand: rng }), stats,
  });
}

// "12 min · Easy · Full Body · Bodyweight" — the line the Fit hub prints under
// a mission, so what it says is what START runs. Quick Mission v2 says
// "No gear" for a bodyweight mission, the word its LOADOUT row uses. When START
// runs it AT YOUR PACE (the choice saved on the Quick Mission page) the line
// ends "· At your pace". Those last words, and the dot before them, are held
// together with no-break spaces, so a narrow card wraps before the dot and
// "At your pace" arrives whole (never "· " at the end of a line).
export function quickMissionLine(cfg, { v2 = false, atYourPace = false } = {}) {
  const type = cfg.workoutType || 'Bodyweight';
  const level = levelWord(cfg.difficulty);
  // With the tail on, "No gear" is held together too, so a wrap never lands between its words.
  const gear = type === 'Bodyweight' && v2 ? (atYourPace ? 'No\u00A0gear' : 'No gear') : type;
  return `${cfg.duration} min · ${level.charAt(0)}${level.slice(1).toLowerCase()} · ${cfg.focus} · ${gear}${atYourPace ? ' \u00B7\u00A0At\u00A0your\u00A0pace' : ''}`;
}

// The setup screen's choices, remembered per viewer: GEAR and TIME on the
// page, FOCUS behind ADJUST. In the screen's own vocabulary: 'FULL BODY', not
// the config's display form. LEVEL is not remembered: the page opens on the
// athlete's own level (data/athleteLevel), so it keeps tracking their
// progress, and a pick in ADJUST lasts for that visit. A `difficulty` an
// older version stored still reads back as one of the four levels (harmless:
// the page ignores it). Anything unreadable comes back as the defaults; a
// stored length lands on the nearest slider step.
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
