import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PictureInPicture2 } from 'lucide-react';
import { positionMiniPreview } from './miniPlayer';

// The floating-window control, and the reason it looks like a tiny screen:
// it IS the window. The mini-player's <video> is positioned over this chip as
// a live preview, which does two jobs at once — the athlete sees exactly what
// will float, and the video is VISIBLE in the viewport, which is what Android's
// automatic picture-in-picture requires before it will open the window by
// itself when they leave the app. Off-screen, the automatic route never fires
// and only the tap works.
//
// Tapping still opens or closes the window by hand (a gesture always works).
// Renders nothing where the platform cannot float a video at all.
const W = 72;
const H = 40;
const POLL_MS = 500;

export default function MiniPlayerButton({ supported, open, toggle, top = 10, right = 52 }) {
  const anchorRef = useRef(null);
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (!supported) return undefined;
    let last = null;
    const measure = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r || r.width === 0) return;
      const next = { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
      if (last && last.left === next.left && last.top === next.top && last.width === next.width && last.height === next.height) return;
      last = next;
      setRect(next);
      positionMiniPreview({ ...next, radius: 10, zIndex: 59 });
    };
    measure();
    const t = setInterval(measure, POLL_MS);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      positionMiniPreview(null);
    };
  }, [supported]);

  if (!supported) return null;
  return (
    <>
      {/* In-flow anchor: gives the chip its place in the player's layout. */}
      <span ref={anchorRef} aria-hidden="true" style={{ position: 'absolute', top, right, width: W, height: H, pointerEvents: 'none' }}/>
      {rect && typeof document !== 'undefined' && createPortal(
        <button
          onClick={toggle}
          aria-label={open ? 'Close floating timer' : 'Float the timer over other apps'}
          data-mini-preview="1"
          style={{
            position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: rect.height, zIndex: 61,
            borderRadius: 10, padding: 0, background: 'transparent', cursor: 'pointer',
            border: `1px solid ${open ? 'rgba(253,224,71,0.9)' : 'rgba(253,224,71,0.45)'}`,
            boxShadow: open ? '0 0 12px rgba(253,224,71,0.5)' : '0 0 8px rgba(0,0,0,0.5)',
          }}>
          <span style={{
            position: 'absolute', right: 2, bottom: 2, width: 16, height: 16, borderRadius: 5,
            background: 'rgba(12,2,24,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PictureInPicture2 size={10} color="#fde047"/>
          </span>
        </button>,
        document.body,
      )}
    </>
  );
}
