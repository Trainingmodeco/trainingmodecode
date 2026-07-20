import { useState, useEffect } from 'react';
import { Share2, X, QrCode, Copy } from 'lucide-react';
import { C } from './Styles';
import { shareTrainingResult, buildShareText, copyShareText } from './data/shareUtils';
import SafeImage from './SafeImage';

export default function SharePromptModal({ shareData, delayMs = 2500, placement = 'fixed' }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!visible || dismissed || (shareData?.xpEarned ?? 0) === 0) return null;

  const isInline = placement === 'inline';

  // Inline placement lives on the outcome screen, which has to fit in one
  // viewport (LT-5) — so it runs tighter than the floating prompt.
  const containerStyle = isInline ? {
    width: '100%', maxWidth: 360,
    borderRadius: 11, padding: '9px 12px',
    background: 'rgba(12,2,24,0.97)',
    border: '1.5px solid rgba(253,224,71,0.3)',
    boxShadow: '0 0 30px rgba(253,224,71,0.12), 0 8px 30px rgba(0,0,0,0.6)',
    animation: 'share-prompt-in 0.35s ease forwards',
    position: 'relative',
  } : {
    position: 'fixed', bottom: 160, left: '50%', transform: 'translateX(-50%)',
    width: 'calc(100% - 40px)', maxWidth: 360, zIndex: 250,
    borderRadius: 14, padding: '16px 18px',
    background: 'rgba(12,2,24,0.97)',
    border: '1.5px solid rgba(253,224,71,0.3)',
    boxShadow: '0 0 30px rgba(253,224,71,0.12), 0 8px 30px rgba(0,0,0,0.6)',
    animation: 'share-prompt-in 0.35s ease forwards',
  };

  const animKeyframes = isInline
    ? `@keyframes share-prompt-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`
    : `@keyframes share-prompt-in { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`;

  return (
    <div style={containerStyle}>
      <style dangerouslySetInnerHTML={{ __html: animKeyframes }}/>

      <button onClick={() => setDismissed(true)} style={{
        position: 'absolute', top: 10, right: 10,
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'rgba(255,255,255,0.3)', padding: 4,
      }}>
        <X size={14}/>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: isInline ? 8 : 10 }}>
        <div style={{
          width: isInline ? 28 : 36, height: isInline ? 28 : 36, borderRadius: 8, flexShrink: 0,
          background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Share2 size={isInline ? 15 : 18} color={C.yellow}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11,
            color: '#fff', letterSpacing: '0.08em',
          }}>SHARE YOUR WIN</div>
          {!isInline && (
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 10.5, fontWeight: 500,
              color: C.muted, marginTop: 1,
            }}>Let your crew know you showed up today.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: isInline ? 8 : 12 }}>
        <button onClick={() => { shareTrainingResult(shareData); setDismissed(true); }} style={{
          flex: 1, padding: isInline ? '8px 0' : '10px 0', borderRadius: 8, border: 'none',
          background: `linear-gradient(135deg, ${C.yellow}, ${C.yellow})`,
          color: C.bg, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10,
          letterSpacing: '0.1em', cursor: 'pointer',
          boxShadow: '0 0 14px rgba(253,224,71,0.3)',
        }}>SHARE</button>
        <button onClick={() => { copyShareText(buildShareText(shareData)); }} style={{
          padding: isInline ? '8px 10px' : '10px 12px', borderRadius: 8,
          background: 'rgba(168,85,247,0.08)',
          border: '1px solid rgba(168,85,247,0.25)',
          color: C.neon, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
          letterSpacing: '0.06em', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}><Copy size={12}/> COPY</button>
        <button onClick={() => setShowQr(!showQr)} style={{
          padding: isInline ? '8px 10px' : '10px 12px', borderRadius: 8,
          background: showQr ? 'rgba(253,224,71,0.1)' : 'transparent',
          border: '1px solid rgba(253,224,71,0.2)',
          color: C.yellow, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
          letterSpacing: '0.06em', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}><QrCode size={12}/> QR</button>
      </div>

      {showQr && (
        <div style={{
          marginTop: 12, padding: '10px', borderRadius: 10,
          background: 'rgba(10,0,20,0.6)', border: '1px solid rgba(253,224,71,0.1)',
          textAlign: 'center',
        }}>
          <SafeImage
            src="/social/qr-code-poster.png"
            fallbackSrc="/social/qr-code-poster.svg"
            alt="QR Code"
            style={{ width: '100%', maxWidth: 180, height: 'auto', borderRadius: 8, objectFit: 'contain' }}
          />
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, marginTop: 6,
          }}>Scan to join Training Mode</div>
        </div>
      )}
    </div>
  );
}
