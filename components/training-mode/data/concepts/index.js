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
import { loadRuns, runMeters } from '../runLog';
import { ULTRA_EGO, ULTRA_EGO_EXERCISES } from './ultraEgo';
import { SHOTO, SHOTO_EXERCISES } from './shoto';
import { NIGHT_VIGILANTE, NIGHT_VIGILANTE_EXERCISES } from './nightVigilante';
import { FLOW_STATE, FLOW_STATE_EXERCISES } from './flowState';
import { ONE_HUNDRED, ONE_HUNDRED_EXERCISES } from './oneHundred';

const KEY = 'tm_concepts_v1';
export const OWNER_PREVIEW_KEY = 'tm_owner_preview';

// The release calendar. Dates are inclusive, local time.
// Keep it in date order: owner preview features the first upcoming drop.
export const CONCEPT_SCHEDULE = [
  { concept: SHOTO, start: '2026-10-19', end: '2026-11-30' },
  { concept: ULTRA_EGO, start: '2026-12-01', end: '2027-01-31' },
  { concept: FLOW_STATE, start: '2027-02-01', end: '2027-03-31' },
  { concept: ONE_HUNDRED, start: '2027-04-01', end: '2027-05-31' },
  // Over Batman Day (third Saturday of September: Sep 18, 2027).
  { concept: NIGHT_VIGILANTE, start: '2027-08-01', end: '2027-09-30' },
];

const EXTRA_EXERCISES = [...ULTRA_EGO_EXERCISES, ...SHOTO_EXERCISES, ...NIGHT_VIGILANTE_EXERCISES, ...FLOW_STATE_EXERCISES, ...ONE_HUNDRED_EXERCISES];

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
    tier: p.tier || 'normal', home: !!p.home, clearedBy: p.clearedBy || {},
    rungs: p.rungs || {}, ladderHits: p.ladderHits || {}, pendingRun: p.pendingRun || null,
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
// The Fit library wins over a concept's own row of the same name (it carries
// the real id and video); concept rows only fill the gaps.
const LIB = new Map([...EXTRA_EXERCISES, ...FIT_MODE_EXERCISES].map(e => [e.name.toLowerCase(), e]));
const WEIGHTED = new Set(['dumbbell', 'barbell', 'kettlebell', 'medball', 'sandbag']);
const TIER = {
  easy: { sets: -1, reps: 0.75 },
  normal: { sets: 0, reps: 1 },
  hard: { sets: 1, reps: 1.15 },
};

export function scaleRow(row, tier = 'normal') {
  // A tier's own alternate (row.easy / row.hard) is already written for that
  // tier — use its numbers as they are.
  if (row.fixed) return { ...row, sets: Math.max(1, row.sets || 3) };
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

// ── Skill ladders ───────────────────────────────────────────────────────────
// A concept may define `ladders: { id: { title, rungs: [row…], start: { easy,
// normal, hard } } }`. A Fit row with `ladder: id` runs the athlete's current
// rung: their saved rung, else the tier's starting rung. Hitting a rung's
// target twice moves them up one (self-reported on the concept page).
function rungIndex(concept, id, tier, progress) {
  const l = concept.ladders?.[id];
  if (!l) return -1;
  const saved = progress?.rungs?.[id];
  const i = Number.isInteger(saved) ? saved : (l.start?.[tier] ?? l.start?.normal ?? 0);
  return Math.max(0, Math.min(l.rungs.length - 1, i));
}
export function rungTarget(r) {
  return `${r.sets} × ${r.seconds ? `${r.seconds} s` : r.reps}`;
}
export function ladderState(concept, { tier = 'normal', progress = loadProgress(concept.id) } = {}) {
  return Object.entries(concept.ladders || {}).map(([id, l]) => {
    const idx = rungIndex(concept, id, tier, progress);
    return { id, title: l.title, idx, total: l.rungs.length, rung: l.rungs[idx], next: l.rungs[idx + 1] || null, hits: progress.ladderHits?.[id] || 0, target: rungTarget(l.rungs[idx]) };
  });
}
const HITS_TO_MOVE_UP = 2;
export function ladderHit(concept, id, tier = 'normal') {
  return update(concept.id, p => {
    const idx = rungIndex(concept, id, tier, p);
    const hits = (p.ladderHits?.[id] || 0) + 1;
    const top = concept.ladders[id].rungs.length - 1;
    const up = hits >= HITS_TO_MOVE_UP && idx < top;
    return { ...p, rungs: { ...(p.rungs || {}), [id]: up ? idx + 1 : idx }, ladderHits: { ...(p.ladderHits || {}), [id]: up ? 0 : Math.min(hits, HITS_TO_MOVE_UP) } };
  });
}
export function ladderStep(concept, id, dir, tier = 'normal') {
  return update(concept.id, p => {
    const idx = rungIndex(concept, id, tier, p);
    const n = Math.max(0, Math.min(concept.ladders[id].rungs.length - 1, idx + (dir < 0 ? -1 : 1)));
    return { ...p, rungs: { ...(p.rungs || {}), [id]: n }, ladderHits: { ...(p.ladderHits || {}), [id]: 0 } };
  });
}

export function fitDayExercises(concept, dayIdx, { tier = 'normal', home = false, progress = loadProgress(concept.id) } = {}) {
  const day = fitTrainingDays(concept)[dayIdx];
  if (!day?.exercises) return [];
  return day.exercises.map((r, i) => {
    // A ladder row runs the athlete's rung; otherwise the tier alternate
    // (row.easy = beginner, row.hard = advanced); then the home version.
    const lad = r.ladder ? concept.ladders?.[r.ladder] : null;
    const alt = lad ? lad.rungs[rungIndex(concept, r.ladder, tier, progress)] : r[tier];
    let row = alt ? { ...r, ...alt, fixed: true } : r;
    if (home && row.home) row = { ...row, ...row.home, note: row.home.note || `Home version of ${row.name}.` };
    else if (home && WEIGHTED.has(row.equip) && row.swap) row = { ...row, name: row.swap, equip: 'bodyweight', note: `Home swap for ${row.name}.` };
    const ex = toPlayerExercise(scaleRow(row, tier), i);
    // A circuit (row.circuit) chains its rows in the Fit player.
    return r.circuit ? { ...ex, _chain: `concept-${r.circuit}` } : ex;
  });
}

// ── Run days ───────────────────────────────────────────────────────────────
// A Fit day may be a run: `{ run: { km | mi: { easy, normal, hard } } }`,
// each a number or a per-week array. It opens Cardio Mode with the distance
// set and counts once a logged run after the start covers 90% of it.
export function runTarget(concept, day, tier = 'normal', week = 1) {
  const unit = day.run.mi ? 'mi' : 'km';
  const t = (day.run[unit] || {})[tier] ?? (day.run[unit] || {}).normal;
  const v = Array.isArray(t) ? t[Math.min(t.length, Math.max(1, week)) - 1] : t;
  return { goal: Number(v) || 0, unit };
}
const M_PER = { km: 1000, mi: 1609.344 };
export function settleConceptRun(conceptId, runs = loadRuns()) {
  const p = loadProgress(conceptId);
  const pr = p.pendingRun;
  if (!pr || p.fitDone !== pr.seq) return p;
  const need = pr.goal * M_PER[pr.unit] * 0.9;
  const hit = runs.find(r => (r.at || 0) >= pr.at && runMeters(r) >= need);
  if (!hit) return p;
  return update(conceptId, q => ({ ...q, fitDone: q.fitDone === pr.seq ? q.fitDone + 1 : q.fitDone, pendingRun: null }));
}

// The cfg the Fit player takes (FitBuilderWorkout: savedExercises bypasses
// the generator). conceptSeq guards against double-counting on completion.
export function fitDayCfg(concept, { tier = 'normal', home = false, now = Date.now() } = {}) {
  const prog = loadProgress(concept.id);
  const st = status(concept, prog);
  const idx = st.fitNext ?? 0;
  const day = fitTrainingDays(concept)[idx];
  markStarted(concept.id, now);
  if (day?.run) {
    const t = runTarget(concept, day, tier, st.fitWeek);
    update(concept.id, p => ({ ...p, pendingRun: { seq: prog.fitDone, at: now, ...t } }));
    return { conceptRun: true, ...t, conceptId: concept.id, conceptKind: 'fit', conceptSeq: prog.fitDone, conceptDayLabel: day.label, conceptTitle: `${concept.title} · ${day.label}` };
  }
  const circuits = Object.fromEntries(Object.entries(day?.circuits || {}).map(([k, v]) => [`concept-${k}`, Math.max(2, Math.min(5, v[tier] ?? v.normal ?? 3))]));
  return {
    chainRounds: circuits,
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
  // A beginner tier (fight.easy) may run fewer, shorter rounds; the last
  // round (it carries the super) always stays.
  const easy = tier === 'easy' ? concept.fight.easy : null;
  const max = easy?.maxRounds;
  const rounds = max && day.rounds.length > max ? [...day.rounds.slice(0, max - 1), day.rounds[day.rounds.length - 1]] : day.rounds;
  markStarted(concept.id, now);
  return {
    difficulty: FIGHT_DIFF[tier] || 'Normal', mode: 'Fight Focus',
    rounds: rounds.length, roundMin: easy?.roundMin ?? concept.fight.roundMin, restSec: rest,
    voiceOn: true, encouragement: 'normal', warmupMin: 3,
    rushMode: !!day.rush, rushPattern: 'perMin10', rushMix: 'explosive',
    // Combos are called by the timer on a 7–11 s cadence (comma-separated words).
    blockRounds: rounds.map(r => {
      const combos = (tier === 'easy' && r.easyCombos) || r.combos;
      const sup = r.super && tier === 'easy' && r.super.easy ? { ...r.super, ...r.super.easy } : r.super;
      return {
        round_title: r.title, coach_prompt: r.prompt,
        ...(combos?.length ? { combos } : {}),
        // A super is a 30 s rush at the end of the round with its own calls.
        ...(sup ? { super: sup, rush: { pattern: 'end30' } } : {}),
        // Multiple opponents: the timer calls SWITCH / PIVOT on a cadence.
        ...(r.multi ? { multi: true } : {}),
      };
    }),
    archetypeName: `${concept.title} · ${day.label}`,
    conceptId: concept.id, conceptKind: 'fight', conceptSeq: prog.fightDone,
  };
}

// The gauntlet's three arcs: same 10-stage ladder, three ways to play it.
export const ARCS = [
  { id: 'fit', label: 'TRAINING ARC', sub: 'Fitness only' },
  { id: 'fight', label: 'TOURNAMENT ARC', sub: 'Striking, a little fitness' },
  { id: 'hybrid', label: 'FINAL ARC', sub: 'Fit × fight, both' },
];
export function arcStages(concept, arc = 'hybrid') {
  return (arc === 'fit' || arc === 'fight') && concept.arcade[arc] ? concept.arcade[arc] : concept.arcade.stages;
}
export function arcsCleared(progress, stageIdx) {
  const by = progress.clearedBy || {};
  return ARCS.filter(a => (by[a.id] || []).includes(stageIdx)).map(a => a.id);
}

export function stagePlayable(concept, stageIdx, progress = loadProgress(concept.id)) {
  const stage = concept.arcade.stages[stageIdx];
  if (!stage) return false;
  if (stage.boss) return status(concept, progress).bossUnlocked;
  return true;
}

// A stage's stations for a tier: the beginner list when the stage has one.
export function stageItems(stage, tier = 'normal') {
  return (tier === 'easy' && stage.easyItems) || stage.items;
}

export function stageCfg(concept, stageIdx, { tier = null, now = Date.now(), arc = 'hybrid' } = {}) {
  const stage = arcStages(concept, arc)[stageIdx];
  const arcLabel = ARCS.find(a => a.id === arc)?.label || 'FINAL ARC';
  const { rounds, len, rest } = stage.plan;
  const t = tier || loadProgress(concept.id).tier || 'normal';
  const list = stageItems(stage, t).join(' · ');
  markStarted(concept.id, now);
  return {
    difficulty: FIGHT_DIFF[t] || 'Normal', mode: 'Fight Focus',
    rounds, roundMin: Math.max(1, Math.round(len / 60)), restSec: rest,
    voiceOn: true, encouragement: 'normal', warmupMin: 3, rushMode: false,
    blockRounds: Array.from({ length: rounds }, (_, i) => ({
      round_title: rounds > 1 ? `${stage.title} · ${i + 1}/${rounds}` : stage.title,
      coach_prompt: stage.boss ? `For time: ${list}. Tap finish when the last rep is done.` : `${list}. Finish the station, rest what is left.`,
      length_sec: len, rest_sec: rest,
      ...(stage.multi ? { multi: true } : {}),
    })),
    archetypeName: `${concept.title} · ${arcLabel} · ${stage.title}`,
    conceptId: concept.id, conceptKind: 'arcade', conceptStage: stageIdx, conceptArc: arc,
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
    // A stage counts as cleared in any arc; each arc keeps its own marks.
    return update(cfg.conceptId, p => {
      const arc = cfg.conceptArc || 'hybrid';
      const by = { ...(p.clearedBy || {}) };
      by[arc] = (by[arc] || []).includes(cfg.conceptStage) ? by[arc] : [...(by[arc] || []), cfg.conceptStage];
      const cleared = p.cleared.includes(cfg.conceptStage) ? p.cleared : [...p.cleared, cfg.conceptStage];
      return { ...p, cleared, clearedBy: by };
    });
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
