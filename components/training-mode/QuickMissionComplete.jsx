import MissionComplete from './shared/MissionComplete';
import { resolveOutcome, xpForOutcome, OUTCOME_PRESET } from './shared/sessionOutcome';
import { FORMAT_LABEL } from './data/loadoutMissions';
import { formatScore, splitsLine, downCopy, isUntilDown } from './data/missionSolo';
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
  // A v2 GUIDED run was settled once in App (data/missionSolo settleGuidedXp):
  // its verdict and the XP it banked are shown as they are.
  const guidedSettle = !solo && result.settle?.mode === 'guided' ? result.settle : null;
  // Item 9 — the engine decides the outcome, so this mode can end on
  // fail / validation_failed and not only success / partial.
  const verdict = solo ? null : guidedSettle ? guidedSettle.verdict : resolveOutcome({
    completed: exercisesCompleted, total: totalExercises, difficulty: mission.difficulty, integrityResult,
  });
  // Beta ND-05 — ONE XP figure. The stats bank credits completed exercises
  // (the End dialog's promise), so the screen shows the same number instead
  // of re-gating it through the integrity ratio and displaying 0 above a
  // level bar that just moved. Real anti-cheat still zeroes via the verdict.
  // SOLO and a v2 GUIDED run show the number App banked from their settle.
  const baseXp = quickMissionXp(exercisesCompleted, totalExercises, completed);
  const xp = solo || guidedSettle ? (result.xpEarned || 0) : xpForOutcome(verdict.outcome, baseXp);
  const preset = solo ? OUTCOME_PRESET[SOLO_PRESET[result.settle?.outcome] || 'fail'] : verdict.preset;
  // The round timer (SOLO): rounds done, each round's time and the total.
  const rounds = solo && Array.isArray(result.rounds) ? result.rounds : null;
  const roundTag = isUntilDown(mission) ? downCopy(mission).tag : 'R';
  const roundWord = isUntilDown(mission) ? downCopy(mission).MANY : 'ROUNDS';

  const subtitle = solo
    ? `${FORMAT_LABEL[result.format || mission.format] || 'Quick Mission'} · ${mission.levelLabel}${result.scaled ? ' · Scaled' : ''} · Solo`
    : `${mission.workoutType} · ${mission.difficulty} · Quick Mission`;
  // A guided run until the bell is down (NO CONTINUES) has a score of its own.
  const scored = solo || (!!result.untilDown && !!result.score);
  const stats = scored
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
      summary={rounds ? <RoundSplits rounds={rounds} tag={roundTag} word={roundWord} totalSec={result.elapsedSec || 0}/> : null}
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

// The round timer's recap: how many rounds, each round's time, the total.
// Kept short so it fits on any phone (MissionComplete never hides it).
function RoundSplits({ rounds, tag, word, totalSec }) {
  const blocks = [...new Set(rounds.map(r => r.block))];
  const multi = blocks.length > 1;
  const box = { background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(253,224,71,0.3)', borderRadius: 10, padding: '8px 10px' };
  const line = { font: "600 10px 'Rajdhani',sans-serif", color: '#e9e3f7', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' };
  return (
    <div data-guide="qm-splits" style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 9px 'Orbitron',sans-serif", letterSpacing: '0.12em', color: GOLD, marginBottom: 3 }}>
        <span>{word} {rounds.length}</span><span style={{ color: '#fff' }}>TOTAL {mmss(totalSec)}</span>
      </div>
      {rounds.length === 0 ? (
        <div style={{ ...line, color: '#9a90b8' }}>No round taps this run.</div>
      ) : multi ? blocks.map(b => (
        <div key={b} style={line}>B{b + 1} · {splitsLine(rounds.filter(r => r.block === b), { tag })}</div>
      )) : (
        <div style={line}>{splitsLine(rounds, { tag })}</div>
      )}
    </div>
  );
}
