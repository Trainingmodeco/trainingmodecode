import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap } from 'lucide-react';
import { C } from '../Styles';

// 1.4 — placement + permission sheet for the strike counter. Opened from the
// timer's 👊 pill. Explains where to put the phone and, on iOS, fires the
// DeviceMotion permission request from this button tap (a required user
// gesture). Once granted it confirms and the pill starts counting.
const VIOLET = '#a855f7';

const PLACEMENTS = [
  { icon: '👖', title: 'Pocket or waistband', sub: 'Best all-round — catches every strike as your body drives it.' },
  { icon: '💪', title: 'Armband', sub: 'Strap it to your lead arm for the cleanest punch spikes.' },
  { icon: '🤛', title: 'Lead hand', sub: 'Hold it in your lead glove/hand if you have nothing to strap it to.' },
];

export default function StrikeCounterSheet({ permission, supported, onEnable, onClose }) {
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    try { await onEnable?.(); } finally { setBusy(false); }
  };

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'rgba(4,0,10,0.85)', backdropFilter: 'blur(4px)',
    }}>
      <div onClick={e => e.stopPropagation()} className="no-scrollbar" style={{
        width: '100%', maxWidth: 330, maxHeight: '92dvh', overflowY: 'auto',
        background: 'linear-gradient(180deg,#160a28,#0a0106)',
        borderRadius: 18, border: `1px solid ${VIOLET}66`,
        boxShadow: '0 0 40px rgba(168,85,247,0.28), 0 20px 50px rgba(0,0,0,0.6)',
        padding: '15px 15px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: "900 13px 'Orbitron',sans-serif", color: '#e6d4ff', letterSpacing: '0.06em' }}>
            <Zap size={15} color={VIOLET}/> STRIKE COUNTER
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', padding: 4 }}><X size={18}/></button>
        </div>

        {!supported ? (
          <div style={{ font: "600 12px 'Rajdhani',sans-serif", color: '#c4a4d8', lineHeight: 1.5, padding: '6px 2px 4px' }}>
            This device doesn&apos;t share motion data with the browser, so strikes
            can&apos;t be counted here. On a phone, open Training Mode and tap the
            👊 counter to enable it.
          </div>
        ) : (
          <>
            <div style={{ font: "600 11px 'Rajdhani',sans-serif", color: '#a99cc4', lineHeight: 1.45, marginBottom: 12 }}>
              Count every strike you throw using your phone&apos;s motion sensor.
              Put it somewhere it&apos;ll feel each punch:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 13 }}>
              {PLACEMENTS.map(p => (
                <div key={p.title} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 10, background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.22)' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{p.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: "800 10.5px 'Orbitron',sans-serif", color: '#fff' }}>{p.title}</div>
                    <div style={{ font: "600 9.5px 'Rajdhani',sans-serif", color: '#a99cc4', lineHeight: 1.3 }}>{p.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {permission === 'granted' ? (
              <div style={{ font: "800 11px 'Orbitron',sans-serif", color: '#22c55e', textAlign: 'center', padding: '10px 0', letterSpacing: '0.04em' }}>
                ✓ MOTION ENABLED — THROW YOUR STRIKES
              </div>
            ) : permission === 'denied' ? (
              <div style={{ font: "600 10.5px 'Rajdhani',sans-serif", color: '#f87171', textAlign: 'center', lineHeight: 1.4, padding: '4px 4px 8px' }}>
                Motion access was blocked. Re-enable it for this site in your
                browser/OS settings, then reopen this sheet.
              </div>
            ) : (
              <button onClick={enable} disabled={busy} style={{
                width: '100%', height: 46, borderRadius: 12, border: 'none', cursor: busy ? 'default' : 'pointer',
                background: `linear-gradient(135deg,${VIOLET},#7c3aed)`, color: '#fff',
                font: "900 12px 'Orbitron',sans-serif", letterSpacing: '0.08em',
              }}>{busy ? 'ENABLING…' : 'ENABLE MOTION'}</button>
            )}

            <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#6f6590', textAlign: 'center', marginTop: 10, lineHeight: 1.4 }}>
              Counting runs only during work rounds, on your device. It&apos;s an
              estimate — a guide to your output, not an exact tally.
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
