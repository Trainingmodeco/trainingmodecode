import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import CornerHUD from './CornerHUD';
import IntroLogo from './IntroLogo';
import WordmarkTM from './WordmarkTM';
import ScrollableScreen from './ScrollableScreen';
import { ChevronLeft, ExternalLink, MessageSquarePlus } from 'lucide-react';
import { C } from './Styles';
import { BETA_FEEDBACK_FORM_URL, openExternalUrl } from './data/links';

export default function BetaFeedback({ onBack }) {
  const [error, setError] = useState('');

  const handleOpenForm = () => {
    setError('');
    const opened = openExternalUrl(BETA_FEEDBACK_FORM_URL);
    if (!opened) {
      setError('Feedback form could not open. Please screenshot this issue and send it to trainingmode.co@gmail.com.');
    }
  };

  return (
    <PhoneFrame useBrandBg>
      <CornerHUD color="rgba(168,85,247,0.3)" size={24} inset={12}/>

      {/* Fixed header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        padding: '14px 16px 0',
        background: 'linear-gradient(to bottom, rgba(10,0,20,0.98) 80%, transparent)',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: '6px', color: C.text, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={22}/>
            </button>
            <IntroLogo size={26}/>
          </div>
          <WordmarkTM height={28}/>
        </div>
      </div>

      <ScrollableScreen
        bottomPadding="calc(180px + env(safe-area-inset-bottom, 0px))"
        showIndicator={false}
        style={{ padding: '0 16px', paddingTop: 'calc(56px + env(safe-area-inset-top, 0px))' }}
      >
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 32, paddingBottom: 40,
        }}>
          {/* Icon */}
          <div style={{
            width: 68, height: 68, borderRadius: '50%', marginBottom: 20,
            background: 'rgba(253,224,71,0.08)', border: '2px solid rgba(253,224,71,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquarePlus size={32} color={C.yellow}/>
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
            color: '#fff', letterSpacing: '0.1em', marginBottom: 12, textAlign: 'center',
            textShadow: '0 0 10px rgba(255,255,255,0.3)',
          }}>BETA WAVE 01 FEEDBACK</h1>

          {/* Description */}
          <p style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 500,
            color: C.text, textAlign: 'center', lineHeight: 1.6, maxWidth: 320,
            marginBottom: 28,
          }}>
            Help improve Training Mode before launch. Submit bugs, layout issues, workout feedback, feature ideas, and testimonials through the official beta feedback form.
          </p>

          {/* Open Form button */}
          <button onClick={handleOpenForm} style={{
            width: '100%', maxWidth: 320, padding: '16px 24px', borderRadius: 12, border: 'none',
            background: `linear-gradient(135deg, ${C.yellow}, ${C.gold})`,
            color: C.bg,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
            letterSpacing: '0.12em', cursor: 'pointer',
            boxShadow: '0 0 22px rgba(253,224,71,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.2s',
          }}>
            <ExternalLink size={16}/> OPEN BETA FEEDBACK FORM
          </button>

          {/* Error message */}
          {error && (
            <p style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500,
              color: '#ef4444', textAlign: 'center', lineHeight: 1.5,
              marginTop: 16, maxWidth: 300,
            }}>
              {error}
            </p>
          )}

          {/* Legal note */}
          <p style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 500,
            color: C.muted, textAlign: 'center', marginTop: 24, opacity: 0.6,
            lineHeight: 1.5, maxWidth: 300,
          }}>
            By submitting feedback, you agree that Training Mode may use your responses to improve the app. Testimonials will only be used if you give permission in the form.
          </p>
        </div>
      </ScrollableScreen>
    </PhoneFrame>
  );
}
