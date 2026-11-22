import { STYLE, C } from '../Styles';
import { HOME, head, orb, goldText, LOOKS_CSS } from './looksKit';
import LookStreak from './lookStreak';
import LookPath from './lookPath';
import LookNearMiss from './lookNearMiss';
import LookLeague from './lookLeague';
import LookSquad from './lookSquad';
import LookSeason from './lookSeason';
import LookCleared from './lookCleared';

// RETENTION LOOKS — Phase 0 of PROMPT-RETENTION-1.md: every screen and state of
// the six retention features, drawn with sample data in the app's own style,
// for the owner to approve one feature at a time before anything is built.
// A hidden page (/retention-looks): not linked from the app, no data wiring,
// nothing saved. Sample names are neutral (Trainee, Squad Alpha).

const NAV = [
  ['f1', '1 STREAK'], ['f2', '2 PATH'], ['f3', '3 RETRY'], ['f4', '4 LEAGUES'], ['f5', '5 SQUADS'], ['f6', '6 SEASON'], ['f7', 'CLEARED'], ['qs', 'QUESTIONS'],
];

const QUESTIONS = [
  ['Weekly training-day target', 'Default 4, range 2 to 6. A change starts next week.'],
  ['Freezes', 'One earned per 4 weeks on target, hold at most 2. New athletes start with 1, so the first bad week does not end a streak that has just begun.'],
  ['League tier names, opt-in or on', 'GARAGE, GYM, CLUB, ARENA, MAIN EVENT, TITLE BOUT. Opt-in, with a one-tap JOIN card on home after the first full week, so nobody is listed by surprise.'],
  ['Squad size, beta or launch', '5 to 20. Open to the beta now, with preset cheers and squad names checked against the existing name filter, so the safety tools are tested before launch.'],
  ['Rewards for the drop track', 'SHOTO ends Nov 30, so the first track fits the next drop (Dec 1). The shape shown: a drop badge (4 days), a frame (8), a title (12), an animated frame (16), a gold emblem (20).'],
  ['Free or Pro', 'All six free. They exist to bring people back, and Pro stays as it is.'],
];

export default function RetentionLooks() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text }}>
      <style>{STYLE}</style>
      <style>{LOOKS_CSS}</style>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,0,18,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(168,85,247,.25)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '10px 16px', display: 'flex', gap: 6, overflowX: 'auto' }}>
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} style={{ ...head(11), whiteSpace: 'nowrap', color: id === 'qs' ? HOME.gold : C.text, textDecoration: 'none', padding: '7px 10px', borderRadius: 999, border: '1px solid rgba(168,85,247,.45)', background: 'rgba(168,85,247,.1)' }}>{label}</a>
          ))}
        </div>
      </div>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 16px 80px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <header>
          <div style={{ ...orb(11), color: HOME.muted }}>PHASE 0 · LOOKS ONLY · SAMPLE DATA</div>
          <h1 style={{ ...orb(26), ...goldText, margin: '4px 0 6px' }}>COMING BACK IS THE GAME</h1>
          <p style={{ fontSize: 15, color: HOME.muted, maxWidth: 720, lineHeight: 1.45 }}>
            Every screen of the six retention features, drawn with the app&apos;s own style and sample data. Nothing here is wired up or saved.
            Say yes, no, or what to change for each feature; nothing gets built until its look is approved. Animated cards have a REPLAY button.
          </p>
        </header>
        <LookStreak/>
        <LookPath/>
        <LookNearMiss/>
        <LookLeague/>
        <LookSquad/>
        <LookSeason/>
        <LookCleared/>
        <section id="qs" style={{ scrollMarginTop: 70, paddingTop: 18 }}>
          <div style={{ borderLeft: `3px solid ${HOME.gold}`, paddingLeft: 12, marginBottom: 12 }}>
            <div style={{ ...orb(11), color: HOME.muted }}>FOR YOU TO DECIDE</div>
            <div style={{ ...orb(20), ...goldText }}>OPEN QUESTIONS</div>
            <div style={{ fontSize: 13, color: HOME.muted }}>With my recommendation for each.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {QUESTIONS.map(([q, a], i) => (
              <div key={q} style={{ background: HOME.tile, borderRadius: 14, padding: 14, border: '1px solid rgba(168,85,247,.25)' }}>
                <div style={{ ...head(12), color: HOME.gold }}>{i + 1}. {q.toUpperCase()}</div>
                <div style={{ fontSize: 14, color: C.text, marginTop: 6, lineHeight: 1.4 }}>{a}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
