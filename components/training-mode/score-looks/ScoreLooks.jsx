import { STYLE } from '../Styles';
import BottomNav from '../BottomNav';
import PhoneFrame from '../PhoneFrame';
import MissionComplete from '../shared/MissionComplete';
import GameOverBoard, { BoardHeader } from '../retention/ui/GameOverBoard';
import HighScoresCard from '../retention/ui/HighScoresCard';
import BoardOptIn from '../retention/ui/BoardOptIn';
import { ARC, RETENTION_CSS } from '../retention/ui/tokens';
import { FIGHT_TOP10, BOSS_EARLY, ROOM_BUSY, STAGE_TIME, RUN_FADE } from '../retention/scoreBoards';

// SCORE LOOKS: the game-over score board (RETENTION-PLAN.md: built owner-only
// once the owner approves its server design), as looks only. Sample data; nothing is wired into a session,
// nothing is sent to a server, no switch turns it on for anyone. The server
// design is docs/retention/SCOREBOARD-DESIGN.md.
//
// A hidden page (/score-looks, noindex, not linked from the app). With
// ?s=<state> it draws ONE state full screen inside the app's own phone layout
// (PhoneFrame and the tab bar), so a screenshot is a real phone width; with no
// state it lists them. scripts/score-looks-preview.mjs photographs every state.
//
// Two places the board could appear, both drawn so the owner can pick:
//   A · straight after FINISH, full screen, CONTINUE to the end screen (board-*)
//   B · a HIGH SCORES card on the end screen, VIEW BOARD opens it (endcard)

const go = (s) => { try { window.location.assign(`?s=${s}`); } catch { /* not in a browser */ } };
const noop = () => {};

const board = (b) => (
  <PhoneFrame>
    <GameOverBoard board={b} onContinue={() => go('endcard')}/>
  </PhoneFrame>
);

function EndCard() {
  return (
    <MissionComplete
      variant="success" eyebrow="SESSION COMPLETE" title="GOOD WORK" subtitle="Boxing · Normal · Fight Focus"
      accent="#fde047" xp={125} heroImage="/static/trophies/mission-complete-fight.webp" onBack={noop}
      stats={[
        { value: '3/3', label: 'ROUNDS', color: '#fde047' },
        { value: '812', label: 'STRIKES ✓', color: '#fff' },
        { value: '11', label: 'MINUTES', color: '#fff' },
      ]}
      summary={<HighScoresCard board={FIGHT_TOP10} onView={() => go('board-top10')}/>}
      actions={[
        { label: 'TRAIN AGAIN', onClick: noop, kind: 'primary', role: 'retry' },
        { label: 'CHANGE DISCIPLINE', onClick: noop, kind: 'secondary' },
        { label: 'BACK TO START', onClick: noop, kind: 'ghost', role: 'home' },
      ]}
    />
  );
}

function OptIn() {
  return (
    <PhoneFrame>
      <div style={{ position: 'relative', zIndex: 10, padding: '22px 14px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
        <BoardHeader mode={FIGHT_TOP10.mode} setting={FIGHT_TOP10.setting} eyebrow="◈ NEW ◈"/>
        <BoardOptIn name="Trainee" country="US" onJoin={() => go('board-top10')} onLater={() => go('endcard')}/>
      </div>
    </PhoneFrame>
  );
}

export const STATES = [
  { s: 'board-top10', group: 'A · Full screen after FINISH', title: 'New best, top 10', note: 'Fight Focus, a beta board: 4 real players among CPU rows, a new best lands 6th. CONTINUE goes to the end screen.', render: () => board(FIGHT_TOP10) },
  { s: 'board-early', group: 'A · Full screen after FINISH', title: 'Brand-new board', note: 'Max Out, BOSS RUSH: you are the first real player; 9 CPU rows hold the other places.', render: () => board(BOSS_EARLY) },
  { s: 'board-fade', group: 'A · Full screen after FINISH', title: 'CPU fading out', note: 'A 5 km run with 6 real players: the CPU rows now sit only under the slowest player.', render: () => board(RUN_FADE) },
  { s: 'board-busy', group: 'A · Full screen after FINISH', title: 'Outside the top 10', note: 'Quick Mission ROOM 12 with 2,310 players: no CPU left, and your row pinned under the list with your world rank and what the next place needs.', render: () => board(ROOM_BUSY) },
  { s: 'board-time', group: 'A · Full screen after FINISH', title: 'Timed board', note: 'An arcade stage: less time ranks higher. A new best lands 4th.', render: () => board(STAGE_TIME) },
  { s: 'endcard', group: 'B · On the end screen', title: 'HIGH SCORES card', note: 'The real end screen with a HIGH SCORES card: your place, the top 3, VIEW BOARD.', render: () => <EndCard/> },
  { s: 'optin', group: 'First time', title: 'Join the world board', note: 'Asked once, before the first board: display name only, country off unless turned on, JOIN or NOT NOW.', render: () => <OptIn/> },
];

// The app's tab shell (ScreenRouter's WithNav): one 100dvh column that
// scrolls, 110px kept clear under it, the tab bar fixed at the bottom.
function Shell({ s, children }) {
  return (
    <div data-sl-state={s} style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100dvh', margin: '0 auto', background: '#0a0014', overflow: 'hidden' }}>
      <div className="no-scrollbar" style={{
        height: '100dvh', boxSizing: 'border-box', overflowX: 'hidden', overflowY: 'auto', overscrollBehaviorY: 'contain',
        paddingBottom: 'calc(110px + env(safe-area-inset-bottom, 0px))',
      }}>
        {children}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 440, zIndex: 100 }}>
        <BottomNav active="train" onNavigate={noop}/>
      </div>
    </div>
  );
}

function Gallery() {
  const groups = [...new Set(STATES.map((x) => x.group))];
  return (
    <div data-sl-state="gallery" style={{ minHeight: '100vh', background: '#080012', color: '#fff' }}>
      <main style={{ maxWidth: 440, margin: '0 auto', padding: '20px 16px 60px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ font: `700 10px ${ARC.head}`, letterSpacing: '0.18em', color: ARC.gold }}>LOOKS ONLY · SAMPLE DATA</span>
          <h1 style={{ margin: 0, font: `900 22px ${ARC.head}`, letterSpacing: '0.06em', lineHeight: 1.15 }}>THE SCORE BOARD</h1>
          <p style={{ margin: 0, font: `600 15px ${ARC.body}`, color: '#cbc6e0', lineHeight: 1.4 }}>
            After a finished session, your score for that mode and where it ranks in the world, like an arcade HIGH SCORES list. CPU house scores fill a new board and step aside as players join. Nothing here is wired up or sent anywhere.
          </p>
        </header>
        {groups.map((g) => (
          <section key={g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: `700 10px ${ARC.head}`, letterSpacing: '0.14em', color: '#a9a3c4' }}>{g.toUpperCase()}</span>
            {STATES.filter((x) => x.group === g).map((x) => (
              <a key={x.s} href={`?s=${x.s}`} style={{
                display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 12px', borderRadius: 12, textDecoration: 'none',
                background: 'rgba(14,11,24,0.95)', border: '1px solid rgba(176,106,255,0.3)', color: '#fff', minHeight: 44, boxSizing: 'border-box',
              }}>
                <span style={{ font: `800 12px ${ARC.head}`, letterSpacing: '0.08em' }}>{x.title.toUpperCase()} <span style={{ color: '#c9a6ff', fontWeight: 600, whiteSpace: 'nowrap' }}>· {x.s}</span></span>
                <span style={{ font: `600 13px ${ARC.body}`, color: '#cbc6e0', lineHeight: 1.35 }}>{x.note}</span>
              </a>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}

export default function ScoreLooks({ s }) {
  const st = STATES.find((x) => x.s === s);
  return (
    <>
      <style>{STYLE}</style>
      {st ? <Shell s={st.s}>{st.render()}</Shell> : <Gallery/>}
    </>
  );
}
