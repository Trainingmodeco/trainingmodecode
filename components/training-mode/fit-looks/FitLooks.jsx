import { STYLE } from '../Styles';
import BottomNav from '../BottomNav';
import QuickMissionSetup from '../QuickMissionSetup';
import { fitKitCSS, HEAD, BODY, MUTED, GOLD, VIOLET_TEXT, CARD, CARD_BORDER } from '../shared/FitSetupKit';
import { CardPage, ProgramPage, TrackerPage, ResultsPage, HistoryPage } from './LookPages';

// FIT LOOKS: the simplified workout card for Fit Mode, as looks only. The
// owner liked a "Calisthenics Challenge Generator" routine; these pages show
// it made from the app's own parts (one WORKOUT CARD for Quick Mission, a
// library mission and a program day), with sample data. Nothing here is wired
// into the app or saved.
//
// A hidden page (/fit-looks, noindex, not linked from the app). With ?s=<state>
// it draws ONE state full screen inside the app's own phone layout (PhoneFrame
// and the tab bar), so a screenshot is a real phone width; with no state it
// lists them. scripts/fit-looks-preview.mjs photographs every state.

const NOOP = () => {};
export const STATES = [
  { s: 'select', group: 'The workout card', title: 'Select', note: 'FULL BODY WARRIOR on the card: SHUFFLE / CHOOSE, 4 rounds with the live totals, a swap on every move, the bar switch, START.', render: () => <CardPage init={{ rounds: 4 }}/> },
  { s: 'rounds5', group: 'The workout card', title: '5 rounds', note: 'The same card at 5 rounds: 495 reps, about 35 min.', render: () => <CardPage init={{ rounds: 5 }}/> },
  { s: 'choose', group: 'The workout card', title: 'Choose', note: 'CHOOSE opens the library by category, SURPRISE ME last.', overlay: true, render: () => <CardPage init={{ rounds: 4, sheet: 'choose' }}/> },
  { s: 'swap', group: 'The workout card', title: 'Swap one move', note: 'The swap sheet on Pull-Ups: only that move changes, the rounds stay, the totals follow.', overlay: true, render: () => <CardPage init={{ rounds: 4, sheet: 'swap' }}/> },
  { s: 'nobar', group: 'The workout card', title: 'No pull-up bar', note: 'The bar switch off: the bar moves show their stand-ins with a NO BAR tag; 103 a round.', render: () => <CardPage init={{ rounds: 4, bar: false }}/> },
  { s: 'shuffled', group: 'The workout card', title: 'Shuffled', note: 'A different balanced deal at the same level, gear and rounds, with pattern tags and a timed hold.', render: () => <CardPage init={{ rounds: 4, deal: 'shuffled' }}/> },
  { s: 'bonus', group: 'The workout card', title: 'Bonus training', note: 'BONUS TRAINING open under the card: optional, never in the totals.', render: () => <CardPage init={{ rounds: 4, bonusOpen: true }}/> },
  { s: 'program', group: 'The workout card', title: 'Program day', note: 'The same card on a program day: PUSH / PULL / LEGS, day 2 of 3.', render: () => <ProgramPage/> },
  { s: 'tracker', group: 'The run', title: 'Check-off', note: 'AT YOUR PACE with CHECK-OFF: round 3 of 5, 2 rounds done, 4 of 8 ticked.', tab: 'train', scroll: true, render: () => <TrackerPage/> },
  { s: 'confirm', group: 'The run', title: 'Start over?', note: 'SHUFFLE mid-run asks before it throws the ticks away.', tab: 'train', scroll: true, overlay: true, render: () => <TrackerPage confirm/> },
  { s: 'results', group: 'After', title: 'Results', note: 'MISSION COMPLETE: 5 rounds, 495 reps, 38:12, 100%, REPEAT / NEW CHALLENGE / SAVE AS MY WORKOUT.', tab: 'progress', scroll: true, render: () => <ResultsPage/> },
  { s: 'history', group: 'After', title: 'Your workouts', note: 'YOUR WORKOUTS: past workouts with date, rounds, reps and time.', render: () => <HistoryPage/> },
  { s: 'today', group: 'For comparison', title: 'Today', note: 'The Quick Mission page as it is today (the real screen).', render: () => <QuickMissionSetup onBack={NOOP} onFightMode={NOOP} onStart={NOOP} onCardioOnly={NOOP} onPaywall={NOOP}/> },
];

// The app's tab shell (ScreenRouter's WithNav): one 100dvh column with the
// tab bar fixed under it. `scroll` lets the column scroll (a run, an end
// screen); otherwise the page scrolls itself (SetupPage).
function Shell({ tab = 'train', scroll = false, s, children }) {
  return (
    <div data-fl-state={s} style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100dvh', margin: '0 auto', background: '#0a0014', overflow: 'hidden' }}>
      <div className="no-scrollbar" style={{
        height: '100dvh', boxSizing: 'border-box', overflowX: 'hidden', overflowY: scroll ? 'auto' : 'hidden', overscrollBehaviorY: 'contain',
        paddingBottom: scroll ? 'calc(110px + env(safe-area-inset-bottom, 0px))' : 0,
      }}>
        {children}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 440, zIndex: 100 }}>
        <BottomNav active={tab} onNavigate={NOOP}/>
      </div>
    </div>
  );
}

function Gallery() {
  const groups = [...new Set(STATES.map((x) => x.group))];
  return (
    <div data-fl-state="gallery" style={{ minHeight: '100vh', background: '#080012', color: '#fff' }}>
      <main style={{ maxWidth: 440, margin: '0 auto', padding: '20px 16px 60px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.18em', color: GOLD }}>LOOKS ONLY · SAMPLE DATA</span>
          <h1 style={{ margin: 0, font: `700 24px ${HEAD}`, letterSpacing: '0.06em', lineHeight: 1.1 }}>THE WORKOUT CARD</h1>
          <p style={{ margin: 0, font: `500 14px ${BODY}`, color: MUTED, lineHeight: 1.45 }}>
            One card for Quick Mission, a library mission and a program day: rounds chosen directly with live totals, SHUFFLE and CHOOSE, a swap on every move, a pull-up bar switch, a check-off run, bonus work, results and your past workouts. Nothing here is wired up or saved.
          </p>
        </header>
        {groups.map((g) => (
          <section key={g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.16em', color: MUTED, textTransform: 'uppercase' }}>{g}</span>
            {STATES.filter((x) => x.group === g).map((x) => (
              <a key={x.s} href={`?s=${x.s}`} className="fk-row" style={{
                display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 12px', borderRadius: 12, textDecoration: 'none',
                background: CARD, border: `1px solid ${CARD_BORDER}`, color: '#fff', minHeight: 44, boxSizing: 'border-box',
              }}>
                <span style={{ font: `700 14px ${HEAD}`, letterSpacing: '0.1em' }}>{x.title.toUpperCase()} <span style={{ color: VIOLET_TEXT, fontWeight: 600 }}>· {x.s}</span></span>
                <span style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{x.note}</span>
              </a>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}

export default function FitLooks({ s }) {
  const st = STATES.find((x) => x.s === s);
  return (
    <>
      <style>{STYLE}</style>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS }}/>
      {st ? <Shell tab={st.tab} scroll={st.scroll} s={st.s}>{st.render()}</Shell> : <Gallery/>}
    </>
  );
}
