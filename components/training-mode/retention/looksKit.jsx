import { useState } from 'react';
import { C } from '../Styles';
import { ARCADE } from '../ArcadeUI';
import { HOME, head } from './ui/tokens';
import SafeImage from '../SafeImage';

// Shared pieces of the retention looks gallery (/retention-looks): the phone
// frame each look is drawn in, the card around it, the home screen's tokens
// and the gallery's own animations. Looks only: sample data, no wiring.

// The home screen's own palette (HomeDashboard.jsx), so home cards match it.
// Shared with the real retention components (retention/ui/tokens), so a look
// and what ships cannot drift.
export { HOME, head };

export const orb = (size, extra = {}) => ({ fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: size, letterSpacing: '0.08em', ...extra });
export const goldText = {
  background: ARCADE.goldGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text',
  WebkitTextFillColor: 'transparent', color: 'transparent',
};

export const LOOKS_CSS = `
@keyframes rl-pop { 0% { transform: scale(0.4); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }
@keyframes rl-slam { 0% { transform: scale(2.4); opacity: 0 } 45% { transform: scale(0.92); opacity: 1 } 70% { transform: scale(1.04) } 100% { transform: scale(1) } }
@keyframes rl-rise { from { transform: translateY(14px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes rl-pulse { 0%,100% { box-shadow: 0 0 10px rgba(168,85,247,.55), 0 0 22px rgba(253,224,71,.25) } 50% { box-shadow: 0 0 20px rgba(168,85,247,.9), 0 0 40px rgba(253,224,71,.5) } }
@keyframes rl-ring { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(1.9); opacity: 0 } }
@keyframes rl-fill { from { width: 0 } }
@keyframes rl-shine { 0% { transform: translateX(-120%) skewX(-20deg) } 100% { transform: translateX(220%) skewX(-20deg) } }
@keyframes rl-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@keyframes rl-shake { 0%,100% { transform: rotate(0) } 20% { transform: rotate(-7deg) } 40% { transform: rotate(6deg) } 60% { transform: rotate(-4deg) } 80% { transform: rotate(3deg) } }
@keyframes rl-lid { 0% { transform: translateY(0) rotate(0) } 100% { transform: translateY(-26px) rotate(-18deg) } }
@keyframes rl-burst { 0% { transform: scale(.2); opacity: 0 } 40% { opacity: 1 } 100% { transform: scale(1.6); opacity: 0 } }
@keyframes rl-spark { 0% { transform: translate(0,0) scale(1); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(.3); opacity: 0 } }
@keyframes rl-dot { 0% { transform: scale(0); background: #fff } 60% { transform: scale(1.35) } 100% { transform: scale(1) } }
@keyframes rl-snow { 0% { transform: translateY(-6px) rotate(0); opacity: 0 } 30% { opacity: 1 } 100% { transform: translateY(10px) rotate(40deg); opacity: .9 } }
.rl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 22px; align-items: start; }
@media (max-width: 420px) { .rl-grid { grid-template-columns: 1fr; } }
`;

// The phone each look is drawn in. transform makes it the containing block
// for position: fixed, so the app's own full-screen overlays stay inside it.
export function Phone({ height, children, pad = 0, bg = C.bg, style }) {
  return (
    <div style={{
      position: 'relative', width: '100%', maxWidth: 360, margin: '0 auto', height: height || 'auto', minHeight: height ? undefined : 80,
      borderRadius: 26, border: '1px solid rgba(168,85,247,0.35)', background: bg, overflow: 'hidden', transform: 'translateZ(0)',
      boxShadow: '0 10px 40px rgba(0,0,0,0.55), 0 0 0 4px rgba(255,255,255,0.03)', padding: pad, boxSizing: 'border-box', ...style,
    }}>
      {children}
    </div>
  );
}

// One gallery card: the look's name, a one-line note, the phone, and a replay
// button for the animated ones (it remounts the look so its animation runs again).
export function Look({ name, note, animated, height, pad, bg, children }) {
  const [run, setRun] = useState(0);
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingRight: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...head(13, 700), color: HOME.gold }}>{name}</div>
          {note && <div style={{ fontSize: 13, color: HOME.muted, lineHeight: 1.35, marginTop: 2 }}>{note}</div>}
        </div>
        {animated && (
          <button type="button" onClick={() => setRun((n) => n + 1)} style={{
            ...head(10, 700), color: C.text, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.5)',
            borderRadius: 999, padding: '6px 10px', cursor: 'pointer', flexShrink: 0,
          }}>▶ REPLAY</button>
        )}
      </div>
      <Phone height={height} pad={pad} bg={bg}><div key={run} style={{ height: '100%' }}>{children}</div></Phone>
    </section>
  );
}

// A feature's block in the gallery: number, title, what it reuses and what is new.
export function Feature({ id, num, title, reuse, isNew, children }) {
  return (
    <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 18, scrollMarginTop: 70 }}>
      <div style={{ borderLeft: `3px solid ${HOME.gold}`, paddingLeft: 12 }}>
        <div style={{ ...orb(11), color: HOME.muted }}>{num}</div>
        <div style={{ ...orb(20), ...goldText }}>{title}</div>
        {reuse && <div style={{ fontSize: 13, color: HOME.muted, marginTop: 4 }}><b style={{ color: C.text }}>Reuses:</b> {reuse}</div>}
        {isNew && <div style={{ fontSize: 13, color: HOME.muted }}><b style={{ color: C.text }}>New:</b> {isNew}</div>}
      </div>
      <div className="rl-grid">{children}</div>
    </div>
  );
}

// Small shared widgets.
export function Bar({ value, max, color = HOME.gold, height = 8, animate = true, bg = HOME.track }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height, background: bg, borderRadius: height, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: height, animation: animate ? 'rl-fill 1s cubic-bezier(.2,.8,.2,1)' : 'none' }}/>
    </div>
  );
}

export function Stars({ n, of = 3, size = 16, land = false, gap = 2, delay = 0 }) {
  return (
    <span style={{ display: 'inline-flex', gap }}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} style={{
          fontSize: size, lineHeight: 1, color: i < n ? '#fde047' : 'rgba(255,255,255,0.18)',
          textShadow: i < n ? '0 0 10px rgba(253,224,71,0.7)' : 'none',
          animation: land && i < n ? `rl-slam .55s ${delay + i * 0.45}s both` : 'none',
        }}>★</span>
      ))}
    </span>
  );
}

export function Btn({ children, tone = 'gold', style, ...rest }) {
  const tones = {
    gold: { background: 'linear-gradient(180deg,#fde047,#f59e0b)', color: '#140a00', border: '1px solid #fde047' },
    ghost: { background: 'rgba(255,255,255,0.04)', color: C.text, border: '1px solid rgba(255,255,255,0.18)' },
    violet: { background: 'rgba(168,85,247,0.18)', color: C.text, border: '1px solid rgba(168,85,247,0.6)' },
    danger: { background: 'transparent', color: HOME.red, border: '1px solid rgba(255,122,122,0.45)' },
  };
  return (
    <button type="button" style={{
      ...head(13, 700), minHeight: 46, borderRadius: 12, padding: '0 14px', cursor: 'pointer', width: '100%', ...tones[tone], ...style,
    }} {...rest}>{children}</button>
  );
}

export function Sparks({ n = 14, color = '#fde047' }) {
  return (
    <div aria-hidden style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2, r = 70 + (i % 3) * 22;
        return <span key={i} style={{
          position: 'absolute', width: 6, height: 6, borderRadius: 3, background: i % 2 ? color : '#c084fc',
          '--dx': `${Math.cos(a) * r}px`, '--dy': `${Math.sin(a) * r}px`, animation: `rl-spark .9s ${0.15 + (i % 4) * 0.05}s ease-out both`,
        }}/>;
      })}
    </div>
  );
}

// The home header as it is today, so the new chips are seen in place.
export function HomeHeader({ right }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 6px' }}>
      <SafeImage src="/static/logo-mark.png" alt="" style={{ width: 26, height: 30, objectFit: 'contain' }}/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ ...head(13), color: HOME.gold }}>LV 14</span>
          <span style={{ ...head(10, 600), letterSpacing: '0.16em', color: HOME.muted }}>WARRIOR</span>
        </div>
        <div style={{ height: 4, background: HOME.track, borderRadius: 2, overflow: 'hidden' }}><div style={{ width: '62%', height: '100%', background: HOME.gold }}/></div>
      </div>
      {right}
    </header>
  );
}
