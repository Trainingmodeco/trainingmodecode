import { X } from 'lucide-react';

// Home's one-at-a-time nudge, over the header: an icon, one line, an optional
// GO and a dismiss. Shared so the retention gallery shows the same toast.
// `solid` (the week streak switch): an opaque fill, so the busier header (the
// logo, the week chip, the help button) does not show through behind the text.
const MUTED = '#A9A3C4';

export default function NudgeToast({ icon, text, onGo, onClose, solid = false }) {
  return (
    <div role="status" style={{
      minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 12px', borderRadius: 14,
      background: solid ? '#140C26' : 'rgba(20,12,38,0.96)', border: '1px solid rgba(196,168,255,0.6)',
      boxShadow: '0 10px 30px rgba(0,0,0,.6), 0 0 18px rgba(157,108,255,.35)',
    }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#E7DDF7', lineHeight: 1.3 }}>{text}</span>
      {onGo && (
        <button type="button" onClick={onGo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F2BE45', font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.14em', padding: 4 }}>GO</button>
      )}
      <button type="button" onClick={onClose} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4, display: 'flex' }}><X size={14}/></button>
    </div>
  );
}
