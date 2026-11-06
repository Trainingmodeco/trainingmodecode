import MissionComplete from './shared/MissionComplete';
import { resolveOutcome, xpForOutcome, OUTCOME_PRESET } from './shared/sessionOutcome';
import { FORMAT_LABEL } from './data/loadoutMissions';
import { formatScore, splitsLine, downCopy, isUntilDown, paysByTime, soloRounds } from './data/missionSolo';
import { mmss } from './data/missionMoves';
import { quickMissionXp } from './data/userStats';
import { levelWord } from './data/quickMissionConfig';

// Quick Mission complete — rendered by the shared design-24f screen.
const GOLD = '#fde047';

// AT YOUR PACE ('solo')'s settle (data/missionSolo settleSoloXp, run once in App) → the preset.
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
    completed: exercisesCompleted, total: totalExercises, difficulty: mission.difficulty, integrityResult, advancedAs: 'hard',
  });
  // Beta ND-05 — ONE XP figure. The stats bank credits completed exercises
  // (the End dialog's promise), so the screen shows the same number instead
  // of re-gating it through the integrity ratio and displaying 0 above a
  // level bar that just moved. Real anti-cheat still zeroes via the verdict.
  // SOLO and a v2 GUIDED run show the number App banked from their settle.
  const baseXp = quickMissionXp(exercisesCompleted, totalExercises, completed, mission);
  const xp = solo || guidedSettle ? (result.xpEarned || 0) : xpForOutcome(verdict.outcome, baseXp);
  const preset = solo ? OUTCOME_PRESET[SOLO_PRESET[result.settle?.outcome] || 'fail'] : verdict.preset;
  // The round timer (SOLO): rounds done, each round's time and the total.
  const rounds = solo && Array.isArray(result.rounds) ? result.rounds : null;
  const roundTag = isUntilDown(mission) ? downCopy(mission).tag : 'R';
  const roundWord = isUntilDown(mission) ? downCopy(mission).MANY : 'ROUNDS';
  // The tap's own word: NO CONTINUES taps SET, everything else ROUND.
  const roundOne = isUntilDown(mission) ? downCopy(mission).one : 'round';
  // No taps and no score (a STOP): nothing to recap.
  const recap = !!rounds && (rounds.length > 0 || !!result.score);
  // An until-down GUIDED run is judged by its settle (sets, skips, the end it
  // took); the per-cycle integrity banner would contradict it. A forensic
  // fail still reaches the verdict through the settle.
  const banner = solo || (guidedSettle && isUntilDown(mission)) ? null : integrityResult;

  // One case in the line: 'Circuit · Medium · At your pace' (EMOM and AMRAP stay
  // capitals), and the same level word the first page and the run use.
  const word = (t) => String(t || '').split(' ').map(w => (/^(AMRAP|EMOM)$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(' ');
  const subtitle = solo
    ? `${word((mission.formatLabel || FORMAT_LABEL[result.format || mission.format]) || 'Quick Mission')} · ${word(mission.levelLabel)}${result.scaled ? ' · Scaled' : ''} · At your pace`
    : `${mission.workoutType} · ${word(levelWord(mission.difficulty))} · Quick Mission`;
  // A guided run until the bell is down (NO CONTINUES) has a score of its own.
  const scored = solo || (!!result.untilDown && !!result.score);
  const stats = scored
    ? [
      { value: formatScore(result.score), label: 'SCORE', color: GOLD },
      { value: mmss(result.elapsedSec || 0), label: 'TIME', color: '#fff' },
      { value: mission.levelLabel, label: 'LEVEL', color: '#fff' },
    ]
    // An until-down run ENDed with no score: no rounds out of the hidden
    // backstop (it has no set length), just the time it ran.
    : isUntilDown(mission)
      ? [
        { value: '—', label: 'SCORE', color: GOLD },
        { value: mmss(result.elapsedSec || 0), label: 'TIME', color: '#fff' },
        { value: mission.levelLabel, label: 'LEVEL', color: '#fff' },
      ]
    : guidedSettle && paysByTime(mission)
      // On a clock the XP is the time worked, so the screen shows it.
      ? [
        { value: `${roundsCompleted}/${totalRounds}`, label: 'ROUNDS', color: GOLD },
        { value: mmss(guidedSettle.workedSec || 0), label: 'WORKED', color: '#fff' },
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
      integrityResult={banner}
      failReason={solo ? result.settle?.message || undefined : verdict.response}
      stats={stats}
      summary={recap ? <RoundSplits rounds={rounds} count={scoreCount(result, mission, rounds.length)} tag={roundTag} word={roundWord} one={roundOne} totalSec={result.elapsedSec || 0}/> : null}
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

// The rounds the saved score counts (the athlete can correct the taps on
// YOUR SCORE): rounds, sets, a finished run's rounds held, a finished race's
// rounds (FINISH means all of them, tapped or not); else the taps.
function scoreCount(result, mission, taps) {
  const score = result?.score;
  if (score?.kind === 'roundsReps') return Array.isArray(score.blocks) && score.blocks.length ? score.blocks.reduce((n, b) => n + (b.rounds || 0), 0) : score.rounds || 0;
  if (score?.kind === 'setsReps') return score.sets || 0;
  if (score?.kind === 'roundsHeld' && !score.capped) return score.of || 0;
  if (score?.kind === 'time' && !score.capped && result?.completed) return soloRounds(mission);
  return taps;
}
// The round timer's recap: how many rounds the score counts, each tapped
// round's time, the total. Rounds the score has but nobody tapped read as
// not timed. Kept short so it fits on any phone (MissionComplete never hides it).
function RoundSplits({ rounds, count, tag, word, one = 'round', totalSec }) {
  const blocks = [...new Set(rounds.map(r => r.block))];
  const multi = blocks.length > 1;
  const taps = rounds.length;
  const gap = count > taps
    ? (multi ? `${count - taps} not timed.` : `${tag}${taps + 1}${count > taps + 1 ? `–${tag}${count}` : ''} not timed.`)
    : count < taps ? `${taps} taps timed.` : null;
  const box = { background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(253,224,71,0.3)', borderRadius: 10, padding: '8px 10px' };
  const line = { font: "600 10px 'Rajdhani',sans-serif", color: '#e9e3f7', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' };
  return (
    <div data-guide="qm-splits" style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 9px 'Orbitron',sans-serif", letterSpacing: '0.12em', color: GOLD, marginBottom: 3 }}>
        <span>{word} {count}</span><span style={{ color: '#fff' }}>TOTAL {mmss(totalSec)}</span>
      </div>
      {rounds.length === 0 ? (
        <div style={{ ...line, color: '#9a90b8' }}>No {one} taps this run.</div>
      ) : multi ? blocks.map(b => (
        <div key={b} style={line}>B{b + 1} · {splitsLine(rounds.filter(r => r.block === b), { tag })}</div>
      )) : (
        <div style={line}>{splitsLine(rounds, { tag })}</div>
      )}
      {gap && taps > 0 && <div style={{ ...line, color: '#9a90b8' }}>{gap}</div>}
    </div>
  );
}
