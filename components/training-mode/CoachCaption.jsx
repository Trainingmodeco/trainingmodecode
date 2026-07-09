import { useState, useEffect, useRef } from 'react';
import { C } from './Styles';

export default function CoachCaption({ text }) {
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!text) return;
    setDisplay(text);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 2800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text]);

  if (!display) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 110,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      pointerEvents: 'none',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s ease',
    }}>
      <div style={{
        background: 'rgba(5,0,12,0.85)',
        border: '1px solid rgba(253,224,71,0.25)',
        borderRadius: 8,
        padding: '6px 14px',
        maxWidth: 260,
        textAlign: 'center',
        boxShadow: '0 0 12px rgba(253,224,71,0.1)',
      }}>
        <span style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 600,
          fontSize: 11,
          color: C.yellow,
          letterSpacing: '0.03em',
          lineHeight: 1.4,
          textShadow: '0 0 6px rgba(253,224,71,0.3)',
        }}>
          {display}
        </span>
      </div>
    </div>
  );
}
