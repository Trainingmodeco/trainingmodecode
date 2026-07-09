import { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { C } from './Styles';
import { BETA_FEEDBACK_FORM_URL, openExternalUrl } from './data/links';
import CompletedWorkoutShareCard from './CompletedWorkoutShareCard';
import ShareActions from './ShareActions';

export default function CompletedWorkoutShareModal({ shareData, delayMs = 3000 }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!visible || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start',
      background: 'rgba(5,0,15,0.92)', backdropFilter: 'blur(6px)',
      overflowY: 'auto', overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      padding: '24px 16px calc(40px + env(safe-area-inset-bottom, 0px))',
      animation: 'share-modal-in 0.35s ease forwards',
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes share-modal-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}}/>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 14, maxWidth: 340 }}>
        <h2 style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
          color: '#fff', letterSpacing: '0.1em',
          textShadow: '0 0 10px rgba(255,255,255,0.2)',
        }}>SHARE YOUR WORKOUT</h2>
        <p style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
          color: C.muted, marginTop: 6, lineHeight: 1.5,
        }}>
          Show your progress. Inspire someone else to start their training arc.
        </p>
      </div>

      {/* Card preview */}
      <div style={{ width: '100%', maxWidth: 300 }}>
        <CompletedWorkoutShareCard ref={cardRef} {...shareData}/>
      </div>

      {/* Actions */}
      <ShareActions cardRef={cardRef} shareData={shareData} onClose={() => setDismissed(true)}/>

      {/* Beta Feedback CTA */}
      <button onClick={() => openExternalUrl(BETA_FEEDBACK_FORM_URL)} style={{
        marginTop: 14, padding: '10px 18px', borderRadius: 8,
        background: 'rgba(253,224,71,0.06)', border: '1px solid rgba(253,224,71,0.2)',
        color: C.yellow, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
        letterSpacing: '0.08em', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 0.18s',
      }}>
        <MessageSquare size={12}/>
        GIVE BETA FEEDBACK
      </button>
    </div>
  );
}
