import MissionComplete from './shared/MissionComplete';
import { settleQuickMissionXp } from './data/quickMissionXp';

// Quick Mission complete — rendered by the shared design-24f screen.
const GOLD = '#fde047';

export default function QuickMissionComplete({ result, cardioResult, onRetry, onFitHub, onHome }) {
  const { completed, roundsCompleted, totalRounds, exercisesCompleted, totalExercises, mission, integrityResult } = result;
  // Item 9 — the engine decides the outcome, so this mode can end on
  // fail / validation_failed and not only success / partial.
  // Beta ND-05 — ONE XP figure: the same settle App.jsx banked with, so the
  // number here is the number the level bar moved by. Real anti-cheat zeroes
  // both via the verdict.
  const { verdict, xp } = settleQuickMissionXp({
    exercisesCompleted, totalExercises, completed, difficulty: mission.difficulty, integrityResult,
  });

  return (
    <MissionComplete
      onBack={onFitHub}
      variant={verdict.preset.variant}
      eyebrow={verdict.preset.eyebrow}
      title={mission.title}
      subtitle={`${mission.workoutType} · ${mission.difficulty} · Quick Mission`}
      accent={GOLD}
      xp={xp}
      heroImage="/static/trophies/mission-complete-fit.webp"
      integrityResult={integrityResult}
      failReason={verdict.response}
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
