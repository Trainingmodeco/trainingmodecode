import { Look, Feature } from './looksKit';
import NearMissPanel from './ui/NearMissPanel';
import ArcadeStageClearOverlay from '../ArcadeStageClearOverlay';
import { nearMiss } from '../data/nearMiss';
import { canRetryNow } from '../data/retrySafety';
import { stageStarRule } from '../data/pathStars';
import { getSeriesById } from '../data/trainingArcadeData';

// 3 · Near-miss retry. How close a partial or failed session came, in plain
// words from its real counts, a RETRY only when a retry is safe, and a way
// out that is just as easy to press. Every card renders the REAL components
// (retention/ui/NearMissPanel, data/nearMiss, data/retrySafety, the real
// classic stage screens) with sample data: what is drawn here is what ships
// behind the `nearMiss` switch.

const OP = getSeriesById('one-punch-protocol');
const noop = () => {};
// A settled near miss as the end screens build it (data/nearMissStore), from sample counts.
const settled = (facts, gate = {}) => ({ miss: nearMiss(facts), gate: canRetryNow(gate), show: true });

// The top of the shared end screen (MissionComplete) down to the panel.
function EndTop({ eyebrow, title, sub, xp, stat, tone = '#a855f7', eyebrowColor = '#c9a6ff', children }) {
  return (
    <div style={{ padding: '22px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ font: "700 7px 'Press Start 2P',monospace", color: eyebrowColor, letterSpacing: '0.16em', textAlign: 'center' }}>◈ {eyebrow} ◈</div>
      <div style={{ font: "900 18px 'Orbitron',sans-serif", color: '#fff', textAlign: 'center', lineHeight: 1.08 }}>{title}</div>
      <div style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#c4a4d8', textAlign: 'center', marginBottom: 6 }}>{sub}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        <div style={{ borderRadius: 10, border: `1px solid ${tone}73`, background: `linear-gradient(135deg, ${tone}24, rgba(8,2,18,0.6))`, padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ font: "900 17px 'Orbitron',sans-serif", color: tone }}>{xp}</div>
          <div style={{ font: "600 7.5px 'Orbitron',sans-serif", color: eyebrowColor, letterSpacing: '0.08em' }}>{xp === '0' ? 'NO XP AWARDED' : 'XP EARNED'}</div>
        </div>
        <div style={{ borderRadius: 10, border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(8,2,18,0.88)', padding: '8px 10px', textAlign: 'center' }}>
          <div style={{ font: "900 17px 'Orbitron',sans-serif", color: '#fde047' }}>{stat[0]}</div>
          <div style={{ font: "600 7.5px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.08em' }}>{stat[1]}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function LookNearMiss() {
  const ff = settled({ unit: 'rounds', done: 2, total: 3, outcome: 'partial' });
  const boss = settled({ unit: 'rounds', done: 9, total: 12, outcome: 'partial' }, { boss: 'boss' });
  const again = settled({ unit: 'exercises', done: 10, total: 12, outcome: 'partial' }, { attemptsToday: 2 });
  const stage = OP.stages[4];
  const tiers = stageStarRule(OP, stage).tiers || [];
  const third = tiers.find((t) => t.stars === 3);
  const clearTime = third ? third.maxMinutes * 60 + 11 : 0;
  const star = { ...settled({ unit: 'time', timeSec: clearTime, tiers, stars: 2 }), retryLabel: 'GO FOR THE THIRD STAR' };
  const bench = settled({ unit: 'exercises', done: 2, total: 3, outcome: 'partial' });
  return (
    <Feature id="f3" num="FEATURE 3" title="NEAR-MISS RETRY"
      reuse="the shared end screen (MissionComplete) and the classic Arcade's stage screens, their verdicts from sessionOutcome, each mode's own start (the same session again: Fight Focus, Combo, Quick Mission, Combat Conditioning, Fit, arcade v2; the camp map's readiness and gear checks; the classic stage's own RETRY)."
      isNew="how close it was in plain words from the session's real counts, with a bar; RETRY and COME BACK FRESH TOMORROW as two buttons of the same size; no RETRY after a boss, the title fight, MAX OUT, a second go at the same session or three sessions in a day: the screen says when to come back and offers DONE FOR TODAY; the classic clear with fewer than three stars offers the third star next to the next stage. There is no reminder to hook a REMIND ME TOMORROW into, so it is left out.">

      <Look name="Stopped short, retry is safe" note="Fight Focus, 2 of 3 rounds. The panel sits under the stats; RETRY runs the same session, and the way home is the same size." height={420}>
        <EndTop eyebrow="SESSION STOPPED" title="GOOD EFFORT" sub="Boxing · Normal · Fight Focus" xp="+40" stat={['2/3', 'ROUNDS']}>
          <NearMissPanel miss={ff.miss} gate={ff.gate} onRetry={noop} onLeave={noop}/>
        </EndTop>
      </Look>

      <Look name="A boss, no retry today" note="An arcade boss stopped at 9 of 12 rounds: no RETRY after a boss. The line says when to come back; one button, DONE FOR TODAY." height={400}>
        <EndTop eyebrow="STAGE STOPPED" title="GOOD EFFORT" sub="TRAINING ARCADE · The Grappler · normal" xp="+52" stat={['9/12', 'ROUNDS']}>
          <NearMissPanel miss={boss.miss} gate={boss.gate} onRetry={noop} onLeave={noop}/>
        </EndTop>
      </Look>

      <Look name="The second go today" note="Two tries at the same session today: no third, come back fresh tomorrow. Three finished sessions in a day read the same way." height={400}>
        <EndTop eyebrow="SESSION STOPPED" title="IRON HOUR" sub="Circuit · Medium · Quick Mission" xp="+96" stat={['3/4', 'ROUNDS']}>
          <NearMissPanel miss={again.miss} gate={again.gate} onRetry={noop} onLeave={noop}/>
        </EndTop>
      </Look>

      <Look name="Cleared, fewer than 3 stars" note="The real classic clear screen: how far off the third star this run was, GO FOR THE THIRD STAR next to the next stage, the same size. A clear is a clear: never pushed." height={700} animated>
        <ArcadeStageClearOverlay
          series={OP} stage={stage}
          result={{ invalid: false, rank: null, points: 300, xpEarned: 300, elapsedSeconds: clearTime, stars: 2, newBest: false, completedTasks: 3, totalTasks: 3 }}
          xpEarned={300} completedStageIds={OP.stages.slice(0, 5).map((s) => s.id)}
          onContinue={noop} onReturnToArcade={noop} onNextStage={noop} onRetry={noop} nearMiss={star}
        />
      </Look>

      <Look name="A stage partly done" note="The real classic partial screen (the benchmark, 2 of 3 exercises tested): what is left, RETRY THE STAGE and the way home." height={700} animated>
        <ArcadeStageClearOverlay
          series={OP} stage={OP.stages[0]}
          result={{ invalid: false, completedTasks: 2, totalTasks: 3, elapsedSeconds: 640 }}
          xpEarned={60} completedStageIds={[]}
          onContinue={noop} onReturnToArcade={noop} onRetry={noop} onDoneForToday={noop} nearMiss={bench}
        />
      </Look>
    </Feature>
  );
}
