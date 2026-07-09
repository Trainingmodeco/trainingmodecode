import { Dumbbell, Play, Lightbulb } from 'lucide-react';
import { C } from '../Styles';
import SafeImage from '../SafeImage';

const GOLD = C.yellow;

// Foundation preview card for a single exercise. When the exercise carries a
// previewMediaUrl (image or video poster) it renders that; otherwise it falls
// back to a clean target-muscle + coaching-tip card so every exercise has a
// usable preview even before media assets exist.
export default function WorkoutPreviewCard({ exercise, accentColor = GOLD, compact, onStart, onSkip }) {
  if (!exercise) return null;

  const { name, muscle, primaryMuscle, previewMediaUrl, previewType, previewTip, coachNote } = exercise;
  const tip = previewTip || coachNote || '';
  const target = (muscle || primaryMuscle || '').toString().toUpperCase();
  const hasMedia = previewType && previewType !== 'none' && !!previewMediaUrl;

  return (
    <div style={{
      width: '100%', borderRadius: 14, overflow: 'hidden',
      background: 'rgba(8,0,18,0.86)', border: `1px solid ${accentColor}33`,
      boxShadow: `0 0 16px ${accentColor}14`,
    }}>
      <div style={{
        position: 'relative', width: '100%', height: compact ? 120 : 168,
        background: `linear-gradient(135deg, rgba(10,0,20,0.9), ${accentColor}12)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {hasMedia ? (
          <>
            <SafeImage
              src={previewMediaUrl}
              alt={name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {previewType === 'video' && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(4,0,10,0.25)',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: `${accentColor}cc`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Play size={22} color={C.bg} fill={C.bg}/>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '0 16px' }}>
            <Dumbbell size={compact ? 26 : 34} color={accentColor} style={{ margin: '0 auto 8px', display: 'block' }}/>
            <div style={{
              fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: C.muted,
              letterSpacing: '0.12em',
            }}>PREVIEW COMING SOON</div>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 14px' }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
          color: accentColor, letterSpacing: '0.05em',
        }}>{name}</div>
        {target && (
          <div style={{
            display: 'inline-block', marginTop: 6,
            fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
            color: C.muted, letterSpacing: '0.08em',
            padding: '2px 8px', borderRadius: 5,
            background: 'rgba(253,224,71,0.06)', border: `1px solid ${accentColor}2a`,
          }}>{target}</div>
        )}
        {tip && (
          <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
            <Lightbulb size={13} color={accentColor} style={{ flexShrink: 0, marginTop: 1 }}/>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 12.5, fontWeight: 500,
              color: C.text, lineHeight: 1.45,
            }}>{tip}</div>
          </div>
        )}

        {(onStart || onSkip) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {onStart && (
              <button
                onClick={onStart}
                style={{
                  flex: 1, cursor: 'pointer', border: 'none', borderRadius: 9,
                  padding: '11px 12px',
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
                  letterSpacing: '0.08em', color: C.bg,
                  background: accentColor, boxShadow: `0 0 14px ${accentColor}55`,
                }}
              >START NOW</button>
            )}
            {onSkip && (
              <button
                onClick={onSkip}
                style={{
                  flex: 1, cursor: 'pointer', borderRadius: 9,
                  padding: '11px 12px',
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11,
                  letterSpacing: '0.08em', color: C.muted,
                  background: 'transparent', border: `1px solid ${accentColor}33`,
                }}
              >SKIP PREVIEW</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
