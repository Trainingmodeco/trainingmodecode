import { useEffect } from 'react';
import PhoneFrame from '../PhoneFrame';

// Phase 2 · 2.4b — S7 transition card. A short full-screen interstitial shown
// before each block in a camp session ("NEXT UP · S1 · SKILL"), matching the
// rest-state visual language (blue/violet tint) with a thin auto-advance bar.
const DUR_MS = 2800;

const css = `
@keyframes ctc-bar { from { width: 0%; } to { width: 100%; } }
@keyframes ctc-pop { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
`;

export default function CampTransitionCard({ label, sub, detail, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, DUR_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(90% 60% at 50% 40%, rgba(79,140,255,0.14), transparent 70%)',
        padding: '0 28px',
      }}>
        <div style={{ font: "700 8px 'Press Start 2P',monospace", color: '#7ea6ff', letterSpacing: '0.2em', marginBottom: 12, animation: 'ctc-pop 0.4s ease both' }}>◈ NEXT UP ◈</div>
        <div style={{ font: "900 26px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.1, textShadow: '0 0 22px rgba(79,140,255,0.45)', animation: 'ctc-pop 0.45s 0.05s ease both' }}>{label}</div>
        {sub && <div style={{ font: "700 11px 'Orbitron',sans-serif", color: '#b06aff', letterSpacing: '0.1em', marginTop: 8, animation: 'ctc-pop 0.45s 0.1s ease both' }}>{sub}</div>}
        {detail && <div style={{ font: "600 12px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 5, animation: 'ctc-pop 0.45s 0.15s ease both' }}>{detail}</div>}
        <div style={{ width: 180, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 22 }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg,#4f8cff,#b06aff)', animation: `ctc-bar ${DUR_MS}ms linear both` }} />
        </div>
      </div>
    </PhoneFrame>
  );
}
