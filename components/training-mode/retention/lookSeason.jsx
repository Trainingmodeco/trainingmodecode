import { C } from '../Styles';
import { HOME, head, orb, goldText, Look, Feature, Btn, Sparks } from './looksKit';

// 6 · Season reward track on the concept drop page. Training days inside the
// live drop's window unlock cosmetic rewards that are kept forever.

export const TRACK = [
  { days: 4, icon: '🥋', name: 'SHOTO drop badge', kind: 'Badge' },
  { days: 8, icon: '🖼', name: 'Gi profile frame', kind: 'Frame' },
  { days: 12, icon: '🏷', name: 'Title: Three Styles', kind: 'Title' },
  { days: 16, icon: '✨', name: 'Animated frame', kind: 'Frame' },
  { days: 20, icon: '🥇', name: 'Gold emblem: One Path', kind: 'Emblem' },
];

// The gold line runs from the first reward to the athlete's day count, between rows.
const ROW = 64;
function fillPx(have) {
  const i = TRACK.findIndex((r) => r.days > have);
  if (i === -1) return (TRACK.length - 1) * ROW;
  if (i === 0) return 0;
  const a = TRACK[i - 1].days, b = TRACK[i].days;
  return (i - 1 + (have - a) / (b - a)) * ROW;
}

function Track({ have = 9, claimedUpTo = 4 }) {
  return (
    <div style={{ position: 'relative', padding: '6px 0 6px 18px' }}>
      <div style={{ position: 'absolute', left: 33, top: 26, bottom: 26, width: 4, borderRadius: 2, background: HOME.track }}/>
      <div style={{ position: 'absolute', left: 33, top: 26, height: fillPx(have), width: 4, borderRadius: 2, background: HOME.gold }}/>
      {TRACK.map((r) => {
        const state = r.days <= claimedUpTo ? 'claimed' : r.days <= have ? 'ready' : TRACK.find((x) => x.days > have)?.days === r.days ? 'next' : 'locked';
        return (
          <div key={r.days} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, height: ROW }}>
            <span style={{ width: 34, height: 34, borderRadius: 17, display: 'grid', placeItems: 'center', zIndex: 1, ...head(12), letterSpacing: 0,
              background: state === 'locked' ? '#120d20' : state === 'next' ? '#2a1a4a' : HOME.gold, color: state === 'locked' || state === 'next' ? HOME.muted : '#140a00',
              border: state === 'next' ? `2px solid ${HOME.gold}` : '2px solid transparent', animation: state === 'next' ? 'rl-pulse 1.8s infinite' : 'none' }}>{r.days}</span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, height: 52, borderRadius: 12, padding: '0 10px', marginRight: 12,
              background: state === 'ready' ? 'rgba(242,190,69,.14)' : HOME.tile, border: `1px solid ${state === 'ready' ? HOME.gold : 'rgba(255,255,255,.08)'}`, opacity: state === 'locked' ? 0.55 : 1 }}>
              <span style={{ fontSize: 22, filter: state === 'locked' ? 'grayscale(1)' : 'none' }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...head(13, 600), color: C.text, letterSpacing: '0.02em' }}>{r.name}</div>
                <div style={{ ...head(9, 600), color: HOME.muted }}>{r.kind.toUpperCase()} · {r.days} TRAINING DAYS</div>
              </div>
              {state === 'claimed' && <span style={{ ...head(10), color: HOME.green }}>✓ YOURS</span>}
              {state === 'ready' && <span style={{ ...head(10), color: '#140a00', background: HOME.gold, borderRadius: 8, padding: '6px 8px' }}>CLAIM</span>}
              {state === 'next' && <span style={{ ...head(10), color: HOME.gold }}>{r.days - have} TO GO</span>}
              {state === 'locked' && <span style={{ fontSize: 13 }}>🔒</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LookSeason() {
  return (
    <Feature id="f6" num="FEATURE 6" title="SEASON REWARD TRACK"
      reuse="the concept drop page and its two-month window (CONCEPT_SCHEDULE: SHOTO runs Oct 23 to Nov 30), the drop popup, the badge art."
      isNew="a track of five cosmetic rewards for training days inside the drop, with claimed, claim, next and locked states, days left, and a claimed moment. Proposed set for SHOTO: a drop badge, a gi frame, a title, an animated frame, a gold emblem.">

      <Look name="Drop page: the track" note="9 training days in the drop so far: the 4-day badge is claimed, the 8-day frame is ready to claim, 12 is next. Kept forever; a missed drop's rewards never come back for money." height={560}>
        <div style={{ height: '100%', overflowY: 'auto', background: 'radial-gradient(ellipse at 50% 0%, rgba(239,68,68,.22), #070010 55%)' }}>
          <div style={{ padding: '18px 16px 8px', textAlign: 'center' }}>
            <div style={{ ...head(10, 600), color: HOME.muted }}>LIVE DROP · ENDS IN 8 DAYS</div>
            <div style={{ ...orb(30), ...goldText }}>SHOTO</div>
            <div style={{ fontSize: 13, color: C.text }}>Three styles. One path. Fundamentals, speed, pressure.</div>
          </div>
          <div style={{ margin: '6px 14px 4px', display: 'flex', justifyContent: 'space-between', ...head(11), color: HOME.gold }}><span>DROP TRACK</span><span>9 TRAINING DAYS</span></div>
          <Track/>
        </div>
      </Look>

      <Look name="Reward claimed" note="Tapping CLAIM: the frame lands on the profile picture." height={440} animated>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 22, position: 'relative',
          background: 'radial-gradient(ellipse at center, rgba(239,68,68,.2) 0%, rgba(8,0,18,1) 65%)' }}>
          <Sparks/>
          <div style={{ ...orb(12), color: HOME.muted, animation: 'rl-rise .4s both' }}>SHOTO · 8 TRAINING DAYS</div>
          <div style={{ position: 'relative', width: 120, height: 120, animation: 'rl-pop .7s .3s both' }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: 60, border: '6px solid #fde047', boxShadow: '0 0 0 4px #b91c1c, 0 0 30px rgba(253,224,71,.6)' }}/>
            <span style={{ position: 'absolute', inset: 14, borderRadius: 50, background: 'linear-gradient(160deg,#3b1670,#14052a)', display: 'grid', placeItems: 'center', ...orb(30), color: C.text }}>Y</span>
          </div>
          <div style={{ ...orb(26), ...goldText, animation: 'rl-slam .6s .9s both' }}>GI FRAME UNLOCKED</div>
          <div style={{ fontSize: 14, color: C.text, animation: 'rl-rise .4s 1.3s both' }}>On your profile now. 3 more training days for the title.</div>
          <div style={{ width: '100%', animation: 'rl-rise .4s 1.5s both' }}><Btn>WEAR IT</Btn></div>
        </div>
      </Look>
    </Feature>
  );
}
