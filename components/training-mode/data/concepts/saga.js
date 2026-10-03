// A concept's Arcade gauntlet as a saga on the original Training Arcade
// ladder. The ladder pop-up offers FIT / FIGHT / BOTH per stage; the stage
// then runs that path's stations (data/concepts stageCfg). Stages unlock in
// order and get harder as you climb — no difficulty picker.
import { CONCEPT_SCHEDULE, entryFor, windowState, canPlay, loadProgress, arcStages, arcsCleared, featuredEntry, stageItems, arcadeGate } from './index';
import { getSeriesProgress } from '../arcadeProgress';
import { isPro } from '../entitlements';

const ARC_OF = { fit: 'fit', fight: 'fight', both: 'hybrid' };
const MODE_OF = { fit: 'fit', fight: 'fight', hybrid: 'both' };

export function conceptSagaId(conceptId) { return `concept-${conceptId}`; }

export function conceptSaga(conceptId) {
  const entry = entryFor(conceptId);
  if (!entry) return null;
  const c = entry.concept;
  const tier = loadProgress(c.id).tier || 'normal';
  const gate = arcadeGate(c);
  const stages = c.arcade.stages.map((s, i) => ({
    id: `${c.id}-stg-${i + 1}`,
    stageNumber: i + 1,
    title: s.title.replace(/^BOSS · /, ''),
    isFinalRound: !!s.boss,
    isBoss: !!s.boss,
    // What each path runs at this stage — the pop-up lists the chosen one.
    pathItems: Object.fromEntries(['fit', 'fight', 'both'].map(m => {
      const st = arcStages(c, ARC_OF[m])[i];
      return [m, { format: st.format, items: stageItems(st, tier) }];
    })),
  }));
  return {
    id: conceptSagaId(c.id),
    conceptId: c.id,
    title: c.title,
    subtitle: `${c.title} Gauntlet · Concept Drop`,
    description: c.tagline,
    // The gauntlet opens once the Fit or the Fight program is done.
    // Opens after week 1 of Fit or Fight; each stage then needs more workouts.
    ...(gate.open ? { status: 'active', isActive: true } : { status: 'locked', isActive: false, lockNote: 'FINISH WEEK 1' }),
    maxUnlocked: gate.allowed,
    gateNote: gate.nextNote,
    isImported: true,
    type: 'Fit / Fight / Hybrid',
    difficultyStars: 4,
    availableModes: ['fit', 'fight', 'both'],
    modeOptions: ['fit', 'fight', 'both'],
    poster: c.art.arcade || c.art.card,
    rewards: { badge: `${c.title} Badge`, title: c.reward.title, xp: 500 },
    stages,
  };
}

// Ladder progress for a concept saga, read from the concept's own record.
export function conceptSagaProgress(conceptId) {
  const entry = entryFor(conceptId);
  const completedStages = {};
  if (entry) {
    const p = loadProgress(conceptId);
    entry.concept.arcade.stages.forEach((_, i) => {
      if (!p.cleared.includes(i)) return;
      const paths = arcsCleared(p, i).map(a => MODE_OF[a]);
      completedStages[`${conceptId}-stg-${i + 1}`] = { completed: true, stars: Math.max(1, paths.length), paths };
    });
  }
  return { completedStages, unlockedStages: [], currentStage: 1, xpEarned: 0, badges: [] };
}

// Sagas shown in the Arcade carousel: the featured drop (live, or the owner's
// preview), then vault drops this athlete can still play.
// Older Arcade sagas a drop replaces. Once the drop goes live they leave the
// carousel — except for Pro (the vault keeps everything) and anyone who
// already cleared a stage in them.
const REPLACES = { 'ultra-ego': 'destroyer-protocol', 'flow-state': 'flow-state-protocol', 'one-hundred': 'one-punch-protocol', 'night-vigilante': 'vigilante-protocol' };
export function retiredSagaIds(now = Date.now(), hasProgress = sagaHasProgress, pro = isPro()) {
  if (pro) return new Set();
  return new Set(CONCEPT_SCHEDULE
    .filter(e => REPLACES[e.concept.id] && windowState(e, now) !== 'upcoming' && !hasProgress(REPLACES[e.concept.id]))
    .map(e => REPLACES[e.concept.id]));
}
function sagaHasProgress(id) {
  return Object.values(getSeriesProgress(id).completedStages || {}).some(x => x?.completed);
}

export function conceptSagasForCarousel(now = Date.now()) {
  const out = [];
  const f = featuredEntry(now);
  if (f) out.push(conceptSaga(f.concept.id));
  CONCEPT_SCHEDULE.forEach(e => {
    if (windowState(e, now) === 'vault' && canPlay(e, now) && !out.some(s => s.conceptId === e.concept.id)) out.push(conceptSaga(e.concept.id));
  });
  return out.filter(Boolean);
}
