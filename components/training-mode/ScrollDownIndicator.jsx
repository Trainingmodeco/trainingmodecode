import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { C } from './Styles';

export default function ScrollDownIndicator({ visible }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setShow(true), 400);
      return () => clearTimeout(t);
    }
    setShow(false);
  }, [visible]);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 90,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      opacity: show ? 0.85 : 0,
      transition: 'opacity 0.4s ease',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 9px',
        borderRadius: 10,
        background: 'rgba(10,0,20,0.92)',
        border: '1px solid rgba(253,224,71,0.15)',
        boxShadow: '0 0 8px rgba(253,224,71,0.06)',
      }}>
        <ChevronDown size={10} color={C.yellow} style={{
          animation: 'scroll-bounce 1.4s ease-in-out infinite',
          opacity: 0.8,
        }} />
      </div>
    </div>
  );
}
