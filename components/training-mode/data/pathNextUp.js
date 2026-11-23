// The path + stars (retention feature 2): Home's NEXT UP row reads the real
// stores here, and a tap on it opens the saga or the camp on its current node.
// Nothing here writes to storage: the "open on the current node" request is a
// one-shot kept in memory until the screen it names takes it.
import { nextUpFrom, stageStars, endStarsLine } from './pathStars';
import { CAMPAIGN_SERIES } from './arcadeCampaignSeries';
import { loadLastSession } from './lastSession';
import { getSeriesById, isSeriesPlayable } from './trainingArcadeData';
import { getSeriesProgress } from './arcadeProgress';
import { conceptSaga, conceptSagaProgress, retiredSagaIds } from './concepts/saga';
import { loadCampProgress, isCampComplete } from './campProgress';
import { loadCampSessions } from './campSessions';
import { campLevels } from '../protocol/content';
import { loadStats } from './userStats';
import { campLevelStars, campKind, campEndStars } from './campStars';

const seriesFor = ({ seriesId, conceptId }) => {
  if (conceptId) return conceptSaga(conceptId);
  const s = getSeriesById(seriesId);
  return s && !retiredSagaIds().has(s.id) ? s : null;
};
const progressFor = (series) => (series.conceptId ? conceptSagaProgress(series.conceptId) : getSeriesProgress(series.id));
const campNow = () => ({ levels: campLevels, current: loadCampProgress(), campDone: isCampComplete(), sessions: loadCampSessions() });

export function loadNextUp(last = loadLastSession()) {
  try {
    return nextUpFrom(last, { series: seriesFor, progress: progressFor, playable: isSeriesPlayable, camp: campNow });
  } catch { return null; }
}

// "Open on the current node": asked for by the NEXT UP tap, taken once by
// the saga (its series id) or the camp ('camp') when it mounts.
let focus = null;
export function requestPathFocus(key) { focus = { key, at: Date.now() }; }
export function takePathFocus(key) {
  if (!focus || focus.key !== key || Date.now() - focus.at > 15000) return false;
  focus = null;
  return true;
}

// The NEXT UP tap: the saga (with the settings it last ran with, like Home's
// Continue) or the camp, asked to open on its current node.
export function openNextUp(next, { goArcadeDetail, goTrainingCamp }) {
  if (!next) return;
  if (next.kind === 'camp') { requestPathFocus('camp'); goTrainingCamp?.(next.disc); return; }
  const series = seriesFor({ seriesId: next.seriesId, conceptId: next.conceptId });
  if (!series) return;
  const last = loadLastSession();
  requestPathFocus(series.id);
  goArcadeDetail?.(series, last?.kind === 'arcade' && last.cfg?.seriesId === series.id ? last.cfg.settings || null : null);
}

// The end screens' stars row: the stage's stars as stored after this clear.
// An arcade v2 stage (camp_complete's arcade result) and a concept stage (its
// Fight Focus cfg). null when the stage has no stars or is not cleared.
export function arcadeEndStars({ campaignId, stageNumber }) {
  try {
    const series = CAMPAIGN_SERIES.find((s) => s.v2Campaign === campaignId);
    const stage = series?.stages?.[(stageNumber || 1) - 1];
    if (!stage) return null;
    return endStars(series, stage, getSeriesProgress(series.id).completedStages?.[stage.id]);
  } catch { return null; }
}
export function conceptEndStars(cfg) {
  try {
    if (cfg?.conceptKind !== 'arcade' || !cfg.conceptId) return null;
    const series = conceptSaga(cfg.conceptId);
    const stage = series?.stages?.[Number(cfg.conceptStage) || 0];
    if (!stage) return null;
    return endStars(series, stage, conceptSagaProgress(cfg.conceptId).completedStages?.[stage.id]);
  } catch { return null; }
}
// The concept stage's end screen asks here with this session's own result:
// the row shows only for a session that ran every round and passed, paid XP
// and was not refused. A replay of a stage cleared on an earlier day that
// fails validation (or pays nothing) shows no stars: only finished, valid
// sessions move anything.
export function conceptSessionStars(cfg, { completed, total, outcome, refused, xp } = {}) {
  if (outcome !== 'pass' || refused || !(Number(xp) > 0)) return null;
  if (!(Number(completed) >= Math.max(1, Number(total) || 1))) return null;
  return conceptEndStars(cfg);
}
function endStars(series, stage, entry) {
  const info = stageStars(series, stage, entry);
  if (!info.cleared || !info.max || info.stars == null) return null;
  return { stars: info.stars, max: info.max, line: endStarsLine(info) };
}

// The camp's end screen (camp_complete, not an arcade stage): the level's
// stars from the session rows, banked just before this screen, for a valid
// session on a cleared level (a first clear, or a replay). A replayed
// Session 1 (`replayS1`) says when its Session 2 counts. null otherwise.
export function campSessionEndStars(r, rows = loadStats().sessions) {
  try {
    if (!r || r.arcade || !r.sessionValid) return null;
    const lv = campLevels.find((l) => l.level === r.level);
    if (!lv) return null;
    const current = loadCampProgress();
    const campDone = isCampComplete();
    const cleared = lv.level < current || (campDone && lv.level >= current);
    if (!cleared) return null;
    const info = campLevelStars({ level: lv.level, kind: campKind(lv), cleared, rows });
    return campEndStars(info, { justS1: !!r.replayS1 });
  } catch { return null; }
}
