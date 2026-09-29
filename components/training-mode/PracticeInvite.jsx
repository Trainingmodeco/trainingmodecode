import { createPortal } from 'react-dom';
import SafeImage from './SafeImage';
import { weeklySummary, WEEKLY_BONUS_XP } from './data/practiceInvite';
import { getLibraryDrilled } from './data/practiceLessons';
import { buildRound, planLine } from './data/practiceRound';

// The Practice posters (Simplify revamp, PracticeInvite.dc.html), full
// screen over everything:
//
// - view 'intro': once, at the end of first-run setup, for new learners.
//   START LESSON 1 opens Practice on lesson 1; the secondary button lets
//   them explore on their own.
// - view 'weekly': the weekly nudge until one discipline's basics are done.
//   Shows each discipline's basics and the next lesson, and promises the
//   bonus data/practiceInvite actually pays.
//
// When to show them is decided by data/practiceInvite; this only draws.

const CSS = `
@keyframes pi-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
@keyframes pi-zoom { from { transform: scale(1.04) } to { transform: scale(1.12) } }
.pi-bg { animation: pi-zoom 16s ease-in-out infinite alternate; }
.pi-1 { animation: pi-rise .6s ease .15s both } .pi-2 { animation: pi-rise .6s ease .5s both }
.pi-3 { animation: pi-rise .6s ease .85s both } .pi-4 { animation: pi-rise .6s ease 1.2s both }
.pi-gold:hover, .pi-gold:focus-visible { filter: brightness(1.1); }
.pi-txt:hover, .pi-txt:focus-visible { color: #FFFFFF !important; }
@media (prefers-reduced-motion: reduce) { .pi-bg, .pi-1, .pi-2, .pi-3, .pi-4 { animation: none !important } }
`;

const BENEFITS = [
  ['📖', 'LEARN', 'Step-by-step guide for every move'],
  ['🥊', 'DRILL', 'A practice round after each lesson'],
  ['📈', 'GROW', 'Rounds grow as your skills do'],
  ['⭐', 'EARN XP', 'Every lesson levels you up'],
];

export default function PracticeInvite({ view = 'intro', discipline = 'Boxing', onStart, onClose }) {
  const intro = view !== 'weekly';
  const { discs, focus } = weeklySummary(discipline);
  const next = focus.next || focus.lessons[0];
  const lessonNo = (focus.nextIndex >= 0 ? focus.nextIndex : 0) + 1;
  // The round that lesson will end on, so "about N min" is the real length.
  const { plan } = buildRound({
    focus: { name: next.title, calls: next.calls },
    learned: focus.done + 1 + getLibraryDrilled(focus.disc).length,
  });

  const kicker = intro ? 'NEW TO FIGHTING? START HERE.' : `THIS WEEK · +${WEEKLY_BONUS_XP} XP`;
  const title = intro ? 'EVERY CHAMPION STARTED AT LESSON 1.' : 'ONE LESSON. ONE WEEK. KEEP BUILDING.';
  const line = intro
    ? 'Your coach in your pocket. Learn each move the right way, then drill it in a round built for you.'
    : `Finish one lesson in any discipline this week for +${WEEKLY_BONUS_XP} XP. Solid basics make every other workout safer and more effective.`;
  const cta = intro ? `▶ START LESSON ${lessonNo} · ${next.title.toUpperCase()}` : `▶ CONTINUE · LESSON ${lessonNo}`;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={intro ? 'Practice Mode — start here' : 'Weekly lesson'} style={{
      position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 900, overflow: 'hidden',
      background: '#050409', color: '#fff', fontFamily: 'Barlow, system-ui, sans-serif',
    }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>
      <SafeImage className="pi-bg" src="/static/revamp/practice-poster.webp" alt="" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '45% top',
      }}/>
      {/* The veil keeps the copy below the fighters' faces readable. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: intro
          ? 'linear-gradient(180deg, rgba(5,4,9,.55) 0%, rgba(5,4,9,0) 14%, rgba(5,4,9,0) 30%, rgba(8,4,24,.88) 50%, #050409 72%)'
          : 'linear-gradient(180deg, rgba(5,4,9,.55) 0%, rgba(5,4,9,0) 14%, rgba(5,4,9,.1) 38%, rgba(8,4,24,.9) 58%, #050409 78%)',
      }}/>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 60, boxSizing: 'border-box', padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 3 }}>
        <span style={{ font: "700 9px 'Orbitron',sans-serif", letterSpacing: '0.3em', color: '#D2BCFF' }}>{intro ? 'SETUP COMPLETE · WELCOME' : 'WEEKLY LESSON'}</span>
        <button type="button" className="pi-txt" onClick={onClose} style={{
          height: 44, padding: '0 4px', background: 'none', border: 0, cursor: 'pointer', color: '#CFC9E4',
          font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.2em',
        }}>SKIP ›</button>
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, boxSizing: 'border-box',
        padding: '0 20px calc(18px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div className="pi-1" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SafeImage src="/static/revamp/practice-book.webp" alt="" style={{ width: 34, height: 34, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(168,85,247,.7))' }}/>
          <span style={{ font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.2em', color: '#F2BE45' }}>{kicker}</span>
        </div>
        <div className="pi-1" style={{
          font: "italic 900 27px 'Orbitron',sans-serif", lineHeight: 1, textWrap: 'balance',
          background: 'linear-gradient(180deg, #FFF6C8 0%, #FDE047 45%, #E0A21C 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          filter: 'drop-shadow(0 0 14px rgba(168,85,247,.55)) drop-shadow(3px 3px 0 #3B0764)',
        }}>{title}</div>
        <div className="pi-2" style={{ fontSize: 15, lineHeight: 1.4, color: '#E6E2F5', textWrap: 'pretty' }}>{line}</div>

        {intro ? (
          <div className="pi-3" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 6 }}>
            {BENEFITS.map(([icon, k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(10,6,24,.82)', border: '1px solid rgba(168,85,247,.4)' }}>
                <span style={{ fontSize: 16, lineHeight: 1.1, flexShrink: 0 }}>{icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.12em' }}>{k}</span>
                  <span style={{ fontSize: 11, lineHeight: 1.25, color: '#BDB6D6' }}>{v}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="pi-3" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 12, background: 'rgba(10,6,24,.85)', border: '1px solid rgba(242,190,69,.45)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.12em' }}>
              <span>BASICS · {focus.disc.toUpperCase()}</span><span style={{ color: '#F2BE45' }}>{focus.done} / {focus.total}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((focus.done / focus.total) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #A855F7, #F2BE45)' }}/>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {discs.map(d => {
                const on = d.disc === focus.disc;
                return (
                  <span key={d.disc} style={{
                    height: 26, display: 'flex', alignItems: 'center', padding: '0 9px', borderRadius: 6, background: '#151029',
                    border: `1px solid ${on ? 'rgba(242,190,69,.55)' : 'rgba(168,85,247,.3)'}`, color: on ? '#F2BE45' : '#A9A3C4',
                    font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.1em',
                  }}>{d.disc.toUpperCase()} {d.done}/{d.total}</span>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: '#BDB6D6' }}>
              Next up: <span style={{ color: '#fff', fontWeight: 600 }}>Lesson {lessonNo} · {next.title}</span> · then a {planLine(plan)} practice round
            </span>
          </div>
        )}

        <div className="pi-4" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button type="button" className="pi-gold" onClick={() => onStart(focus.disc)} style={{
            height: 54, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px',
            clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
            background: 'linear-gradient(180deg, #FFE9A8 0%, #F2BE45 50%, #C98A1C 100%)', color: '#1A1204',
            font: "900 13px 'Orbitron',sans-serif", letterSpacing: '0.12em', boxShadow: '0 0 28px rgba(242,190,69,.4)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{cta}</button>
          <button type="button" className="pi-txt" onClick={onClose} style={{
            height: 40, background: 'none', border: 0, cursor: 'pointer', color: '#A9A3C4',
            font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.18em',
          }}>{intro ? 'I’LL EXPLORE ON MY OWN' : 'REMIND ME NEXT WEEK'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
