import SafeImage from '../SafeImage';
import { featuredEntry, loadProgress, status, fmtEnd } from '../data/concepts';

// The featured-drop card on Home and at the top of the Fit and Fight hubs.
// Renders nothing when no drop is featured.
const H = "'Orbitron',sans-serif";
const B = "'Rajdhani',sans-serif";
const GOLD = '#fde047';

export default function ConceptFeatureCard({ mode = 'home', onOpen, style }) {
  const entry = featuredEntry();
  if (!entry) return null;
  const c = entry.concept;
  const prog = loadProgress(c.id);
  const st = status(c, prog);
  const fight = mode === 'fight';
  const ring = fight ? '#60a5fa' : c.accent;
  const title = mode === 'fight' ? `${c.title} · FIGHT` : c.title;
  const sub = mode === 'home'
    ? `Fit · Fight · Arcade — ${st.partsDone} of 3 done`
    : mode === 'fight' ? c.fight.blurb : c.fit.blurb;
  const cta = st.partsDone ? 'CONTINUE ›' : 'START ›';
  return (
    <button type="button" onClick={() => onOpen?.(mode === 'home' ? 'fit' : mode)} style={{
      position: 'relative', display: 'block', width: '100%', height: mode === 'home' ? 92 : 112, padding: 0, border: 0, cursor: 'pointer',
      borderRadius: 14, overflow: 'hidden', textAlign: 'left', color: '#fff', background: '#0c0218',
      boxShadow: `0 0 0 1.5px ${ring}aa, 0 0 22px ${ring}44`, ...style,
    }}>
      <SafeImage src={fight ? c.art.poster : c.art.wide} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '60% 30%' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,${fight ? 'rgba(4,8,26,.95)' : 'rgba(10,0,22,.94)'} 0%,rgba(10,0,22,.68) 55%,rgba(10,0,22,.12) 100%)` }} />
      <div style={{ position: 'absolute', left: 14, top: 11, right: 14 }}>
        <span style={{ display: 'inline-block', padding: '4px 9px', borderRadius: 99, background: ring, color: fight ? '#03122e' : '#2a0034', font: `800 8.5px ${H}`, letterSpacing: '0.14em' }}>
          ◆ {mode === 'home' ? 'NEW DROP' : 'CONCEPT PROGRAM'}
        </span>
        <div style={{ font: `900 ${mode === 'home' ? 20 : 21}px ${H}`, letterSpacing: '0.04em', marginTop: 5 }}>{title}</div>
        <div style={{ font: `600 12px ${B}`, color: fight ? '#cfe0ff' : '#f0d6ff', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 70 }}>{sub}</div>
      </div>
      <div style={{ position: 'absolute', right: 12, bottom: 10, textAlign: 'right' }}>
        {mode !== 'home' && <div style={{ font: `800 7.5px ${H}`, letterSpacing: '0.14em', color: '#cfc3e8' }}>ENDS {fmtEnd(entry)}</div>}
        <div style={{ font: `900 10px ${H}`, letterSpacing: '0.14em', color: GOLD }}>{cta}</div>
      </div>
    </button>
  );
}
