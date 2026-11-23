import { Zap } from 'lucide-react';
import { Look, Feature } from './looksKit';
import HomeHeader from '../shared/HomeHeader';
import NudgeToast from '../shared/NudgeToast';
import RealWeekChip from './ui/WeekChip';
import PowerLine from './ui/PowerLine';
import ReviveLine from './ui/ReviveLine';
import { RustyCard } from './ui/RustyPopup';
import { RustyPortraitImage } from './ui/RustyLook';
import { HOME } from './ui/tokens';
import { tierImage } from '../data/tiers';
import { powerNoticeCopy } from '../data/power';

// POWER, RUSTY and REVIVE (the owner's idea, 2026-11-23; switch `power`).
// POWER drains while the athlete stays away and refills with one finished
// session; after a month away the fighter is RUSTY (nothing earned is taken
// away); REVIVE is the comeback session. Every card renders the REAL
// components with sample data. No phone alerts in this build.
const WEEK = ['done', 'rest', 'rest', 'today', 'future', 'future', 'future'];

function Header({ power, state }) {
  return (
    <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <HomeHeader level={14} tierName="Champion" levelXp={250} levelNeeded={500} xpPercent={50} compact
        chip={<RealWeekChip days={WEEK} done={1} target={4} streak={6} freezes={2}/>}/>
      {power != null && <PowerLine pct={power} state={state}/>}
    </div>
  );
}

export default function LookPower() {
  return (
    <Feature id="f8" num="1UP · POWER" title="POWER, RUSTY + REVIVE"
      reuse="Home's header and its notice slot, the open's one pop-up turn, TODAY'S BOUT's START, the tier portraits, the end screen's YOUR PROGRESS card."
      isNew="a slim POWER line under Home's header once the fighter is below full (full for 3 days after training, empty at day 28), one quiet notice when it runs low, RUSTY after a month away (a pop-up once, the portrait greyed and dusty), REVIVE (one finished session: back to 100%, one calm line). No XP, level, streak or badge is ever taken.">

      <Look name="Home: full (nothing new)" note="Trained in the last 3 days: POWER is full, and Home shows nothing new." height={78}>
        <Header/>
      </Look>

      <Look name="Home: draining" note="Day 10 away: one slim line under the header, in line with the level, the bar at 72%." height={100}>
        <Header power={72} state="draining"/>
      </Look>

      <Look name="Home: low, with its notice" note="40% or less: the bar turns amber, and one quiet notice under it, once per drain." height={170}>
        <Header power={36} state="low"/>
        <div style={{ padding: '14px 16px 0' }}>
          <NudgeToast solid icon={<Zap size={20} color={HOME.low} fill={HOME.low} strokeWidth={0}/>} text={powerNoticeCopy({ kind: 'low', pct: 36 })} onClose={() => {}}/>
        </div>
      </Look>

      <Look name="Home: RUSTY" note="30 days away: the line reads RUSTY (until the owner's art, nothing else on Home changes)." height={100}>
        <Header power={0} state="rusty"/>
      </Look>

      <Look name="RUSTY pop-up (once per spell)" note="On opening the app, once per rusty spell, never over another pop-up. Stand-in art: the athlete's own tier portrait, greyed, with dust and rust. REVIVE runs TODAY'S BOUT's START; LATER closes it." height={560} animated>
        <div style={{ padding: '20px 16px', display: 'flex', justifyContent: 'center' }}>
          <RustyCard sex="male" tierId="warrior" daysSince={34}/>
        </div>
      </Look>

      <Look name="Portrait while RUSTY" note="Profile, the Level page and the end screen show the athlete's portrait rusty; the name, level and XP stay as they are." height={170}>
        <div style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
          {[false, true].map((r) => (
            <div key={String(r)} style={{ position: 'relative', width: 72, height: 90, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(253,224,71,0.5)', flexShrink: 0 }}>
              <RustyPortraitImage src={tierImage('warrior', 'female')} rusty={r} imgStyle={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}/>
            </div>
          ))}
          <div style={{ fontSize: 13, color: HOME.muted, lineHeight: 1.35 }}>Left: trained. Right: RUSTY.</div>
        </div>
      </Look>

      <Look name="REVIVED (end screen)" note="The first finished session after low or RUSTY: one calm line in YOUR PROGRESS, once (the revive art beside it when the file exists)." height={130} animated>
        <div style={{ padding: '18px 16px' }}>
          <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(176,106,255,0.3)', borderRadius: 11, padding: '9px 12px' }}>
            <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#b06aff', letterSpacing: '0.16em', marginBottom: 7 }}>YOUR PROGRESS</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 10px 'Orbitron',sans-serif", color: '#fde047', marginBottom: 7 }}><span>LEVEL 14 · COMBAT CHAMPION</span><span style={{ color: '#c4a4d8', fontWeight: 600 }}>250/500 XP</span></div>
            <ReviveLine sex="male"/>
          </div>
        </div>
      </Look>
    </Feature>
  );
}
