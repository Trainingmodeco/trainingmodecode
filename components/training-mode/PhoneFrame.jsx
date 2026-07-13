import IMG1 from './IMG1';
import SafeImage from './SafeImage';

// Shared phone-frame background — matches the designer's layered background on
// every screen: dark violet base + violet radial glow (top) + magenta glow
// (bottom) + 32px grid, with the app-bg art at low opacity and a dark overlay.
// (Previously the .app-bg + .checker-bg CSS classes both set background-image,
// so .checker-bg overrode the designer's violet gradient — screens looked flat.)
const APP_BG = '/static/app-bg.png';
const DESIGN_BG = {
  backgroundColor: '#080012',
  backgroundImage:
    'radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.18) 0%, transparent 55%),' +
    'radial-gradient(ellipse at 50% 100%, rgba(217,70,239,0.12) 0%, transparent 60%),' +
    'linear-gradient(rgba(168,85,247,0.04) 1px, transparent 1px),' +
    'linear-gradient(90deg, rgba(168,85,247,0.04) 1px, transparent 1px)',
  backgroundSize: '100% 100%, 100% 100%, 32px 32px, 32px 32px',
};

export default function PhoneFrame({ children, usePhoto = false, extraClass = '' }) {
  return (
    <div
      className={`scanlines grain ${extraClass}`}
      style={{
        width: '100%', maxWidth: 440, minHeight: '100dvh',
        margin: '0 auto', position: 'relative', isolation: 'isolate',
        ...DESIGN_BG,
      }}>
      {usePhoto ? (
        <>
          <img src={IMG1} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75, zIndex: 0 }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,0,20,0.1) 0%, rgba(10,0,20,0.35) 40%, rgba(10,0,20,0.92) 100%)', zIndex: 1 }}/>
        </>
      ) : (
        <>
          <SafeImage src={APP_BG} alt="" loading="eager" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.22, zIndex: 0 }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,2,18,0.42)', zIndex: 0 }}/>
        </>
      )}
      {children}
    </div>
  );
}
