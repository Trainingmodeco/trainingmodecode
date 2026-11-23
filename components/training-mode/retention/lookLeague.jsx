import { C } from '../Styles';
import { HOME, head, orb, goldText, Look, Feature, Btn, Sparks, HomeHeader } from './looksKit';
import { WeekChip } from './lookStreak';

// 4 · Weekly leagues. About 30 real athletes per group, weekly XP from valid
// sessions only, top 5 go up and bottom 5 go down, Monday to Sunday.

export const TIERS = ['GARAGE', 'GYM', 'CLUB', 'ARENA', 'MAIN EVENT', 'TITLE BOUT'];
const ROWS = Array.from({ length: 30 }, (_, i) => ({
  pos: i + 1,
  name: i === 6 ? 'You' : `Trainee ${String(i + 1).padStart(2, '0')}`,
  xp: Math.round(1480 * Math.pow(0.9, i)),
  you: i === 6,
}));

function TierBadge({ name, size = 44 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 12, display: 'grid', placeItems: 'center', flexShrink: 0,
      background: 'linear-gradient(160deg, rgba(253,224,71,.25), rgba(168,85,247,.25))', border: '1.5px solid rgba(253,224,71,.6)',
      ...orb(size * 0.3), ...goldText }}>{name.split(' ').map((w) => w[0]).join('')}</span>
  );
}

function LeagueScreen() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse at 50% 0%, rgba(60,10,110,.6), #070010 60%)' }}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <TierBadge name="ARENA"/>
        <div style={{ flex: 1 }}>
          <div style={{ ...orb(17), ...goldText }}>ARENA LEAGUE</div>
          <div style={{ ...head(10, 600), color: HOME.muted }}>TIER 4 OF 6 · 30 ATHLETES · THIS WEEK</div>
        </div>
        <div style={{ textAlign: 'right' }}><div style={{ ...head(9, 600), color: HOME.muted }}>ENDS IN</div><div style={{ ...head(15), color: HOME.gold }}>2d 14h</div></div>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', ...head(10, 600) }}>
        <span style={{ color: HOME.green }}>▲ TOP 5 GO UP TO MAIN EVENT</span><span style={{ marginLeft: 'auto', color: HOME.red }}>▼ BOTTOM 5 DROP</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {ROWS.map((r) => (
          <div key={r.pos}>
            {r.pos === 6 && <div style={{ ...head(9, 700), color: HOME.green, textAlign: 'center', borderTop: '1px dashed rgba(143,232,172,.5)', margin: '6px 0', paddingTop: 4 }}>PROMOTION ZONE ▲</div>}
            {r.pos === 26 && <div style={{ ...head(9, 700), color: HOME.red, textAlign: 'center', borderTop: '1px dashed rgba(255,122,122,.5)', margin: '6px 0', paddingTop: 4 }}>DROP ZONE ▼</div>}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 10px', borderRadius: 10, marginBottom: 3,
              background: r.you ? 'rgba(242,190,69,.16)' : r.pos <= 5 ? 'rgba(143,232,172,.06)' : r.pos > 25 ? 'rgba(255,122,122,.05)' : HOME.tile,
              border: r.you ? `1.5px solid ${HOME.gold}` : '1px solid transparent',
            }}>
              <span style={{ width: 22, ...head(12), color: r.pos <= 3 ? HOME.gold : HOME.muted, letterSpacing: 0 }}>{r.pos}</span>
              <span style={{ width: 26, height: 26, borderRadius: 13, background: r.you ? HOME.gold : 'rgba(168,85,247,.3)', display: 'grid', placeItems: 'center', ...head(10), color: r.you ? '#140a00' : C.text, letterSpacing: 0 }}>{r.you ? 'Y' : 'T'}</span>
              <span style={{ flex: 1, ...head(13, 600), color: r.you ? HOME.gold : C.text, letterSpacing: '0.02em' }}>{r.name}</span>
              <span style={{ ...head(12), color: r.you ? HOME.gold : C.text, letterSpacing: 0 }}>{r.xp.toLocaleString()} XP</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekEnd({ kind }) {
  const k = {
    up: { icon: '▲', color: HOME.green, title: 'PROMOTED', big: 'MAIN EVENT', sub: 'Finished #4 in Arena League. Next week you train with the Main Event group.' },
    stay: { icon: '■', color: HOME.gold, title: 'HELD YOUR GROUND', big: 'ARENA', sub: 'Finished #12. You stay in Arena League; 280 more XP would have gone up.' },
    down: { icon: '▼', color: '#ffb27a', title: 'NEW WEEK, NEW GROUP', big: 'CLUB', sub: 'Finished #27, so you move to Club League. A fresh week starts Monday; the top 5 go back up.' },
  }[kind];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', padding: 20, position: 'relative',
      background: 'radial-gradient(ellipse at center, rgba(60,10,110,.6) 0%, rgba(8,0,18,1) 70%)' }}>
      {kind === 'up' && <Sparks/>}
      <div style={{ fontSize: 40, color: k.color, animation: kind === 'down' ? 'rl-rise .6s both' : 'rl-pop .6s both' }}>{k.icon}</div>
      <div style={{ ...orb(12), color: k.color, animation: 'rl-rise .4s .3s both' }}>{k.title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'rl-slam .6s .5s both' }}><TierBadge name={k.big} size={38}/><span style={{ ...orb(26), ...goldText }}>{k.big}</span></div>
      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.35, animation: 'rl-rise .4s .9s both' }}>{k.sub}</div>
    </div>
  );
}

export default function LookLeague() {
  return (
    <Feature id="f4" num="FEATURE 4" title="WEEKLY LEAGUES"
      reuse="the arcade gold titles and panels, the home tile style, the XP from valid sessions (mission integrity) as the only score."
      isNew={`the league screen with promotion and drop zones, a home card, three week-end moments, an empty state and an opt-out. Proposed tier names, low to high: ${TIERS.join(' · ')}.`}>

      <Look name="League screen" note="About 30 real athletes, weekly XP only. Top 5 go up, bottom 5 drop. You are highlighted; the list opens on your row." height={640}>
        <LeagueScreen/>
      </Look>

      <Look name="Home: league card" note="Small, under Today's Bout: tier, place, days left, and how far the promotion zone is." height={170}>
        <HomeHeader right={<WeekChip/>}/>
        <div style={{ margin: '8px 14px', height: 64, borderRadius: 14, background: HOME.tile, border: '1px solid rgba(168,85,247,.35)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px' }}>
          <TierBadge name="ARENA" size={40}/>
          <div style={{ flex: 1 }}>
            <div style={{ ...head(10, 600), color: HOME.muted }}>ARENA LEAGUE · 2 DAYS LEFT</div>
            <div style={{ ...head(15), color: C.text, letterSpacing: '0.02em' }}>#7 of 30 · <span style={{ color: HOME.green }}>90 XP to the top 5</span></div>
          </div>
          <span style={{ color: HOME.muted, fontSize: 18 }}>›</span>
        </div>
      </Look>

      <Look name="Week end: promoted" note="Monday morning, once, on opening the app." height={330} animated><WeekEnd kind="up"/></Look>
      <Look name="Week end: stayed" note="Same group next week; says how close promotion was." height={330} animated><WeekEnd kind="stay"/></Look>
      <Look name="Week end: dropped" note="No shame copy: a new group and a fresh week." height={330} animated><WeekEnd kind="down"/></Look>

      <Look name="Empty state + opt-out" note="No bots, no padding: a league only opens when enough real athletes trained that week. Leagues are opt-in; display name only." height={420}>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ borderRadius: 14, border: '1px dashed rgba(168,85,247,.5)', padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 34 }}>🏟️</div>
            <div style={{ ...orb(14), ...goldText, marginTop: 4 }}>LEAGUES OPEN SOON</div>
            <div style={{ fontSize: 14, color: C.text, marginTop: 6 }}>A league starts when 20 athletes at your level train in the same week. This week: 12.</div>
            <div style={{ fontSize: 12, color: HOME.muted, marginTop: 6 }}>Your training this week still counts for your streak and XP.</div>
          </div>
          <div style={{ borderRadius: 12, background: HOME.tile, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...head(13), color: C.text }}>WEEKLY LEAGUES</div>
                <div style={{ fontSize: 12, color: HOME.muted }}>Shows your display name and weekly XP. Never your email or location.</div>
              </div>
              <span style={{ width: 46, height: 26, borderRadius: 13, background: HOME.gold, position: 'relative', flexShrink: 0 }}><span style={{ position: 'absolute', right: 3, top: 3, width: 20, height: 20, borderRadius: 10, background: '#140a00' }}/></span>
            </div>
          </div>
          <Btn tone="ghost">LEAVE LEAGUES</Btn>
        </div>
      </Look>
    </Feature>
  );
}
