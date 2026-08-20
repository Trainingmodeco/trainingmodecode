import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { C, NAV_H } from '../Styles';

// Shared bottom sheet.
//
// Why this exists: a sheet rendered inline inside a screen sits inside
// PhoneFrame, which sets `isolation: isolate` and therefore caps every
// z-index inside it. ScreenRouter's BottomNav is a *sibling* of that frame at
// z-index 100, so it paints on top no matter how high the sheet's z-index
// goes. The bottom ~70px of an inline sheet — exactly where its primary
// action button lives — ends up hidden behind the tab bar and untappable.
//
// Portalling to document.body escapes the frame's stacking context, so the
// sheet genuinely overlays the screen. The panel also caps its own height and
// scrolls its body, with the action button pinned as a non-scrolling footer,
// so the action stays reachable on a short screen with a tall sheet.
//
// The overlay stops at NAV_H rather than running to inset:0: a sheet should
// rest ON the tab bar, never cover it. The nav stays visible and tappable, so
// the athlete can always leave the screen without hunting for a close button.

export default function BottomSheet({
  title,
  accent = C.violet,
  onClose,
  children,
  footer,
  maxHeight = '86dvh',
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: NAV_H, zIndex: 1000,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      {/* Portalled out of the screen, so it can't rely on a screen's own CSS. */}
      <style dangerouslySetInnerHTML={{ __html: '@keyframes fadeSlideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }' }}/>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.7)' }}/>
      <div style={{
        width: '100%', maxWidth: 440, margin: '0 auto', boxSizing: 'border-box',
        background: '#0a0014', borderRadius: '16px 16px 0 0',
        border: `1px solid ${accent}4d`, borderBottom: 'none',
        // min(…, 100%) so a tall sheet can never outgrow the shortened
        // overlay (which now ends at the nav) on a small screen.
        maxHeight: `min(${maxHeight}, 100%)`, display: 'flex', flexDirection: 'column',
        animation: 'fadeSlideUp 0.2s ease',
      }}>
        {title != null && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 16px 8px', flexShrink: 0,
          }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, color: accent, letterSpacing: '0.08em' }}>
              {title}
            </div>
            <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X size={18} color={C.muted}/>
            </button>
          </div>
        )}

        <div style={{ padding: '0 16px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {children}
        </div>

        {/* The action never scrolls out of reach. No safe-area padding here —
            the sheet now rests on the nav, which already carries that inset. */}
        <div style={{
          flexShrink: 0, padding: footer ? '10px 16px 16px' : '0 0 16px',
        }}>
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}
