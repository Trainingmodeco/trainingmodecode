import { useState } from 'react';
import { getProgressionNudge, snoozeProgressionNudge } from '../data/progressionNudge';

// Anti-stagnation nudge card, shown at the top of the lane's own setup
// screen (strength → Workout Builder, cardio → Cardio Mode). Renders
// nothing unless the lane has ~2 weeks of consistent sessions and isn't
// snoozed. ✕ or the CTA acknowledges and snoozes for 14 days.
export default function ProgressionNudgeCard({ lane, style }) {
  const [nudge, setNudge] = useState(() => getProgressionNudge(lane));
  if (!nudge) return null;

  const dismiss = () => { snoozeProgressionNudge(nudge.lane); setNudge(null); };

  return (
    <div style={{
      position: 'relative', borderRadius: 12, marginBottom: 12,
      border: '1.5px solid rgba(255,138,58,0.55)',
      background: 'linear-gradient(135deg, rgba(255,138,58,0.14), rgba(8,2,18,0.9))',
      boxShadow: '0 0 18px -6px rgba(255,138,58,0.5)',
      padding: '11px 12px',
      ...style,
    }}>
      <button onClick={dismiss} aria-label="Dismiss" style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 13, padding: 2 }}>✕</button>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{nudge.emoji}</span>
        <div style={{ flex: 1, paddingRight: 14 }}>
          <div style={{ font: "800 10px 'Orbitron',sans-serif", color: '#ff8a3a', letterSpacing: '0.1em' }}>{nudge.title}</div>
          <div style={{ font: "600 10.5px 'Rajdhani',sans-serif", color: '#e7ddf7', lineHeight: 1.4, marginTop: 3 }}>{nudge.body}</div>
          <button onClick={dismiss} style={{ marginTop: 8, border: '1px solid rgba(255,138,58,0.55)', borderRadius: 8, background: 'rgba(255,138,58,0.12)', color: '#ffb27a', font: "800 9px 'Orbitron',sans-serif", letterSpacing: '0.1em', padding: '7px 13px', cursor: 'pointer' }}>
            {nudge.cta} ›
          </button>
        </div>
      </div>
    </div>
  );
}
