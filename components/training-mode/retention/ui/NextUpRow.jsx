import { HOME, head, ARC, RETENTION_CSS } from './tokens';

// Home's NEXT UP row (retention feature 2): the saga's current node or the
// camp's current level, one tap to open it there. Copy from data/pathStars
// nextUpCopy: the badge carries the number, the title the name (at most two
// lines), `label` the whole of it for a screen reader.
const TWO_LINES = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' };

export default function NextUpRow({ eyebrow, title, label, number, boss = false, onGo, style }) {
  return (
    <button type="button" data-retention="next-up" aria-label={label} className="rt-go rt-anim" onClick={onGo} style={{
      width: '100%', minHeight: 64, boxSizing: 'border-box', borderRadius: 14, background: HOME.tile, border: '1px solid rgba(253,224,71,.35)',
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', flexShrink: 0, ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <span aria-hidden style={{
        width: 42, height: 42, borderRadius: 21, flexShrink: 0, display: 'grid', placeItems: 'center', boxSizing: 'border-box',
        border: `2px solid ${ARC.goldBright}`, background: 'radial-gradient(circle at 50% 35%, #3b1670, #14052a)', animation: 'rt-pulse 1.8s infinite',
        font: `900 ${boss ? 17 : String(number).length > 1 ? 12 : 14}px ${ARC.head}`, color: '#fff',
      }}>{boss ? '👑' : number}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ ...head(10, 600), color: HOME.muted, overflowWrap: 'anywhere' }}>{eyebrow}</span>
        <span style={{ ...head(15, 700, { letterSpacing: '0.02em', lineHeight: 1.2 }), ...TWO_LINES, color: '#fff', overflowWrap: 'anywhere' }}>{title}</span>
      </span>
      <span style={{ ...head(12), color: HOME.gold, whiteSpace: 'nowrap', flexShrink: 0 }}>START ▶</span>
    </button>
  );
}
