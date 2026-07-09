import { Play } from 'lucide-react';
import { C } from './Styles';

const SESSION_LABELS = {
  timer: 'Fight Focus',
  combo_active: 'Combo Coach',
  qm_active: 'Quick Mission',
  fit_workout: 'Fit Builder',
  cc_active: 'Combat Conditioning',
  arcade_session: 'Arcade',
};

export default function FloatingResumeButton({ pausedSession, onResume }) {
  if (!pausedSession) return null;

  const label = SESSION_LABELS[pausedSession.screen] || 'Session';

  return (
    <button
      onClick={onResume}
      style={{
        position: 'fixed',
        bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
        right: 16,
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        background: 'rgba(20,5,40,0.92)',
        border: '1.5px solid rgba(168,85,247,0.6)',
        borderRadius: 28,
        cursor: 'pointer',
        boxShadow: '0 0 18px rgba(168,85,247,0.4), 0 0 8px rgba(253,224,71,0.2)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'resumePulse 2s ease-in-out infinite',
      }}
    >
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #b06aff 0%, #7c3aed 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 12px rgba(168,85,247,0.6)',
      }}>
        <Play size={14} color="#fff" fill="#fff" />
      </div>
      <span style={{
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 9,
        fontWeight: 700,
        color: C.text,
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes resumePulse {
          0%, 100% { box-shadow: 0 0 18px rgba(168,85,247,0.4), 0 0 8px rgba(253,224,71,0.2); }
          50% { box-shadow: 0 0 24px rgba(168,85,247,0.65), 0 0 14px rgba(253,224,71,0.35); }
        }
      `}} />
    </button>
  );
}
