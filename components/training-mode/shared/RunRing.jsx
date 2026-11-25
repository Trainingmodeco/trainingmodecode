import { HEAD, GOLD } from './FitSetupKit';

// AT YOUR PACE's clock (owner, 2026-11-24: "I need the counter to work similar to
// how the counter works in all the other timers"): the ring the guided timers
// draw (QuickMissionActive, CombatConditioningActive, WarmupTimer: a faint
// track, a round-capped arc that glows in the phase's colour, the time large in
// the middle, the phase word under it), sized by the head's --sr-ring
// (shared/RunBar RUN_CSS), with Quick Mission's lightning bolt glowing softly
// behind it. Those screens keep their own rings untouched; this one is shared
// by the two AT YOUR PACE run screens (QuickMissionSolo, fit-challenge CheckOffRun).
//
//   time     the big number ('0:11', or GET READY's 5)
//   pct      the arc, 0..1 (what is left of a segment, or the share of a cap used)
//   color    the phase's colour: work gold, rest blue, get ready violet, last minute red
//   word     the line under the time (WORK, REST, CAP 30:00, PAUSED…)
//   call     a wiper call, in place of the word, large
//   timer    false for GET READY (role="timer" marks the run's clock only)
const VB = 200;
const R = 86;
const STROKE = 11;
const CIRC = 2 * Math.PI * R;

export const RING_COLORS = { work: GOLD, rest: '#4f8cff', ready: '#B57BFF', warn: '#EF4444' };

export default function RunRing({ time, pct = 1, color = GOLD, word, call, paused = false, timer = true, label }) {
  const p = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
  return (
    <div className="sr-ringbox" data-run-ring="true">
      <svg aria-hidden="true" viewBox={`0 0 ${VB} ${VB}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
        <circle cx={VB / 2} cy={VB / 2} r={R} fill="rgba(7,0,15,0.55)" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE}/>
      </svg>
      {/* The lightning bolt: Quick Mission is the lightning mode. Soft, behind the arc. */}
      <svg aria-hidden="true" viewBox="0 0 100 160" style={{ position: 'absolute', left: '50%', top: '50%', height: '78%', transform: 'translate(-50%, -50%)', opacity: paused ? 0.16 : 0.3, filter: `drop-shadow(0 0 8px ${color})`, pointerEvents: 'none' }}>
        <polygon points="62,2 16,92 47,92 32,158 88,60 56,60 78,2" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="4" strokeLinejoin="round"/>
      </svg>
      <svg aria-hidden="true" viewBox={`0 0 ${VB} ${VB}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
        <circle className="sr-arc" cx={VB / 2} cy={VB / 2} r={R} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={(1 - p) * CIRC} transform={`rotate(-90 ${VB / 2} ${VB / 2})`}
          style={{ filter: `drop-shadow(0 0 7px ${color})`, opacity: paused ? 0.45 : 1 }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <div role={timer ? 'timer' : undefined} aria-label={label} className="sr-time" style={{
          fontWeight: 700, fontFamily: HEAD, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 16px ${color}`, opacity: paused ? 0.7 : 1,
        }}>{time}</div>
        {call ? (
          <div style={{ font: `800 17px ${HEAD}`, letterSpacing: '0.1em', color: GOLD, textTransform: 'uppercase', textShadow: '0 0 12px rgba(253,224,71,0.5)' }}>{call}</div>
        ) : word ? (
          <div style={{ font: `700 12px ${HEAD}`, letterSpacing: '0.16em', color: paused ? GOLD : color, whiteSpace: 'nowrap' }}>{word}</div>
        ) : null}
      </div>
    </div>
  );
}
