import { HeartPulse, Sparkles } from 'lucide-react';
import { C } from './Styles';

const GOLD = C.yellow;
const NEON = C.neon;

function formatDuration(sec) {
  if (!sec) return null;
  const m = Math.round(sec / 60);
  return `${m} min`;
}

// Shows the completed cardio finisher and, when earned, the Hybrid Training
// Bonus. Rendered on each mode's completion screen when a cardio finisher ran.
export default function CardioFinisherSummaryCard({ cardioResult }) {
  if (!cardioResult) return null;
  const { summary, cardioLabel, styleLabel, timeSeconds, completedDistance, calories, xpEarned, hybridBonusXp, completed } = cardioResult;
  const durationLabel = formatDuration(timeSeconds);
  const meta = [styleLabel, completedDistance, calories ? `${calories} kcal` : null].filter(Boolean).join('  \u2022  ');

  return (
    <div style={{ width: '100%', marginBottom: 16 }}>
      <div style={{
        width: '100%', borderRadius: 12, padding: '12px 14px',
        background: 'linear-gradient(135deg, rgba(20,0,40,0.9), rgba(8,0,18,0.9))',
        border: '1px solid rgba(176,106,255,0.35)',
        boxShadow: '0 0 14px rgba(176,106,255,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(176,106,255,0.14)', border: '1px solid rgba(176,106,255,0.3)',
          }}>
            <HeartPulse size={17} color={NEON}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10,
              letterSpacing: '0.1em', color: NEON,
            }}>
              {completed ? 'CARDIO FINISHER COMPLETE' : 'CARDIO FINISHER'}
            </div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500, color: C.text, marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {summary || cardioLabel}
            </div>
          </div>
          {xpEarned > 0 && (
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: GOLD,
              letterSpacing: '0.04em', flexShrink: 0,
            }}>+{xpEarned}</div>
          )}
        </div>
        {(durationLabel || meta) && (
          <div style={{
            fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted,
            letterSpacing: '0.1em', marginTop: 8, lineHeight: 1.6,
          }}>
            {durationLabel ? `${durationLabel.toUpperCase()} LOGGED` : ''}
            {durationLabel && meta ? '  \u2022  ' : ''}
            {meta ? meta.toUpperCase() : ''}
          </div>
        )}
      </div>

      {hybridBonusXp > 0 && (
        <div style={{
          width: '100%', borderRadius: 12, padding: '12px 14px', marginTop: 10,
          background: 'linear-gradient(135deg, rgba(253,224,71,0.14), rgba(176,106,255,0.14))',
          border: '1px solid rgba(253,224,71,0.4)',
          boxShadow: '0 0 16px rgba(253,224,71,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Sparkles size={20} color={GOLD}/>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
              letterSpacing: '0.1em', color: GOLD,
            }}>HYBRID TRAINING BONUS</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500, color: C.text, marginTop: 2 }}>
              Strength + Cardio completed.
            </div>
          </div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15, color: GOLD }}>
            +{hybridBonusXp}
          </div>
        </div>
      )}
    </div>
  );
}
