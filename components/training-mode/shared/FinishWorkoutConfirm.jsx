import OverlayPortal, { OVERLAY_Z } from './OverlayPortal';
import { finishPrompt } from '../data/builderFinish';

// Build Workout: "Finish with 6 of 8 done?" — the confirm behind FINISH
// WORKOUT, on the list and on the workout map. Same card as the player's
// END SESSION? confirm, in gold, because finishing is not a mistake to warn
// about. Portalled above everything (the tab bar, the map sheet), so its
// buttons are never covered. A tap outside the card is KEEP GOING.
export default function FinishWorkoutConfirm({ done, total, onFinish, onCancel }) {
  const { title, line } = finishPrompt(done, total);
  return (
    <OverlayPortal>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Finish workout"
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: OVERLAY_Z + 2,
          background: 'rgba(4,0,10,0.72)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 290, background: 'rgba(16,7,32,0.96)', border: '1px solid rgba(242,190,69,0.45)', borderRadius: 15, padding: 18, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '0.04em', marginBottom: 6 }}>{title}</div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: '#c4a4d8', marginBottom: 14 }}>{line}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onCancel} style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid rgba(168,85,247,0.35)', background: 'transparent', color: '#c9a6ff', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer' }}>KEEP GOING</button>
            <button type="button" onClick={onFinish} style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #fde047, #f59e0b)', color: '#0a0014', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11, cursor: 'pointer' }}>FINISH</button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
