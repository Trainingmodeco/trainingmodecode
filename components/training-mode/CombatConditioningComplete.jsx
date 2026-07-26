import MissionComplete from './shared/MissionComplete';
import { calculatePartialXp } from './utils/missionIntegrity';
import { resolveOutcome, xpForOutcome } from './shared/sessionOutcome';

// Combat Conditioning complete — rendered by the shared design-24f screen.
const GOLD = '#fde047';

export default function CombatConditioningComplete({ mission, result, cardioResult, onNewMission, onFitHub, onHome }) {
  const { roundsCompleted, totalRounds, drillsCompleted, totalDrills, completed, integrityResult } = result;
  // Item 9 — the engine decides the outcome, so this mode can end on
  // fail / validation_failed and not only success / partial.
  const verdict = resolveOutcome({
    completed: drillsCompleted, total: totalDrills, difficulty: mission.difficulty, integrityResult,
  });
  const baseXp = drillsCompleted * 15 + (completed ? 30 : 0);
  const rawXp = integrityResult?.awardXp
    ? calculatePartialXp(baseXp, integrityResult.validCompletedUnits, integrityResult.totalRequiredUnits)
    : (integrityResult ? 0 : baseXp);
  const xp = xpForOutcome(verdict.outcome, rawXp);

  return (
    <MissionComplete
      variant={verdict.preset.variant}
      eyebrow={verdict.preset.eyebrow}
      title={mission.missionName || 'COMBAT CONDITIONING'}
      subtitle={`${mission.style} · ${mission.difficulty} · ${mission.estimatedMinutes || '--'} min`}
      accent={GOLD}
      xp={xp}
      heroImage="/static/trophies/mission-complete-combat.webp"
      integrityResult={integrityResult}
      failReason={verdict.response}
      stats={[
        { value: `${roundsCompleted}/${totalRounds}`, label: 'ROUNDS', color: GOLD },
        { value: String(drillsCompleted), label: 'DRILLS', color: '#fff' },
      ]}
      cardioResult={cardioResult}
      shareData={{ mode: 'Combat Conditioning', style: mission.style, completedCount: drillsCompleted, totalCount: totalDrills }}
      actions={[
        { label: 'NEW COMBAT MISSION', onClick: onNewMission, kind: 'primary' },
        { label: 'BACK TO FIT MODE', onClick: onFitHub, kind: 'secondary' },
        { label: 'RETURN HOME', onClick: onHome, kind: 'ghost' },
      ]}
    />
  );
}
