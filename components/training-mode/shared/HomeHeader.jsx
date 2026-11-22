import SafeImage from '../SafeImage';
import { HelpButton } from './WorkoutHelpPanel';

// Home's header: the logo, the level with its rank and bar, a chip (the
// streak), and the help button. Profile lives on the tab bar.
// `compact` (the week streak's wider chip, retention feature 1): a tighter
// gap, and the XP numbers give way (the bar still shows them; the Level page
// has them), so the chip fits beside the bar at 360 px. The rank wraps under
// the level rather than being cut.
const MUTED = '#A9A3C4';

export default function HomeHeader({ level, tierName, levelXp, levelNeeded, xpPercent, chip, compact = false, onHome, onHelp }) {
  const gap = compact ? 8 : 12;
  // The secret ranks' two-word names (FIGHT ASCENDANT) set a size smaller, so
  // they keep one line beside the chip; they still wrap rather than be cut.
  const longTier = String(tierName || '').length > 10;
  return (
    <header data-guide="home-level" style={{ display: 'flex', alignItems: 'center', gap }}>
      <button type="button" onClick={onHome} aria-label="Training Mode" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
        <SafeImage src="/static/logo-mark.png" alt="" style={{ width: 30, height: 34, objectFit: 'contain' }}/>
      </button>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {compact ? (
          <div aria-label={`Level ${level}, ${tierName || ''}, ${levelXp} of ${levelNeeded} XP`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 7, rowGap: 1 }}>
            <span style={{ font: "700 14px 'Chakra Petch',sans-serif", color: '#F2BE45', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>LV {level}</span>
            <span style={{ minWidth: 0, font: `600 ${longTier ? 10 : 11}px 'Chakra Petch',sans-serif`, letterSpacing: longTier ? '0.06em' : '0.1em', textTransform: 'uppercase', color: MUTED }}>{tierName}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ font: "700 14px 'Chakra Petch',sans-serif", color: '#F2BE45', letterSpacing: '0.08em' }}>LV {level}</span>
            <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>{tierName}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>{levelXp.toLocaleString()} / {levelNeeded.toLocaleString()} XP</span>
          </div>
        )}
        <div style={{ height: 4, background: '#1B1730', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${xpPercent}%`, height: '100%', background: '#F2BE45' }}/>
        </div>
      </div>
      {chip}
      <HelpButton dataGuide="help-icon" onClick={onHelp}/>
    </header>
  );
}
