// Item 10b — where achievements actually get awarded.
//
// Deliberately hangs off events the app ALREADY fires rather than adding new
// plumbing: a session finishing, a stage clearing, a ghost battle resolving.
// Each function is safe to call more than once — award() is idempotent — and
// each returns only the achievements newly unlocked by this call, so the caller
// can show exactly one toast per real unlock.
import { award, awardMany, hasEarned } from './achievements';
import { loadStats, getStreak } from './userStats';
import { highestCleared } from './arcadeCampaignProgress';
import { getCampaign, campaignStages } from '../protocol/campaigns';

// Universal family ids, from protocol/data/achievements.json.
const FIT_CLEAR = 'ACH_FIT_CLEAR';
const FIGHT_CLEAR = 'ACH_FIGHT_CLEAR';
const FULL_ARC_CLEAR = 'ACH_FULL_ARC_CLEAR';
const PERFECT_DEFENSE = 'ACH_PERFECT_DEFENSE';
const TACTICAL_BOSS = 'ACH_TACTICAL_BOSS';
const CONSISTENCY = 'ACH_CONSISTENCY';

// "Train on schedule for 4 consecutive weeks" — 28 days of streak is the
// closest honest reading of that trigger with the data userStats keeps.
const CONSISTENCY_DAYS = 28;

/**
 * A session finished anywhere in the app.
 * @returns {Array} newly unlocked achievements
 */
export function onSessionComplete({ outcome, path, cleanTechnique = false } = {}) {
  const unlocked = [];
  if (outcome !== 'pass') return unlocked;

  // Consistency is streak-based, so it can fire off any completed session.
  if (!hasEarned(CONSISTENCY) && getStreak(loadStats()) >= CONSISTENCY_DAYS) {
    const a = award(CONSISTENCY);
    if (a) unlocked.push(a);
  }
  if (cleanTechnique && path === 'fight') {
    const a = award(PERFECT_DEFENSE);
    if (a) unlocked.push(a);
  }
  return unlocked;
}

/**
 * An Arcade stage cleared. Fires the campaign's own stage achievements (their
 * trigger text names the stage number) and, on the final stage, the campaign
 * clears.
 * @returns {Array} newly unlocked achievements
 */
export function onStageClear({ campaignId, stageNumber, path, outcome, tacticalClean = false } = {}) {
  const unlocked = [];
  if (!campaignId || outcome !== 'pass') return unlocked;

  const campaign = getCampaign(campaignId);
  const stages = campaignStages(campaignId);
  const isFinal = stages.length > 0 && stageNumber >= stages[stages.length - 1].stage_number;

  // Campaign achievements whose trigger text names this stage. The triggers are
  // prose — "Clear the Katsumi karate stage (4) with form intact", "Clear both
  // Young Baki stages (1-2)", "Defeat Stage 10 (Yujiro)" — so pull out every
  // stage number mentioned and require ALL of them to be cleared. That stops
  // "(1-2)" firing the moment stage 1 is done, and it fires on the clear that
  // actually completes the set.
  const cleared = highestCleared(campaignId);
  for (const a of campaign?.achievements || []) {
    const trigger = String(a.trigger || '');
    if (/all \d+ stages|across the campaign|every/i.test(trigger)) continue; // campaign-wide, handled on clear
    const nums = (trigger.match(/\d+/g) || []).map(Number).filter((n) => n >= 1 && n <= 99);
    if (!nums.length) continue;
    if (!nums.includes(stageNumber)) continue;      // not about the stage just finished
    if (Math.max(...nums) > cleared) continue;      // a later stage in the set is still outstanding
    const got = award(a.id);
    if (got) unlocked.push(got);
  }

  if (isFinal) {
    unlocked.push(...onCampaignClear({ campaignId, path, tacticalClean }));
  }
  return unlocked;
}

/**
 * Every stage of a campaign is behind us. Awards the path-clear family and any
 * campaign achievement whose trigger is campaign-wide.
 * @returns {Array} newly unlocked achievements
 */
export function onCampaignClear({ campaignId, path, tacticalClean = false } = {}) {
  const unlocked = [];
  const campaign = getCampaign(campaignId);
  const stages = campaignStages(campaignId);
  const cleared = highestCleared(campaignId);
  const complete = stages.length > 0 && cleared >= stages[stages.length - 1].stage_number;
  if (!complete) return unlocked;

  const familyId = path === 'fit' ? FIT_CLEAR : path === 'fight' ? FIGHT_CLEAR : FULL_ARC_CLEAR;
  const got = award(familyId);
  if (got) unlocked.push(got);
  if (tacticalClean) {
    const boss = award(TACTICAL_BOSS);
    if (boss) unlocked.push(boss);
  }

  for (const a of campaign?.achievements || []) {
    if (/all \d+ stages|across the campaign|every/i.test(String(a.trigger || ''))) {
      const wide = award(a.id);
      if (wide) unlocked.push(wide);
    }
  }
  return unlocked;
}

/**
 * A ghost battle resolved. Only a victory counts.
 *
 * There is no universal ghost family in protocol/data/achievements.json yet, so
 * this matches campaign achievements whose trigger names a ghost battle. Today
 * that awards nothing on most campaigns — which is the honest result, not a
 * bug — and it starts working the moment a ghost achievement is authored.
 * @returns {Array} newly unlocked achievements
 */
export function onGhostBattle(battleResult, campaignId) {
  const outcome = battleResult?.result?.outcome || battleResult?.outcome;
  if (outcome !== 'victory') return [];
  const campaign = campaignId ? getCampaign(campaignId) : null;
  const ids = (campaign?.achievements || [])
    .filter((a) => /ghost/i.test(String(a.trigger || '')) || /ghost/i.test(String(a.name || '')))
    .map((a) => a.id);
  return awardMany(ids);
}
