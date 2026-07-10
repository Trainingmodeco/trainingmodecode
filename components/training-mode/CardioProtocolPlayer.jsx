import { useState, useEffect, useRef } from 'react';
import { C } from './Styles';
import { Play, Pause, Rewind, FastForward, Flag, SquarePen, Check } from 'lucide-react';
import { ARCADE } from './ArcadeUI';
import { CARDIO_SAFETY_COPY } from './data/cardioProtocolData';
import TrainingCTA from './shared/TrainingCTA';

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

// Great-circle distance between two lat/lng points, in meters.
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Turns a protocol into an ordered list of countdown segments. Interval / Tabata
// alternate work and rest for each round; steady / custom is a single segment.
function buildSegments(format, durationSeconds, intervalConfig) {
  if (format === 'interval' || format === 'tabata') {
    const cfg = intervalConfig || {};
    const rounds = cfg.rounds || 8;
    const workSeconds = cfg.workSeconds ?? cfg.fastSeconds ?? cfg.hardSeconds ?? 30;
    const restSeconds = cfg.restSeconds ?? cfg.easySeconds ?? 15;
    const warmupSeconds = cfg.warmupSeconds ?? 0;
    const cooldownSeconds = cfg.cooldownSeconds ?? 0;
    const workLabel = format === 'tabata' ? 'HARD' : 'WORK';
    const restLabel = format === 'tabata' ? 'REST' : 'RECOVER';
    const segments = [];
    if (warmupSeconds > 0) segments.push({ kind: 'warmup', seconds: warmupSeconds, round: 0, label: 'WARM-UP', color: GOLD });
    for (let r = 1; r <= rounds; r++) {
      segments.push({ kind: 'work', seconds: workSeconds, round: r, label: workLabel, color: RED });
      segments.push({ kind: 'rest', seconds: restSeconds, round: r, label: restLabel, color: GREEN });
    }
    if (cooldownSeconds > 0) segments.push({ kind: 'cooldown', seconds: cooldownSeconds, round: -1, label: 'COOL DOWN', color: GREEN });
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
  useGps = false,
  randomSurges = false,
  distanceTargetLabel = null,
  paceTargetLabel = null,
  paceTargetSeconds = null,
  goalDistance = null,
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

  // Real GPS tracking (outdoor runs). Accumulates distance between fixes and keeps
  // a route trail; falls back to the simulation when GPS is unavailable/denied.
  const gpsRef = useRef({ watchId: null, last: null, meters: 0, pts: [] });
  const [gpsMeters, setGpsMeters] = useState(0);
  const [gpsFix, setGpsFix] = useState(false);
  const [gpsRoute, setGpsRoute] = useState([]);
  const [gpsSpeed, setGpsSpeed] = useState(0);
  const [surge, setSurge] = useState(false);

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

  // Live GPS: start/stop watchPosition with the run. Reject sub-meter jitter and
  // impossible jumps between fixes so the distance total stays honest.
  useEffect(() => {
    if (!useGps || !distanceMode || !running) return undefined;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const prev = gpsRef.current.last;
        if (prev) {
          const d = haversineMeters(prev.lat, prev.lng, latitude, longitude);
          if (d > 1 && d < 75) { gpsRef.current.meters += d; setGpsMeters(gpsRef.current.meters); }
        }
        gpsRef.current.last = { lat: latitude, lng: longitude };
        gpsRef.current.pts.push({ lat: latitude, lng: longitude });
        if (gpsRef.current.pts.length > 240) gpsRef.current.pts.shift();
        setGpsRoute(gpsRef.current.pts.slice());
        if (typeof speed === 'number' && speed >= 0) setGpsSpeed(speed);
        setGpsFix(true);
      },
      () => { setGpsFix(false); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 },
    );
    gpsRef.current.watchId = id;
    return () => { if (id != null && navigator.geolocation) navigator.geolocation.clearWatch(id); };
  }, [useGps, distanceMode, running]);

  // Random-interval surges: every 45–90s, call a 20–30s surge, then reschedule.
  useEffect(() => {
    if (!randomSurges || !running || done) return undefined;
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        setSurge(true);
        timer = setTimeout(() => { setSurge(false); schedule(); }, 20000 + Math.random() * 10000);
      }, 45000 + Math.random() * 45000);
    };
    schedule();
    return () => { clearTimeout(timer); setSurge(false); };
  }, [randomSurges, running, done]);

  // Distance/pace come from real GPS when we have a fix; otherwise simulate from
  // elapsed time (~2% ahead of target pace). Auto-finish once the goal is reached.
  const simPaceSec = paceTargetSeconds || 600;
  const simDistance = distanceMode ? totalElapsed / (simPaceSec * 0.98) : 0;
  const simGoal = goalDistance || parseFloat(distanceTargetLabel) || 3;
  const usingRealGps = useGps && gpsFix;
  const gpsDistanceUnit = (initialDistanceUnit || 'mi') === 'km' ? gpsMeters / 1000 : gpsMeters / 1609.344;
  const trackedDistance = usingRealGps ? gpsDistanceUnit : simDistance;
  useEffect(() => {
    if (distanceMode && running && !done && trackedDistance >= simGoal) {
      finish({ completedDistance: usingRealGps ? +trackedDistance.toFixed(2) : simGoal, distanceUnit: initialDistanceUnit });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalElapsed, gpsMeters, distanceMode, running, done]);

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
    const unit = initialDistanceUnit || 'mi';
    const dist = trackedDistance;
    const fmtPace = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
    // Current pace: from GPS speed while moving, else derived from distance/time; sim otherwise.
    const gpsPaceSec = gpsSpeed > 0.4
      ? (unit === 'km' ? 1000 / gpsSpeed : 1609.344 / gpsSpeed)
      : (dist > 0.02 ? totalElapsed / dist : simPaceSec);
    const curPaceSec = usingRealGps ? gpsPaceSec : (running ? simPaceSec * (0.96 + 0.06 * Math.sin(totalElapsed / 8)) : simPaceSec);
    const aheadSec = Math.round(dist * simPaceSec - totalElapsed);
    const progressPct = Math.min(100, simGoal > 0 ? (dist / simGoal) * 100 : 0);
    const coach = surge ? 'SURGE! Push the pace — hold it!'
      : !running ? (useGps ? 'Tap start — we\'ll lock onto GPS.' : 'Tap start to begin.')
        : Math.abs(aheadSec) <= 6 ? 'Great pace — hold it right there!'
          : aheadSec > 6 ? 'Ahead of target — settle into it.'
            : 'Push a little — you\'re behind pace.';
    // Route trail: real GPS path once we have ≥2 fixes, else a decorative trace.
    const routePts = (() => {
      if (usingRealGps && gpsRoute.length >= 2) {
        const lats = gpsRoute.map(p => p.lat), lngs = gpsRoute.map(p => p.lng);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        const spanLat = Math.max(1e-6, maxLat - minLat), spanLng = Math.max(1e-6, maxLng - minLng);
        const pad = 6;
        return gpsRoute.map(p => {
          const x = pad + ((p.lng - minLng) / spanLng) * (300 - pad * 2);
          const y = 58 - ((p.lat - minLat) / spanLat) * (58 - 6);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
      }
      return [56, 44, 50, 34, 40, 26, 30, 18].map((y, i) => `${6 + i * 41},${y}`).join(' ');
    })();
    const statusText = useGps ? (usingRealGps ? 'GPS LIVE' : 'GPS ACQUIRING…') : 'PACE TRACK';
    const statusColor = usingRealGps ? '#8fe8ac' : useGps ? '#ffd27a' : '#c9a6ff';
    const statusDot = usingRealGps ? '#22c55e' : useGps ? '#f5b942' : '#b06aff';
    const gaugeColor = surge ? '#ff8a4a' : '#c9a6ff';
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0' }}>
        <style dangerouslySetInnerHTML={{ __html: RING_STYLES }} />
        {/* GPS live header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot, boxShadow: `0 0 8px ${statusDot}`, animation: usingRealGps || !useGps ? 'none' : 'cardio-ring-glow 1.4s ease-in-out infinite' }}/>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700, color: statusColor, letterSpacing: '0.1em' }}>{statusText} · {String(methodLabel || 'RUN').toUpperCase()} · {simGoal} {unit}</span>
        </div>

        {/* Surge banner */}
        {surge && (
          <div style={{ width: '100%', borderRadius: 10, background: 'rgba(255,138,74,0.14)', border: '1px solid rgba(255,138,74,0.5)', padding: '7px 12px', marginBottom: 10, textAlign: 'center', animation: 'cardio-ring-glow 0.9s ease-in-out infinite' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 900, color: '#ff8a4a', letterSpacing: '0.1em' }}>🔥 SURGE — PUSH THE PACE</span>
          </div>
        )}

        {/* Route mini-chart */}
        <div style={{ width: '100%', borderRadius: 11, border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(8,2,18,0.6)', padding: '8px 12px', marginBottom: 12, position: 'relative' }}>
          <svg viewBox="0 0 300 64" style={{ width: '100%', height: 44, display: 'block' }}>
            <polyline points={routePts} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 3px rgba(34,197,94,0.5))' }}/>
          </svg>
          <div style={{ position: 'absolute', top: 8, right: 12, display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#8fe8ac' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }}/> ROUTE · {dist.toFixed(2)} {unit}
          </div>
        </div>

        {/* Pace gauge — design 12b cardio ring (dimmed + enlarged so it clears the numbers) */}
        <div style={{ position: 'relative', width: 'min(86vw, 330px)', aspectRatio: '1/1', marginBottom: 10, marginTop: -4 }}>
          <img src="/static/timer-cardio.png" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.34, pointerEvents: 'none' }}/>
          <svg width="100%" height="100%" viewBox="0 0 260 260" style={{ position: 'absolute', inset: 0, display: 'block' }}>
            <circle
              cx="130" cy="130" r="105" fill="none"
              stroke={gaugeColor} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 105}
              strokeDashoffset={(1 - Math.min(1, progressPct / 100)) * 2 * Math.PI * 105}
              transform="rotate(-90 130 130)"
              style={{ transition: 'stroke-dashoffset 0.9s linear', filter: `drop-shadow(0 0 8px ${surge ? 'rgba(255,138,74,0.8)' : 'rgba(176,106,255,0.7)'})` }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: VIOLET, letterSpacing: '0.16em', marginBottom: 2 }}>PACE /{unit}</div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1, textShadow: '0 0 16px rgba(168,85,247,0.4)' }}>{fmtPace(curPaceSec)}</div>
            <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 900, color: GOLD }}>{dist.toFixed(2)}</div><div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.08em' }}>{unit.toUpperCase() === 'MI' ? 'MILES' : 'KM'}</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 900, color: '#fff' }}>{fmt(totalElapsed)}</div><div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.08em' }}>TIME</div></div>
            </div>
          </div>
        </div>

        {/* Target pace bar */}
        <div style={{ width: '100%', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.06em' }}>TARGET {paceTargetLabel || `${fmtPace(simPaceSec)} /${unit}`}</span>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: aheadSec >= 0 ? '#8fe8ac' : '#ff9a52' }}>{Math.abs(aheadSec)}s {aheadSec >= 0 ? 'AHEAD ✓' : 'BEHIND'}</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}><div style={{ width: `${Math.max(3, progressPct)}%`, height: '100%', background: aheadSec >= 0 ? 'linear-gradient(90deg,#22c55e,#8fe8ac)' : 'linear-gradient(90deg,#f59e0b,#ff9a52)' }}/></div>
        </div>

        {/* Coach caption */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 99, background: surge ? 'rgba(255,138,74,0.12)' : 'rgba(34,197,94,0.1)', border: `1px solid ${surge ? 'rgba(255,138,74,0.4)' : 'rgba(34,197,94,0.3)'}`, padding: '7px 15px', marginBottom: 14 }}>
          <span style={{ fontSize: 11 }}>{surge ? '🔥' : '💬'}</span>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 600, color: surge ? '#ffd0b0' : '#c9f5d6' }}>{coach}</span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <TrainingCTA
            variant={running ? 'violet' : 'gold'}
            label={running ? 'PAUSE' : (totalElapsed > 0 ? 'RESUME' : 'START')}
            icon={running ? '❚❚' : '▶'}
            height={52}
            onClick={() => setRunning(v => !v)}
            style={{ flex: '2 1 0', width: 'auto', fontSize: 14, letterSpacing: '0.08em' }}
          />
          <button onClick={() => { setRunning(false); if (deferManualLog) finish({ completedDistance: +dist.toFixed(2), distanceUnit: unit }); else setShowManual(true); }} style={{ flex: 1, height: 52, borderRadius: 14, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#ff8a8a', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Flag size={14}/> END
          </button>
        </div>
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
          {seg.round > 0 ? `ROUND ${seg.round} OF ${rounds}` : seg.label}
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
