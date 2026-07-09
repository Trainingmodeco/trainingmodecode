import { useState, useEffect, useRef } from 'react';
import { C } from './Styles';
import { Play, Pause, Rewind, FastForward, Flag, SquarePen, Check } from 'lucide-react';
import { ARCADE } from './ArcadeUI';
import { CARDIO_SAFETY_COPY } from './data/cardioProtocolData';

const GOLD = C.yellow;
const VIOLET = '#a855f7';
const GREEN = '#22c55e';
const RED = '#ef4444';

const RING_STYLES = `
@keyframes cardio-ring-glow {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(168,85,247,0.35)); }
  50% { filter: drop-shadow(0 0 16px rgba(168,85,247,0.6)); }
}
`;

function fmt(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Turns a protocol into an ordered list of countdown segments. Interval / Tabata
// alternate work and rest for each round; steady / custom is a single segment.
function buildSegments(format, durationSeconds, intervalConfig) {
  if (format === 'interval' || format === 'tabata') {
    const cfg = intervalConfig || {};
    const rounds = cfg.rounds || 8;
    const workSeconds = cfg.workSeconds ?? cfg.fastSeconds ?? cfg.hardSeconds ?? 30;
    const restSeconds = cfg.restSeconds ?? cfg.easySeconds ?? 15;
    const workLabel = format === 'tabata' ? 'HARD' : 'WORK';
    const restLabel = format === 'tabata' ? 'REST' : 'RECOVER';
    const segments = [];
    for (let r = 1; r <= rounds; r++) {
      segments.push({ kind: 'work', seconds: workSeconds, round: r, label: workLabel, color: RED });
      segments.push({ kind: 'rest', seconds: restSeconds, round: r, label: restLabel, color: GREEN });
    }
    return { segments, rounds };
  }
  const seconds = durationSeconds || 600;
  return { segments: [{ kind: 'steady', seconds, round: 1, label: 'STEADY', color: VIOLET }], rounds: 1 };
}

function Ring({ progress, color, done, children, size = 216 }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(Math.max(progress, 0), 1));
  const innerR = r - 20;

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', animation: 'cardio-ring-glow 3s ease-in-out infinite' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(168,85,247,0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={done ? GOLD : color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease', filter: `drop-shadow(0 0 6px ${done ? GOLD : color})` }}
        />
        <circle cx={size / 2} cy={size / 2} r={innerR} fill="none" stroke="rgba(253,224,71,0.22)" strokeWidth={1.5} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

function CtrlButton({ onClick, children, size = 46 }) {
  return (
    <button onClick={onClick} style={{
      width: size, height: size, borderRadius: 12, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(168,85,247,0.3)',
    }}>{children}</button>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  background: 'rgba(6,0,16,0.7)', border: `1px solid ${ARCADE.violetBorderSoft}`,
  color: C.text, fontFamily: ARCADE.fontBody, fontSize: 14, fontWeight: 600,
  outline: 'none', boxSizing: 'border-box',
};
const fieldLabel = {
  fontFamily: ARCADE.fontHead, fontSize: 9, fontWeight: 700,
  color: GOLD, letterSpacing: '0.14em', marginBottom: 6, display: 'block',
};

function ManualLog({ methodLabel, initialSeconds = 0, initialUnit = 'mi', onSave, onCancel }) {
  const [minutes, setMinutes] = useState(initialSeconds ? String(Math.floor(initialSeconds / 60)) : '');
  const [seconds, setSeconds] = useState(initialSeconds % 60 ? String(Math.round(initialSeconds % 60)) : '');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState(initialUnit || 'mi');
  const [calories, setCalories] = useState('');
  const [notes, setNotes] = useState('');

  const save = () => {
    const m = parseInt(minutes, 10);
    const s = parseInt(seconds, 10);
    const total = (Number.isFinite(m) ? m : 0) * 60 + (Number.isFinite(s) ? s : 0);
    const dist = parseFloat(distance);
    const cals = parseInt(calories, 10);
    onSave({
      completedTimeSeconds: total > 0 ? total : null,
      completedDistance: Number.isFinite(dist) && dist > 0 ? `${dist} ${distanceUnit}` : null,
      distanceUnit,
      calories: Number.isFinite(cals) && cals > 0 ? cals : null,
      notes: notes.trim(),
      completed: true,
      manual: true,
    });
  };

  return (
    <div style={{ width: '100%', textAlign: 'left' }}>
      <div style={{ fontFamily: ARCADE.fontHead, fontSize: 12, fontWeight: 900, color: '#c4b5fd', letterSpacing: '0.08em', textAlign: 'center', marginBottom: 14 }}>
        LOG {(methodLabel || 'CARDIO').toUpperCase()}
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={fieldLabel}>TIME COMPLETED</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="number" inputMode="numeric" min="0" placeholder="0" value={minutes} onChange={e => setMinutes(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
          <span style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted }}>min</span>
          <input type="number" inputMode="numeric" min="0" max="59" placeholder="0" value={seconds} onChange={e => setSeconds(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
          <span style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted }}>sec</span>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={fieldLabel}>DISTANCE <span style={{ color: C.muted, letterSpacing: 0 }}>(optional)</span></span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" inputMode="decimal" placeholder="e.g. 3" value={distance} onChange={e => setDistance(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {['mi', 'km'].map(u => (
              <button key={u} onClick={() => setDistanceUnit(u)} style={{
                padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                background: distanceUnit === u ? 'rgba(253,224,71,0.12)' : 'rgba(6,0,16,0.7)',
                border: distanceUnit === u ? `1.5px solid ${ARCADE.goldBorder}` : `1px solid ${ARCADE.violetBorderSoft}`,
                color: distanceUnit === u ? GOLD : C.muted,
                fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 700,
              }}>{u.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={fieldLabel}>CALORIES <span style={{ color: C.muted, letterSpacing: 0 }}>(optional)</span></span>
        <input type="number" inputMode="numeric" min="0" placeholder="e.g. 250" value={calories} onChange={e => setCalories(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <span style={fieldLabel}>NOTES <span style={{ color: C.muted, letterSpacing: 0 }}>(optional)</span></span>
        <textarea rows={2} placeholder="How did it feel?" value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, resize: 'none', lineHeight: 1.4 }} />
      </div>
      <button onClick={save} style={{
        width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg, ${GOLD}, ${C.gold})`, color: C.bg,
        fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13, letterSpacing: '0.1em',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8,
      }}><Check size={16} /> LOG CARDIO</button>
      {onCancel && (
        <button onClick={onCancel} style={{
          width: '100%', padding: '10px 0', borderRadius: 8, cursor: 'pointer',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: C.muted,
          fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10, letterSpacing: '0.1em',
        }}>BACK TO TIMER</button>
      )}
    </div>
  );
}

// Futuristic cardio HUD. Drives steady / interval / tabata / custom protocols with
// a circular progress ring, round + work/rest status, pause, -15 / +15 nudges, and
// a manual-log fallback. onComplete receives a rich result object.
export default function CardioProtocolPlayer({
  format,
  durationSeconds,
  intervalConfig,
  methodLabel,
  styleLabel,
  distanceLabel,
  headerLabel = 'CARDIO MODE',
  subLabel,
  manualOnly = false,
  distanceMode = false,
  distanceTargetLabel = null,
  initialDistanceUnit = 'mi',
  deferManualLog = false,
  onComplete,
}) {
  const buildRef = useRef(null);
  if (!buildRef.current) buildRef.current = buildSegments(format, durationSeconds, intervalConfig);
  const { segments, rounds } = buildRef.current;

  const [segIndex, setSegIndex] = useState(0);
  const [remaining, setRemaining] = useState(segments[0].seconds);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [showManual, setShowManual] = useState(manualOnly);
  const firedRef = useRef(false);
  const tickRef = useRef(null);

  const seg = segments[segIndex];
  const isInterval = format === 'interval' || format === 'tabata';
  const totalTarget = segments.reduce((sum, s) => sum + s.seconds, 0);

  useEffect(() => {
    if (!running || done || showManual) { clearInterval(tickRef.current); return; }
    tickRef.current = setInterval(() => {
      if (!distanceMode) setRemaining(r => Math.max(0, r - 1));
      setTotalElapsed(t => t + 1);
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running, done, showManual, distanceMode]);

  useEffect(() => {
    if (distanceMode) return;
    if (remaining > 0 || done) return;
    const next = segIndex + 1;
    if (next >= segments.length) {
      setDone(true);
      setRunning(false);
    } else {
      setSegIndex(next);
      setRemaining(segments[next].seconds);
    }
  }, [remaining, done, segIndex, segments, distanceMode]);

  useEffect(() => () => clearInterval(tickRef.current), []);

  const finish = (extra = {}) => {
    if (firedRef.current) return;
    firedRef.current = true;
    clearInterval(tickRef.current);
    onComplete({ completedTimeSeconds: totalElapsed, completed: true, ...extra });
  };

  if (showManual) {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
        {headerLabel && <div style={{ fontFamily: ARCADE.fontHead, fontSize: 9, color: GOLD, fontWeight: 700, letterSpacing: '0.22em', marginBottom: 4 }}>{headerLabel}</div>}
        {subLabel && <div style={{ fontFamily: ARCADE.fontHead, fontSize: 8, color: VIOLET, fontWeight: 700, letterSpacing: '0.2em', marginBottom: 12 }}>{subLabel}</div>}
        <ManualLog
          methodLabel={methodLabel}
          initialSeconds={totalElapsed}
          initialUnit={initialDistanceUnit}
          onSave={(r) => finish(r)}
          onCancel={manualOnly ? null : () => setShowManual(false)}
        />
      </div>
    );
  }

  if (distanceMode) {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
        <style dangerouslySetInnerHTML={{ __html: RING_STYLES }} />
        {methodLabel && <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 900, color: '#c4b5fd', letterSpacing: '0.04em', textAlign: 'center' }}>{methodLabel}</div>}
        <div style={{ fontFamily: ARCADE.fontHead, fontSize: 13, fontWeight: 900, color: GOLD, letterSpacing: '0.16em', marginTop: 4, marginBottom: 12, textShadow: '0 0 12px rgba(253,224,71,0.4)' }}>
          TARGET: {distanceTargetLabel || 'DISTANCE'}
        </div>

        <Ring progress={0} color={VIOLET} done={false}>
          <div style={{ fontFamily: ARCADE.fontHead, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: VIOLET, marginBottom: 2 }}>ELAPSED</div>
          <div style={{ fontFamily: ARCADE.fontHead, fontSize: 46, fontWeight: 900, color: C.text, textShadow: '0 0 16px rgba(168,85,247,0.4)' }}>{fmt(totalElapsed)}</div>
          <div style={{ fontFamily: ARCADE.fontBody, fontSize: 10, color: C.muted, marginTop: 2 }}>stopwatch</div>
        </Ring>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 14 }}>
          <button onClick={() => setRunning(v => !v)} style={{
            width: 60, height: 60, borderRadius: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: running ? 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(168,85,247,0.12))' : 'rgba(253,224,71,0.12)',
            border: `1.5px solid ${running ? 'rgba(168,85,247,0.5)' : GOLD}`,
            boxShadow: running ? '0 0 16px rgba(168,85,247,0.2)' : '0 0 16px rgba(253,224,71,0.25)',
          }}>
            {running ? <Pause size={24} color="#fff" /> : <Play size={24} color={GOLD} />}
          </button>
        </div>

        <button onClick={() => { setRunning(false); deferManualLog ? finish() : setShowManual(true); }} style={{
          marginTop: 16, width: '100%', maxWidth: 300, padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${GOLD}, ${C.gold})`, color: C.bg,
          fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13, letterSpacing: '0.14em',
          boxShadow: '0 0 24px rgba(253,224,71,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Flag size={15} /> FINISH &amp; LOG
        </button>

        <p style={{
          fontFamily: ARCADE.fontBody, fontSize: 9, color: 'rgba(239,68,68,0.7)',
          textAlign: 'center', marginTop: 12, maxWidth: 280, lineHeight: 1.4,
        }}>{CARDIO_SAFETY_COPY}</p>
      </div>
    );
  }

  const progress = seg.seconds > 0 ? (seg.seconds - remaining) / seg.seconds : 1;
  const phaseColor = seg.color;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0' }}>
      <style dangerouslySetInnerHTML={{ __html: RING_STYLES }} />

      <div style={{ fontFamily: ARCADE.fontHead, fontSize: 9, color: GOLD, fontWeight: 700, letterSpacing: '0.22em', marginBottom: 3, display: headerLabel ? 'block' : 'none' }}>{headerLabel}</div>
      {subLabel && <div style={{ fontFamily: ARCADE.fontHead, fontSize: 8, color: VIOLET, fontWeight: 700, letterSpacing: '0.2em', marginBottom: 4 }}>{subLabel}</div>}
      {methodLabel && <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 900, color: '#c4b5fd', letterSpacing: '0.04em', textAlign: 'center' }}>{methodLabel}</div>}
      {styleLabel && <div style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: C.muted, marginBottom: 6 }}>{styleLabel}</div>}

      {isInterval && (
        <div style={{ fontFamily: ARCADE.fontHead, fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.12em', marginBottom: 8 }}>
          ROUND {seg.round} OF {rounds}
        </div>
      )}

      <Ring progress={done ? 1 : progress} color={phaseColor} done={done}>
        <div style={{
          fontFamily: ARCADE.fontHead, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
          color: done ? GOLD : phaseColor, marginBottom: 2,
        }}>{done ? 'COMPLETE' : seg.label}</div>
        <div style={{
          fontFamily: ARCADE.fontHead, fontSize: 46, fontWeight: 900,
          color: done ? GOLD : C.text, textShadow: `0 0 16px ${done ? 'rgba(253,224,71,0.5)' : 'rgba(168,85,247,0.4)'}`,
        }}>{fmt(done ? 0 : remaining)}</div>
        <div style={{ fontFamily: ARCADE.fontBody, fontSize: 10, color: C.muted, marginTop: 2 }}>
          {fmt(totalElapsed)} / {fmt(totalTarget)}
        </div>
      </Ring>

      {distanceLabel && (
        <div style={{ fontFamily: ARCADE.fontBody, fontSize: 11, color: GOLD, opacity: 0.85, marginTop: 8 }}>
          Target: {distanceLabel}
        </div>
      )}

      {!done && (
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 14 }}>
          <CtrlButton onClick={() => setRemaining(r => Math.max(0, r - 15))}>
            <Rewind size={17} color={C.neon} />
          </CtrlButton>
          <button onClick={() => setRunning(v => !v)} style={{
            width: 60, height: 60, borderRadius: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: running ? 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(168,85,247,0.12))' : 'rgba(253,224,71,0.12)',
            border: `1.5px solid ${running ? 'rgba(168,85,247,0.5)' : GOLD}`,
            boxShadow: running ? '0 0 16px rgba(168,85,247,0.2)' : '0 0 16px rgba(253,224,71,0.25)',
          }}>
            {running ? <Pause size={24} color="#fff" /> : <Play size={24} color={GOLD} />}
          </button>
          <CtrlButton onClick={() => setRemaining(r => r + 15)}>
            <FastForward size={17} color={C.neon} />
          </CtrlButton>
        </div>
      )}

      <button onClick={() => finish()} style={{
        marginTop: 14, width: '100%', maxWidth: 300, padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
        background: done ? `linear-gradient(135deg, ${GOLD}, ${C.gold})` : 'rgba(255,255,255,0.06)',
        color: done ? C.bg : C.text,
        fontFamily: ARCADE.fontHead, fontWeight: 900, fontSize: 13, letterSpacing: '0.14em',
        boxShadow: done ? '0 0 24px rgba(253,224,71,0.45)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <Flag size={15} /> {done ? 'COMPLETE CARDIO' : 'FINISH EARLY'}
      </button>

      <button onClick={() => setShowManual(true)} style={{
        marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: ARCADE.fontHead, fontWeight: 700, fontSize: 10, color: C.muted, letterSpacing: '0.08em',
      }}>
        <SquarePen size={13} /> LOG MANUALLY INSTEAD
      </button>

      <p style={{
        fontFamily: ARCADE.fontBody, fontSize: 9, color: 'rgba(239,68,68,0.7)',
        textAlign: 'center', marginTop: 12, maxWidth: 280, lineHeight: 1.4,
      }}>{done ? 'Stay focused. Finish strong.' : CARDIO_SAFETY_COPY}</p>
    </div>
  );
}
