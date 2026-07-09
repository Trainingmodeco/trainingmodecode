import { HeartPulse, ChevronRight, Pencil, X } from 'lucide-react';
import { C } from './Styles';
import { summarizeCardioAddon } from './data/cardioAddon';
import { IMG } from './data/optimizedImageMap';

const GOLD = C.yellow;

// Notched-corner HUD frame (gold when idle-active state), matching the
// cardio sub-banner reference. Outer clip draws the metallic edge; the inner
// clip carries the dark glass fill.
const NOTCH = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';

// Compact sub-banner shown on the three workout setup screens. Two states:
// not-added (invite to add a cardio finisher) and added (summary + edit/remove).
export default function CardioFinisherBanner({ addon, onAdd, onEdit, onRemove }) {
  const added = !!addon?.enabled;

  return (
    <div style={{
      width: '100%', marginBottom: 14, padding: 1.5,
      clipPath: NOTCH,
      background: `linear-gradient(135deg, ${GOLD}, rgba(253,224,71,0.35) 40%, rgba(176,106,255,0.4) 75%, ${GOLD})`,
      boxShadow: added
        ? `0 0 22px rgba(253,224,71,0.32), 0 0 30px rgba(176,106,255,0.18)`
        : `0 0 12px rgba(253,224,71,0.12), 0 0 18px rgba(176,106,255,0.08)`,
      transition: 'box-shadow 0.3s ease',
    }}>
      <div style={{
        clipPath: NOTCH,
        background: 'linear-gradient(135deg, rgba(14,2,26,0.96), rgba(6,0,14,0.98))',
        padding: '13px 15px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <img
          src={IMG.fitMode.cardioFinisherSubBanner}
          alt=""
          style={{
            position: 'absolute', right: 0, top: 0, height: '100%',
            width: 'auto', opacity: 0.08, objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Icon in reticle */}
          <div style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(circle, rgba(253,224,71,0.14), rgba(176,106,255,0.06))',
            border: `1.5px solid ${GOLD}`,
            boxShadow: `0 0 12px rgba(253,224,71,0.35), inset 0 0 8px rgba(253,224,71,0.12)`,
          }}>
            <HeartPulse size={20} color={GOLD}/>
          </div>

          {/* Title + subtitle */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
              letterSpacing: '0.09em', color: GOLD,
              textShadow: '0 0 10px rgba(253,224,71,0.35)',
            }}>
              {added ? 'CARDIO FINISHER ADDED' : 'ADD CARDIO FINISHER'}
            </div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
              color: added ? C.text : C.muted, marginTop: 2, lineHeight: 1.3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {added ? summarizeCardioAddon(addon) : 'Run, intervals, Tabata, bike, rower, jump rope, and more.'}
            </div>
          </div>

          {/* Right-side CTA for the not-added state */}
          {!added && (
            <>
              <div style={{
                width: 1, alignSelf: 'stretch', flexShrink: 0,
                background: 'linear-gradient(180deg, transparent, rgba(253,224,71,0.4), transparent)',
              }}/>
              <button onClick={onAdd} style={{
                flexShrink: 0, padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(253,224,71,0.06)', border: `1.5px solid ${GOLD}`,
                color: GOLD, fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10,
                letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: '0 0 12px rgba(253,224,71,0.25)',
              }}>
                ADD CARDIO <ChevronRight size={14}/>
              </button>
            </>
          )}
        </div>

        {/* Edit / Remove row for the added state */}
        {added && (
          <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
            <button onClick={onEdit} style={{
              flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(253,224,71,0.08)', border: `1.5px solid ${GOLD}`,
              color: GOLD, fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10,
              letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 0 10px rgba(253,224,71,0.18)',
            }}>
              <Pencil size={13}/> EDIT
            </button>
            <button onClick={onRemove} style={{
              flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10,
              letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <X size={13}/> REMOVE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
