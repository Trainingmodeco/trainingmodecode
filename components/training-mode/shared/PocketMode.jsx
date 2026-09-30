import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Pocket mode for GPS runs. The run holds a screen wake lock (so the phone
// keeps GPS alive), which means the screen stays lit for the whole run — a
// real battery cost on a 45-minute run. Pocket mode paints the screen pure
// black instead: on OLED phones black pixels are off, the wake lock (and GPS)
// stays up, and nothing on screen can be pressed by a pocket.
//
// DOUBLE-tap wakes it, so a single brush in a pocket doesn't.
export function PocketModeChip({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Pocket mode — black screen to save battery" style={{
      height: 20, padding: '0 8px', borderRadius: 10, cursor: 'pointer',
      background: 'transparent', border: '1px solid rgba(255,255,255,0.22)', color: '#c9c3dc',
      fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
    }}>◐ POCKET</button>
  );
}

export default function PocketMode({ open, onClose }) {
  const lastTap = useRef(0);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 450) { lastTap.current = 0; setHint(false); onClose(); return; }
    lastTap.current = now;
    // One tap only reminds how to get back — briefly, then black again.
    setHint(true);
    setTimeout(() => setHint(false), 1600);
  };

  return createPortal(
    <div
      role="button" tabIndex={0} aria-label="Pocket mode on. Double-tap to wake the screen."
      onClick={tap}
      style={{
        position: 'fixed', inset: 0, zIndex: 5000, background: '#000', cursor: 'pointer',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 48,
        touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', userSelect: 'none',
      }}
    >
      <span style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        color: hint ? '#6b6680' : '#1c1a24', transition: 'color .2s',
      }}>POCKET MODE · DOUBLE-TAP TO WAKE</span>
    </div>,
    document.body,
  );
}
