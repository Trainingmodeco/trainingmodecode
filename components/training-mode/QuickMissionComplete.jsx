import MissionComplete from './shared/MissionComplete';
import { resolveOutcome, xpForOutcome } from './shared/sessionOutcome';

// Quick Mission complete — rendered by the shared design-24f screen.
const GOLD = '#fde047';

export default function QuickMissionComplete({ result, cardioResult, onRetry, onFitHub, onHome }) {
  const { completed, roundsCompleted, totalRounds, exercisesCompleted, totalExercises, mission, integrityResult } = result;
  // Item 9 — the engine decides the outcome, so this mode can end on
  // fail / validation_failed and not only success / partial.
  const verdict = resolveOutcome({
    completed: exercisesCompleted, total: totalExercises, difficulty: mission.difficulty, integrityResult,
  });
  // Beta ND-05 — ONE XP figure. The stats bank credits completed exercises
  // (the End dialog's promise), so the screen shows the same number instead
  // of re-gating it through the integrity ratio and displaying 0 above a
  // level bar that just moved. Real anti-cheat still zeroes via the verdict.
  const baseXp = exercisesCompleted * 15 + (completed ? 30 : 0);
  const xp = xpForOutcome(verdict.outcome, baseXp);

  return (
    <MissionComplete
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
