import { PictureInPicture2 } from 'lucide-react';

// Opens the floating mini-player. It is a BUTTON rather than something the
// session does by itself because Android requires a user gesture to enter
// picture-in-picture — a session cannot pop the window when it is already
// being backgrounded, which is precisely the moment it would want to. Tapped
// once before or during the round, the window then survives the athlete
// leaving the app.
//
// Renders nothing at all where the platform cannot float a video, rather than
// offering a control that does nothing (the mistake AUDIO DUCKING made).
export default function MiniPlayerButton({ supported, open, toggle, top = 10, right = 52 }) {
  if (!supported) return null;
  return (
    <button
      onClick={toggle}
      aria-label={open ? 'Close floating timer' : 'Float the timer over other apps'}
      style={{
        position: 'absolute', top, right, zIndex: 60,
        width: 34, height: 34, borderRadius: '50%', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: open ? 'rgba(253,224,71,0.16)' : 'rgba(12,2,24,0.9)',
        border: `1px solid ${open ? 'rgba(253,224,71,0.75)' : 'rgba(253,224,71,0.35)'}`,
        cursor: 'pointer',
      }}>
      <PictureInPicture2 size={15} color="#fde047"/>
    </button>
  );
}
