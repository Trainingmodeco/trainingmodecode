import { createPortal } from 'react-dom';
import SafeImage from './SafeImage';

// First contact through a haunt link. Someone who has never used Training
// Mode opens a friend's ghost — before any setup questionnaire — and gets:
//
//   page 'intro'   — what Training Mode is, that they've been challenged to a
//                    fitness challenge, the app is free, and why people use it.
//   page 'battle'  — what a ghost battle is and exactly what they'll use:
//                    the Fight Focus timer, the strike counter, the bell.
//   page 'welcome' — after the battle, or if they pass on it: the app's main
//                    features, and a reminder that the ghost waits (or, if
//                    they beat it, that they did). Then the normal setup.
//
// Everything about the ghost here comes from the ghost itself.

const VIOLET = '#B794FF';
const GOLD = '#F2BE45';
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

const CSS = `
@keyframes hw-rise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes hw-glow { 0%, 100% { filter: drop-shadow(0 0 14px rgba(168,85,247,.55)) } 50% { filter: drop-shadow(0 0 26px rgba(217,70,239,.8)) } }
.hw-in { animation: hw-rise .5s ease both }
.hw-logo { animation: hw-glow 3.2s ease-in-out infinite; }
.hw-gold:hover, .hw-gold:focus-visible { filter: brightness(1.1); }
.hw-txt:hover, .hw-txt:focus-visible { color: #FFFFFF !important; }
@media (prefers-reduced-motion: reduce) { .hw-in, .hw-logo { animation: none !important } }
`;

const WHY = [
  ['🥊', 'TRAIN LIKE A FIGHTER', 'Boxing, kickboxing, Muay Thai and MMA rounds with a voice coach and a bell.'],
  ['💪', 'GET FIT YOUR WAY', 'Strength, cardio and quick workouts built around your gear and your time.'],
  ['🕹️', 'WORKOUTS AS A GAME', 'The Training Arcade turns real workouts into stages and boss fights.'],
  ['📈', 'SEE YOURSELF IMPROVE', 'XP, levels, streaks and trophies for every session you finish.'],
];

const FEATURES = [
  ['💪', 'FIT MODE', 'Quick missions, build-your-own workouts, programs and cardio.'],
  ['🥊', 'FIGHT MODE', 'Just Train, Fight Focus and Combo Coach round timers, plus Training Camp.'],
  ['📚', 'PRACTICE', 'Learn each move step by step, then drill it in a practice round.'],
  ['🕹️', 'TRAINING ARCADE', 'Real workouts played as stages, with a boss at the end.'],
  ['👻', 'GHOSTS', 'Race your own best sessions — and haunt your friends back.'],
];

function Logo({ size }) {
  return (
    <SafeImage className="hw-logo" src="/static/brand/tm-logo-violet.webp" alt="Training Mode" style={{ width: size, height: size, objectFit: 'contain' }}/>
  );
}

function Row({ icon, k, v }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(10,6,24,.82)', border: '1px solid rgba(168,85,247,.35)' }}>
      <span style={{ fontSize: 18, lineHeight: 1.1, flexShrink: 0 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', color: '#fff' }}>{k}</span>
        <span style={{ fontSize: 12.5, lineHeight: 1.3, color: '#BDB6D6' }}>{v}</span>
      </div>
    </div>
  );
}

const goldBtn = {
  height: 54, border: 0, cursor: 'pointer', width: '100%', flexShrink: 0,
  clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
  background: 'linear-gradient(180deg, #FFE9A8 0%, #F2BE45 50%, #C98A1C 100%)', color: '#1A1204',
  font: "900 14px 'Orbitron',sans-serif", letterSpacing: '0.12em', boxShadow: '0 0 28px rgba(242,190,69,.4)',
};
const quietBtn = {
  height: 40, background: 'none', border: 0, cursor: 'pointer', color: '#A9A3C4', width: '100%', flexShrink: 0,
  font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
};
const kickerStyle = { font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.22em', color: VIOLET, textAlign: 'center' };
const titleStyle = {
  font: "italic 900 25px 'Orbitron',sans-serif", lineHeight: 1.05, textAlign: 'center', textWrap: 'balance',
  background: 'linear-gradient(180deg, #FFF6C8 0%, #FDE047 45%, #E0A21C 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  filter: 'drop-shadow(0 0 12px rgba(168,85,247,.5)) drop-shadow(2px 2px 0 #3B0764)',
};

export default function HauntWelcome({ page, challenge, beaten = false, onNext, onBack, onAccept, onDecline, onExplore }) {
  const g = challenge?.ghost || {};
  const name = String(g.ownerName || 'A FRIEND').toUpperCase();
  const rc = g.source?.roundsConfig || {};
  const rounds = rc.rounds && rc.roundSec ? `${rc.rounds} round${rc.rounds === 1 ? '' : 's'} of ${mmss(rc.roundSec)}` : 'their rounds';
  const level = String(g.source?.difficulty || 'normal').toLowerCase();

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Welcome to Training Mode" style={{
      position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 950, overflowY: 'auto', boxSizing: 'border-box',
      padding: '18px 20px calc(18px + env(safe-area-inset-bottom, 0px))', color: '#fff', fontFamily: 'Barlow, system-ui, sans-serif',
      background: 'radial-gradient(100% 45% at 50% 0%, rgba(107,43,217,.35) 0%, #07060C 70%), #07060C',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>

      {page === 'intro' && (
        <>
          <div className="hw-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Logo size={104}/>
            <span style={{ font: "900 13px 'Orbitron',sans-serif", letterSpacing: '0.3em', color: '#E6E2F5' }}>TRAINING MODE</span>
          </div>
          <div className="hw-in" style={kickerStyle}>👻 YOU&apos;VE BEEN HAUNTED</div>
          <div className="hw-in" style={titleStyle}>{name} DARED YOU TO A FITNESS CHALLENGE.</div>
          <div className="hw-in" style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(168,85,247,.10)', border: '1px solid rgba(196,168,255,.4)', fontSize: 14, lineHeight: 1.45, color: '#E6E2F5' }}>
            <strong>Training Mode is a fitness app</strong> built around how fighters train. {name.charAt(0) + name.slice(1).toLowerCase()} finished a real workout in it and sent you
            its <strong>ghost</strong> — a recording of that session — to see if you can beat it. The link gets you in <strong>free</strong>: no account and no card needed.
          </div>
          <span style={{ font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: '#A9A3C4' }}>WHY PEOPLE TRAIN HERE</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {WHY.map(([icon, k, v]) => <Row key={k} icon={icon} k={k} v={v}/>)}
          </div>
          <div style={{ flexGrow: 1 }}/>
          <button type="button" className="hw-gold" onClick={onNext} style={goldBtn}>NEXT · THE CHALLENGE ›</button>
          <button type="button" className="hw-txt" onClick={onDecline} style={quietBtn}>NOT NOW — JUST SHOW ME THE APP</button>
        </>
      )}

      {page === 'battle' && (
        <>
          <div className="hw-in" style={{ display: 'flex', justifyContent: 'center' }}><Logo size={64}/></div>
          <div className="hw-in" style={kickerStyle}>THE GHOST BATTLE</div>
          <div className="hw-in" style={titleStyle}>RACE {name}&apos;S GHOST</div>
          <div className="hw-in" style={{ fontSize: 14, lineHeight: 1.45, color: '#E6E2F5', textAlign: 'center' }}>
            Their session plays back beside yours, strike for strike. Throw more strikes than the ghost&apos;s <strong style={{ color: GOLD }}>{g.totalStrikes ?? '—'}</strong> by the final bell and you win.
            Surprise rushes are thrown in — when the coach calls one, go all out.
          </div>
          <span style={{ font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: '#A9A3C4' }}>WHAT YOU&apos;LL USE</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row icon="⏱" k="FIGHT FOCUS — THE ROUND TIMER" v={`Already set to their session: ${rounds}, on ${level}. Just press START SESSION.`}/>
            <Row icon="👊" k="THE STRIKE COUNTER" v="Only counted strikes race the ghost. On the timer, tap 👊 COUNT STRIKES and allow motion, then keep your phone in a pocket or waistband (or an armband, or your lead hand)."/>
            <Row icon="🔔" k="THE BELL AND THE COACH" v="The bell starts and ends every round, and the coach calls the work. Rest between rounds is built in."/>
            <Row icon="❤️" k="A QUICK HEALTH CHECK FIRST" v="A few yes/no questions before your first round, to keep the challenge safe for you."/>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: '#8E88A8' }}>Not ready? The ghost won&apos;t disappear until you beat it.</div>
          <div style={{ flexGrow: 1 }}/>
          <button type="button" className="hw-gold" onClick={onAccept} style={goldBtn}>ACCEPT THE CHALLENGE</button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="hw-txt" onClick={onBack} style={{ ...quietBtn, width: 'auto', flex: '0 0 auto', padding: '0 8px' }}>‹ BACK</button>
            <button type="button" className="hw-txt" onClick={onDecline} style={{ ...quietBtn, flex: 1 }}>NOT NOW — SHOW ME THE APP</button>
          </div>
        </>
      )}

      {page === 'welcome' && (
        <>
          <div className="hw-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Logo size={84}/>
            <span style={{ font: "900 13px 'Orbitron',sans-serif", letterSpacing: '0.3em', color: '#E6E2F5' }}>TRAINING MODE</span>
          </div>
          <div className="hw-in" style={kickerStyle}>WELCOME</div>
          <div className="hw-in" style={titleStyle}>{beaten ? 'YOU BEAT THE GHOST.' : 'THE GHOST WILL WAIT.'}</div>
          <div className="hw-in" style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(168,85,247,.10)', border: '1px solid rgba(196,168,255,.4)', fontSize: 14, lineHeight: 1.45, color: '#E6E2F5', textAlign: 'center' }}>
            {beaten
              ? <>Nice work. After any Fight Focus session you can send your own ghost back — <strong>HAUNT A FRIEND</strong> is on the summary screen.</>
              : <>{name}&apos;s ghost isn&apos;t going anywhere — <strong>it won&apos;t disappear until you beat it.</strong> Whenever you&apos;re ready, tap the 👻 on your Home screen.</>}
          </div>
          <span style={{ font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: '#A9A3C4' }}>WHAT&apos;S INSIDE</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {FEATURES.map(([icon, k, v]) => <Row key={k} icon={icon} k={k} v={v}/>)}
          </div>
          <div style={{ textAlign: 'center', fontSize: 12.5, color: '#BDB6D6' }}>Next: a few quick questions to set up your training, then a short tour.</div>
          <div style={{ flexGrow: 1 }}/>
          <button type="button" className="hw-gold" onClick={onExplore} style={goldBtn}>EXPLORE THE APP ›</button>
        </>
      )}
    </div>,
    document.body,
  );
}
