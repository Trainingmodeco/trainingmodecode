import { useState } from 'react';
import { HeartPulse, ArrowLeft, Check } from 'lucide-react';
import { C } from './Styles';
import { INTERVAL_PRESETS, summarizeCardioAddon } from './data/cardioAddon';

const GOLD = C.yellow;
const NEON = C.neon;

// Cardio methods offered by the finisher setup. `distance` marks the methods
// that make sense to measure by distance; the rest hide the Distance target.
const METHODS = [
  { id: 'outdoor-run', label: 'Outdoor Run', distance: true },
  { id: 'treadmill', label: 'Treadmill', distance: true },
  { id: 'bike', label: 'Bike', distance: true },
  { id: 'assault-bike', label: 'Assault / Air Bike', distance: true },
  { id: 'row-machine', label: 'Row Machine', distance: true },
  { id: 'elliptical', label: 'Elliptical', distance: false },
  { id: 'jump-rope', label: 'Jump Rope', distance: false },
  { id: 'stair-climber', label: 'Stair Climber', distance: false },
  { id: 'swimming', label: 'Swimming', distance: true },
  { id: 'shadowbox-footwork', label: 'Shadowboxing Footwork', distance: false },
  { id: 'burpees', label: 'Burpees', distance: false },
  { id: 'sprint-intervals', label: 'Sprint Intervals', distance: false },
  { id: 'step-ups', label: 'Step-Ups', distance: false },
  { id: 'low-impact', label: 'Low-Impact Cardio', distance: false },
  { id: 'manual-cardio', label: 'Other / Manual Cardio', distance: true },
  { id: 'custom-cardio', label: 'Custom Cardio', distance: true },
];

// Protocols map to the interval configs the player understands. Steady/Custom
// run a plain timer (no interval config).
const PROTOCOLS = [
  { id: 'steady', label: 'Steady', intervals: null },
  { id: 'intervals', label: 'Beginner Intervals', intervals: INTERVAL_PRESETS.intervals },
  { id: 'tabata', label: 'Tabata', intervals: INTERVAL_PRESETS.tabata },
  { id: 'hiit', label: 'HIIT', intervals: INTERVAL_PRESETS.hiit },
  { id: 'custom', label: 'Custom', intervals: null },
];

const TARGETS = [
  { id: 'time', label: 'Time' },
  { id: 'distance', label: 'Distance' },
  { id: 'manual', label: 'Manual Completion' },
];

const TIME_PRESETS = [
  { seconds: 300, label: '5 min' },
  { seconds: 600, label: '10 min' },
  { seconds: 900, label: '15 min' },
  { seconds: 1200, label: '20 min' },
  { seconds: 1800, label: '30 min' },
  { seconds: 2700, label: '45 min' },
  { seconds: 3600, label: '60 min' },
];

const DISTANCE_PRESETS = [
  { id: '1mi', value: 1, unit: 'mi', label: '1 mile' },
  { id: '2mi', value: 2, unit: 'mi', label: '2 miles' },
  { id: '3mi', value: 3, unit: 'mi', label: '3 miles' },
  { id: '5k', value: 5, unit: 'km', label: '5K' },
  { id: '10k', value: 10, unit: 'km', label: '10K' },
  { id: 'custom', value: null, unit: 'mi', label: 'Custom' },
];

function getMethod(id) {
  return METHODS.find(m => m.id === id) || METHODS[0];
}

function Label({ children }) {
  return (
    <div style={{
      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: GOLD,
      fontSize: 10, letterSpacing: '0.2em', marginBottom: 8, marginTop: 4,
    }}>{children}</div>
  );
}

function Chip({ label, active, onClick, accent = GOLD }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 13px', borderRadius: 8, cursor: 'pointer',
      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9.5, letterSpacing: '0.05em',
      background: active ? `${accent}22` : 'rgba(8,0,18,0.86)',
      border: active ? `1.5px solid ${accent}` : '1px solid rgba(176,106,255,0.18)',
      color: active ? accent : C.muted,
      boxShadow: active ? `0 0 10px ${accent}33` : 'none',
      transition: 'all 0.2s ease',
    }}>
      {label.toUpperCase()}
    </button>
  );
}

// Cardio finisher setup, presented as an overlay sheet. Default method is
// Outdoor Run. Returns a complete cardio addon config via onSave.
export default function CardioFinisherSetup({ initialAddon, sourceMode, onSave, onClose }) {
  const seed = initialAddon || {};
  const [cardioType, setCardioType] = useState(seed.cardioType || 'outdoor-run');
  const [style, setStyle] = useState(seed.style || 'steady');
  const [targetType, setTargetType] = useState(seed.targetType || 'time');
  const [targetTimeSeconds, setTargetTimeSeconds] = useState(seed.targetTimeSeconds ?? 600);

  const seedIsCustomDistance = seed.targetType === 'distance'
    && !DISTANCE_PRESETS.some(d => d.id !== 'custom' && d.value === seed.targetDistance && d.unit === seed.distanceUnit);
  const [distancePreset, setDistancePreset] = useState(() => {
    if (seed.targetDistance == null) return '3mi';
    if (seedIsCustomDistance) return 'custom';
    const match = DISTANCE_PRESETS.find(d => d.value === seed.targetDistance && d.unit === seed.distanceUnit);
    return match ? match.id : '3mi';
  });
  const [customDistance, setCustomDistance] = useState(
    seedIsCustomDistance && seed.targetDistance != null ? String(seed.targetDistance) : ''
  );

  const method = getMethod(cardioType);
  const supportsDistance = method.distance;
  const effectiveTarget = targetType === 'distance' && !supportsDistance ? 'time' : targetType;

  const availableTargets = supportsDistance
    ? TARGETS
    : TARGETS.filter(t => t.id !== 'distance');

  const handleMethodChange = (id) => {
    setCardioType(id);
    if (targetType === 'distance' && !getMethod(id).distance) setTargetType('time');
  };

  const resolveDistance = () => {
    const preset = DISTANCE_PRESETS.find(d => d.id === distancePreset) || DISTANCE_PRESETS[0];
    if (preset.id === 'custom') {
      const value = parseFloat(customDistance);
      return { value: Number.isFinite(value) && value > 0 ? value : 1, unit: 'mi' };
    }
    return { value: preset.value, unit: preset.unit };
  };

  const handleSave = () => {
    const proto = PROTOCOLS.find(p => p.id === style) || PROTOCOLS[0];
    const dist = effectiveTarget === 'distance' ? resolveDistance() : null;
    const addon = {
      enabled: true,
      sourceMode: sourceMode || 'Workout Builder',
      placement: 'finisher',
      cardioType,
      cardioLabel: method.label,
      targetType: effectiveTarget,
      targetTimeSeconds,
      targetDistance: dist ? dist.value : null,
      distanceUnit: dist ? dist.unit : 'mi',
      style,
      intervals: proto.intervals,
      bonusEligible: true,
    };
    onSave(addon);
  };

  // Live preview of the current selections for the footer summary line.
  const previewDistance = effectiveTarget === 'distance' ? resolveDistance() : null;
  const summary = summarizeCardioAddon({
    cardioLabel: method.label,
    targetType: effectiveTarget,
    targetTimeSeconds,
    targetDistance: previewDistance ? previewDistance.value : null,
    distanceUnit: previewDistance ? previewDistance.unit : 'mi',
    style,
  });

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

        {/* Sticky header with back/X + title + subtitle */}
        <div style={{
          position: 'relative', flexShrink: 0,
          padding: 'calc(14px + env(safe-area-inset-top, 0px)) 18px 14px',
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

        {/* Scrollable body */}
        <div className="no-scrollbar" style={{
          position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '16px 18px calc(120px + env(safe-area-inset-bottom, 0px))',
        }}>
          <Label>METHOD</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
            {METHODS.map(m => (
              <Chip key={m.id} label={m.label} active={cardioType === m.id} accent={NEON} onClick={() => handleMethodChange(m.id)}/>
            ))}
          </div>

          <Label>PROTOCOL</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
            {PROTOCOLS.map(p => (
              <Chip key={p.id} label={p.label} active={style === p.id} onClick={() => setStyle(p.id)}/>
            ))}
          </div>

          <Label>TARGET</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
            {availableTargets.map(t => (
              <Chip key={t.id} label={t.label} active={effectiveTarget === t.id} onClick={() => setTargetType(t.id)}/>
            ))}
          </div>

          {effectiveTarget === 'time' && (
            <>
              <Label>TARGET TIME</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
                {TIME_PRESETS.map(p => (
                  <Chip key={p.seconds} label={p.label} active={targetTimeSeconds === p.seconds} onClick={() => setTargetTimeSeconds(p.seconds)}/>
                ))}
              </div>
            </>
          )}

          {effectiveTarget === 'distance' && (
            <>
              <Label>TARGET DISTANCE</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
                {DISTANCE_PRESETS.map(p => (
                  <Chip key={p.id} label={p.label} active={distancePreset === p.id} onClick={() => setDistancePreset(p.id)}/>
                ))}
              </div>
              {distancePreset === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={customDistance}
                    onChange={e => setCustomDistance(e.target.value)}
                    placeholder="Distance"
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8,
                      background: 'rgba(8,0,18,0.86)', border: '1px solid rgba(176,106,255,0.3)',
                      color: C.text, fontFamily: "'Rajdhani',sans-serif", fontSize: 15, fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: C.muted }}>MI</span>
                </div>
              )}
            </>
          )}

          {effectiveTarget === 'manual' && (
            <div style={{
              background: 'rgba(176,106,255,0.08)', borderRadius: 10, padding: '12px 14px',
              border: '1px solid rgba(176,106,255,0.2)', marginBottom: 8,
            }}>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                Do the cardio your way, then mark it complete. No timer &mdash; just log it when you finish.
              </div>
            </div>
          )}

          {(style === 'intervals' || style === 'hiit' || style === 'tabata') && (
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted,
              marginTop: 6, marginBottom: 4, lineHeight: 1.4,
            }}>
              {style === 'tabata'
                ? `${INTERVAL_PRESETS.tabata.rounds} rounds \u2022 ${INTERVAL_PRESETS.tabata.hardSeconds}s hard / ${INTERVAL_PRESETS.tabata.restSeconds}s rest`
                : `${INTERVAL_PRESETS[style].rounds} rounds \u2022 ${INTERVAL_PRESETS[style].fastSeconds}s fast / ${INTERVAL_PRESETS[style].easySeconds}s easy`}
            </div>
          )}

          {/* Live summary + prominent CTA, placed just below the target section */}
          <div style={{ marginTop: 40 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10,
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 13,
              color: C.text, justifyContent: 'center', textAlign: 'center',
            }}>
              <HeartPulse size={14} color={GOLD}/>
              <span style={{ color: GOLD }}>{summary}</span>
            </div>
            <button onClick={handleSave} style={{
              width: '100%', padding: '15px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${GOLD}, ${C.gold})`,
              color: C.bg, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: '0.14em',
              boxShadow: '0 0 24px rgba(253,224,71,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <Check size={18}/>
              {initialAddon ? 'UPDATE CARDIO' : 'ADD TO WORKOUT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
