import PhoneFrame from '../PhoneFrame';
import TrainingHeader from '../TrainingHeader';

// Shared chrome for every arcade stage screen: standard TT-logo header on top,
// and a content area that reserves room for the bottom tab bar (provided by the
// WithNav wrapper on the arcade_session route). Keeps the header/footer
// consistent across intro, live HUD, rest and clear — like the Battle HUD.
export default function StageChrome({ title, subtitle, onHome, onBack, rightSlot, scroll = false, contentStyle, children }) {
  return (
    <PhoneFrame useBrandBg>
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
