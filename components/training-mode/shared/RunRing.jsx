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
//   fill     true: the ring fills its parent (the guided runner sizes its own box)
//   timeSize the big number's font size (when the head's RUN_CSS is not there)
//   arcTransition  the arc's CSS transition (the guided runner ticks once a second)
//   children drawn in the middle in place of the time and the word (PREPARING..., MAX)
//
// The GUIDED Quick Mission (QuickMissionActive) uses this ring too since
// 2026-11-25 (one look for all of Quick Mission, docs/quick-mission/UNIFIED-LOOK.md).
const VB = 200;
const R = 86;
const STROKE = 11;
const CIRC = 2 * Math.PI * R;

// The lightning bolt behind the arc. Its strength, 0 (gone) to 1. It is 0.3, as it
// was when AT YOUR PACE shipped: the owner tried it at 0.03 (2026-11-25, for the
// exercise GIFs to come) and asked for it back (2026-11-26). Paused, it drops to
// about half of this.
export const BOLT_OPACITY = 0.3;

export const RING_COLORS = { work: GOLD, rest: '#4f8cff', ready: '#B57BFF', warn: '#EF4444' };

// The bolt is CHARGED while the work is on (gold, and red for the last minute):
// it pulses, crackles with electric arcs and throws sparks. On a rest it settles
// down to BOLT_REST_OPACITY and the arcs stop (owner, 2026-11-26). Paused, ready
// and everything else is as before. With reduced motion the arcs stand still.
export const BOLT_REST_OPACITY = 0.12;

const CHARGE_CSS = `
@keyframes rr-glow { 0% { filter: drop-shadow(0 0 5px var(--rr-c)); opacity: .3 } 100% { filter: drop-shadow(0 0 17px var(--rr-c)); opacity: .44 } }
@keyframes rr-arc-a { 0%, 30% { opacity: 1 } 34%, 100% { opacity: 0 } }
@keyframes rr-arc-b { 0%, 32% { opacity: 0 } 36%, 64% { opacity: 1 } 68%, 100% { opacity: 0 } }
@keyframes rr-arc-c { 0%, 66% { opacity: 0 } 70%, 96% { opacity: 1 } 100% { opacity: 0 } }
@keyframes rr-flick { 0%, 100% { opacity: 1 } 13% { opacity: .55 } 27% { opacity: 1 } 41% { opacity: .35 } 58% { opacity: .95 } 79% { opacity: .5 } }
@keyframes rr-spark { 0%, 100% { opacity: 0; transform: scale(.4) } 45% { opacity: 1; transform: scale(1.5) } 70% { opacity: .2; transform: scale(.8) } }
.rr-bolt-live { animation: rr-glow 1.1s ease-in-out infinite alternate; }
.rr-arcs { animation: rr-flick .83s linear infinite; }
.rr-arc { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.rr-arc-a { animation: rr-arc-a .6s steps(1, end) infinite; }
.rr-arc-b { animation: rr-arc-b .6s steps(1, end) infinite; }
.rr-arc-c { animation: rr-arc-c .6s steps(1, end) infinite; }
.rr-spark { transform-box: fill-box; transform-origin: center; animation: rr-spark .9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .rr-bolt-live, .rr-arcs, .rr-spark { animation: none !important; }
  .rr-arc-a, .rr-arc-b, .rr-arc-c { animation: none !important; opacity: .55; }
  .rr-spark { opacity: .6; }
}
`;

// Jagged arcs hugging the bolt's edges (the bolt is drawn in a 100 x 160 box),
// three sets that take turns, and the sparks they throw.
const ARCS_A = ['M57 4 L48 20 L54 25 L38 48 L44 52 L26 76 L31 80 L16 94', 'M83 62 L72 80 L78 85 L60 112 L65 116 L47 142 L52 146 L38 158'];
const ARCS_B = ['M80 2 L72 16 L78 22 L66 38 L71 42 L58 58', 'M20 88 L33 96 L45 88 L52 98 L40 112 L45 116 L33 138', 'M92 58 L80 74 L84 78 L70 100 L74 104 L60 126'];
const ARCS_C = ['M64 0 L56 14 L62 19 L46 40 L51 44 L34 68 L39 72 L22 90', 'M90 64 L81 82 L86 86 L68 112 L72 116 L54 144 L58 148', 'M58 62 L68 54 L62 50 L76 38 L70 34 L84 18'];
const SPARKS = [[62, 2, 0], [16, 92, .2], [88, 60, .45], [32, 158, .65], [78, 2, .3], [47, 92, .75]];

export default function RunRing({ time, pct = 1, color = GOLD, word, call, paused = false, timer = true, label, fill = false, timeSize, arcTransition, children }) {
  const p = Math.max(0, Math.min(1, Number.isFinite(pct) ? pct : 0));
  const charged = !paused && (color === RING_COLORS.work || color === RING_COLORS.warn);
  const resting = !paused && color === RING_COLORS.rest;
  const boltOpacity = paused ? BOLT_OPACITY * 0.55 : resting ? BOLT_REST_OPACITY : BOLT_OPACITY;
  const boltPos = { position: 'absolute', left: '50%', top: '50%', height: '78%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', overflow: 'visible' };
  return (
    <div className={fill ? undefined : 'sr-ringbox'} data-run-ring="true" style={fill ? { position: 'absolute', inset: 0 } : undefined}>
      <svg aria-hidden="true" viewBox={`0 0 ${VB} ${VB}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
        <circle cx={VB / 2} cy={VB / 2} r={R} fill="rgba(7,0,15,0.55)" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE}/>
      </svg>
      {/* The lightning bolt: Quick Mission is the lightning mode. Behind the arc (BOLT_OPACITY). */}
      <style dangerouslySetInnerHTML={{ __html: CHARGE_CSS }}/>
      <svg aria-hidden="true" viewBox="0 0 100 160" className={charged ? 'rr-bolt-live' : undefined}
        style={{ ...boltPos, '--rr-c': color, opacity: boltOpacity, filter: `drop-shadow(0 0 8px ${color})`, transition: 'opacity .5s ease' }}>
        <polygon points="62,2 16,92 47,92 32,158 88,60 56,60 78,2" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="4" strokeLinejoin="round"/>
      </svg>
      {charged && (
        <svg aria-hidden="true" viewBox="0 0 100 160" data-run-charge="true" style={boltPos}>
          <g className="rr-arcs" style={{ filter: `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 7px ${color})` }}>
            {[['a', ARCS_A], ['b', ARCS_B], ['c', ARCS_C]].map(([k, list]) => (
              <g key={k} className={`rr-arc-${k}`}>
                {list.map((d) => (
                  <g key={d}>
                    <path className="rr-arc" d={d} stroke={color} strokeWidth="5" strokeOpacity="0.6"/>
                    <path className="rr-arc" d={d} stroke="#FFFBE6" strokeWidth="2.1"/>
                  </g>
                ))}
              </g>
            ))}
          </g>
          {SPARKS.map(([x, y, d]) => (
            <circle key={`${x}-${y}`} className="rr-spark" cx={x} cy={y} r="2.8" fill="#FFFBE6" style={{ animationDelay: `${d}s`, filter: `drop-shadow(0 0 4px ${color})` }}/>
          ))}
        </svg>
      )}
      <svg aria-hidden="true" viewBox={`0 0 ${VB} ${VB}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
        <circle className="sr-arc" cx={VB / 2} cy={VB / 2} r={R} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={(1 - p) * CIRC} transform={`rotate(-90 ${VB / 2} ${VB / 2})`}
          style={{ filter: `drop-shadow(0 0 7px ${color})`, opacity: paused ? 0.45 : 1, ...(arcTransition ? { transition: arcTransition } : null) }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {children || (<>
        <div role={timer ? 'timer' : undefined} aria-label={label} className="sr-time" style={{
          fontWeight: 700, fontFamily: HEAD, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 16px ${color}`, opacity: paused ? 0.7 : 1, ...(timeSize ? { fontSize: timeSize } : null),
        }}>{time}</div>
        {call ? (
          <div style={{ font: `800 17px ${HEAD}`, letterSpacing: '0.1em', color: GOLD, textTransform: 'uppercase', textShadow: '0 0 12px rgba(253,224,71,0.5)' }}>{call}</div>
        ) : word ? (
          <div style={{ font: `700 12px ${HEAD}`, letterSpacing: '0.16em', color: paused ? GOLD : color, whiteSpace: 'nowrap' }}>{word}</div>
        ) : null}
        </>)}
      </div>
    </div>
  );
}
