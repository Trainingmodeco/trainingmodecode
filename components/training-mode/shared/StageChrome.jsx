import PhoneFrame from '../PhoneFrame';
import TrainingHeader from '../TrainingHeader';
import SafeImage from '../SafeImage';
import VoiceMixer from './VoiceMixer';

// Shared chrome for every arcade stage screen: standard TT-logo header on top,
// and a content area that reserves room for the bottom tab bar (provided by the
// WithNav wrapper on the arcade_session route). Keeps the header/footer
// consistent across intro, live HUD, rest and clear — like the Battle HUD.
// `bgImage` renders the stage's banner art behind everything, dimmed.
//
// The VoiceMixer lives HERE rather than in each player, because
// SESSION-UX-TODO item 4 asks for one consistent volume control on every
// session screen and per-player copies had already drifted: the cadence-rep
// and benchmark players shipped without one, so an arcade stage was the one
// place you could not turn the coach down mid-set. Chrome owns the chrome.
// `right: 44` clears the header's home button.
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
        <VoiceMixer top={10} right={44}/>
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
