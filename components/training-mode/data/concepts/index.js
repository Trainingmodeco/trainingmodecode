// Concept drops — themed programs released on a two-month cadence, each with
// a Fit program, a Fight program and an Arcade gauntlet.
//
//   • The CURRENT drop is free for everyone during its window.
//   • When the window ends it moves to the Concept Vault. Vault drops are Pro,
//     except that anyone who STARTED a drop during its window keeps it until
//     they finish.
//   • The limited reward (title + XP) can only be claimed inside the window.
//   • The owner can preview an unreleased drop: unlocking the private Strike
//     Lab sets OWNER_PREVIEW_KEY on that phone.
//
// This module is pure data + rules. Screens call it; it never renders.
import { FIT_MODE_EXERCISES } from '../../fit-mode/fitModeExerciseData';
import { isPro } from '../entitlements';
import { ULTRA_EGO, ULTRA_EGO_EXERCISES } from './ultraEgo';
import { SHOTO, SHOTO_EXERCISES } from './shoto';

const KEY = 'tm_concepts_v1';
export const OWNER_PREVIEW_KEY = 'tm_owner_preview';

// The release calendar. Dates are inclusive, local time.
// Keep it in date order: owner preview features the first upcoming drop.
export const CONCEPT_SCHEDULE = [
  { concept: SHOTO, start: '2026-10-19', end: '2026-11-30' },
  { concept: ULTRA_EGO, start: '2026-12-01', end: '2027-01-31' },
];

const EXTRA_EXERCISES = [...ULTRA_EGO_EXERCISES, ...SHOTO_EXERCISES];

// ── time ────────────────────────────────────────────────────────────────────
const dayStart = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 0, 0, 0, 0).getTime(); };
const dayEnd = (iso) => dayStart(iso) + 24 * 3600 * 1000 - 1;
export function windowState(entry, now = Date.now()) {
  if (now < dayStart(entry.start)) return 'upcoming';
  if (now > dayEnd(entry.end)) return 'vault';
  return 'live';
}
export function daysLeft(entry, now = Date.now()) {
  return Math.max(0, Math.ceil((dayEnd(entry.end) - now) / (24 * 3600 * 1000)));
}
export function fmtEnd(entry) {
  const [y, m, d] = entry.end.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function ownerPreview() {
  try { return localStorage.getItem(OWNER_PREVIEW_KEY) === '1'; } catch { return false; }
}
export function setOwnerPreview(on) {
  try { if (on) localStorage.setItem(OWNER_PREVIEW_KEY, '1'); else localStorage.removeItem(OWNER_PREVIEW_KEY); } catch { /* storage */ }
}
export function isOwnerPreview() { return ownerPreview(); }

// The drop to feature right now: the live one, or — for the owner only — the
// next upcoming one, so it can be checked before release.
export function featuredEntry(now = Date.now(), preview = ownerPreview()) {
  const live = CONCEPT_SCHEDULE.find(e => windowState(e, now) === 'live');
  if (live) return live;
  if (!preview) return null;
  return CONCEPT_SCHEDULE.find(e => windowState(e, now) === 'upcoming') || null;
}
export function vaultEntries(now = Date.now()) {
  return CONCEPT_SCHEDULE.filter(e => windowState(e, now) === 'vault');
}
export function entryFor(id) {
  return CONCEPT_SCHEDULE.find(e => e.concept.id === id) || null;
}

// ── progress ────────────────────────────────────────────────────────────────
function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function saveAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage */ }
}
export function loadProgress(id) {
  const p = loadAll()[id] || {};
  return {
    fitDone: p.fitDone || 0, fightDone: p.fightDone || 0, cleared: Array.isArray(p.cleared) ? p.cleared : [],
    startedAt: p.startedAt || null, popupSeen: !!p.popupSeen, rewardClaimedAt: p.rewardClaimedAt || null,
    tier: p.tier || 'normal', home: !!p.home,
  };
}
function update(id, fn) {
  const all = loadAll();
  const cur = { ...loadProgress(id), ...(all[id] || {}) };
  all[id] = fn(cur) || cur;
  saveAll(all);
  return loadProgress(id);
}
export function setPrefs(id, prefs) { return update(id, p => ({ ...p, ...prefs })); }
export function markPopupSeen(id) { return update(id, p => ({ ...p, popupSeen: true })); }
function markStarted(id, now) { return update(id, p => (p.startedAt ? p : { ...p, startedAt: new Date(now).toISOString() })); }

// ── structure ───────────────────────────────────────────────────────────────
export function fitTrainingDays(concept) { return concept.fit.days.filter(d => !d.rest); }
export function fitTotal(concept) { return fitTrainingDays(concept).length * concept.fit.weeks; }
export function fightTotal(concept) { return concept.fight.days.length * (concept.fight.weeks || 1); }
export function bossIndex(concept) { return concept.arcade.stages.findIndex(s => s.boss); }

export function status(concept, progress = loadProgress(concept.id)) {
  const fitComplete = progress.fitDone >= fitTotal(concept);
  const fightComplete = progress.fightDone >= fightTotal(concept);
  const b = bossIndex(concept);
  const bossUnlocked = fitComplete || fightComplete;
  const arcadeComplete = b >= 0 ? progress.cleared.includes(b) : progress.cleared.length >= concept.arcade.stages.length;
  const trainDays = fitTrainingDays(concept);
  return {
    fitComplete, fightComplete, arcadeComplete, bossUnlocked,
    fitWeek: Math.min(concept.fit.weeks, Math.floor(progress.fitDone / trainDays.length) + 1),
    fitNext: fitComplete ? null : progress.fitDone % trainDays.length,
    fightNext: fightComplete ? null : progress.fightDone % concept.fight.days.length,
    fightWeek: Math.min(concept.fight.weeks || 1, Math.floor(progress.fightDone / concept.fight.days.length) + 1),
    partsDone: [fitComplete, fightComplete, arcadeComplete].filter(Boolean).length,
  };
}

// Who may play it: live → everyone; vault → Pro, or anyone who started it
// inside its window and has not finished.
export function canPlay(entry, now = Date.now(), progress = loadProgress(entry.concept.id), pro = isPro()) {
  const w = windowState(entry, now);
  if (w === 'live') return true;
  if (w === 'upcoming') return ownerPreview();
  if (pro) return true;
  if (!progress.startedAt) return false;
  const st = status(entry.concept, progress);
  return new Date(progress.startedAt).getTime() <= dayEnd(entry.end) && st.partsDone < 3;
}

export function rewardState(entry, now = Date.now(), progress = loadProgress(entry.concept.id)) {
  const st = status(entry.concept, progress);
  const all = st.partsDone === 3;
  if (progress.rewardClaimedAt) return 'claimed';
  if (!all) return 'locked';
  return windowState(entry, now) === 'live' || ownerPreview() ? 'ready' : 'expired';
}
export function claimReward(id, now = Date.now()) {
  return update(id, p => ({ ...p, rewardClaimedAt: new Date(now).toISOString() }));
}

// ── Fit ─────────────────────────────────────────────────────────────────────
const LIB = new Map([...FIT_MODE_EXERCISES, ...EXTRA_EXERCISES].map(e => [e.name.toLowerCase(), e]));
const WEIGHTED = new Set(['dumbbell', 'barbell', 'kettlebell', 'medball', 'sandbag']);
const TIER = {
  easy: { sets: -1, reps: 0.75 },
  normal: { sets: 0, reps: 1 },
  hard: { sets: 1, reps: 1.15 },
};

export function scaleRow(row, tier = 'normal') {
  const t = TIER[tier] || TIER.normal;
  const sets = Math.max(2, (row.sets || 3) + t.sets);
  const out = { ...row, sets };
  if (row.reps) out.reps = Math.max(4, Math.round(row.reps * t.reps));
  if (row.seconds) out.seconds = Math.max(15, Math.round(row.seconds * t.reps));
  return out;
}

// One concept row → the exercise shape the Fit player runs.
export function toPlayerExercise(row, i) {
  const lib = LIB.get(row.name.toLowerCase()) || {};
  const weighted = WEIGHTED.has(row.equip);
  const primary = lib.primaryMuscle || 'Full Body';
  const note = row.note || lib.coachNote || '';
  return {
    id: lib.id || `concept_${row.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${i}`,
    name: row.name,
    primaryMuscle: primary,
    secondaryMuscles: lib.secondaryMuscles || [],
    sets: row.sets,
    reps: row.seconds ? `${row.seconds}s` : String(row.reps),
    durationSeconds: row.seconds || null,
    restSeconds: row.rest || 60,
    rest: `${row.rest || 60}s`,
    muscle: String(primary).toUpperCase(),
    equipment: weighted ? 'Weighted' : 'Bodyweight',
    difficulty: lib.difficulty || 'Normal',
    movementType: lib.movementType || 'Compound',
    trainingStyle: lib.trainingStyle || 'Strength',
    coachNote: note,
    voiceIntro: `${row.name}. ${note}`.trim(),
    voiceCountingType: lib.voiceCountingType || 'rep_count',
    voiceCadenceSeconds: lib.voiceCadenceSeconds || 2.5,
    tempo: lib.tempo || '',
    combatCarryover: lib.combatCarryover || '',
    videoUrl: lib.videoUrl || '',
    bodyMapRegion: lib.bodyMapRegion || primary,
  };
}

export function fitDayExercises(concept, dayIdx, { tier = 'normal', home = false } = {}) {
  const day = fitTrainingDays(concept)[dayIdx];
  if (!day) return [];
  return day.exercises.map((r, i) => {
    let row = r;
    if (home && WEIGHTED.has(r.equip) && r.swap) row = { ...r, name: r.swap, equip: 'bodyweight', note: `Home swap for ${r.name}.` };
    return toPlayerExercise(scaleRow(row, tier), i);
  });
}

// The cfg the Fit player takes (FitBuilderWorkout: savedExercises bypasses
// the generator). conceptSeq guards against double-counting on completion.
export function fitDayCfg(concept, { tier = 'normal', home = false, now = Date.now() } = {}) {
  const prog = loadProgress(concept.id);
  const st = status(concept, prog);
  const idx = st.fitNext ?? 0;
  const day = fitTrainingDays(concept)[idx];
  markStarted(concept.id, now);
  return {
    muscleGroups: [], equipment: home ? 'Bodyweight' : 'Hybrid', difficulty: tier === 'hard' ? 'Hard' : tier === 'easy' ? 'Easy' : 'Normal',
    focus: 'Strength', duration: concept.fit.minutes, cardioAddon: null, addCardio: false,
    savedExercises: fitDayExercises(concept, idx, { tier, home }),
    conceptId: concept.id, conceptKind: 'fit', conceptSeq: prog.fitDone, conceptDayLabel: day?.label || null,
    conceptTitle: `${concept.title} · ${day?.label || 'DAY'}`,
  };
}

// ── Fight + Arcade (both run on the Fight Focus timer) ─────────────────────
const FIGHT_DIFF = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

export function fightDayCfg(concept, { tier = 'normal', now = Date.now() } = {}) {
  const prog = loadProgress(concept.id);
  const idx = Math.min(prog.fightDone, fightTotal(concept) - 1) % concept.fight.days.length;
  const day = concept.fight.days[idx];
  const rest = day.restSec ?? concept.fight.restSec;
  markStarted(concept.id, now);
  return {
    difficulty: FIGHT_DIFF[tier] || 'Normal', mode: 'Fight Focus',
    rounds: day.rounds.length, roundMin: concept.fight.roundMin, restSec: rest,
    voiceOn: true, encouragement: 'normal', warmupMin: 3,
    rushMode: !!day.rush, rushPattern: 'perMin10', rushMix: 'explosive',
    // Combos are called by the timer on a 7–11 s cadence (comma-separated words).
    blockRounds: day.rounds.map(r => ({
      round_title: r.title, coach_prompt: r.prompt,
      ...(r.combos?.length ? { combos: r.combos } : {}),
      // A super is a 30 s rush at the end of the round with its own calls.
      ...(r.super ? { super: r.super, rush: { pattern: 'end30' } } : {}),
    })),
    archetypeName: `${concept.title} · ${day.label}`,
    conceptId: concept.id, conceptKind: 'fight', conceptSeq: prog.fightDone,
  };
}

export function stagePlayable(concept, stageIdx, progress = loadProgress(concept.id)) {
  const stage = concept.arcade.stages[stageIdx];
  if (!stage) return false;
  if (stage.boss) return status(concept, progress).bossUnlocked;
  return true;
}

export function stageCfg(concept, stageIdx, { tier = 'normal', now = Date.now() } = {}) {
  const stage = concept.arcade.stages[stageIdx];
  const { rounds, len, rest } = stage.plan;
  const list = stage.items.join(' · ');
  markStarted(concept.id, now);
  return {
    difficulty: FIGHT_DIFF[tier] || 'Normal', mode: 'Fight Focus',
    rounds, roundMin: Math.max(1, Math.round(len / 60)), restSec: rest,
    voiceOn: true, encouragement: 'normal', warmupMin: 3, rushMode: false,
    blockRounds: Array.from({ length: rounds }, (_, i) => ({
      round_title: rounds > 1 ? `${stage.title} · ${i + 1}/${rounds}` : stage.title,
      coach_prompt: stage.boss ? `For time: ${list}. Tap finish when the last rep is done.` : `${list}. Finish the station, rest what is left.`,
      length_sec: len, rest_sec: rest,
    })),
    archetypeName: `${concept.title} GAUNTLET · ${stage.title}`,
    conceptId: concept.id, conceptKind: 'arcade', conceptStage: stageIdx,
  };
}

// ── completion (called by the host after a session) ────────────────────────
// Fit counts at 75% of exercises; Fight at 75% of rounds; an Arcade stage
// only when every round is done.
export function recordConceptSession(cfg, done, total) {
  if (!cfg?.conceptId) return null;
  const d = Number(done) || 0, t = Math.max(1, Number(total) || 1);
  if (cfg.conceptKind === 'fit' && d >= Math.ceil(t * 0.75)) {
    return update(cfg.conceptId, p => (p.fitDone === cfg.conceptSeq ? { ...p, fitDone: p.fitDone + 1 } : p));
  }
  if (cfg.conceptKind === 'fight' && d >= Math.ceil(t * 0.75)) {
    return update(cfg.conceptId, p => (p.fightDone === cfg.conceptSeq ? { ...p, fightDone: p.fightDone + 1 } : p));
  }
  if (cfg.conceptKind === 'arcade' && d >= t) {
    return update(cfg.conceptId, p => (p.cleared.includes(cfg.conceptStage) ? p : { ...p, cleared: [...p.cleared, cfg.conceptStage] }));
  }
  return loadProgress(cfg.conceptId);
}

// ── the app-open pop-up ────────────────────────────────────────────────────
// Once per drop per phone, only while it is featured.
export function duePopup(now = Date.now()) {
  const e = featuredEntry(now);
  if (!e) return null;
  return loadProgress(e.concept.id).popupSeen ? null : e;
}
