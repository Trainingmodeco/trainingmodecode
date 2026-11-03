import MissionComplete from './shared/MissionComplete';
import { resolveOutcome, xpForOutcome, OUTCOME_PRESET } from './shared/sessionOutcome';
import { FORMAT_LABEL } from './data/loadoutMissions';
import { formatScore } from './data/missionSolo';
import { mmss } from './data/missionMoves';
import { quickMissionXp } from './data/userStats';

// Quick Mission complete — rendered by the shared design-24f screen.
const GOLD = '#fde047';

// SOLO's settle (data/missionSolo settleSoloXp, run once in App) → the preset.
// too_fast is the floor rule refusing the run, so it reads as VALIDATION FAILED.
const SOLO_PRESET = { pass: 'pass', partial: 'partial', too_fast: 'validation_failed', none: 'fail' };

export default function QuickMissionComplete({ result, cardioResult, onRetry, onFitHub, onHome }) {
  const { completed, roundsCompleted, totalRounds, exercisesCompleted, totalExercises, mission, integrityResult } = result;
  const solo = result.mode === 'solo';
  // Item 9 — the engine decides the outcome, so this mode can end on
  // fail / validation_failed and not only success / partial.
  const verdict = solo ? null : resolveOutcome({
    completed: exercisesCompleted, total: totalExercises, difficulty: mission.difficulty, integrityResult,
  });
  // Beta ND-05 — ONE XP figure. The stats bank credits completed exercises
  // (the End dialog's promise), so the screen shows the same number instead
  // of re-gating it through the integrity ratio and displaying 0 above a
  // level bar that just moved. Real anti-cheat still zeroes via the verdict.
  // SOLO shows the number App banked from its settle.
  const baseXp = quickMissionXp(exercisesCompleted, totalExercises, completed);
  const xp = solo ? (result.xpEarned || 0) : xpForOutcome(verdict.outcome, baseXp);
  const preset = solo ? OUTCOME_PRESET[SOLO_PRESET[result.settle?.outcome] || 'fail'] : verdict.preset;

  const subtitle = solo
    ? `${FORMAT_LABEL[result.format || mission.format] || 'Quick Mission'} · ${mission.levelLabel}${result.scaled ? ' · Scaled' : ''} · Solo`
    : `${mission.workoutType} · ${mission.difficulty} · Quick Mission`;
  const stats = solo
    ? [
      { value: formatScore(result.score), label: 'SCORE', color: GOLD },
      { value: mmss(result.elapsedSec || 0), label: 'TIME', color: '#fff' },
      { value: mission.levelLabel, label: 'LEVEL', color: '#fff' },
    ]
    : [
      { value: `${roundsCompleted}/${totalRounds}`, label: 'ROUNDS', color: GOLD },
      { value: String(exercisesCompleted), label: 'EXERCISES', color: '#fff' },
    ];

  return (
    <MissionComplete
      onBack={onFitHub}
      variant={preset.variant}
      eyebrow={preset.eyebrow}
      title={mission.title}
      subtitle={subtitle}
      accent={GOLD}
      xp={xp}
      heroImage="/static/trophies/mission-complete-fit.webp"
      integrityResult={solo ? null : integrityResult}
      failReason={solo ? result.settle?.message || undefined : verdict.response}
      stats={stats}
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
