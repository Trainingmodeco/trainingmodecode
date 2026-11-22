import { C } from '../Styles';
import { HOME, head, orb, goldText, Look, Feature, Bar, Btn, Sparks, HomeHeader } from './looksKit';

// 1 · Daily mission + streak freeze. The streak counts weeks that reach the
// weekly target of training days (default 4), so a rest day never breaks it.

// done | rest | today | future
const WEEK = ['done', 'done', 'rest', 'done', 'today', 'future', 'future'];

function Dot({ s, pop }) {
  const base = { width: 7, height: 7, borderRadius: 4, display: 'inline-block' };
  if (s === 'done') return <span style={{ ...base, background: HOME.gold, boxShadow: '0 0 6px rgba(242,190,69,.7)', animation: pop ? 'rl-dot .6s .5s both' : 'none' }}/>;
  if (s === 'today') return <span style={{ ...base, border: `1.5px solid ${HOME.gold}`, boxSizing: 'border-box' }}/>;
  if (s === 'rest') return <span style={{ ...base, background: 'rgba(143,232,172,.35)' }} title="rest"/>;
  return <span style={{ ...base, background: HOME.track }}/>;
}

export function TodayChip() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', borderRadius: 16, background: HOME.chip, color: HOME.gold, flexShrink: 0 }}>
      <span style={{ fontSize: 14 }}>🔥</span><span style={{ ...head(14), letterSpacing: 0 }}>12</span>
      <span style={{ fontSize: 10, color: HOME.green }}>🛡1</span>
    </div>
  );
}

export function WeekChip({ week = WEEK, done = 3, target = 4, streak = 9, freezes = 2, pop }) {
  return (
    <div aria-label={`${streak} week streak, ${done} of ${target} training days this week, ${freezes} freezes`} style={{
      display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 9px', borderRadius: 17, background: HOME.chip, color: HOME.gold, flexShrink: 0,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span style={{ fontSize: 13 }}>🔥</span><span style={{ ...head(13), letterSpacing: 0 }}>{streak}</span><span style={{ ...head(8, 600), color: HOME.muted }}>WK</span></span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ display: 'flex', gap: 2 }}>{week.map((s, i) => <Dot key={i} s={s} pop={pop && i === 4}/>)}</span>
        <span style={{ ...head(8, 700), letterSpacing: '0.06em', color: HOME.muted }}>{done}/{target} DAYS</span>
      </span>
      <span style={{ ...head(11), color: '#9ad8ff', letterSpacing: 0 }}>❄{freezes}</span>
    </div>
  );
}

function MissionCard({ done }) {
  return (
    <div style={{
      margin: '6px 14px', borderRadius: 14, padding: 14, position: 'relative', overflow: 'hidden',
      background: done ? HOME.tile : 'linear-gradient(135deg, rgba(242,190,69,.16), rgba(157,108,255,.14))',
      border: `1px solid ${done ? 'rgba(143,232,172,.4)' : 'rgba(242,190,69,.55)'}`,
    }}>
      {!done && <div style={{ position: 'absolute', top: 0, bottom: 0, width: 40, background: 'rgba(255,255,255,.12)', animation: 'rl-shine 2.6s 1s infinite' }}/>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...head(10), color: done ? HOME.green : HOME.gold }}>{done ? '✓ DAILY MISSION DONE' : 'DAILY MISSION'}</span>
        <span style={{ marginLeft: 'auto', ...head(10, 600), color: HOME.muted }}>{done ? 'NEW ONE TOMORROW' : '3 MIN'}</span>
      </div>
      <div style={{ ...head(18), color: C.text, marginTop: 6, letterSpacing: '0.02em' }}>One Round: Jab, Cross, Slip</div>
      <div style={{ fontSize: 13, color: HOME.muted, marginTop: 2 }}>Fight Focus · fits your level · counts as a training day</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        {done
          ? <span style={{ ...head(14), color: HOME.green }}>+40 XP · DAY 4 OF 4 ✓</span>
          : <><Btn style={{ width: 'auto', flex: 1 }}>▶ START</Btn><span style={{ ...head(14), color: HOME.gold }}>+40 XP</span></>}
      </div>
    </div>
  );
}

function Moment({ icon, title, big, sub, children, tone = HOME.gold, sparks }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 22, textAlign: 'center', position: 'relative',
      background: 'radial-gradient(ellipse at center, rgba(60,10,110,.65) 0%, rgba(8,0,18,1) 70%)' }}>
      {sparks && <Sparks/>}
      <div style={{ fontSize: 54, animation: 'rl-pop .7s both' }}>{icon}</div>
      <div style={{ ...orb(13), color: tone, animation: 'rl-rise .5s .3s both' }}>{title}</div>
      {big && <div style={{ ...orb(34), ...goldText, animation: 'rl-slam .6s .5s both' }}>{big}</div>}
      {sub && <div style={{ fontSize: 15, color: C.text, lineHeight: 1.35, animation: 'rl-rise .5s .8s both' }}>{sub}</div>}
      <div style={{ width: '100%', animation: 'rl-rise .5s 1s both' }}>{children}</div>
    </div>
  );
}

export default function LookStreak() {
  return (
    <Feature id="f1" num="FEATURE 1" title="DAILY MISSION + STREAK FREEZE"
      reuse="the home header chip and its 🔥 / 🛡 marks (comboStreak.js), the existing daily-mission bonus, the home tile style."
      isNew="the streak counts weeks that hit the weekly target (rest days never break it), the week chip with day dots, freezes (❄), the DAILY MISSION card, four moments and the target picker.">

      <Look name="Home header: today vs new" note="Top: the chip as it is today (12-day streak, 1 guard). Bottom: the new chip: 9-week streak, this week's days (gold done, green rest, ring today), 3 of 4 days, 2 freezes." height={170}>
        <div style={{ ...head(9, 600), color: HOME.muted, padding: '10px 14px 0' }}>TODAY</div>
        <HomeHeader right={<TodayChip/>}/>
        <div style={{ ...head(9, 600), color: HOME.muted, padding: '8px 14px 0' }}>NEW</div>
        <HomeHeader right={<WeekChip/>}/>
      </Look>

      <Look name="Home: DAILY MISSION, ready" note="Top of home. One tap starts a 3-minute session picked for the athlete's level and yesterday's work. One a day." height={250} animated>
        <HomeHeader right={<WeekChip/>}/>
        <MissionCard/>
      </Look>

      <Look name="Home: DAILY MISSION, done" note="After finishing: the card turns green and says when the next one comes. The week chip has filled today's dot." height={250}>
        <HomeHeader right={<WeekChip week={['done', 'done', 'rest', 'done', 'done', 'future', 'future']} done={4}/>}/>
        <MissionCard done/>
      </Look>

      <Look name="Streak kept (after a session)" note="Shown on the session end screen when the session fills a day of the week. Today's dot pops in." height={420} animated>
        <Moment icon="🔥" title="TRAINING DAY 3 OF 4" big="STREAK KEPT" sub="One more day this week keeps your 9-week streak going.">
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}><WeekChip pop week={['done', 'done', 'rest', 'done', 'future', 'future', 'future']}/></div>
        </Moment>
      </Look>

      <Look name="Freeze used (next day)" note="A quiet notice on home the day after a missed week. No guilt copy: it says what happened and what is left." height={220} animated>
        <HomeHeader right={<WeekChip freezes={1} done={0} week={['today', 'future', 'future', 'future', 'future', 'future', 'future']}/>}/>
        <div style={{ margin: '8px 14px', borderRadius: 12, background: 'rgba(154,216,255,.08)', border: '1px solid rgba(154,216,255,.4)', padding: 12, display: 'flex', gap: 10, animation: 'rl-rise .5s .2s both' }}>
          <span style={{ fontSize: 24, animation: 'rl-snow 1.2s .4s both' }}>❄</span>
          <div>
            <div style={{ ...head(12), color: '#9ad8ff' }}>A FREEZE COVERED LAST WEEK</div>
            <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>Your 9-week streak is safe. 1 freeze left. New week, new 4 days.</div>
          </div>
        </div>
      </Look>

      <Look name="Freeze earned" note="Earned by training only (suggested: one per 4 weeks on target, hold at most 2). Never bought, never an ad." height={400} animated>
        <Moment icon="❄" tone="#9ad8ff" title="4 WEEKS ON TARGET" big="FREEZE EARNED" sparks sub="If life gets in the way one week, a freeze keeps your streak. You hold 2 of 2.">
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 6 }}>
            {[0, 1].map((i) => <span key={i} style={{ width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 22, background: 'rgba(154,216,255,.1)', border: '1px solid rgba(154,216,255,.55)', animation: `rl-pop .5s ${1.1 + i * 0.25}s both` }}>❄</span>)}
          </div>
        </Moment>
      </Look>

      <Look name="Week complete" note="When the 4th day lands. Says plainly that the rest of the week is free to rest." height={420} animated>
        <Moment icon="🏆" title="WEEK COMPLETE · 4 OF 4" big="10-WEEK STREAK" sparks sub="Target hit. Rest the remaining days or keep going: both count.">
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}><WeekChip done={4} streak={10} week={['done', 'done', 'rest', 'done', 'done', 'future', 'future']}/></div>
        </Moment>
      </Look>

      <Look name="Settings: weekly target" note="2 to 6 training days a week, default 4. Changing it starts counting next week, so it can't be gamed mid-week." height={330}>
        <div style={{ padding: 16 }}>
          <div style={{ ...head(12), color: HOME.gold }}>WEEKLY TARGET</div>
          <div style={{ fontSize: 13, color: HOME.muted, marginTop: 4 }}>Training days a week that keep your streak. Rest days never break it.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {[2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" style={{
                flex: 1, height: 52, borderRadius: 12, cursor: 'pointer', ...head(20), letterSpacing: 0,
                background: n === 4 ? 'rgba(242,190,69,.16)' : HOME.tile, color: n === 4 ? HOME.gold : C.text,
                border: `1.5px solid ${n === 4 ? HOME.gold : 'rgba(255,255,255,.12)'}`,
              }}>{n}</button>
            ))}
          </div>
          <div style={{ ...head(10, 600), color: HOME.muted, marginTop: 8, textAlign: 'center' }}>4 DAYS · RECOMMENDED</div>
          <div style={{ marginTop: 18, borderRadius: 12, background: HOME.tile, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', ...head(11), color: C.text }}><span>FREEZES</span><span style={{ color: '#9ad8ff' }}>❄ 2 / 2</span></div>
            <div style={{ fontSize: 12, color: HOME.muted, marginTop: 4 }}>Next one in 3 weeks on target.</div>
            <div style={{ marginTop: 8 }}><Bar value={1} max={4} color="#9ad8ff" height={6}/></div>
          </div>
        </div>
      </Look>
    </Feature>
  );
}
