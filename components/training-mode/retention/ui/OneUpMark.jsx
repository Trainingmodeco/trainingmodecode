import { HOME, head } from './tokens';

// The 1UP mark (the week streak's spare life: it covers a short week so the
// streak is kept; once called a freeze). Numbers and storage are the
// freeze's own (data/weekStreak: start with 1, +1 per 4 weeks on target, hold 2).
//   stacked: the week chip's compact mark, "1UP" over "×2", narrow enough
//            that the chip still fits Home's header at 360 px with the longest
//            rank names (10 px, the count in near-white so it reads on the
//            dark chip)
//   default: a small pill reading 1UP, for a notice's icon
export default function OneUpMark({ count = null, stacked = false, style }) {
  if (stacked) {
    return (
      <span aria-hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, ...style }}>
        <span style={{ ...head(10, 800, { letterSpacing: 0, lineHeight: 1 }), color: HOME.oneUp, whiteSpace: 'nowrap' }}>1UP</span>
        <span style={{ ...head(10, 700, { letterSpacing: '0.02em', lineHeight: 1 }), color: count > 0 ? HOME.text : HOME.muted, whiteSpace: 'nowrap' }}>×{count ?? 0}</span>
      </span>
    );
  }
  return (
    <span aria-hidden style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 22, padding: '0 6px', borderRadius: 6, boxSizing: 'border-box',
      border: `1.5px solid ${HOME.oneUp}`, color: HOME.oneUp, background: 'rgba(107,245,154,0.08)',
      ...head(11, 800, { letterSpacing: '0.02em', lineHeight: 1 }), whiteSpace: 'nowrap', flexShrink: 0, ...style,
    }}>1UP</span>
  );
}
