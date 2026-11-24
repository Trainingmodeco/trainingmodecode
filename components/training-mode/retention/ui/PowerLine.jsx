import { Zap } from 'lucide-react';
import { HOME, head } from './tokens';

// POWER on Home (retention, switch `power`): one slim line under the header,
// shown only once the fighter is below full (a trained athlete sees nothing
// new). The bar drains from 100% three days after the last training day to
// 0% at day 28; it turns amber at 40% or less, and after a month away reads
// RUSTY. One finished session fills it again. data/power powerAt gives
// { pct, state }.
// It lines up under the level column (the logo's width and the header's gap),
// so it reads as part of the level block, not as another card.
export const POWER_INDENT = 37;
const CELLS = 10;

export default function PowerLine({ pct = 100, state = 'full', style }) {
  const rusty = state === 'rusty';
  const low = state === 'low';
  const tone = rusty ? HOME.rust : low ? HOME.low : HOME.gold;
  const label = rusty ? 'Power: rusty. One session revives it.' : `Power ${pct}%`;
  // Any power left lights at least one cell.
  const lit = pct <= 0 ? 0 : Math.max(1, Math.round((pct / 100) * CELLS));
  return (
    <div data-retention="power" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{
      display: 'flex', alignItems: 'center', gap: 7, minHeight: 16, paddingLeft: POWER_INDENT, boxSizing: 'border-box', ...style,
    }}>
      <Zap size={12} color={tone} fill={tone} strokeWidth={0} style={{ flexShrink: 0 }}/>
      <span style={{ ...head(10, 700, { letterSpacing: '0.16em', lineHeight: 1 }), color: HOME.muted, whiteSpace: 'nowrap' }}>POWER</span>
      {/* A segmented power bar (ten cells, like a game's), so it never reads
          as a second XP bar: the cells still lit are the power left. */}
      <span aria-hidden style={{ flex: 1, minWidth: 60, display: 'flex', gap: 2 }}>
        {Array.from({ length: CELLS }, (_, i) => (
          <span key={i} style={{
            flex: 1, height: 5, borderRadius: 1.5, boxSizing: 'border-box',
            background: i < lit ? tone : HOME.track,
            boxShadow: rusty ? `inset 0 0 0 1px ${HOME.rust}40` : 'none',
          }}/>
        ))}
      </span>
      <span style={{ ...head(11, 700, { letterSpacing: rusty ? '0.12em' : '0.02em', lineHeight: 1 }), color: rusty || low ? tone : '#E6E2F5', whiteSpace: 'nowrap', minWidth: 30, textAlign: 'right' }}>
        {rusty ? 'RUSTY' : `${pct}%`}
      </span>
    </div>
  );
}
