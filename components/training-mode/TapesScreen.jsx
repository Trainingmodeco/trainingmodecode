import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Link2, Play, X } from 'lucide-react';
import SafeImage from './SafeImage';
import {
  TAPES, tapeVideoId, youtubeUrl, featuredTape, startTape, pendingTape, returnState, settleTape, quoteTape,
  tapeCounts, tapeXp, setTapeLink, loadTapes, clearPending, clearedToday, markPendingSeen, snoozePending,
} from './data/tapes';
import { isOwnerPreview } from './data/concepts';
import { endMiniPlayer } from './shared/miniPlayer';

// COACH'S TAPES — the shelf of the coach's follow-along videos.
//
// PLAY is a real link: the tap itself opens YouTube (a delayed script
// navigation can lose the tap on an iOS home-screen app and land on the web
// page instead of the YouTube app). The tap also writes the pending record
// and spins the disc — the spin is only the send-off, YouTube is already
// opening underneath it. When the athlete comes back (visibilitychange,
// pageshow, or a cold reload — App routes here if a tape is pending) the
// comeback bar asks how it went. CLEARED unlocks once most of the tape's
// length has passed; the rest is the honor system, capped in data/tapes.
const CP = "'Chakra Petch',sans-serif";
const OR = "'Orbitron',sans-serif";
const GOLD = '#F2BE45';
const VIOLET = '#9D6CFF';
const BLUE = '#3D7BFF';
const MUTED = '#8E88A8';
const NAV = 'calc(64px + env(safe-area-inset-bottom, 0px))';
// The sheets sit above the row the BETA chip and the resume pill share.
const SHEET_BOTTOM = 'calc(108px + env(safe-area-inset-bottom, 0px))';
const SPIN_SENDOFF_MS = 2500;

const css = `
@keyframes tp-spin { to { transform: rotate(360deg); } }
@keyframes tp-in { from { transform: scale(.45); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes tp-bar { from { transform: translateY(110%); } to { transform: none; } }
@keyframes tp-stamp { 0% { transform: translate(-50%,-50%) rotate(-12deg) scale(2.4); opacity: 0; } 60% { transform: translate(-50%,-50%) rotate(-12deg) scale(.94); opacity: 1; } 100% { transform: translate(-50%,-50%) rotate(-12deg) scale(1); opacity: 1; } }
.tp-spin { animation: tp-spin .6s linear infinite; }
.tp-idle { animation: tp-spin 16s linear infinite; }
.tp-down { animation: tp-spin 2.4s cubic-bezier(.1,.6,.3,1) 1 forwards; }
.tp-in { animation: tp-in .5s cubic-bezier(.2,.9,.3,1.1) both; }
.tp-bar { animation: tp-bar .35s ease-out both; }
.tp-stamp { animation: tp-stamp .55s cubic-bezier(.2,.9,.3,1) both; }
.tp-play { transition: transform .12s, box-shadow .2s; }
.tp-play:active { transform: scale(.95); }
.tp-chip { transition: background .15s, color .15s; }
@media (prefers-reduced-motion: reduce) { .tp-spin, .tp-idle, .tp-down, .tp-in, .tp-bar, .tp-stamp { animation: none !important; } }
`;

const fmtLen = (min) => `${min}:00`;

// The disc: a rim, the tape's art, the title around the rim (big sizes), a hub.
function Disc({ tape, size, className = '', id = 'd' }) {
  const hub = Math.round(size * 0.18);
  return (
    <div className={className} style={{ position: 'relative', width: size, height: size, flex: `0 0 ${size}px`, borderRadius: '50%', willChange: 'transform' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'conic-gradient(from 30deg,#c9d3ff,#f6c6ff,#a8f0ff,#fff2a8,#c9d3ff)', boxShadow: '0 0 0 2px rgba(255,255,255,0.25), 0 8px 26px rgba(0,0,0,0.6)' }}/>
      <div style={{ position: 'absolute', inset: Math.round(size * 0.05), borderRadius: '50%', overflow: 'hidden', background: '#0b0716' }}>
        <SafeImage src={tape.art} alt="" style={{ position: 'absolute', left: '50%', top: '50%', width: '160%', height: '160%', transform: 'translate(-50%,-50%)', objectFit: 'cover', objectPosition: tape.pos }}/>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, transparent 48%, rgba(8,4,18,0.85) 70%)' }}/>
      </div>
      {size >= 90 && (
        <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs><path id={`tp-rim-${id}`} d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0"/></defs>
          <text fontFamily="Orbitron" fontWeight="900" fontSize="6.2" letterSpacing="1.6" fill={GOLD}>
            <textPath href={`#tp-rim-${id}`}>{`COACH'S TAPES · ${tape.num} · COACH'S TAPES · ${tape.num} ·`}</textPath>
          </text>
        </svg>
      )}
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: hub, height: hub, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: '#07040f', border: `${Math.max(2, Math.round(size * 0.03))}px solid rgba(225,230,250,0.9)` }}/>
    </div>
  );
}

const chip = (text, color, border, bg) => (
  <span style={{ display: 'inline-block', maxWidth: '100%', boxSizing: 'border-box', lineHeight: '18px', padding: '0 8px', borderRadius: 99, font: `700 9px ${CP}`, letterSpacing: '0.12em', color, background: bg, border: `1px solid ${border}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle' }}>{text}</span>
);
const linkBtn = (onClick, label, text) => (
  <button type="button" onClick={onClick} aria-label={label}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 20, padding: '0 8px', borderRadius: 99, font: `700 9px ${CP}`, letterSpacing: '0.12em', color: '#f0abfc', background: 'rgba(232,121,249,0.1)', border: '1px solid rgba(232,121,249,0.45)', cursor: 'pointer' }}>
    <Link2 size={10}/> {text}
  </button>
);

export default function TapesScreen({ initialKind = 'all', onBack }) {
  const [state, setState] = useState(loadTapes);
  const [filter, setFilter] = useState(initialKind === 'fit' || initialKind === 'fight' ? initialKind : 'all');
  const [spin, setSpin] = useState(null);          // tape being sent off to YouTube
  const [pending, setPending] = useState(() => pendingTape());
  const [now, setNow] = useState(() => Date.now());
  const [reward, setReward] = useState(null);      // { tape, verdict, xp, reason }
  const [editing, setEditing] = useState(null);    // tape id whose link the owner is setting
  const [draft, setDraft] = useState('');
  const [linkError, setLinkError] = useState('');
  const [returnAt, setReturnAt] = useState(() => Date.now());  // last time the athlete came back
  const owner = isOwnerPreview();
  const playAt = useRef(0);

  const refresh = useCallback(() => { setState(loadTapes()); setPending(pendingTape()); setNow(Date.now()); }, []);
  const openEditor = (tape) => { setEditing(tape.id); setDraft(tapeVideoId(tape, state) ? youtubeUrl(tapeVideoId(tape, state)) : ''); setLinkError(''); };

  // Back from YouTube: drop the send-off, pick up the pending tape.
  useEffect(() => {
    // Focus can bounce straight back while the link is opening; that is not
    // the athlete returning.
    const back = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (Date.now() - playAt.current < 1500) return;
      setSpin(null); setReturnAt(Date.now()); refresh();
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('pageshow', back);
    window.addEventListener('focus', back);
    return () => {
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('pageshow', back);
      window.removeEventListener('focus', back);
    };
  }, [refresh]);

  // The send-off never holds the screen: YouTube is opening underneath it.
  useEffect(() => {
    if (!spin) return undefined;
    const t = setTimeout(() => setSpin(null), SPIN_SENDOFF_MS);
    return () => clearTimeout(t);
  }, [spin]);

  // The comeback bar's unlock countdown.
  useEffect(() => {
    if (!pending) return undefined;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [pending]);

  const play = (tape) => {
    endMiniPlayer();                 // never float a timer over the video
    playAt.current = Date.now();
    startTape(tape.id);
    setPending(null);
    setSpin(tape);
  };
  const cancelSendoff = () => { clearPending(); setSpin(null); refresh(); };
  const settle = (verdict) => {
    if (!pending) return;
    const r = settleTape(pending.id, verdict);
    refresh();
    if (r && verdict !== 'skip') setReward(r);
  };
  // NOT YET keeps the tape pending: the bar comes back next time they return.
  const snooze = () => { snoozePending(); refresh(); };
  const saveLink = () => {
    const res = setTapeLink(editing, draft);
    if (res === null) { setLinkError('Not a YouTube link. Paste the video\u2019s share link.'); return; }
    setEditing(null); setDraft(''); setLinkError(''); refresh();
  };

  const featured = featuredTape(state);
  const rows = TAPES.filter(t => t !== featured && (filter === 'all' || t.kind === filter));
  const counts = tapeCounts(state);
  const snoozed = !!pending?.snoozedAt && returnAt <= pending.snoozedAt;
  const ret = pending && !snoozed ? returnState(pending, now) : null;
  const quote = (verdict) => (pending ? quoteTape(pending.id, verdict, now, state) : 0);

  // The bar has been seen: App stops pulling the athlete back here on every return.
  useEffect(() => { if (ret) markPendingSeen(); }, [ret]);

  // PLAY is an <a>: the tap opens YouTube itself. No video yet → the owner
  // gets the link editor, everyone else sees it dimmed.
  const PlayLink = ({ tape, children, style, round = false }) => {
    const vid = tapeVideoId(tape, state);
    const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', cursor: 'pointer', ...style };
    if (!vid) {
      return (
        <button type="button" className="tp-play" aria-label={`${tape.title}: no video yet`} onClick={() => { if (owner) openEditor(tape); }}
          style={{ ...base, border: '1px dashed rgba(255,255,255,0.25)', background: 'transparent', color: MUTED, font: `700 ${round ? 12 : 11}px ${CP}`, letterSpacing: '0.1em' }}>
          {round ? <Link2 size={16}/> : 'NO VIDEO YET'}
        </button>
      );
    }
    return (
      <a href={youtubeUrl(vid)} target="_blank" rel="noopener noreferrer" className="tp-play" aria-label={`Play ${tape.title} on YouTube`} onClick={() => play(tape)} style={base}>
        {children}
      </a>
    );
  };

  const playStyle = (filled) => (filled
    ? { height: 38, padding: '0 16px', borderRadius: 11, background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204', font: `700 12.5px ${CP}`, letterSpacing: '0.14em', boxShadow: '0 0 18px rgba(242,190,69,0.3)' }
    : { width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${GOLD}`, color: GOLD, background: 'rgba(242,190,69,0.08)' });

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', background: 'radial-gradient(ellipse at 50% -10%,#2a1257 0%,transparent 55%),#07040f', color: '#fff', paddingBottom: 190 }}>
      <style dangerouslySetInnerHTML={{ __html: css }}/>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 6px' }}>
        <button type="button" onClick={onBack} aria-label="Back" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.35)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><ChevronLeft size={20}/></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: `900 18px ${OR}`, letterSpacing: '0.08em', textShadow: '0 0 16px rgba(157,108,255,0.5)' }}>{"COACH'S TAPES"}</div>
          <div style={{ font: `600 10.5px ${CP}`, letterSpacing: '0.16em', color: '#c9b8ff', whiteSpace: 'nowrap' }}>FOLLOW ALONG · COACH TM</div>
        </div>
        {owner && chip('OWNER', '#f0abfc', 'rgba(232,121,249,0.6)', 'rgba(232,121,249,0.12)')}
      </div>

      {/* shelf filter */}
      <div style={{ display: 'flex', gap: 6, padding: '6px 14px 0' }} role="tablist" aria-label="Shelf">
        {[['all', 'ALL'], ['fit', 'FIT'], ['fight', 'FIGHT']].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} className="tp-chip" onClick={() => setFilter(k)} style={{
            height: 30, padding: '0 14px', borderRadius: 9, cursor: 'pointer', font: `700 11px ${CP}`, letterSpacing: '0.12em',
            background: filter === k ? (k === 'fight' ? BLUE : VIOLET) : '#141024', color: filter === k ? '#fff' : '#9a93b8',
            border: `1px solid ${filter === k ? 'transparent' : 'rgba(255,255,255,0.08)'}`, boxShadow: filter === k ? `0 0 14px ${k === 'fight' ? BLUE : VIOLET}66` : 'none',
          }}>{l}</button>
        ))}
      </div>

      {/* featured: the newest tape */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '10px 14px 8px', padding: 12, borderRadius: 18, background: 'linear-gradient(135deg,rgba(60,30,110,0.55),rgba(14,8,28,0.9))', border: '1px solid rgba(242,190,69,0.45)' }}>
        <Disc tape={featured} size={112} className="tp-idle" id="hero"/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: `900 10px ${OR}`, letterSpacing: '0.2em', color: GOLD }}>NEW THIS MONTH</div>
          <div style={{ font: `700 18px ${CP}`, marginTop: 3 }}>{featured.title}</div>
          <div style={{ font: `500 12px ${CP}`, color: '#bdb5d8', marginTop: 2 }}>{featured.meta} · {fmtLen(featured.minutes)} · +{tapeXp(featured)} XP</div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <PlayLink tape={featured} style={playStyle(true)}><Play size={13} fill="currentColor" strokeWidth={0}/>PLAY <span style={{ opacity: 0.7 }}>↗</span></PlayLink>
            {owner && linkBtn(() => openEditor(featured), `Set the video link for ${featured.title}`, tapeVideoId(featured, state) ? 'LINK' : 'SET LINK')}
          </div>
        </div>
      </div>
      <div style={{ margin: '0 16px 8px', font: `500 12px ${CP}`, color: '#9a93b8' }}>Tapes play on YouTube. Come back here to claim your XP.</div>

      {/* the rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px' }}>
        {rows.map(t => {
          const out = (spin?.id === t.id) || (pending?.id === t.id);
          const done = counts.cleared.has(t.id);
          return (
            <div key={t.id} className="tp-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 14, background: out ? 'rgba(40,24,8,0.9)' : '#0E0B18', border: `1px solid ${out ? GOLD : 'rgba(255,255,255,0.08)'}` }}>
              {out
                ? <div style={{ width: 56, height: 56, flex: '0 0 56px', borderRadius: '50%', border: '2px dashed rgba(242,190,69,0.6)' }}/>
                : <Disc tape={t} size={56} id={t.id}/>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `700 15px ${CP}`, color: '#fff' }}><span style={{ color: MUTED, fontWeight: 600 }}>{t.num}</span>  {t.title}</div>
                <div style={{ font: `500 11.5px ${CP}`, color: MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.meta} · {fmtLen(t.minutes)} · <span style={{ color: '#ff9b9b' }}>YouTube ↗</span></div>
                <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                  {done && chip('✓ CLEARED', '#fff', 'rgba(34,197,94,0.9)', 'rgba(34,197,94,0.55)')}
                  {t.live && chip(t.live.toUpperCase(), '#c9b8ff', 'rgba(157,108,255,0.5)', 'transparent')}
                  {owner && linkBtn(() => openEditor(t), `Set the video link for ${t.title}`, tapeVideoId(t, state) ? 'LINK' : 'SET LINK')}
                </div>
              </div>
              <PlayLink tape={t} round style={playStyle(false)}><Play size={15} fill="currentColor" strokeWidth={0}/></PlayLink>
            </div>
          );
        })}
      </div>

      {/* set progress */}
      <div style={{ margin: '16px 14px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[['fit', 'FIT TAPES', VIOLET], ['fight', 'FIGHT TAPES', BLUE]].map(([k, l, c]) => (
          <div key={k} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(20,10,40,0.7)', border: '1px solid rgba(157,108,255,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: `700 10px ${CP}`, letterSpacing: '0.16em', color: '#c9b8ff' }}><span>{l}</span><span style={{ color: GOLD }}>{counts[k].done} / {counts[k].total}</span></div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', marginTop: 6, overflow: 'hidden' }}><div style={{ width: `${counts[k].total ? (counts[k].done / counts[k].total) * 100 : 0}%`, height: '100%', background: `linear-gradient(90deg,${c},${GOLD})` }}/></div>
          </div>
        ))}
      </div>
      <div style={{ margin: '8px 16px 0', font: `500 11.5px ${CP}`, color: '#7d76a0', textAlign: 'center' }}>XP for the workout, once per tape a day. Clear a whole shelf for its badge.</div>

      {/* send-off: the tape you picked spins while YouTube opens */}
      {spin && (
        <div role="status" style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: NAV, zIndex: 40, background: 'rgba(4,2,10,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          {/* scale-in on the wrapper, the spin on the disc: one animation each */}
          <div className="tp-in"><Disc tape={spin} size={220} className="tp-spin" id="big"/></div>
          <div style={{ marginTop: 18, font: `900 12px ${OR}`, letterSpacing: '0.24em', color: GOLD }}>NOW LOADING</div>
          <div style={{ font: `700 18px ${CP}`, marginTop: 4 }}>{spin.title}</div>
          <div style={{ font: `500 13px ${CP}`, color: '#ddd6f3', marginTop: 4 }}>Opening on YouTube…</div>
          <div style={{ font: `500 12px ${CP}`, color: '#9a93b8', marginTop: 10, textAlign: 'center' }}>When you finish, come back here for <b style={{ color: GOLD }}>+{tapeXp(spin)} XP</b></div>
          <button type="button" onClick={cancelSendoff} style={{ marginTop: 18, font: `700 11px ${CP}`, letterSpacing: '0.14em', color: '#9a93b8', border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', padding: '8px 14px', borderRadius: 10, cursor: 'pointer' }}>CANCEL</button>
        </div>
      )}

      {/* comeback bar */}
      {ret && !spin && !reward && (
        <div className="tp-bar" style={{ position: 'fixed', left: 0, right: 0, bottom: SHEET_BOTTOM, maxWidth: 440, margin: '0 auto', padding: '0 10px', zIndex: 30 }}>
          <div style={{ borderRadius: 16, background: 'linear-gradient(180deg,#1d1236,#0e0820)', border: `1.5px solid ${GOLD}`, boxShadow: '0 -6px 24px rgba(0,0,0,0.6)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Disc tape={ret.tape} size={54} className="tp-down" id="bar"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `900 10px ${OR}`, letterSpacing: '0.2em', color: GOLD }}>TAPE CLEAR?</div>
                <div style={{ font: `700 15px ${CP}`, marginTop: 2 }}>{ret.tape.title} · did you finish it?</div>
                <div style={{ font: `500 11.5px ${CP}`, color: '#9a93b8' }}>Away {ret.awayMin} min · tape is {fmtLen(ret.tape.minutes)}{clearedToday(ret.tape.id, now, state) ? ' · already cleared today' : ''}</div>
              </div>
              <button type="button" onClick={snooze} aria-label="Not yet" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#9a93b8', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={15}/></button>
            </div>
            <button type="button" disabled={!ret.canClear} onClick={() => settle('cleared')} style={{ width: '100%', height: 46, marginTop: 10, borderRadius: 12, border: 0, cursor: ret.canClear ? 'pointer' : 'default', background: ret.canClear ? 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)' : 'rgba(255,255,255,0.06)', color: ret.canClear ? '#1A1204' : '#7d76a0', font: `900 13px ${OR}`, letterSpacing: '0.1em' }}>
              {ret.canClear ? `✓ CLEARED · +${quote('cleared')} XP` : `CLEARED UNLOCKS IN ${ret.clearInMin} MIN`}
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" disabled={!ret.canPartial} onClick={() => settle('partial')} style={{ flex: 1, height: 38, borderRadius: 10, cursor: ret.canPartial ? 'pointer' : 'default', border: `1px solid ${ret.canPartial ? 'rgba(157,108,255,0.5)' : 'rgba(255,255,255,0.1)'}`, background: 'transparent', color: ret.canPartial ? '#c9b8ff' : '#5a5478', font: `700 11px ${CP}`, letterSpacing: '0.12em' }}>
                {ret.canPartial ? `PARTIAL · +${quote('partial')} XP` : `PARTIAL IN ${ret.partialInMin} MIN`}
              </button>
              <button type="button" onClick={snooze} style={{ flex: 1, height: 38, borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#bdb5d8', font: `700 11px ${CP}`, letterSpacing: '0.12em' }}>NOT YET</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <button type="button" onClick={() => settle('skip')} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: `600 11px ${CP}`, color: '#7d76a0' }}>{"Didn't do it"}</button>
              {tapeVideoId(ret.tape, state) && (
                <a href={youtubeUrl(tapeVideoId(ret.tape, state))} target="_blank" rel="noopener noreferrer" onClick={() => endMiniPlayer()} style={{ font: `600 11px ${CP}`, color: '#ff9b9b', textDecoration: 'none' }}>Back to the video ↗</a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* the clear */}
      {reward && (
        <div role="dialog" aria-label="Tape cleared" onClick={() => setReward(null)} style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: NAV, zIndex: 45, background: 'radial-gradient(circle at 50% 30%, rgba(90,60,10,0.98), rgba(6,3,12,0.985) 55%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer' }}>
          <div style={{ position: 'relative' }}>
            <Disc tape={reward.tape} size={200} id="won"/>
            <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: `3px solid ${GOLD}`, boxShadow: '0 0 40px rgba(242,190,69,0.7)' }}/>
            <div className="tp-stamp" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%) rotate(-12deg)', font: `900 ${reward.verdict === 'cleared' ? 26 : 22}px ${OR}`, letterSpacing: '0.12em', color: GOLD, border: `3px solid ${GOLD}`, padding: '4px 12px', borderRadius: 8, background: 'rgba(8,4,18,0.75)', textShadow: '0 0 14px rgba(242,190,69,0.8)', whiteSpace: 'nowrap' }}>{reward.verdict === 'cleared' ? 'CLEARED' : 'PARTIAL'}</div>
          </div>
          <div style={{ marginTop: 26, font: `900 44px ${OR}`, color: '#fff', textShadow: '0 0 24px rgba(242,190,69,0.9)' }}>{reward.xp > 0 ? `+${reward.xp} XP` : 'LOGGED'}</div>
          <div style={{ font: `600 13px ${CP}`, color: '#ddd6f3', marginTop: 6, textAlign: 'center' }}>{reward.xp > 0 ? `${reward.tape.title} · added to your Tapes shelf` : reward.reason === 'daily_cap' ? `${reward.tape.title} · two paid tapes a day, this one is logged` : reward.reason === 'repeat' ? `${reward.tape.title} · XP is once per tape a day` : reward.tape.title}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 18, padding: '10px 14px', borderRadius: 12, background: 'rgba(20,10,40,0.85)', border: '1px solid rgba(157,108,255,0.4)' }}>
            <span style={{ font: `700 11px ${CP}`, letterSpacing: '0.14em', color: '#c9b8ff' }}>{reward.tape.kind === 'fight' ? 'FIGHT TAPES' : 'FIT TAPES'}</span>
            <span style={{ width: 110, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}><span style={{ display: 'block', width: `${counts[reward.tape.kind].total ? (counts[reward.tape.kind].done / counts[reward.tape.kind].total) * 100 : 0}%`, height: '100%', background: `linear-gradient(90deg,${VIOLET},${GOLD})` }}/></span>
            <span style={{ font: `700 12px ${CP}`, color: GOLD }}>{counts[reward.tape.kind].done} / {counts[reward.tape.kind].total}</span>
          </div>
          <div style={{ marginTop: 22, font: `700 10px ${CP}`, letterSpacing: '0.2em', color: '#7d76a0' }}>TAP TO CONTINUE</div>
        </div>
      )}

      {/* owner: paste the video link */}
      {owner && editing && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: SHEET_BOTTOM, maxWidth: 440, margin: '0 auto', padding: '0 10px', zIndex: 35 }}>
          <div style={{ borderRadius: 16, background: '#140d26', border: '1.5px solid rgba(232,121,249,0.6)', boxShadow: '0 -6px 24px rgba(0,0,0,0.6)', padding: 12 }}>
            <div style={{ font: `900 10px ${OR}`, letterSpacing: '0.2em', color: '#f0abfc' }}>VIDEO LINK · {TAPES.find(t => t.id === editing)?.title}</div>
            <input value={draft} onChange={e => { setDraft(e.target.value); setLinkError(''); }} placeholder="Paste the YouTube link" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, height: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: '#0b0716', color: '#fff', padding: '0 12px', font: `600 14px ${CP}` }}/>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" onClick={saveLink} style={{ flex: 1.4, height: 40, borderRadius: 10, border: 0, cursor: 'pointer', background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204', font: `800 12px ${CP}`, letterSpacing: '0.12em' }}>{draft.trim() ? 'SAVE LINK' : 'CLEAR LINK'}</button>
              <button type="button" onClick={() => { setEditing(null); setLinkError(''); }} style={{ flex: 1, height: 40, borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#bdb5d8', font: `700 11px ${CP}`, letterSpacing: '0.12em' }}>CANCEL</button>
            </div>
            {linkError && <div role="alert" style={{ marginTop: 6, font: `600 11.5px ${CP}`, color: '#ff9b9b' }}>{linkError}</div>}
            <div style={{ marginTop: 6, font: `500 11px ${CP}`, color: '#7d76a0' }}>Saved on this phone only. Put the ID in data/tapes.js to ship it.</div>
          </div>
        </div>
      )}
    </div>
  );
}
