const STORAGE_KEY = 'tm_arcade_progress';
const ACTIVE_CHALLENGE_KEY = 'tm_active_arcade_challenge';

function loadAll() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAll(data) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {}
}

function defaultProgress() {
  return {
    completedStages: {},
    unlockedStages: [1],
    currentStage: 1,
    xpEarned: 0,
    badges: [],
    statXp: {},
    attempts: [],
    lastCompletedStage: null,
    lastValidityStatus: null,
  };
}

export function getSeriesProgress(seriesId) {
  const all = loadAll();
  const raw = all[seriesId];
  if (!raw) return defaultProgress();
  if (!raw.unlockedStages) {
    raw.unlockedStages = buildUnlockedList(raw);
  }
  return { ...defaultProgress(), ...raw };
}

function buildUnlockedList(progress) {
  const completed = progress.completedStages || {};
  const completedIds = Object.keys(completed).filter(k => completed[k]?.completed);
  const unlocked = [1];
  for (let i = 2; i <= completedIds.length + 1; i++) {
    unlocked.push(i);
  }
  return unlocked;
}

export function markBlockComplete(seriesId, stageId, blockMode) {
  const all = loadAll();
  if (!all[seriesId]) all[seriesId] = defaultProgress();
  if (!all[seriesId].completedStages[stageId]) all[seriesId].completedStages[stageId] = {};
  all[seriesId].completedStages[stageId][blockMode] = true;
  saveAll(all);
  setActiveChallenge({ seriesId, stageId, selectedMode: blockMode, lastPlayedAt: Date.now() });
  return all[seriesId];
}

export function isStageComplete(seriesId, stageId, selectedMode) {
  const progress = getSeriesProgress(seriesId);
  const stageData = progress.completedStages[stageId];
  if (!stageData) return false;
  if (selectedMode === 'both') return stageData.fit === true && stageData.fight === true;
  return stageData[selectedMode] === true;
}

export function completeStage(seriesId, stageId, xpReward, badge, title, statRewards, result = {}) {
  const all = loadAll();
  if (!all[seriesId]) all[seriesId] = defaultProgress();
  const prev = all[seriesId].completedStages[stageId] || {};
  const entry = { fit: true, fight: true, completed: true, completedAt: Date.now() };
  // Persist the run time (best-of) and star rating (max-of) across clears.
  if (Number.isFinite(result.timeSeconds) && result.timeSeconds > 0) {
    entry.lastTimeSeconds = Math.round(result.timeSeconds);
    entry.bestTimeSeconds = Number.isFinite(prev.bestTimeSeconds)
      ? Math.min(prev.bestTimeSeconds, entry.lastTimeSeconds)
      : entry.lastTimeSeconds;
  } else if (Number.isFinite(prev.bestTimeSeconds)) {
    entry.bestTimeSeconds = prev.bestTimeSeconds;
    if (Number.isFinite(prev.lastTimeSeconds)) entry.lastTimeSeconds = prev.lastTimeSeconds;
  }
  if (Number.isFinite(result.stars) && result.stars > 0) {
    entry.stars = Math.max(prev.stars || 0, Math.min(3, Math.round(result.stars)));
  } else if (prev.stars) {
    entry.stars = prev.stars;
  }
  all[seriesId].completedStages[stageId] = entry;
  all[seriesId].xpEarned += (xpReward || 0);
  if (badge && !all[seriesId].badges.includes(badge)) all[seriesId].badges.push(badge);
  if (title) all[seriesId].title = title;

  if (statRewards) {
    if (!all[seriesId].statXp) all[seriesId].statXp = {};
    Object.entries(statRewards).forEach(([stat, val]) => {
      all[seriesId].statXp[stat] = (all[seriesId].statXp[stat] || 0) + val;
    });
  }

  const completedCount = Object.keys(all[seriesId].completedStages)
    .filter(k => all[seriesId].completedStages[k].completed)
    .length;
  all[seriesId].currentStage = completedCount + 1;
  all[seriesId].lastCompletedStage = stageId;
  all[seriesId].lastValidityStatus = 'valid';

  // Rebuild unlocked stages list
  const unlocked = [];
  for (let i = 1; i <= completedCount + 1; i++) {
    unlocked.push(i);
  }
  all[seriesId].unlockedStages = unlocked;

  if (!all[seriesId].attempts) all[seriesId].attempts = [];
  all[seriesId].attempts.push({ stageId, valid: true, xp: xpReward, at: Date.now() });
  if (all[seriesId].attempts.length > 100) all[seriesId].attempts.splice(0, all[seriesId].attempts.length - 100);

  saveAll(all);
  clearActiveChallenge();
  return all[seriesId];
}

export function recordInvalidAttempt(seriesId, stageId, reason) {
  const all = loadAll();
  if (!all[seriesId]) all[seriesId] = defaultProgress();
  all[seriesId].lastValidityStatus = 'invalid';
  if (!all[seriesId].attempts) all[seriesId].attempts = [];
  all[seriesId].attempts.push({ stageId, valid: false, reason, at: Date.now() });
  if (all[seriesId].attempts.length > 100) all[seriesId].attempts.splice(0, all[seriesId].attempts.length - 100);
  saveAll(all);
}

export function getHighestUnlockedStage(seriesId) {
  const progress = getSeriesProgress(seriesId);
  return progress.currentStage || 1;
}

export function isStageUnlocked(seriesId, stageNumber) {
  const highestUnlocked = getHighestUnlockedStage(seriesId);
  return stageNumber <= highestUnlocked;
}

export function getStageAttemptHistory(seriesId, stageId) {
  const progress = getSeriesProgress(seriesId);
  return (progress.attempts || []).filter(a => a.stageId === stageId);
}

export function getTotalSeriesXP(seriesId) {
  const progress = getSeriesProgress(seriesId);
  return progress.xpEarned || 0;
}

export function getStatXP(seriesId) {
  const progress = getSeriesProgress(seriesId);
  return progress.statXp || {};
}

export function setActiveChallenge(data) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTIVE_CHALLENGE_KEY, JSON.stringify({
        ...data,
        lastPlayedAt: data.lastPlayedAt || Date.now(),
      }));
    }
  } catch {}
}

export function getActiveChallenge() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ACTIVE_CHALLENGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearActiveChallenge() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACTIVE_CHALLENGE_KEY);
    }
  } catch {}
}

export function saveArcadeSettings(seriesId, settings) {
  const all = loadAll();
  if (!all[seriesId]) all[seriesId] = defaultProgress();
  all[seriesId].settings = settings;
  saveAll(all);
}

export function getArcadeSettings(seriesId) {
  const progress = getSeriesProgress(seriesId);
  return progress.settings || null;
}
