import { useEffect, useState } from 'react';
import { ChevronLeft, Trophy } from 'lucide-react';
import PhoneFrame from '../../PhoneFrame';
import BoardOptIn from './BoardOptIn';
import { BoardLine, phoneCountry, startName } from './ScoreBoardSlot';
import { ARC, RETENTION_CSS } from './tokens';
import { fetchBoardProfile, joinBoards, setBoardProfile, leaveBoards, loadBoardState } from '../../data/scoreBoardCloud';

// Profile's SCORE BOARD (switch `scores`): the row on the overview, and its
// page: join, change the display name (once a week) or the country, LEAVE
// BOARDS (every score comes off at once). Nothing here is asked of the server
// until the page is opened.

const label = { font: `700 8px ${ARC.head}`, color: '#b06aff', letterSpacing: '0.16em' };
const body = { font: `600 14px ${ARC.body}`, color: '#e9e3f7', lineHeight: 1.4, margin: 0 };
const card = { background: 'rgba(8,2,18,0.92)', border: '1px solid rgba(253,224,71,0.35)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 };

// The overview's row: the board name it shows is the phone's copy (no network).
export function BoardProfileRow({ onOpen }) {
  const [st] = useState(loadBoardState);
  const joined = st.optIn === 'joined' && st.name;
  return (
    <button type="button" data-retention="board-profile-row" onClick={onOpen} style={{
      width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
      background: 'rgba(8,2,18,0.8)', border: '1px solid rgba(253,224,71,0.35)', boxSizing: 'border-box',
    }}>
      <Trophy size={16} color={ARC.gold} aria-hidden="true" style={{ flexShrink: 0 }}/>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: "800 9px 'Orbitron',sans-serif", color: ARC.gold, letterSpacing: '0.06em' }}>SCORE BOARD</span>
        <span style={{ display: 'block', font: "600 11px 'Rajdhani',sans-serif", color: '#c4a4d8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {joined ? `On the world board as ${st.name}` : 'Not on the world board'}
        </span>
      </span>
      <span aria-hidden="true" style={{ font: "900 13px 'Orbitron',sans-serif", color: ARC.gold }}>›</span>
    </button>
  );
}

function Switch({ on, text, onToggle, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, padding: '0 12px', borderRadius: 10, cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#e9e3f7',
    }}>
      <span style={{ flex: 1, font: `700 14px ${ARC.body}`, lineHeight: 1.25, textWrap: 'balance' }}>{text}</span>
      <span aria-hidden style={{ width: 42, height: 24, borderRadius: 12, flexShrink: 0, position: 'relative', background: on ? ARC.gold : 'rgba(255,255,255,0.15)' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: 9, background: on ? '#140a00' : '#cbc6e0' }}/>
      </span>
    </button>
  );
}

const btn = (kind) => ({
  height: 44, borderRadius: 11, cursor: 'pointer', font: `${kind === 'gold' ? 900 : 800} 12px ${ARC.head}`, letterSpacing: '0.08em', width: '100%',
  ...(kind === 'gold' ? { border: 'none', background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014' }
    : kind === 'danger' ? { border: '1px solid rgba(255,122,122,0.55)', background: 'rgba(255,122,122,0.08)', color: '#ff9a9a' }
      : { border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#cbc6e0' }),
});

export default function BoardProfile({ onBack }) {
  // { status: 'loading'|'joined'|'none'|'signedOut'|'offline'|'error', profile }
  const [st, setSt] = useState({ status: 'loading' });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [left, setLeft] = useState(false);
  const cc = phoneCountry();

  useEffect(() => {
    let alive = true;
    fetchBoardProfile().then((r) => { if (!alive) return; setSt(r); if (r.profile) setName(r.profile.name); });
    return () => { alive = false; };
  }, []);

  const join = async ({ name: n, showCountry }) => {
    setBusy(true); setMsg(null); setLeft(false);
    const r = await joinBoards(n, showCountry ? cc : null);
    setBusy(false);
    if (!r.ok) { setMsg(r.line); return; }
    setSt({ status: 'joined', profile: { name: r.name, country: r.country } });
    setName(r.name);
    setMsg('You are on the world board. Your next board score goes up.');
  };
  const save = async (nextName, country) => {
    setBusy(true); setMsg(null);
    const r = await setBoardProfile(nextName, country);
    setBusy(false);
    if (!r.ok) {
      const when = r.renameAt ? new Date(r.renameAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : null;
      setMsg(r.reason === 'too_soon' && when ? `You can change your name again on ${when}.` : r.line);
      return;
    }
    setSt((s) => ({ ...s, profile: { ...s.profile, name: r.name, country: r.country } }));
    setName(r.name);
    setMsg('Saved.');
  };
  const leave = async () => {
    setBusy(true); setMsg(null);
    const r = await leaveBoards();
    setBusy(false); setConfirmLeave(false);
    if (!r.ok) { setMsg(r.line); return; }
    setSt({ status: 'none' });
    setLeft(true);
  };

  const p = st.profile || {};
  const clean = name.replace(/[^A-Za-z0-9 ._-]/g, '');
  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <div data-retention="board-profile" style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', color: '#c4a4d8', cursor: 'pointer', display: 'flex', padding: 8, margin: -8 }}><ChevronLeft size={20}/></button>
          <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.06em' }}>SCORE BOARD</div>
          <span style={{ marginLeft: 'auto', padding: '2px 7px 1px', borderRadius: 99, border: '1px solid rgba(253,224,71,0.5)', color: ARC.gold, font: `800 8px ${ARC.head}`, letterSpacing: '0.1em' }}>BETA</span>
        </div>

        {st.status === 'loading' && <BoardLine line="Loading the world board…"/>}
        {st.status === 'signedOut' && <BoardLine line="Sign in with Google on Profile to join the world board."/>}
        {(st.status === 'offline' || st.status === 'error') && <BoardLine line={st.status === 'offline' ? "You're offline. Open this again when you are back online." : 'The board is not answering. Try again later.'}/>}

        {st.status === 'none' && left && <BoardLine line="You left the world board. Your scores are off every board."/>}
        {st.status === 'none' && (
          <BoardOptIn name={startName()} country={cc} onJoin={join} onLater={onBack} busy={busy} error={msg} laterLabel="BACK"/>
        )}

        {st.status === 'joined' && (
          <div style={card}>
            <div>
              <div style={label}>WORLD BOARD</div>
              <p style={{ ...body, marginTop: 6 }}>Your best score in each board mode is on a world list. Others see your display name and level{p.country ? `, and your country (${p.country})` : ''}.</p>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={label}>DISPLAY NAME</span>
              <input type="text" value={clean} maxLength={12} onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9 ._-]/g, ''))} aria-describedby="sbp-name-note" style={{
                height: 44, boxSizing: 'border-box', width: '100%', borderRadius: 10, border: '1px solid rgba(176,106,255,0.5)',
                background: 'rgba(176,106,255,0.08)', color: '#fff', padding: '0 12px', font: `700 16px ${ARC.body}`, outline: 'none',
              }}/>
              <span id="sbp-name-note" style={{ font: `600 12px ${ARC.body}`, color: '#a9a3c4' }}>Everyone sees it. You can change it once a week.</span>
            </label>
            {clean.trim() !== p.name && (
              <button type="button" className="rt-go" disabled={busy || clean.trim().length < 3} onClick={() => save(clean.trim(), p.country || null)} style={{ ...btn('gold'), opacity: busy || clean.trim().length < 3 ? 0.5 : 1 }}>SAVE NAME</button>
            )}
            {(cc || p.country) && (
              <Switch on={!!p.country} disabled={busy} text={`Show my country (${p.country || cc}) next to my name`} onToggle={() => save(p.name, p.country ? null : cc)}/>
            )}
            {msg && <span role="status" style={{ font: `700 13px ${ARC.body}`, color: msg === 'Saved.' ? '#8fe8ac' : '#ffb25c', lineHeight: 1.3 }}>{msg}</span>}
            {!confirmLeave ? (
              <button type="button" onClick={() => setConfirmLeave(true)} disabled={busy} style={btn('danger')}>LEAVE BOARDS</button>
            ) : (
              <div data-retention="board-leave" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 11, border: '1px solid rgba(255,122,122,0.45)', background: 'rgba(255,122,122,0.06)' }}>
                <p style={{ ...body, fontSize: 14 }}>Leave the world board? Every score of yours comes off every board, now.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button type="button" onClick={() => setConfirmLeave(false)} style={btn('plain')}>STAY</button>
                  <button type="button" onClick={leave} disabled={busy} style={btn('danger')}>LEAVE</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
