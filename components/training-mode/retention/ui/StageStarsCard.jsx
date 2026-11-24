import StarsRow from './StarsRow';
import { ARC } from './tokens';

// The end screen's small stars row (retention feature 2) for an arcade v2 or
// concept stage that has stars: the stage's stars as stored now, landing one
// by one, and one plain line (which paths are cleared, or that a clear is the
// one star). Sized for MissionComplete's `summary` slot.
// `title`: what the stars are of ('STAGE STARS'; the camp's 'LEVEL STARS').
export default function StageStarsCard({ stars = 0, max = 3, line, onLand, title = 'STAGE STARS' }) {
  return (
    <div data-retention="stage-stars" style={{
      background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(253,224,71,0.3)', borderRadius: 11, padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `700 8px ${ARC.head}`, color: ARC.gold, letterSpacing: '0.16em' }}>{title} · {stars} OF {max}</div>
        {line && <div style={{ font: `600 10px ${ARC.body}`, color: ARC.muted, marginTop: 3, lineHeight: 1.3 }}>{line}</div>}
      </div>
      <StarsRow n={stars} of={max} size={20} gap={3} land delay={0.6} onLand={onLand} style={{ flexShrink: 0 }}/>
    </div>
  );
}
