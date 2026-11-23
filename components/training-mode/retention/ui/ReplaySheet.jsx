import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import StarsRow from './StarsRow';
import { HOME, head, ARC, GOLD_BUTTON, RETENTION_CSS } from './tokens';

// A cleared node's replay sheet (retention feature 2): the best stars (or a
// check where there is no star rule), the best time where one is stored, what
// the next star needs where a rule exists, REPLAY (the screen's own start
// flow) and CLOSE. It covers the box it is drawn in (the path's box, above the
// tab bar) and rises from its bottom. `children` sits above the buttons (a
// multi-path saga's path picker). `bottomPad` keeps the buttons clear of
// what floats over the box's bottom edge (the beta chip over the camp's).
//   tiles: [{ label, value, gold? }]  at most two
export default function ReplaySheet({ eyebrow, title, stars, max = 3, check = false, tiles = [], line, onReplay, onClose, replayLabel = 'REPLAY', bottomPad = 16, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="rt-anim" style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <div onClick={onClose} aria-hidden style={{ position: 'absolute', inset: 0, background: 'rgba(4,0,10,0.55)' }}/>
      <section role="dialog" aria-label={title} data-retention="replay-sheet" style={{
        position: 'relative', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box',
        borderRadius: '20px 20px 0 0', background: HOME.tile, borderTop: '1px solid rgba(253,224,71,.45)',
        boxShadow: '0 -14px 36px rgba(0,0,0,0.55)', padding: `12px 16px ${bottomPad}px`, animation: 'rt-sheet .3s both',
      }}>
        <div aria-hidden style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)', margin: '0 auto 12px' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...head(10, 600), color: HOME.muted }}>{eyebrow}</div>
            <div style={{ ...head(18, 700, { letterSpacing: '0.02em', lineHeight: 1.15 }), color: '#fff', marginTop: 2, overflowWrap: 'anywhere' }}>{title}</div>
          </div>
          {check ? (
            <span role="img" aria-label="Cleared" style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: '#22c55e', color: '#04140c', display: 'grid', placeItems: 'center', font: `900 18px ${ARC.head}` }}>✓</span>
          ) : max > 0 ? (
            <StarsRow n={stars} of={max} size={22} style={{ flexShrink: 0 }}/>
          ) : null}
        </div>
        {tiles.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`, gap: 8, marginTop: 14 }}>
            {tiles.map((t) => (
              <div key={t.label} style={{
                borderRadius: 10, padding: 10, minWidth: 0,
                background: t.gold ? 'rgba(253,224,71,.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${t.gold ? 'rgba(253,224,71,.35)' : 'rgba(255,255,255,0.08)'}`,
              }}>
                <div style={{ ...head(9, 600), color: HOME.muted }}>{t.label}</div>
                <div style={{ ...head(17, 700, { letterSpacing: '0.02em' }), color: t.gold ? '#fff' : HOME.gold, marginTop: 2, overflowWrap: 'anywhere' }}>{t.value}</div>
              </div>
            ))}
          </div>
        )}
        {line && <div style={{ fontSize: 13, lineHeight: 1.35, color: HOME.muted, marginTop: 10 }}>{line}</div>}
        {children}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          <button type="button" className="rt-go" onClick={onReplay} style={{
            height: 46, borderRadius: 12, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: GOLD_BUTTON, color: '#1A1204', ...head(13, 700, { letterSpacing: '0.14em' }),
          }}><RotateCcw size={14} strokeWidth={2.6}/>{replayLabel}</button>
          <button type="button" className="rt-go" onClick={onClose} style={{
            height: 46, borderRadius: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff', ...head(13, 700, { letterSpacing: '0.14em' }),
          }}>CLOSE</button>
        </div>
      </section>
    </div>
  );
}

// The path picker inside the sheet (a multi-path saga): one star per path,
// gold where that path is cleared; the chosen one is the path REPLAY runs.
export function PathChoice({ paths = [], cleared = [], value, onChange, label = 'PATH TO REPLAY' }) {
  const tone = { fit: '#2dd4bf', fight: '#fde047', both: '#a855f7' };
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...head(9, 600), color: HOME.muted, marginBottom: 6 }}>{label}</div>
      <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${paths.length}, minmax(0, 1fr))`, gap: 6 }}>
        {paths.map((p) => {
          const on = value === p;
          const done = cleared.includes(p);
          const ac = tone[p] || HOME.gold;
          return (
            <button key={p} type="button" role="radio" aria-checked={on} onClick={() => onChange?.(p)} style={{
              height: 44, borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: on ? `${ac}22` : 'rgba(255,255,255,0.04)', border: `1.5px solid ${on ? ac : 'rgba(255,255,255,0.14)'}`,
            }}>
              <span aria-hidden style={{ fontSize: 13, color: done ? ARC.star : ARC.starOff }}>★</span>
              <span style={{ font: `900 11px ${ARC.head}`, letterSpacing: '0.08em', color: on ? ac : 'rgba(230,215,255,0.85)' }}>{p === 'both' ? 'BOTH' : String(p).toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
