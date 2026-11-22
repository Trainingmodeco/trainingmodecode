import { ARCADE } from '../ArcadeUI';
import ArcadeStageClearOverlay from '../ArcadeStageClearOverlay';
import { HOME, head, orb, goldText, Look, Feature, Stars, Btn, Sparks } from './looksKit';
import { CountUp } from './lookPath';
import { WeekChip } from './lookStreak';

// The CLEARED moment every feature lands on: the app's stage-clear screen as
// it is today (the real component, sample data) next to a louder version.

const STAGES = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `s${n}`, stageNumber: n, title: n === 5 ? 'Burpee Ladder' : `Stage ${n}` }));
const SERIES = { id: 'iron', title: 'Iron Path', stages: STAGES };
const RESULT = { completedTasks: 5, totalTasks: 5, elapsedSeconds: 291, newBest: true, stars: 3, rank: 'S' };
const noop = () => {};

function Louder() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '28px 20px 20px', position: 'relative', overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 35%, rgba(253,224,71,.22) 0%, rgba(34,197,94,.1) 30%, rgba(8,0,18,1) 68%)' }}>
      <span style={{ position: 'absolute', left: '50%', top: 150, width: 300, height: 300, marginLeft: -150, borderRadius: 150, background: 'radial-gradient(circle, rgba(253,224,71,.35), transparent 60%)', animation: 'rl-burst 1.2s .3s both' }}/>
      <div style={{ ...orb(12), color: HOME.muted, animation: 'rl-rise .3s both' }}>IRON PATH · STAGE 5</div>
      <div style={{ ...orb(46), ...goldText, lineHeight: 1, animation: 'rl-slam .6s .2s both', filter: 'drop-shadow(0 0 18px rgba(253,224,71,.5))' }}>CLEARED</div>
      <div style={{ position: 'relative', height: 70, display: 'grid', placeItems: 'center' }}><Sparks n={18}/><Stars n={3} size={54} land gap={14} delay={0.9}/></div>
      <div style={{ ...head(13), color: HOME.green, animation: 'rl-rise .3s 2.4s both' }}>★★★ · NEW BEST 4:51 · 9 s FASTER</div>
      <div style={{ ...orb(44), color: ARCADE.gold, animation: 'rl-rise .3s 2.6s both', textShadow: '0 0 20px rgba(253,224,71,.6)' }}>+<CountUp to={180} delay={2600} ms={1100}/><span style={{ fontSize: 18 }}> XP</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'rl-rise .4s 3.8s both' }}>
        <WeekChip pop done={4} week={['done', 'done', 'rest', 'done', 'today', 'future', 'future']}/>
        <div style={{ ...head(11, 600), color: HOME.muted }}>DAY 4 OF 4 · STREAK KEPT · SQUAD +5 ROUNDS</div>
      </div>
      <div style={{ width: '100%', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, animation: 'rl-rise .4s 4.2s both' }}>
        <Btn>NEXT: STAGE 6 ▶</Btn>
        <Btn tone="ghost">BACK TO THE PATH</Btn>
      </div>
    </div>
  );
}

export default function LookCleared() {
  return (
    <Feature id="f7" num="ALSO" title="THE CLEARED MOMENT"
      reuse="ArcadeStageClearOverlay, shown here as the real component with sample data."
      isNew="a louder version: bigger CLEARED, a gold burst, three stars that slam in one by one, a longer XP count-up, and one line for what the session did for the streak, the league and the squad. Sound cue note: a rising tone per star (the screen already plays tones at 880 and 1200 Hz), then a short chord when the XP lands.">
      <Look name="Today: stage cleared" note="The app's current screen, unchanged (it plays two short tones)." height={640} animated>
        <ArcadeStageClearOverlay series={SERIES} stage={STAGES[4]} result={RESULT} pointsEarned={120} xpEarned={180} statRewards={[]}
          totalArcadeXpBefore={2400} completedStageIds={['s1', 's2', 's3', 's4']} onContinue={noop} onRetry={noop} onReturnToArcade={noop} onNextStage={noop} onShare={noop}/>
      </Look>
      <Look name="Louder: stage cleared" note="Same moment, louder: the stars and the XP are the show, and the session's effect on the week is one line under it." height={640} animated>
        <Louder/>
      </Look>
    </Feature>
  );
}
