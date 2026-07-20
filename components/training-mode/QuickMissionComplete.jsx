import MissionComplete from './shared/MissionComplete';
import { calculatePartialXp } from './utils/missionIntegrity';

// Quick Mission complete — rendered by the shared design-24f screen.
const GOLD = '#fde047';

export default function QuickMissionComplete({ result, cardioResult, onRetry, onFitHub, onHome }) {
  const { completed, roundsCompleted, totalRounds, exercisesCompleted, totalExercises, mission, integrityResult } = result;
  const baseXp = exercisesCompleted * 15 + (completed ? 30 : 0);
  const xp = integrityResult?.awardXp
    ? calculatePartialXp(baseXp, integrityResult.validCompletedUnits, integrityResult.totalRequiredUnits)
    : (integrityResult ? 0 : baseXp);

  return (
    <MissionComplete
      variant={completed ? 'success' : 'partial'}
      eyebrow={completed ? 'MISSION COMPLETE' : 'GOOD EFFORT'}
      title={mission.title}
      subtitle={`${mission.workoutType} · ${mission.difficulty} · Quick Mission`}
      accent={GOLD}
      xp={xp}
      heroImage="/static/trophies/mission-complete-fit.webp"
      integrityResult={integrityResult}
      stats={[
        { value: `${roundsCompleted}/${totalRounds}`, label: 'ROUNDS', color: GOLD },
        { value: String(exercisesCompleted), label: 'EXERCISES', color: '#fff' },
      ]}
      cardioResult={cardioResult}
      shareData={{ mode: 'Quick Mission', completedCount: exercisesCompleted, totalCount: totalExercises }}
      actions={[
        { label: 'NEW MISSION', onClick: onRetry, kind: 'primary' },
        { label: 'BACK TO FIT MODE', onClick: onFitHub, kind: 'secondary' },
        { label: 'RETURN HOME', onClick: onHome, kind: 'ghost' },
      ]}
    />
  );
}
