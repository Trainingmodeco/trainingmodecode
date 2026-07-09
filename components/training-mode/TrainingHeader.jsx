import IntroLogo from './IntroLogo';
import { ChevronLeft } from 'lucide-react';
import { C } from './Styles';

export default function TrainingHeader({ title = 'TRAINING MODE', subtitle = 'Fight. Fit. Evolve.', onHome, showBack = false, onBack, rightSlot }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 80,
      padding: '12px 14px 10px',
      background: 'rgba(5,0,15,0.88)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(168,85,247,0.18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {showBack && onBack && (
          <button onClick={onBack} style={{
            background: 'transparent', border: 'none', padding: 4,
            color: C.text, display: 'flex', alignItems: 'center', cursor: 'pointer',
          }}>
            <ChevronLeft size={20}/>
          </button>
        )}
        <button onClick={onHome} style={{
          background: 'transparent', border: 'none', padding: 0,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
        }}>
          <IntroLogo size={28}/>
        </button>
        <div>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
            color: '#f0f0ff', letterSpacing: '0.1em', lineHeight: 1,
            textShadow: '0 0 10px rgba(220,220,255,0.4)',
          }}>{title}</div>
          {subtitle && (
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 9,
              color: C.muted, letterSpacing: '0.04em', marginTop: 1,
            }}>{subtitle}</div>
          )}
        </div>
      </div>
      {rightSlot && <div>{rightSlot}</div>}
    </div>
  );
}
