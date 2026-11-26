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
// The streaks' glow: pale electric blue on the gold work phase (white lightning on a golden aura), the phase's own colour otherwise.
const GLOW = (c) => (c === RING_COLORS.work ? '#9fd8ff' : c);

const CHARGE_CSS = `
@keyframes rr-glow { 0% { filter: drop-shadow(0 0 6px var(--rr-c)) drop-shadow(0 0 2px #fff); opacity: .3 } 100% { filter: drop-shadow(0 0 20px var(--rr-c)) drop-shadow(0 0 6px #fff); opacity: .46 } }
@keyframes rr-aura { 0% { opacity: .35; transform: translate(-50%, -50%) scale(.92) } 100% { opacity: .85; transform: translate(-50%, -50%) scale(1.1) } }
@keyframes rr-s1 { 0%, 5% { opacity: 0 } 6%, 11% { opacity: 1 } 12%, 18% { opacity: 0 } 19%, 23% { opacity: .9 } 24%, 100% { opacity: 0 } }
@keyframes rr-s2 { 0%, 38% { opacity: 0 } 39%, 45% { opacity: 1 } 46%, 52% { opacity: 0 } 53%, 57% { opacity: .85 } 58%, 100% { opacity: 0 } }
@keyframes rr-s3 { 0%, 66% { opacity: 0 } 67%, 74% { opacity: 1 } 75%, 80% { opacity: 0 } 81%, 85% { opacity: .9 } 86%, 100% { opacity: 0 } }
@keyframes rr-s4 { 0%, 20% { opacity: 0 } 21%, 26% { opacity: 1 } 27%, 33% { opacity: .2 } 34%, 38% { opacity: 1 } 39%, 100% { opacity: 0 } }
@keyframes rr-s5 { 0%, 52% { opacity: 0 } 53%, 58% { opacity: 1 } 59%, 65% { opacity: 0 } 66%, 70% { opacity: 1 } 71%, 100% { opacity: 0 } }
@keyframes rr-spark { 0% { opacity: 0; transform: translate(0, 0) scale(.5) } 30% { opacity: 1 } 100% { opacity: 0; transform: translate(var(--rr-dx), var(--rr-dy)) scale(1.2) } }
.rr-bolt-live { animation: rr-glow 1.05s ease-in-out infinite alternate; }
.rr-aura { animation: rr-aura 1.05s ease-in-out infinite alternate; }
.rr-streak { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.rr-set1 { animation: rr-s1 .95s linear infinite; }
.rr-set2 { animation: rr-s2 1.15s linear infinite .2s; }
.rr-set3 { animation: rr-s3 .8s linear infinite .45s; }
.rr-set4 { animation: rr-s4 1.3s linear infinite .1s; }
.rr-set5 { animation: rr-s5 1.05s linear infinite .6s; }
.rr-spark { transform-box: fill-box; transform-origin: center; animation: rr-spark .85s ease-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .rr-bolt-live, .rr-aura, .rr-spark { animation: none !important; }
  .rr-aura { opacity: .5; }
  .rr-set1, .rr-set2, .rr-set3, .rr-set4, .rr-set5 { animation: none !important; opacity: 0; }
  .rr-set1, .rr-set3 { opacity: .8 !important; }
  .rr-spark { opacity: .6; }
}
`;

// The bolt is drawn in a 100 x 160 box. Long white streaks shoot out from its
// edges like a charging Super Saiyan's lightning, five sets flashing at their own
// rhythms (white only: the owner took the yellow ones out, 2026-11-26).
const STREAK_SETS = [
  ['M39 47 L30 40 L33 33 L20 26 L24 18 L8 8 L12 -2', 'M30 40 L22 45 L12 41', 'M60 109 L72 108 L70 118 L86 120 L84 130 L102 134', 'M62 2 L58 -8 L66 -14 L60 -26'],
  ['M67 31 L78 27 L76 20 L92 14 L90 6 L108 -2', 'M78 27 L88 33 L100 29', 'M39 125 L28 124 L30 133 L14 134 L16 144 L-2 150', 'M32 158 L38 166 L32 172 L40 184'],
  ['M88 60 L98 52 L96 44 L112 36 L108 28 L124 20', 'M16 92 L6 86 L9 78 L-8 72 L-4 62 L-20 56', 'M98 52 L108 56 L118 50'],
  ['M52 25 L42 20 L45 12 L30 6 L32 -4', 'M72 85 L84 88 L82 98 L98 100 L96 110', 'M37 100 L26 104 L28 114 L12 116', 'M60 109 L70 118 L66 126 L80 132'],
  ['M70 2 L74 -10 L68 -16 L78 -28', 'M88 60 L100 64 L98 72 L114 74', 'M16 92 L8 100 L12 108 L-2 112', 'M50 70 L38 64 L40 56 L24 52'],
];
const SPARKS = [[62, 2, 0, -9, -16], [16, 92, .2, -16, 4], [88, 60, .45, 16, -6], [32, 158, .65, -6, 14], [78, 2, .3, 10, -14], [47, 92, .75, -14, 10], [56, 60, .5, 14, 6], [39, 47, .1, -12, -8]];

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
      {charged && (
        <div aria-hidden="true" className="rr-aura" style={{ position: 'absolute', left: '50%', top: '50%', width: '74%', height: '92%', transform: 'translate(-50%, -50%)', borderRadius: '50%', pointerEvents: 'none', background: `radial-gradient(ellipse at center, ${color}77 0%, ${color}2e 42%, transparent 70%)`, filter: 'blur(5px)' }}/>
      )}
      <svg aria-hidden="true" viewBox="0 0 100 160" className={charged ? 'rr-bolt-live' : undefined}
        style={{ ...boltPos, '--rr-c': color, opacity: boltOpacity, filter: `drop-shadow(0 0 8px ${color})`, transition: 'opacity .5s ease' }}>
        <polygon points="62,2 16,92 47,92 32,158 88,60 56,60 78,2" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="4" strokeLinejoin="round"/>
      </svg>
      {charged && (
        <svg aria-hidden="true" viewBox="0 0 100 160" data-run-charge="true" style={boltPos}>
          <g style={{ filter: `drop-shadow(0 0 3px ${GLOW(color)}) drop-shadow(0 0 8px ${GLOW(color)})` }}>
            {STREAK_SETS.map((list, i) => (
              <g key={i} className={`rr-set${i + 1}`} opacity="0">
                {list.map((dd) => (
                  <g key={dd}>
                    <path className="rr-streak" d={dd} stroke={GLOW(color)} strokeWidth="5.5" strokeOpacity="0.5"/>
                    <path className="rr-streak" d={dd} stroke="#FFFFFF" strokeWidth="2.3"/>
                  </g>
                ))}
              </g>
            ))}
          </g>
          {SPARKS.map(([x, y, dl, dx, dy]) => (
            <circle key={`${x}-${y}`} className="rr-spark" cx={x} cy={y} r="2.6" fill="#FFFFFF" style={{ '--rr-dx': `${dx}px`, '--rr-dy': `${dy}px`, animationDelay: `${dl}s`, filter: `drop-shadow(0 0 4px ${GLOW(color)})` }}/>
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
