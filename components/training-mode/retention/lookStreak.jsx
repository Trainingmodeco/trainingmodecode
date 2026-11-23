import { HOME, head, Look, Feature, HomeHeader as LookHomeHeader } from './looksKit';
import HomeHeader from '../shared/HomeHeader';
import NudgeToast from '../shared/NudgeToast';
import RealWeekChip from './ui/WeekChip';
import TodaysBoutCard from './ui/TodaysBoutCard';
import { SIDES } from './ui/tokens';
import WeekMomentStrip from './ui/WeekMomentStrip';
import WeekTargetRow from './ui/WeekTargetRow';
import { noticeCopy } from '../data/weekStreak';
import { boutMeta } from '../data/dailyMission';

// 1 · Weekly streak + Today's Bout + freezes. The streak counts weeks that
// reach the weekly target of training days (default 4), so a rest day never
// breaks it. Every card below renders the REAL components (retention/ui,
// shared/HomeHeader, shared/NudgeToast) with sample data: what is drawn here
// is what ships behind the `weeks` switch.

// done | rest | today | future, Monday first
const WEEK = ['done', 'done', 'rest', 'done', 'today', 'future', 'future'];
// Today's Bout as data/dailyMission pickTodaysBout holds it: a fighter's last
// session, ready to run again, and a new fit athlete's first pick.
const FIGHT_BOUT = {
  date: '2026-11-26', kind: 'last', side: 'fight', bonusXp: 25, title: 'Fight Focus', parts: ['Boxing · 3 rounds', 'Normal'],
  cta: 'START', minutes: 11, why: 'Same as last time', run: { type: 'replay' },
};
const FIT_BOUT = {
  date: '2026-11-26', kind: 'bout', side: 'fit', bonusXp: 25, title: 'Quick Mission — 12 Min Starter', parts: ['A short bodyweight circuit to get moving.'],
  cta: 'START', minutes: 12, why: 'Fits your level', run: { type: 'route' },
};
// The real card with a sample bout.
function Bout({ bout, done = false }) {
  return (
    <div style={{ padding: '14px 16px' }}>
      <TodaysBoutCard side={SIDES[bout.side]} title={bout.title} parts={bout.parts} meta={boutMeta(bout)} cta={bout.cta} bonusXp={bout.bonusXp} done={done}/>
    </div>
  );
}

// The week chip with sample data, for the other features' looks (they show
// it in their home headers): the real component.
export function WeekChip({ week = WEEK, done = 3, target = 4, streak = 9, freezes = 2, pop }) {
  return <RealWeekChip days={week} done={done} target={target} streak={streak} freezes={freezes} pop={pop ? 4 : null}/>;
}

// The old chip, as it is today with the switch off.
function TodayChip() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', borderRadius: 16, background: HOME.chip, color: HOME.gold, flexShrink: 0 }}>
      <span style={{ fontSize: 14 }}>🔥</span><span style={{ ...head(14), letterSpacing: 0 }}>12</span>
      <span style={{ fontSize: 10, color: HOME.green }}>🛡1</span>
    </div>
  );
}

// Home's real header with the week chip, in Home's own padding.
function NewHeader({ days = WEEK, done = 3, target = 4, streak = 9, freezes = 2 }) {
  return (
    <div style={{ padding: '14px 16px 0' }}>
      <HomeHeader level={14} tierName="Champion" levelXp={250} levelNeeded={500} xpPercent={50} compact
        chip={<RealWeekChip days={days} done={done} target={target} streak={streak} freezes={freezes}/>}/>
    </div>
  );
}

// The end screen's YOUR PROGRESS card (shared/MissionComplete), holding the real strip.
function YourProgress({ children }) {
  return (
    <div style={{ padding: '18px 16px' }}>
      <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(176,106,255,0.3)', borderRadius: 11, padding: '9px 12px' }}>
        <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#b06aff', letterSpacing: '0.16em', marginBottom: 7 }}>YOUR PROGRESS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 10px 'Orbitron',sans-serif", color: '#fde047', marginBottom: 3 }}><span>LEVEL 14 · COMBAT CHAMPION</span><span style={{ color: '#c4a4d8', fontWeight: 600 }}>250/500 XP</span></div>
        <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 8 }}><div style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg,#b06aff,#fde047)' }}/></div>
        {children}
        <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#9a90b8' }}>This week: <span style={{ color: '#fff', fontWeight: 700 }}>4 sessions</span> · <span style={{ color: '#fde047', fontWeight: 700 }}>380 XP</span></div>
      </div>
    </div>
  );
}

export default function LookStreak() {
  return (
    <Feature id="f1" num="FEATURE 1" title="TODAY'S BOUT + STREAK FREEZE"
      reuse="the home header and its nudge slot, Home's top card and its pick, the existing Mission of the Day bonus (+25 XP), Profile's Game Plan “Days per week”, the end screen's YOUR PROGRESS card."
      isNew="the streak counts weeks that hit the weekly target (rest days never break it), the week chip with day dots, freezes (❄), TODAY'S BOUT (Home's one card, held for the day, with the daily bonus and a done state), the end-screen strip, the target picker. Every card here is the real component.">

      <Look name="Home header: today vs new" note="Top: the chip as it is today (12-day combo, 1 guard). Bottom: the real header with the week chip: 9-week streak, this week's days (gold done, green rest, ring today), 3 of 4 days, 2 freezes. The XP numbers give way so it fits at 360 px." height={190}>
        <div style={{ ...head(9, 600), color: HOME.muted, padding: '10px 14px 0' }}>TODAY</div>
        <LookHomeHeader right={<TodayChip/>}/>
        <div style={{ ...head(9, 600), color: HOME.muted, padding: '8px 14px 0' }}>NEW</div>
        <NewHeader/>
      </Look>

      <Look name="Home: TODAY'S BOUT, ready" note="Home's one card at the top: the day's pick, held all day (here the last session, ready to run again), its length, why it was picked, and the daily bonus beside START: +25 XP once a day for a session started here that runs to its end." height={296}>
        <NewHeader/>
        <Bout bout={FIGHT_BOUT}/>
      </Look>

      <Look name="Home: TODAY'S BOUT, new fit athlete" note="No history yet: the setup's first pick, a 12-minute Quick Mission on the athlete's own level." height={312}>
        <NewHeader done={0} streak={0} freezes={1} days={['today', 'future', 'future', 'future', 'future', 'future', 'future']}/>
        <Bout bout={FIT_BOUT}/>
      </Look>

      <Look name="Home: TODAY'S BOUT, done" note="Once the bonus is paid: the card turns green, says so and that a new bout comes tomorrow; TRAIN AGAIN runs it once more, with no second bonus. Today's dot is filled." height={270}>
        <NewHeader done={4} days={['done', 'done', 'rest', 'done', 'done', 'future', 'future']}/>
        <Bout bout={FIGHT_BOUT} done/>
      </Look>

      <Look name="Streak kept (end screen)" note="One quiet strip in YOUR PROGRESS when the session fills a training day; today's dot pops in. Today's Bout's bonus says so." height={230} animated>
        <YourProgress>
          <WeekMomentStrip missionXp={25} moment={{ kind: 'kept', done: 3, target: 4, streak: 9, freezes: 2, popIndex: 3, days: ['done', 'done', 'rest', 'done', 'future', 'future', 'future'], freezeEarned: null }}/>
        </YourProgress>
      </Look>

      <Look name="Freeze used (next day)" note="A quiet notice under Home's header the week after a short one, once. No guilt: what happened; the chip above it shows the freezes left." height={160} animated>
        <NewHeader freezes={1} done={0} days={['today', 'future', 'future', 'future', 'future', 'future', 'future']}/>
        <div style={{ padding: '14px 16px 0' }}>
          <NudgeToast solid icon="❄" text={noticeCopy({ kind: 'freeze_used', streak: 9, freezes: 1, target: 4 })} onClose={() => {}}/>
        </div>
      </Look>

      <Look name="Freeze earned" note="Earned by training only: one per 4 weeks on target, hold at most 2. Never bought, never an ad. On the end screen that earns it (or once on Home, if that screen has no strip)." height={250} animated>
        <YourProgress>
          <WeekMomentStrip moment={{ kind: 'complete', done: 4, target: 4, streak: 8, freezes: 2, popIndex: 4, days: ['done', 'done', 'rest', 'done', 'done', 'future', 'future'], freezeEarned: { id: 'earned:sample', freezes: 2 } }}/>
        </YourProgress>
      </Look>

      <Look name="Week complete" note="When the 4th day lands. Says plainly that the rest of the week is free to rest." height={230} animated>
        <YourProgress>
          <WeekMomentStrip moment={{ kind: 'complete', done: 4, target: 4, streak: 10, freezes: 2, popIndex: 4, days: ['done', 'done', 'rest', 'done', 'done', 'future', 'future'], freezeEarned: null }}/>
        </YourProgress>
      </Look>

      <Look name="Settings: weekly target" note="Profile → Game Plan → Days per week: 2 to 6 training days, 4 for anyone who never chose. A change starts next Monday, so it can't be gamed mid-week." height={250}>
        <div style={{ padding: 16 }}>
          <WeekTargetRow value={5} current={4} freezes={1} nextFreezeIn={3}/>
        </div>
      </Look>
    </Feature>
  );
}
