import { HOME, head, Look, Feature, HomeHeader as LookHomeHeader } from './looksKit';
import HomeHeader from '../shared/HomeHeader';
import NudgeToast from '../shared/NudgeToast';
import RealWeekChip from './ui/WeekChip';
import DailyMissionCard from './ui/DailyMissionCard';
import WeekMomentStrip from './ui/WeekMomentStrip';
import WeekTargetRow from './ui/WeekTargetRow';
import { noticeCopy } from '../data/weekStreak';

// 1 · Weekly streak + daily mission + freezes. The streak counts weeks that
// reach the weekly target of training days (default 4), so a rest day never
// breaks it. Every card below renders the REAL components (retention/ui,
// shared/HomeHeader, shared/NudgeToast) with sample data: what is drawn here
// is what ships behind the `weeks` switch.

// done | rest | today | future, Monday first
const WEEK = ['done', 'done', 'rest', 'done', 'today', 'future', 'future'];
const FIGHT_MISSION = {
  date: '2026-11-26', side: 'fight', minutes: 3, bonusXp: 25, tier: 'NORMAL', lighter: false,
  discipline: 'Boxing', difficulty: 'Normal', title: 'One Round: Boxing', line: 'Fight Focus · Normal · fits your level',
};
const FIT_MISSION = {
  date: '2026-11-26', side: 'fit', minutes: 3, bonusXp: 25, tier: 'EASY', lighter: true,
  focus: 'Core', difficulty: 'Easy', title: 'Quick Mission: Core', line: 'No gear · Easy · lighter after yesterday',
};

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
    <Feature id="f1" num="FEATURE 1" title="DAILY MISSION + STREAK FREEZE"
      reuse="the home header and its nudge slot, the existing Mission of the Day bonus (+25 XP), Profile's Game Plan “Days per week”, the end screen's YOUR PROGRESS card."
      isNew="the streak counts weeks that hit the weekly target (rest days never break it), the week chip with day dots, freezes (❄), the DAILY MISSION card, the end-screen strip, the target picker. Every card here is the real component.">

      <Look name="Home header: today vs new" note="Top: the chip as it is today (12-day combo, 1 guard). Bottom: the real header with the week chip: 9-week streak, this week's days (gold done, green rest, ring today), 3 of 4 days, 2 freezes. The XP numbers give way so it fits at 360 px." height={190}>
        <div style={{ ...head(9, 600), color: HOME.muted, padding: '10px 14px 0' }}>TODAY</div>
        <LookHomeHeader right={<TodayChip/>}/>
        <div style={{ ...head(9, 600), color: HOME.muted, padding: '8px 14px 0' }}>NEW</div>
        <NewHeader/>
      </Look>

      <Look name="Home: DAILY MISSION, ready" note="Top of home. One tap starts a 3-minute session on the athlete's level: one Fight Focus round for a fighter, a short Quick Mission for a fit athlete. One a day, the same all day." height={270} animated>
        <NewHeader/>
        <div style={{ padding: '14px 16px' }}><DailyMissionCard mission={FIGHT_MISSION} weekDone={3} weekTarget={4}/></div>
      </Look>

      <Look name="Home: DAILY MISSION, fit and lighter" note="A fit athlete who trained yesterday: a Quick Mission one level easier, and it says why." height={270}>
        <NewHeader done={2} streak={0} freezes={1} days={['done', 'rest', 'done', 'today', 'future', 'future', 'future']}/>
        <div style={{ padding: '14px 16px' }}><DailyMissionCard mission={FIT_MISSION} weekDone={2} weekTarget={4}/></div>
      </Look>

      <Look name="Home: DAILY MISSION, done" note="After a valid, finished session started from the card: the card turns green and says when the next one comes. Today's dot is filled." height={250}>
        <NewHeader done={4} days={['done', 'done', 'rest', 'done', 'done', 'future', 'future']}/>
        <div style={{ padding: '14px 16px' }}><DailyMissionCard mission={FIGHT_MISSION} done weekDone={4} weekTarget={4}/></div>
      </Look>

      <Look name="Streak kept (end screen)" note="One quiet strip in YOUR PROGRESS when the session fills a training day; today's dot pops in. The daily mission's bonus says so." height={230} animated>
        <YourProgress>
          <WeekMomentStrip missionXp={25} moment={{ kind: 'kept', done: 3, target: 4, streak: 9, freezes: 2, popIndex: 3, days: ['done', 'done', 'rest', 'done', 'future', 'future', 'future'], freezeEarned: null }}/>
        </YourProgress>
      </Look>

      <Look name="Freeze used (next day)" note="A quiet notice in Home's nudge slot the week after a short one, once. No guilt: what happened; the chip shows the freezes left." height={200} animated>
        <div style={{ position: 'relative' }}>
          <NewHeader freezes={1} done={0} days={['today', 'future', 'future', 'future', 'future', 'future', 'future']}/>
          <div style={{ position: 'absolute', left: 16, right: 16, top: 10 }}>
            <NudgeToast solid icon="❄" text={noticeCopy({ kind: 'freeze_used', streak: 9, freezes: 1, target: 4 })} onClose={() => {}}/>
          </div>
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
