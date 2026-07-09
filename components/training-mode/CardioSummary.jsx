import { useState } from 'react';
import { C } from './Styles';
import { CircleCheck as CheckCircle } from 'lucide-react';
import { ARCADE, ArcadeHudPanel, ArcadeSectionLabel, ArcadePrimaryButton, ArcadeSecondaryButton, ArcadeStatusChip } from './ArcadeUI';
import { createCardioSession, logCardioSession } from './data/cardioSessions';

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

const fieldLabel = {
  fontFamily: ARCADE.fontHead, fontSize: 9, fontWeight: 700,
  color: ARCADE.gold, letterSpacing: '0.14em', marginBottom: 6, display: 'block',
};

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: ARCADE.radius.sm,
  background: 'rgba(6,0,16,0.7)', border: `1px solid ${ARCADE.violetBorderSoft}`,
  color: ARCADE.text, fontFamily: ARCADE.fontBody, fontSize: 14, fontWeight: 600,
  outline: 'none', boxSizing: 'border-box',
};

// Reusable cardio completion + manual log screen. Works for Fit, Fight, Daily
// Quest and Training Arcade. Callers pass what they know about the target; the
// user fills in what they actually completed, then we persist the session.
export default function CardioSummary({
  sourceMode = 'fit',
  method = 'custom-cardio',
  methodLabel = 'Cardio',
  cardioType,
  targetType = 'time',
  targetTimeSeconds = null,
  targetDistance = null,
  initialTimeSeconds = 0,
  initialDistanceUnit = 'mi',
  awardXp = true,
  onDone,
}) {
  const startMin = Math.floor((initialTimeSeconds || 0) / 60);
  const startSec = Math.round((initialTimeSeconds || 0) % 60);

  const [minutes, setMinutes] = useState(startMin ? String(startMin) : '');
  const [seconds, setSeconds] = useState(startSec ? String(startSec) : '');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState(initialDistanceUnit || 'mi');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');
  const [logged, setLogged] = useState(false);
  const [saved, setSaved] = useState(null);

  function buildTimeSeconds() {
    const m = parseInt(minutes, 10);
    const s = parseInt(seconds, 10);
    const total = (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
    return total > 0 ? total : null;
  }

  function buildDistanceLabel() {
    const trimmed = distance.trim();
    if (!trimmed) return null;
    const num = parseFloat(trimmed);
    if (Number.isFinite(num)) return `${num} ${distanceUnit}`;
    return trimmed;
  }

  function handleLog() {
    const completedTimeSeconds = buildTimeSeconds();
    const completedDistance = buildDistanceLabel();
    const cals = parseInt(calories, 10);
    const session = createCardioSession({
      sourceMode,
      cardioType: cardioType || method,
      methodLabel,
      targetType,
      targetTimeSeconds,
      targetDistance,
      completedTimeSeconds,
      completedDistance,
      calories: Number.isFinite(cals) && cals > 0 ? cals : null,
      notes: notes.trim(),
      completed: true,
    });
    logCardioSession(session, { awardXp });
    setSaved(session);
    setLogged(true);
  }

  if (logged && saved) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 14px', width: '100%' }}>
        <ArcadeHudPanel glow="gold" style={{ width: '100%', maxWidth: 340, padding: '22px 18px', textAlign: 'center' }}>
          <CheckCircle size={40} color="#22c55e" style={{ margin: '0 auto 10px', display: 'block' }} />
          <div style={{
            fontFamily: ARCADE.fontHead, fontSize: 15, fontWeight: 900, color: ARCADE.gold,
            letterSpacing: '0.1em', textShadow: '0 0 14px rgba(253,224,71,0.4)', marginBottom: 4,
          }}>CARDIO LOGGED</div>
          <div style={{ fontFamily: ARCADE.fontBody, fontSize: 12, color: C.muted, marginBottom: 16 }}>
            {methodLabel}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18, textAlign: 'left' }}>
            <SummaryRow label="Method" value={methodLabel} />
            <SummaryRow label="Time Completed" value={saved.completedTimeSeconds ? formatClock(saved.completedTimeSeconds) : 'Not recorded'} />
            {targetDistance && <SummaryRow label="Target Distance" value={targetDistance} />}
            <SummaryRow label="Distance Completed" value={saved.completedDistance || 'Not recorded'} />
            {saved.calories != null && <SummaryRow label="Calories" value={`${saved.calories} kcal`} />}
            {saved.notes ? <SummaryRow label="Notes" value={saved.notes} /> : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <ArcadeStatusChip tone="gold">COMPLETED</ArcadeStatusChip>
          </div>

          <ArcadePrimaryButton onClick={onDone}>CONTINUE</ArcadePrimaryButton>
        </ArcadeHudPanel>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', width: '100%' }}>
      <ArcadeSectionLabel style={{ textAlign: 'center', marginBottom: 4 }}>LOG YOUR CARDIO</ArcadeSectionLabel>
      <h3 style={{
        fontFamily: ARCADE.fontHead, fontSize: 14, fontWeight: 900, color: '#c4b5fd',
        letterSpacing: '0.06em', margin: '0 0 4px', textAlign: 'center',
        textShadow: '0 0 12px rgba(168,85,247,0.4)',
      }}>{methodLabel}</h3>
      {targetDistance && (
        <p style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: ARCADE.gold, margin: '0 0 14px', textAlign: 'center' }}>
          Target: {targetDistance}
        </p>
      )}
      {!targetDistance && targetTimeSeconds ? (
        <p style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: ARCADE.gold, margin: '0 0 14px', textAlign: 'center' }}>
          Target: {formatClock(targetTimeSeconds)}
        </p>
      ) : null}

      <ArcadeHudPanel style={{ width: '100%', maxWidth: 340, padding: '16px 16px 18px' }}>
        <div style={{ marginBottom: 14 }}>
          <span style={fieldLabel}>TIME COMPLETED</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" inputMode="numeric" min="0" placeholder="0" value={minutes}
              onChange={(e) => setMinutes(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
            <span style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted }}>min</span>
            <input type="number" inputMode="numeric" min="0" max="59" placeholder="0" value={seconds}
              onChange={(e) => setSeconds(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
            <span style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted }}>sec</span>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <span style={fieldLabel}>DISTANCE <span style={{ color: C.muted, letterSpacing: 0 }}>(optional)</span></span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" inputMode="decimal" placeholder="e.g. 5" value={distance}
              onChange={(e) => setDistance(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {['km', 'mi'].map(u => (
                <button key={u} onClick={() => setDistanceUnit(u)} style={{
                  padding: '0 14px', borderRadius: ARCADE.radius.sm, cursor: 'pointer',
                  background: distanceUnit === u ? 'rgba(253,224,71,0.12)' : 'rgba(6,0,16,0.7)',
                  border: distanceUnit === u ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                  color: distanceUnit === u ? ARCADE.gold : C.muted,
                  fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                }}>{u.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <span style={fieldLabel}>CALORIES <span style={{ color: C.muted, letterSpacing: 0 }}>(optional)</span></span>
          <input type="number" inputMode="numeric" min="0" placeholder="e.g. 250" value={calories}
            onChange={(e) => setCalories(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <span style={fieldLabel}>NOTES <span style={{ color: C.muted, letterSpacing: 0 }}>(optional)</span></span>
          <textarea rows={2} placeholder="How did it feel?" value={notes}
            onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, resize: 'none', lineHeight: 1.4 }} />
        </div>
      </ArcadeHudPanel>

      <div style={{ width: '100%', maxWidth: 340, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ArcadePrimaryButton onClick={handleLog}>LOG CARDIO</ArcadePrimaryButton>
        <ArcadeSecondaryButton onClick={onDone}>SKIP LOGGING</ArcadeSecondaryButton>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted, letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontFamily: ARCADE.fontHead, fontSize: 12, fontWeight: 700, color: ARCADE.text, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
