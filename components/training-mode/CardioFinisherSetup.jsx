import { HeartPulse, ArrowLeft } from 'lucide-react';
import { C } from './Styles';
import CardioSetupForm from './shared/CardioSetupForm';

const NEON = C.neon;

// Cardio finisher setup, presented as an overlay sheet. Uses the EXACT same setup
// design as the Cardio Mode option screen (via the shared CardioSetupForm) and
// returns a complete cardio addon config via onSave.
export default function CardioFinisherSetup({ initialAddon, sourceMode, onSave, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', justifyContent: 'center',
      background: 'radial-gradient(120% 80% at 50% 0%, #1a0336 0%, #0a0014 60%, #05000c 100%)',
    }}>
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 440, height: '100dvh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderLeft: '1px solid rgba(176,106,255,0.12)',
        borderRight: '1px solid rgba(176,106,255,0.12)',
      }}>
        {/* Ambient glow accents for the Training Mode feel */}
        <div style={{
          position: 'absolute', top: -80, left: -60, width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(176,106,255,0.22), transparent 70%)',
          pointerEvents: 'none',
        }}/>
        <div style={{
          position: 'absolute', top: 120, right: -80, width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(253,224,71,0.1), transparent 70%)',
          pointerEvents: 'none',
        }}/>

        {/* Sticky header with back + title + subtitle */}
        <div style={{
          position: 'relative', flexShrink: 0,
          padding: 'calc(14px + env(safe-area-inset-top, 0px)) 18px 12px',
          borderBottom: '1px solid rgba(176,106,255,0.15)',
          background: 'linear-gradient(180deg, rgba(20,3,42,0.92), rgba(10,0,20,0.78))',
          backdropFilter: 'blur(6px)',
        }}>
          <button onClick={onClose} aria-label="Back" style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
            background: 'rgba(176,106,255,0.1)', border: '1px solid rgba(176,106,255,0.3)',
            borderRadius: 9, padding: '7px 11px', cursor: 'pointer', color: C.text,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9.5, letterSpacing: '0.12em',
          }}>
            <ArrowLeft size={15}/> BACK
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(circle, rgba(176,106,255,0.18), rgba(253,224,71,0.05))',
              border: `1.5px solid ${NEON}`, boxShadow: `0 0 14px ${NEON}44`,
            }}>
              <HeartPulse size={20} color={NEON}/>
            </div>
            <div>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: C.text,
                fontSize: 17, letterSpacing: '0.08em',
              }}>CARDIO FINISHER</div>
              <div style={{
                fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, color: C.muted,
                fontSize: 12.5, marginTop: 1, lineHeight: 1.3,
              }}>Add cardio to the end of your workout.</div>
            </div>
          </div>
        </div>

        {/* Body — the shared Cardio Mode setup design */}
        <div style={{
          position: 'relative', flex: 1, minHeight: 0,
          padding: '14px 18px calc(84px + env(safe-area-inset-bottom, 0px))',
        }}>
          <CardioSetupForm
            initial={initialAddon}
            sourceMode={sourceMode || 'Workout Builder'}
            placement="finisher"
            bonusEligible
            submitLabel={initialAddon ? 'UPDATE CARDIO' : 'ADD TO WORKOUT'}
            submitIcon="✓"
            submitVariant="gold"
            bottomSpacer={4}
            onSubmit={(addon) => onSave(addon)}
          />
        </div>
      </div>
    </div>
  );
}
