import { ChevronRight } from 'lucide-react';
import { HEAD, BODY, MUTED, GOLD, VIOLET_TEXT, GOLD_FILL } from '../../shared/FitSetupKit';

// The card's two settings in one box, in the kit's setting-row look:
//
//   ADJUST        Level · focus · gear            ›    (the ADJUST sheet, as today)
//   PULL-UP BAR   Bar moves stay in             [●]    (the gear switch)
//
// adjust: { value, onClick } or null. bar: { on, summary, onToggle } or null.
// The switch's track is CardioToggleCard's; its hit area is 44px tall.
const LABEL = { width: 96, flexShrink: 0, font: `600 11px ${HEAD}`, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED };
const VALUE = { flex: 1, minWidth: 0, font: `500 13px ${BODY}`, lineHeight: 1.3, color: '#fff' };

export function BarSwitch({ on, onToggle, label = 'Pull-up bar' }) {
  return (
    <button type="button" role="switch" aria-checked={on ? 'true' : 'false'} aria-label={label} onClick={onToggle} style={{
      flexShrink: 0, width: 56, height: 44, margin: '0 -4px 0 0', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span aria-hidden="true" style={{
        position: 'relative', display: 'block', width: 52, height: 30, borderRadius: 15,
        background: on ? GOLD_FILL : '#2A2540', boxShadow: on ? '0 0 14px rgba(242,190,69,0.6)' : 'none', transition: 'box-shadow .25s',
      }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left .2s ease' }}/>
      </span>
    </button>
  );
}

export default function CardSettings({ adjust, bar }) {
  return (
    <div style={{ borderRadius: 12, background: 'rgba(18,13,36,0.9)', border: '1px solid rgba(157,108,255,0.35)', overflow: 'hidden' }}>
      {adjust && (
        <button type="button" className="fk-row" onClick={adjust.onClick} aria-haspopup="dialog" style={{
          width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
          background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer',
        }}>
          <span style={{ ...LABEL, color: VIOLET_TEXT }}>Adjust</span>
          <span style={{ ...VALUE, color: MUTED }}>{adjust.value}</span>
          <ChevronRight size={16} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>
        </button>
      )}
      {bar && (
        <div style={{ minHeight: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderTop: adjust ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
          <span style={LABEL}>Pull-up bar</span>
          <span style={{ ...VALUE, color: bar.on ? '#fff' : GOLD }}>{bar.summary}</span>
          <BarSwitch on={bar.on} onToggle={bar.onToggle}/>
        </div>
      )}
    </div>
  );
}
