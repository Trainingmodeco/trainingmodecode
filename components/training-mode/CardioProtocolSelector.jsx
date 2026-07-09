import { useState } from 'react';
import { C } from './Styles';
import { CARDIO_METHODS, CARDIO_SAFETY_COPY } from './data/cardioProtocolData';
import { TriangleAlert as AlertTriangle } from 'lucide-react';
import { ARCADE, ArcadePrimaryButton } from './ArcadeUI';

export default function CardioProtocolSelector({ selectedMethod, onSelectMethod, allowedMethods, title, subtitle }) {
  const methods = allowedMethods
    ? CARDIO_METHODS.filter(m => allowedMethods.includes(m.id))
    : CARDIO_METHODS;

  const [localSelected, setLocalSelected] = useState(selectedMethod || methods[0]?.id || 'outdoor-run');

  function handleSelect(id) {
    setLocalSelected(id);
  }

  function handleConfirm() {
    onSelectMethod(localSelected);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '16px 12px', width: '100%',
    }}>
      <div style={{
        fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 700,
        color: ARCADE.gold, letterSpacing: '0.22em', marginBottom: 4, textAlign: 'center',
      }}>CARDIO PHASE</div>
      <h3 style={{
        fontFamily: ARCADE.fontHead, fontSize: 13, fontWeight: 900,
        color: '#c4b5fd', letterSpacing: '0.06em', margin: '0 0 4px', textAlign: 'center',
        textShadow: '0 0 12px rgba(168,85,247,0.4)',
      }}>{title || 'CHOOSE CARDIO METHOD'}</h3>
      {subtitle && (
        <p style={{
          fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted,
          textAlign: 'center', marginBottom: 12, lineHeight: 1.4,
        }}>{subtitle}</p>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        width: '100%', maxWidth: 320, marginBottom: 14,
        maxHeight: 260, overflowY: 'auto', paddingRight: 4,
      }}>
        {methods.map(method => {
          const active = localSelected === method.id;
          return (
            <button
              key={method.id}
              onClick={() => handleSelect(method.id)}
              style={{
                padding: '11px 8px', borderRadius: ARCADE.radius.pill, cursor: 'pointer',
                background: active ? 'rgba(253,224,71,0.1)' : 'rgba(14,2,28,0.65)',
                border: active
                  ? `1.5px solid ${ARCADE.goldBorder}`
                  : `1px solid ${ARCADE.violetBorderSoft}`,
                boxShadow: active ? '0 0 16px rgba(253,224,71,0.18)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <span style={{
                fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.06em',
                color: active ? ARCADE.gold : '#c4b5fd',
              }}>{method.label.toUpperCase()}</span>
            </button>
          );
        })}
      </div>

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 6,
        padding: '8px 10px', borderRadius: ARCADE.radius.sm,
        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
        marginBottom: 14, maxWidth: 320, width: '100%',
      }}>
        <AlertTriangle size={12} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }}/>
        <span style={{
          fontFamily: ARCADE.fontBody, fontSize: 9.5, color: 'rgba(239,68,68,0.85)',
          lineHeight: 1.4,
        }}>{CARDIO_SAFETY_COPY}</span>
      </div>

      <div style={{ width: '100%', maxWidth: 320 }}>
        <ArcadePrimaryButton onClick={handleConfirm}>START CARDIO</ArcadePrimaryButton>
      </div>
    </div>
  );
}
