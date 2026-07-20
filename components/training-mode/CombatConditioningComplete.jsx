import MissionComplete from './shared/MissionComplete';
import { calculatePartialXp } from './utils/missionIntegrity';

// Combat Conditioning complete — rendered by the shared design-24f screen.
const GOLD = '#fde047';

export default function CombatConditioningComplete({ mission, result, cardioResult, onNewMission, onFitHub, onHome }) {
  const { roundsCompleted, totalRounds, drillsCompleted, totalDrills, completed, integrityResult } = result;
  const baseXp = drillsCompleted * 15 + (completed ? 30 : 0);
  const xp = integrityResult?.awardXp
    ? calculatePartialXp(baseXp, integrityResult.validCompletedUnits, integrityResult.totalRequiredUnits)
    : (integrityResult ? 0 : baseXp);

  return (
    <MissionComplete
      variant={completed ? 'success' : 'partial'}
      eyebrow={completed ? 'MISSION COMPLETE' : 'GOOD EFFORT'}
      title={mission.missionName || 'COMBAT CONDITIONING'}
      subtitle={`${mission.style} · ${mission.difficulty} · ${mission.estimatedMinutes || '--'} min`}
      accent={GOLD}
      xp={xp}
      heroImage="/static/trophies/mission-complete-combat.webp"
      integrityResult={integrityResult}
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
