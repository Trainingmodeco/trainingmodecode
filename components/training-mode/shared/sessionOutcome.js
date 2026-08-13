// Item 9 — ONE place that decides how a session ended.
//
// Before this, every mode judged itself: SessionSummary derived `stoppedEarly`
// from a round count, CampFullSession had its own `judge()`, and the Arcade
// overlay read three ad-hoc booleans off `result`. Three answers to the same
// question, and none of them could produce "fail" or "validation_failed" for a
// non-arcade mode.
//
// Now every mode calls resolveOutcome() and gets the engine's verdict from
// protocol/content.ts → evaluateSession() against pass-rules.json. Presentation
// still differs per mode (Arcade has its own full-screen overlay, everything
// else uses the shared 24f MissionComplete), but the VERDICT is shared.
import { evaluate, xpRuleset } from '../protocol/content';

/** Outcome → the copy + colour every mode presents it with. */
export const OUTCOME_PRESET = {
  pass: {
    variant: 'success', eyebrow: 'SESSION COMPLETE', title: 'GOOD WORK', accent: '#fde047',
  },
  partial: {
    variant: 'partial', eyebrow: 'SESSION STOPPED', title: 'GOOD EFFORT', accent: '#a855f7',
  },
  fail: {
    variant: 'fail', eyebrow: 'MISSION FAILED', title: 'NOT THIS TIME', accent: '#ef4444',
  },
  validation_failed: {
    variant: 'validation_failed', eyebrow: 'VALIDATION FAILED', title: 'COULD NOT VERIFY', accent: '#f59e0b',
  },
};

const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * Resolve a finished session to pass / partial / fail / validation_failed.
 *
 * @param {object}  o
 * @param {number}  o.completed              units of work actually completed
 * @param {number}  o.total                  units prescribed
 * @param {string}  o.difficulty             'easy' | 'normal' | 'hard'
 * @param {object}  [o.integrityResult]      from utils/missionIntegrity
 * @param {boolean} [o.safetyFlag]           pain / danger symptom reported
 * @param {number}  [o.techniqueBreakdowns]  flagged form breakdowns
 * @param {string}  [o.tacticalObjective]    'missed'|'attempted'|'completed'|'completed_cleanly'
 * @returns {{ outcome: string, failType?: string, response?: string,
 *             completionRatio: number, preset: object }}
 */
export function resolveOutcome({
  completed,
  total,
  difficulty = 'normal',
  integrityResult = null,
  safetyFlag = false,
  techniqueBreakdowns = 0,
  tacticalObjective,
}) {
  const denom = total > 0 ? total : 1;
  const completionRatio = clamp01((completed ?? 0) / denom);

  // The 1.6 anti-cheat gate outranks everything: an unverifiable session is
  // validation_failed and earns nothing, however much work it claims.
  //
  // Beta ND-04 — but ONLY a real anti-cheat flag may trip it. The integrity
  // layer also sets awardXp:false for a perfectly ordinary early exit below
  // 25% completion, and that used to land here too — so quitting a mission
  // early showed "VALIDATION FAILED / This attempt could not be verified",
  // fraud vocabulary for something innocent the athlete did deliberately.
  // Early exits fall through to the engine and read as what they are.
  const CHEAT_FLAGS = ['tooFast', 'suspicious', 'expired', 'idleTimeout'];
  const hardInvalid = !!integrityResult && integrityResult.awardXp === false
    && CHEAT_FLAGS.includes(integrityResult.validityStatus);
  if (hardInvalid) {
    return {
      outcome: 'validation_failed',
      failType: 'validation',
      response: integrityResult?.reason || 'This attempt could not be verified.',
      completionRatio,
      preset: OUTCOME_PRESET.validation_failed,
    };
  }

  // Difficulty arrives in whatever case the mode's UI uses — Fight Focus and
  // Combo Coach store 'Normal', the Arcade stores 'normal'. Normalise BEFORE
  // comparing, or the two branches below disagree: 'Normal' fails
  // `=== 'normal'` so the tactical default drops to 'attempted', while the tier
  // still resolves to 'normal', whose threshold demands 'completed'. Every
  // Fight Focus and Combo Coach session then failed on the tactical rule —
  // 3/3 rounds, all verified, MISSION FAILED, zero XP.
  const diff = String(difficulty || 'normal').toLowerCase();
  const tier = diff === 'easy' || diff === 'hard' ? diff : 'normal';

  // Modes that don't track a tactical objective shouldn't be failed on one:
  // default to "met" so the engine judges them on completion and technique.
  const tactical = tacticalObjective
    || (tier === 'hard' ? 'completed_cleanly' : tier === 'normal' ? 'completed' : 'attempted');

  const ev = evaluate(
    {
      completionRatio,
      majorTechniqueBreakdowns: techniqueBreakdowns,
      tacticalObjective: tactical,
      safetyFlag: !!safetyFlag,
      rpeInBand: true,
    },
    tier
  );

  // Beta ND-05 — the End dialog promises "Only completed exercises will count
  // toward your stats", and the stats bank honours that. So an early exit
  // WITH completed work is a partial (kept work, kept XP), never a zero-XP
  // fail — otherwise the screen contradicts the very XP it just banked.
  // The fail gate still bites where it should: nothing completed, or a full
  // run that failed on its tactical/technique rules (ratio 1).
  let outcome = ev.outcome;
  let response = ev.response;
  if (ev.outcome === 'fail' && completionRatio > 0 && completionRatio < 1) {
    outcome = 'partial';
    response = 'Ended early — the work you completed counts toward your stats.';
  } else if (ev.outcome === 'fail' && completionRatio === 0) {
    // Beta ND-04 — consequence language, never system language.
    response = 'Ended early — finish a full round to earn XP.';
  }

  return {
    outcome,
    failType: outcome === 'fail' ? ev.failType : undefined,
    response,
    completionRatio,
    preset: OUTCOME_PRESET[outcome] || OUTCOME_PRESET.pass,
  };
}

/**
 * Apply the outcome to a mode's own XP figure.
 *
 * Careful here: the modes do NOT compute XP the way the engine's calcXp() does.
 * They count units — `completed * 20`, `exercisesCompleted * 15` — so their
 * number is ALREADY prorated by how much work got done. Multiplying a partial
 * session by the ruleset's 0.5 on top of that would penalise it twice and
 * silently halve rewards people already earn today. So pass and partial keep
 * the mode's own figure.
 *
 * Fail and validation_failed are different: the mode math has no concept of
 * them, so those come straight from the authored ruleset
 * (protocol/data/xp-rules.json — fail 0.15, validation_failed 0). A failed
 * session still pays a little, because the ruleset's balancing rule is that a
 * clean Easy pass beats repeated Hard failure, not that failure is worthless.
 * An unverifiable one pays nothing — that is what the anti-cheat gate is for.
 */
export function xpForOutcome(outcome, xp) {
  const base = Math.max(0, Math.round(xp || 0));
  if (outcome !== 'fail' && outcome !== 'validation_failed') return base;
  const mult = xpRuleset?.completion_multiplier?.[outcome] ?? 0;
  return Math.max(0, Math.round(base * mult));
}
