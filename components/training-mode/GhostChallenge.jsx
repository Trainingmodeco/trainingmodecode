import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import SafeImage from './SafeImage';
import { bonusFor, bonusLine, ghostHunter, hauntURL } from './data/ghostChallenges';

// The Ghost Challenge screen (Simplify revamp, GhostChallenge.dc.html), full
// screen over everything. Three views:
//
// - 'challenge': one of your own sessions is back. ACCEPT or NOT NOW — and
//   NOT NOW never makes it go away (data/ghostChallenges).
// - 'haunted': a friend's ghost arrived by link, with their name on it.
// - 'haunt': Haunt a Friend — send the session you just finished as a link
//   that opens straight into racing it.
//
// Fight ghosts glow blue, everything else violet, as in the design.

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const dayLabel = (t) => { try { return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return 'earlier'; } };
const upper = (s) => String(s || '').toUpperCase();

const CSS = `
@keyframes gc-float { 0%, 100% { opacity: .78; transform: translateY(0) } 50% { opacity: 1; transform: translateY(-8px) } }
.gc-art { animation: gc-float 3.2s ease-in-out infinite; }
.gc-gold:hover, .gc-gold:focus-visible { filter: brightness(1.1); }
.gc-txt:hover, .gc-txt:focus-visible { color: #F2BE45 !important; }
.gc-share:hover, .gc-share:focus-visible { border-color: #F2BE45 !important; color: #F2BE45 !important; }
@media (prefers-reduced-motion: reduce) { .gc-art { animation: none !important } }
`;

// What a challenge says, from the ghost itself — never made-up numbers.
function describe(ch) {
  if (ch.kind === 'cardio') {
    const r = ch.run;
    const unit = r.unit === 'km' ? 'km' : 'mi';
    return {
      title: 'RACE YOUR GHOST',
      sub: `Your ${dayLabel(r.createdAt)} ${r.goal} ${unit} run is back. Your ghost runs beside you — stay ahead of it.`,
      stats: [[mmss(r.totalSec), 'GHOST TIME'], [`${r.goal} ${unit}`, 'DISTANCE'], [mmss(r.totalSec / r.goal), `PACE /${upper(unit)}`]],
      cta: 'START GHOST RUN',
    };
  }
  const g = ch.ghost;
  const rc = g.source?.roundsConfig || {};
  const rounds = rc.rounds && rc.roundSec ? `${rc.rounds} × ${mmss(rc.roundSec)}` : '—';
  const level = upper(g.source?.difficulty || 'normal');
  if (ch.from === 'friend') {
    return {
      title: `${upper(g.ownerName)} HAUNTED YOU`,
      sub: `${g.ownerName} finished Fight Focus · ${rounds} on ${level.toLowerCase()} and dared you to beat it.`,
      stats: [[String(g.totalStrikes), 'STRIKES'], [rounds, 'ROUNDS'], [level, 'LEVEL']],
      cta: 'ACCEPT HAUNT',
    };
  }
  return {
    title: 'BEAT YOUR GHOST',
    sub: `Your ${dayLabel(g.createdAt)} Fight Focus is back. Same rounds — with surprise rushes scattered through it.`,
    stats: [[String(g.totalStrikes), 'GHOST STRIKES'], [rounds, 'ROUNDS'], [level, 'LEVEL']],
    cta: 'TAKE THE FIGHT',
  };
}

const Trophy = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 15, height: 15, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>
  </svg>
);
const SHARE_ICONS = {
  MESSAGES: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  'COPY LINK': 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  SHARE: 'M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5',
};

export default function GhostChallenge({ view = 'challenge', challenge, ghost, xpLine, gender = 'male', onAccept, onDecline, onClose }) {
  const haunt = view === 'haunt';
  const fight = haunt || challenge?.kind === 'fight';
  const accent = fight ? '#8FB4FF' : '#C4A8FF';
  const d = haunt ? null : describe(challenge);
  const [copied, setCopied] = useState('');

  const link = haunt ? hauntURL(ghost) : null;
  const bonus = haunt ? 0 : bonusFor(challenge);
  const hunter = ghostHunter();
  const kicker = haunt ? `SESSION COMPLETE${xpLine ? ` · ${xpLine}` : ''}`
    : challenge.from === 'friend' ? 'YOU’VE BEEN HAUNTED'
      : `${challenge.kind === 'cardio' ? 'GHOST RUN' : 'GHOST CHALLENGE'} · ${bonusLine(challenge)}`;

  const shareText = 'I left my ghost in Training Mode. Beat it if you can:';
  const doShare = async (kind) => {
    if (!link) return;
    if (kind === 'COPY LINK') {
      try { await navigator.clipboard.writeText(link); setCopied('Link copied'); } catch { setCopied('Couldn’t copy — press and hold the link'); }
      setTimeout(() => setCopied(''), 2600);
    } else if (kind === 'MESSAGES') {
      window.location.href = `sms:?&body=${encodeURIComponent(`${shareText} ${link}`)}`;
    } else if (navigator.share) {
      navigator.share({ title: 'Training Mode ghost', text: shareText, url: link }).catch(() => {});
    }
  };
  const shares = ['MESSAGES', 'COPY LINK', ...(typeof navigator !== 'undefined' && navigator.share ? ['SHARE'] : [])];

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={haunt ? 'Haunt a friend' : d.title} style={{
      position: 'fixed', inset: 0, maxWidth: 440, margin: '0 auto', zIndex: 900, overflow: 'hidden', boxSizing: 'border-box',
      padding: '14px 20px calc(18px + env(safe-area-inset-bottom, 0px))', color: '#fff', fontFamily: 'Barlow, system-ui, sans-serif',
      background: `radial-gradient(90% 50% at 50% 30%, ${fight ? 'rgba(36,88,224,.35)' : 'rgba(107,61,240,.35)'} 0%, #07060C 70%), #07060C`,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }}/>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, height: 44, flexShrink: 0 }}>
        <span style={{ font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: accent }}>{kicker}</span>
        <button type="button" className="gc-txt" aria-label="Close" onClick={haunt ? onClose : onDecline} style={{
          width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.06)', border: 0, color: '#CFC9E4', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}><X size={16}/></button>
      </header>

      <div style={{ position: 'relative', flex: '0 1 auto', height: haunt ? 250 : 330, minHeight: 140, display: 'flex', justifyContent: 'center' }}>
        <SafeImage className="gc-art" src={`/static/revamp/ghost-${gender === 'female' ? 'female' : 'male'}.webp`} alt="Ghost" style={{
          height: '100%', width: 'auto', objectFit: 'contain',
          filter: `drop-shadow(0 0 28px ${fight ? 'rgba(61,123,255,.55)' : 'rgba(157,108,255,.6)'})`,
        }}/>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', flexShrink: 0 }}>
        <div style={{ font: "700 28px 'Chakra Petch',sans-serif", letterSpacing: '0.04em', lineHeight: 1.05, textWrap: 'pretty' }}>{haunt ? 'HAUNT A FRIEND' : d.title}</div>
        <div style={{ fontSize: 14, color: '#A9A3C4', lineHeight: 1.4, maxWidth: 300, textWrap: 'pretty' }}>
          {haunt ? 'Send your ghost. Whoever opens the link races this exact session.' : d.sub}
        </div>
      </div>

      {!haunt && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6, flexShrink: 0 }}>
            {d.stats.map(([val, lab], i) => (
              <div key={lab} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 4px', borderRadius: 10, background: '#0E0B18', border: '1px solid rgba(255,255,255,.08)' }}>
                <span style={{ font: "700 18px 'Chakra Petch',sans-serif", color: i === 0 ? '#F2BE45' : '#fff', whiteSpace: 'nowrap' }}>{val}</span>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: '#8E88A8', textAlign: 'center' }}>{lab}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: '#F2BE45', flexShrink: 0 }}>
            <Trophy/>{bonus ? `+${bonus} BONUS XP` : 'FOR PRIDE'} · Ghost Hunter {hunter.beaten} / {hunter.next}
          </div>
        </>
      )}

      {haunt && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 14, borderRadius: 12, border: '1px dashed rgba(196,168,255,.55)', background: 'rgba(157,108,255,.08)', flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: '#A9A3C4' }}>YOUR GHOST · {ghost.totalStrikes} STRIKES</span>
            <span style={{ font: "700 13px 'Chakra Petch',sans-serif", color: '#F2BE45', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {link ? link.replace(/^https?:\/\//, '').slice(0, 38) + '…' : 'Link unavailable'}
            </span>
            <span style={{ fontSize: 12, color: '#8E88A8' }}>{copied || 'Opens straight into racing your session'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${shares.length}, minmax(0,1fr))`, gap: 6, flexShrink: 0 }}>
            {shares.map(k => (
              <button key={k} type="button" className="gc-share" onClick={() => doShare(k)} disabled={!link} style={{
                height: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 10,
                background: '#0E0B18', border: '1px solid rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer',
                font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.14em', transition: 'border-color .18s, color .18s',
              }}>
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d={SHARE_ICONS[k]}/></svg>{k}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ flexGrow: 1 }}/>
      <button type="button" className="gc-gold" onClick={haunt ? onClose : onAccept} style={{
        height: 56, flexShrink: 0, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
        background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204',
        font: "700 16px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', boxShadow: '0 0 28px rgba(242,190,69,.35)',
      }}>{haunt ? 'DONE' : d.cta}</button>
      {!haunt && <div style={{ textAlign: 'center', fontSize: 12, color: '#7F789C', marginBottom: -6, flexShrink: 0 }}>It won&rsquo;t leave until you beat it.</div>}
      {!haunt && (
        <button type="button" className="gc-txt" onClick={onDecline} style={{
          height: 40, flexShrink: 0, background: 'none', border: 0, cursor: 'pointer', color: '#A9A3C4',
          font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
        }}>{challenge.from === 'friend' ? 'LATER' : 'NOT NOW'}</button>
      )}
    </div>,
    document.body,
  );
}
