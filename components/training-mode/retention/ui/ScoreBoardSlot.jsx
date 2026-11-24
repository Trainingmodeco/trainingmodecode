import { useEffect, useRef, useState } from 'react';
import OverlayPortal, { OVERLAY_Z } from '../../shared/OverlayPortal';
import PhoneFrame from '../../PhoneFrame';
import HighScoresCard from './HighScoresCard';
import GameOverBoard, { BoardHeader } from './GameOverBoard';
import BoardOptIn from './BoardOptIn';
import { ARC, RETENTION_CSS } from './tokens';
import { finishBoardRun, postAfterJoin, skipAfterAsk, joinBoards } from '../../data/scoreBoardCloud';
import { boardTitle } from '../../data/scoreBoardRules';
import { loadProfile } from '../../data/userProfile';

// The world score board on an end screen (switch `scores`; App hands the
// session's `finish` only with the switch on). It never holds the screen up:
// the end screen draws at once and this fills in when the server answers.
//
//   - a one-line reason when the session cannot go on a board (a setting off
//     the board, signed out, started offline, NOT NOW before);
//   - the first time, the opt-in over the end screen (JOIN posts this session);
//   - the HIGH SCORES card (top 3, your row, VIEW BOARD);
//   - the full GAME OVER board over the end screen when it is news (a new
//     best that lands in or moves up the top 10, or a first score on the
//     board), if the answer comes while the athlete is still looking (4 s),
//     and always right after JOIN. CONTINUE goes back to the end screen.
const NEWS_WINDOW_MS = 4000;

// The two capital letters the phone's language settings carry ("en-US"), or null.
export function phoneCountry() {
  try {
    const tags = [Intl.DateTimeFormat().resolvedOptions().locale, ...(typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [])];
    for (const t of tags) {
      const m = /[-_]([A-Za-z]{2})(?:$|[-_])/.exec(String(t || ''));
      if (m) return m[1].toUpperCase();
    }
  } catch { /* no Intl */ }
  return null;
}
// The display name to start from: the profile's name, cut to what the board takes.
export function startName() {
  const n = String(loadProfile()?.name || '').replace(/[^A-Za-z0-9 ._-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12).trim();
  return n.length >= 3 ? n : '';
}

function Overlay({ label, children }) {
  return (
    <OverlayPortal>
      <div role="dialog" aria-modal="true" aria-label={label} className="no-scrollbar" style={{
        position: 'fixed', inset: 0, zIndex: OVERLAY_Z, overflowY: 'auto', overflowX: 'hidden', background: '#080012',
      }}>
        <PhoneFrame>
          <div style={{ paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))' }}>{children}</div>
        </PhoneFrame>
      </div>
    </OverlayPortal>
  );
}

export function BoardLine({ line }) {
  return (
    <div data-retention="board-line" style={{
      background: 'rgba(8,2,18,0.85)', border: '1px solid rgba(176,106,255,0.25)', borderRadius: 10, padding: '8px 12px',
      font: `600 12px ${ARC.body}`, color: '#cbc6e0', lineHeight: 1.35, textAlign: 'center', textWrap: 'balance',
    }}>{line}</div>
  );
}

export default function ScoreBoardSlot({ finish }) {
  const [res, setRes] = useState(() => (finish && !finish.handle ? (finish.reason ? { kind: 'line', line: finish.reason } : { kind: 'none' }) : null));
  const [full, setFull] = useState(false);
  const [join, setJoin] = useState({ busy: false, error: null });
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!finish?.handle) return undefined;
    let alive = true;
    finishBoardRun(finish).then((r) => {
      if (!alive) return;
      setRes(r);
      if (r.kind === 'card' && r.news && Date.now() - mountedAt.current < NEWS_WINDOW_MS) setFull(true);
    });
    return () => { alive = false; };
  }, [finish]);

  if (!res || res.kind === 'none') return null;
  if (res.kind === 'line') return <BoardLine line={res.line}/>;

  if (res.kind === 'optin') {
    const t = boardTitle(finish.board) || {};
    const onJoin = async ({ name, showCountry }) => {
      setJoin({ busy: true, error: null });
      const j = await joinBoards(name, showCountry ? phoneCountry() : null);
      if (!j.ok) { setJoin({ busy: false, error: j.line }); return; }
      const r = await postAfterJoin(finish, res.ticket);
      setJoin({ busy: false, error: null });
      setRes(r);
      if (r.kind === 'card') setFull(true);
    };
    const onLater = () => setRes(skipAfterAsk(finish));
    return (
      <Overlay label="Join the world board">
        <div style={{ position: 'relative', zIndex: 10, padding: '22px 14px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
          <BoardHeader mode={t.mode} setting={t.setting} beta={!!t.beta} eyebrow="◈ NEW ◈"/>
          <BoardOptIn name={startName()} country={phoneCountry()} onJoin={onJoin} onLater={onLater} busy={join.busy} error={join.error}/>
        </div>
      </Overlay>
    );
  }

  return (
    <div data-retention="board-slot" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <HighScoresCard board={res.board} onView={() => setFull(true)}/>
      {res.line && <BoardLine line={res.line}/>}
      {full && (
        <Overlay label="High scores">
          <GameOverBoard board={res.board} onContinue={() => setFull(false)}/>
        </Overlay>
      )}
    </div>
  );
}
