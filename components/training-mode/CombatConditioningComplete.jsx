import MissionComplete from './shared/MissionComplete';
import { calculatePartialXp } from './utils/missionIntegrity';
import { resolveOutcome, xpForOutcome } from './shared/sessionOutcome';
import { combatRetryKey } from './data/retrySafety';

// Combat Conditioning complete — rendered by the shared design-24f screen.
const GOLD = '#fde047';

// retry (retention feature 3): { token, onRetry, onLeave } — this same mission
// again and the way home, for the near-miss panel (MissionComplete).
export default function CombatConditioningComplete({ mission, result, cardioResult, onNewMission, onFightHub, onHome, retry = null }) {
  const { roundsCompleted, totalRounds, drillsCompleted, totalDrills, completed, integrityResult, cleanRounds = 0, cleanRoundXp = 0 } = result;
  // Item 9 — the engine decides the outcome, so this mode can end on
  // fail / validation_failed and not only success / partial.
  const verdict = resolveOutcome({
    completed: drillsCompleted, total: totalDrills, difficulty: mission.difficulty, integrityResult,
  });
  const baseXp = drillsCompleted * 15 + (completed ? 30 : 0);
  const rawXp = integrityResult?.awardXp
    ? calculatePartialXp(baseXp, integrityResult.validCompletedUnits, integrityResult.totalRequiredUnits)
    : (integrityResult ? 0 : baseXp);
  // Clean rounds ride the settled number, never a session the gate refused.
  const cleanBonus = integrityResult?.awardXp === false || verdict.outcome === 'validation_failed' ? 0 : cleanRoundXp;
  const xp = xpForOutcome(verdict.outcome, rawXp) + cleanBonus;

  return (
    <MissionComplete
      onBack={onFightHub}
      variant={verdict.preset.variant}
      eyebrow={verdict.preset.eyebrow}
      title={mission.missionName || 'COMBAT CONDITIONING'}
      subtitle={`${mission.style} · ${mission.difficulty} · ${mission.estimatedMinutes || '--'} min`}
      accent={GOLD}
      xp={xp}
      heroImage="/static/trophies/mission-complete-combat.webp"
      integrityResult={integrityResult}
      failReason={verdict.response}
      nearMiss={retry ? {
        key: combatRetryKey(mission), token: retry.token, outcome: verdict.outcome,
        unit: 'drills', done: drillsCompleted, total: totalDrills, onRetry: retry.onRetry, onLeave: retry.onLeave,
      } : null}
      stats={[
        { value: `${roundsCompleted}/${totalRounds}`, label: 'ROUNDS', color: GOLD },
        { value: String(drillsCompleted), label: 'DRILLS', color: '#fff' },
        ...(cleanRounds > 0 ? [{ value: `${cleanRounds} · +${cleanBonus}`, label: 'CLEAN RDS', color: '#8fe8ac' }] : []),
      ]}
      cardioResult={cardioResult}
      shareData={{ mode: 'Combat Conditioning', style: mission.style, completedCount: drillsCompleted, totalCount: totalDrills }}
      actions={[
        { label: 'NEW COMBAT MISSION', onClick: onNewMission, kind: 'primary' },
        // A fight feature returns to Home or the Fight hub: this screen used to send the back arrow and
        // its second button to Fit Mode, and RETURN HOME was the quietest button.
        { label: 'RETURN HOME', onClick: onHome, kind: 'secondary', role: 'home' },
        { label: 'BACK TO FIGHT MODE', onClick: onFightHub, kind: 'ghost' },
      ]}
    />
  );
}
