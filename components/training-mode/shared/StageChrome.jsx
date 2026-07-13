import PhoneFrame from '../PhoneFrame';
import TrainingHeader from '../TrainingHeader';
import SafeImage from '../SafeImage';

// Shared chrome for every arcade stage screen: standard TT-logo header on top,
// and a content area that reserves room for the bottom tab bar (provided by the
// WithNav wrapper on the arcade_session route). Keeps the header/footer
// consistent across intro, live HUD, rest and clear — like the Battle HUD.
// `bgImage` renders the stage's banner art behind everything, dimmed.
export default function StageChrome({ title, subtitle, onHome, onBack, rightSlot, scroll = false, contentStyle, bgImage, children }) {
  return (
    <PhoneFrame useBrandBg>
      {bgImage && (
        <>
          <SafeImage src={bgImage} alt="" aria-hidden loading="lazy" decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.45, zIndex: 0 }} />
          {/* Darker top/bottom for legible header + buttons, clearer through the middle so the art reads. */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'linear-gradient(180deg, rgba(6,1,14,0.82) 0%, rgba(6,1,14,0.42) 30%, rgba(6,1,14,0.42) 58%, rgba(6,1,14,0.86) 100%)' }} />
        </>
      )}
      <div style={{
        position: 'relative', zIndex: 10, height: '100dvh', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <TrainingHeader
          title={title}
          subtitle={subtitle}
          onHome={onHome}
          showBack={!!onBack}
          onBack={onBack}
          rightSlot={rightSlot}
        />
        <div style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          overflowY: scroll ? 'auto' : 'hidden', overflowX: 'hidden',
          paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))',
          ...contentStyle,
        }}>
          {children}
        </div>
      </div>
    </PhoneFrame>
  );
}
