import SafeImage from '../SafeImage';

// Dimmed boxer-in-the-ring backdrop for Fight Mode screens (hub + timer selects).
// Sits behind the content (below zIndex 10) so it sets the mood without competing
// with the UI. A top-to-bottom scrim keeps headers and text legible.
export default function FightRingBackdrop({ opacity = 0.2 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      <SafeImage
        src="/static/fight-ring-bg.png"
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%', opacity }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,2,18,0.72) 0%, rgba(8,2,18,0.28) 42%, rgba(8,2,18,0.66) 100%)' }}/>
    </div>
  );
}
