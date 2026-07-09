import { useState } from 'react';
import { C } from './Styles';
import { ChevronRight } from 'lucide-react';

export default function ArcadeBackBalanceChooser({ options, onSelect, noPullUpBarAlternatives }) {
  const [selected, setSelected] = useState(null);
  const [noPullUpBar, setNoPullUpBar] = useState(false);

  const displayOptions = noPullUpBar && noPullUpBarAlternatives
    ? options.filter(o => noPullUpBarAlternatives.includes(o.id) || o.equipment === 'None')
    : options;

  function handleConfirm() {
    if (!selected) return;
    const option = options.find(o => o.id === selected);
    onSelect(option);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', width: '100%' }}>
      <h3 style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700,
        color: C.yellow, letterSpacing: '0.1em', marginBottom: 4, textAlign: 'center',
      }}>BACK-BALANCE BLOCK</h3>
      <p style={{
        fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted,
        textAlign: 'center', marginBottom: 12, lineHeight: 1.5, maxWidth: 280,
      }}>
        Choose one bodyweight pulling or posterior-chain option to balance the push-up volume.
      </p>

      {/* No pull-up bar toggle */}
      <button onClick={() => setNoPullUpBar(!noPullUpBar)} style={{
        marginBottom: 12, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
        background: noPullUpBar ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
        border: noPullUpBar ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.08)',
        fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 600,
        color: noPullUpBar ? '#3b82f6' : C.muted,
      }}>
        {noPullUpBar ? 'No Pull-up Bar (Filtered)' : 'No Pull-up Bar?'}
      </button>

      {/* Options grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 320, marginBottom: 14 }}>
        {displayOptions.map(option => (
          <button
            key={option.id}
            onClick={() => setSelected(option.id)}
            style={{
              padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: selected === option.id ? 'rgba(253,224,71,0.08)' : 'rgba(255,255,255,0.02)',
              border: selected === option.id
                ? '1.5px solid rgba(253,224,71,0.5)'
                : '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.15s',
            }}
          >
            <div>
              <div style={{
                fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 700,
                color: selected === option.id ? C.yellow : C.text,
              }}>{option.label}</div>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, marginTop: 2 }}>
                {option.reps ? `${option.reps} reps` : option.durationSeconds ? `${option.durationSeconds}s hold` : ''}
                {option.equipment && option.equipment !== 'None' ? ` • ${option.equipment}` : ''}
              </div>
            </div>
            {selected === option.id && <ChevronRight size={14} color={C.yellow}/>}
          </button>
        ))}
      </div>

      {/* Safety note for towel rows */}
      {selected && options.find(o => o.id === selected)?.equipment?.toLowerCase().includes('towel') && (
        <div style={{
          padding: '6px 10px', borderRadius: 6, marginBottom: 10,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          maxWidth: 320, width: '100%',
        }}>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: '#f59e0b' }}>
            Only use this option if the anchor point is secure.
          </span>
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={!selected}
        style={{
          width: '100%', maxWidth: 320, padding: '12px', borderRadius: 8, border: 'none',
          cursor: selected ? 'pointer' : 'not-allowed',
          background: selected ? `linear-gradient(135deg, ${C.yellow}, #facc15)` : 'rgba(255,255,255,0.04)',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11,
          color: selected ? '#0a0014' : C.muted,
          opacity: selected ? 1 : 0.5, transition: 'all 0.2s',
        }}
      >START EXERCISE</button>
    </div>
  );
}
