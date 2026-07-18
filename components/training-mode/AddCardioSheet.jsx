import { useState } from 'react';

// Add Cardio — design 38 "generate and program". A centered modal card that
// opens with ONE ready-to-go cardio finisher already generated (no decisions
// required), a ↻ regenerate reroll, and a collapsed ⚙ CUSTOMIZE section for
// overrides. Shared verbatim by Workout Builder, Quick Mission, and Combat
// Conditioning — the caller passes its context so the generator can bias
// (harder strength session → easier cardio; keep total time reasonable).
// Emits the same cardioAddon config the existing finisher pipeline plays.
const ORANGE = '#ff8a4a';
const GOLD = '#fde047';

// The common finisher pool. paceKm = minutes per km at each intensity, used
// to derive a distance target from the chosen duration.
const POOL = [
  { id: 'outdoor-run', word: 'RUN', icon: '🏃', label: 'Outdoor Run',
    detail: { easy: 'Outdoor GPS · easy pace', moderate: 'Outdoor GPS · easy-moderate pace', hard: 'Outdoor GPS · strong pace' },
    paceKm: { easy: 7.5, moderate: 6.5, hard: 5.5 } },
  { id: 'bike', word: 'BIKE', icon: '🚴', label: 'Bike',
    detail: { easy: 'Stationary bike · easy spin', moderate: 'Stationary bike · steady spin', hard: 'Stationary bike · hard spin' },
    paceKm: { easy: 3, moderate: 2.5, hard: 2.2 } },
  { id: 'treadmill', word: 'TREADMILL', icon: '🎽', label: 'Treadmill',
    detail: { easy: 'Treadmill · easy pace', moderate: 'Treadmill · steady pace', hard: 'Treadmill · strong pace' },
    paceKm: { easy: 7.5, moderate: 6.5, hard: 5.5 } },
  { id: 'walk', word: 'WALK', icon: '🚶', label: 'Walk',
    detail: { easy: 'Outdoor GPS · relaxed walk', moderate: 'Outdoor GPS · brisk walk', hard: 'Outdoor GPS · power walk' },
    paceKm: { easy: 12, moderate: 10.5, hard: 9 } },
];
const GOALS = [{ id: 'time', label: 'TIME' }, { id: 'distance', label: 'DISTANCE' }, { id: 'intervals', label: 'INTERVALS' }];
const INTENSITIES = ['easy', 'moderate', 'hard'];

const poolType = (id) => POOL.find(t => t.id === id) || POOL[0];
const round1 = (n) => Math.round(n * 10) / 10;

function weightedPick(weights) {
  const entries = Object.entries(weights);
  let total = entries.reduce((a, [, w]) => a + w, 0);
  let roll = Math.random() * total;
  for (const [id, w] of entries) { roll -= w; if (roll <= 0) return id; }
  return entries[0][0];
}

// One roll of the generator. Bias: a harder main session pairs with easier,
// shorter cardio; a light one can carry a real run. avoid = previous roll so
// REGENERATE always visibly changes something.
function generateRoutine(context, avoid) {
  const diff = String(context?.difficulty || 'Normal').toLowerCase();
  const mainMin = context?.durationMin || 30;
  const weights = diff === 'hard'
    ? { walk: 3, bike: 3, treadmill: 2, 'outdoor-run': 1 }
    : diff === 'easy'
      ? { 'outdoor-run': 3, treadmill: 2, bike: 2, walk: 1 }
      : { 'outdoor-run': 2, bike: 2, treadmill: 2, walk: 2 };
  const budget = mainMin >= 40 ? [10, 15] : mainMin >= 25 ? [10, 15, 20] : [15, 20, 30];
  const durations = diff === 'hard' ? budget.slice(0, 2) : budget;
  for (let i = 0; i < 8; i++) {
    const typeId = weightedPick(weights);
    const durationMin = durations[Math.floor(Math.random() * durations.length)];
    if (!avoid || avoid.typeId !== typeId || avoid.durationMin !== durationMin) {
      const intensity = diff === 'hard' ? 'easy' : diff === 'easy' ? 'moderate' : (Math.random() < 0.5 ? 'easy' : 'moderate');
      return { typeId, durationMin, goal: 'time', intensity, generated: true };
    }
  }
  return { typeId: 'bike', durationMin: 10, goal: 'time', intensity: 'easy', generated: true };
}

// Reopen with an addon this sheet built earlier → resume its exact state.
function seedFromAddon(addon, context) {
  if (!addon) return generateRoutine(context);
  const known = POOL.some(t => t.id === addon.cardioType);
  return {
    typeId: known ? addon.cardioType : 'outdoor-run',
    durationMin: addon.durationMin || Math.max(5, Math.round((addon.targetTimeSeconds || 600) / 60)),
    goal: addon.goal || (addon.targetType === 'distance' ? 'distance' : addon.style === 'intervals' ? 'intervals' : 'time'),
    intensity: INTENSITIES.includes(addon.intensity) ? addon.intensity : 'moderate',
    generated: addon.generated === true,
  };
}

const chip = (active, color = ORANGE) => ({
  padding: '7px 0', borderRadius: 8, cursor: 'pointer', textAlign: 'center', flex: 1,
  font: "800 8.5px 'Orbitron',sans-serif", letterSpacing: '0.05em',
  color: active ? '#0a0014' : '#d9d1ef',
  background: active ? color : 'rgba(16,4,30,0.8)',
  border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
  boxShadow: active ? `0 0 8px ${color}66` : 'none',
});

export default function AddCardioSheet({ context, initialAddon, onAdd, onClose }) {
  const [routine, setRoutine] = useState(() => seedFromAddon(initialAddon, context));
  const [customOpen, setCustomOpen] = useState(false);

  const t = poolType(routine.typeId);
  const { durationMin, goal, intensity } = routine;
  const distanceKm = round1(durationMin / t.paceKm[intensity]);
  const workSec = intensity === 'easy' ? 30 : 45;
  const restSec = intensity === 'easy' ? 60 : intensity === 'moderate' ? 45 : 30;
  const rounds = Math.max(4, Math.round((durationMin * 60) / (workSec + restSec)));
  const bonusXp = 20 + durationMin * 5 + 40; // cardio session XP + hybrid training bonus

  const title = goal === 'distance' ? `${distanceKm} KM ${t.word}` : `${durationMin}-MIN ${t.word}`;
  const detail = goal === 'intervals' ? `${t.label} · ${rounds} rounds of ${workSec}s on / ${restSec}s off` : t.detail[intensity];
  const targetLabel = goal === 'distance' ? `${distanceKm} KM` : '—';

  // Any manual edit flips the routine from "generated" to "custom".
  const edit = (patch) => setRoutine(r => ({ ...r, ...patch, generated: false }));
  const regenerate = () => setRoutine(r => generateRoutine(context, r));

  const buildAddon = () => ({
    enabled: true,
    sourceMode: context?.source || 'Workout Builder',
    placement: 'finisher',
    cardioType: t.id,
    cardioLabel: t.label,
    targetType: goal === 'distance' ? 'distance' : 'time',
    targetTimeSeconds: durationMin * 60,
    targetDistance: goal === 'distance' ? distanceKm : null,
    distanceUnit: 'km',
    paceTargetSeconds: null,
    paceTargetLabel: null,
    style: goal === 'intervals' ? 'intervals' : 'steady',
    intervals: goal === 'intervals' ? { easySeconds: restSec, fastSeconds: workSec, rounds } : null,
    randomSurges: false,
    bonusEligible: true,
    // design-38 extras (customize state + promised bonus)
    goal, intensity, durationMin, generated: routine.generated, bonusXp,
  });

  const label = { font: "700 7.5px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em', marginBottom: 6 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(8,2,18,0.6)' }}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', left: 16, right: 16, top: '50%', transform: 'translateY(-50%)',
        maxWidth: 400, margin: '0 auto', maxHeight: '88dvh', display: 'flex', flexDirection: 'column',
        borderRadius: 22, border: '1.5px solid rgba(255,138,74,0.45)',
        background: 'linear-gradient(180deg, rgba(24,10,18,0.82), rgba(10,4,22,0.82))',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 0 44px rgba(255,138,74,0.16), 0 24px 60px rgba(0,0,0,0.6)',
      }}>
        <div className="no-scrollbar" style={{ overflowY: 'auto', padding: '16px 16px 14px' }}>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ font: "700 8px 'Press Start 2P',monospace", color: ORANGE, letterSpacing: '0.14em' }}>◈ CARDIO FINISHER</span>
            <span style={{ font: "700 8px 'Orbitron',sans-serif", color: routine.generated ? '#9a90b8' : GOLD, letterSpacing: '0.12em' }}>{routine.generated ? 'GENERATED' : 'CUSTOM'}</span>
          </div>

          {/* Generated routine card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'rgba(255,138,74,0.12)', border: '1px solid rgba(255,138,74,0.4)' }}>{t.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "900 18px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.03em' }}>{title}</div>
              <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 2 }}>{detail}</div>
            </div>
          </div>

          {/* 3-stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 12 }}>
            {[['TIME', `${durationMin} MIN`, '#fff'], ['TARGET', targetLabel, '#fff'], ['BONUS XP', `+${bonusXp}`, GOLD]].map(([lab, val, color]) => (
              <div key={lab} style={{ background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ font: "900 13px 'Orbitron',sans-serif", color }}>{val}</div>
                <div style={{ font: "600 6.5px 'Orbitron',sans-serif", color: '#9a90b8', letterSpacing: '0.1em', marginTop: 2 }}>{lab}</div>
              </div>
            ))}
          </div>

          {/* Regenerate */}
          <button onClick={regenerate} style={{ width: '100%', padding: '10px 0', borderRadius: 10, cursor: 'pointer', background: 'rgba(176,106,255,0.1)', border: '1px solid rgba(176,106,255,0.4)', color: '#c9a6ff', font: "800 10px 'Orbitron',sans-serif", letterSpacing: '0.1em', marginBottom: 10 }}>↻ REGENERATE CARDIO</button>

          {/* Customize — progressive disclosure */}
          <button onClick={() => setCustomOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderRadius: 10, cursor: 'pointer', background: 'rgba(16,4,30,0.6)', border: '1px solid rgba(168,85,247,0.25)', marginBottom: customOpen ? 10 : 12 }}>
            <span style={{ font: "800 9px 'Orbitron',sans-serif", color: '#d9d1ef', letterSpacing: '0.1em' }}>⚙ CUSTOMIZE</span>
            <span style={{ font: "900 11px 'Orbitron',sans-serif", color: '#b06aff' }}>{customOpen ? '▴' : '▾'}</span>
          </button>

          {customOpen && (
            <div style={{ marginBottom: 12 }}>
              <div style={label}>TYPE</div>
              <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                {POOL.map(p => <button key={p.id} onClick={() => edit({ typeId: p.id })} style={{ ...chip(routine.typeId === p.id), fontSize: 7.5 }}>{p.word}</button>)}
              </div>
              <div style={label}>GOAL</div>
              <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                {GOALS.map(g => <button key={g.id} onClick={() => edit({ goal: g.id })} style={chip(goal === g.id)}>{g.label}</button>)}
              </div>
              <div style={label}>DURATION</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <button onClick={() => edit({ durationMin: Math.max(5, durationMin - 5) })} style={{ width: 36, height: 36, borderRadius: 9, cursor: 'pointer', background: 'rgba(16,4,30,0.8)', border: '1px solid rgba(168,85,247,0.35)', color: '#fff', font: "900 15px 'Orbitron',sans-serif" }}>−</button>
                <div style={{ flex: 1, textAlign: 'center', font: "900 17px 'Orbitron',sans-serif", color: '#fff' }}>{durationMin}<span style={{ fontSize: 9, color: ORANGE, marginLeft: 3 }}>MIN</span></div>
                <button onClick={() => edit({ durationMin: Math.min(60, durationMin + 5) })} style={{ width: 36, height: 36, borderRadius: 9, cursor: 'pointer', background: 'rgba(16,4,30,0.8)', border: '1px solid rgba(168,85,247,0.35)', color: '#fff', font: "900 15px 'Orbitron',sans-serif" }}>＋</button>
              </div>
              <div style={label}>INTENSITY</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {INTENSITIES.map(i => <button key={i} onClick={() => edit({ intensity: i })} style={chip(intensity === i)}>{i.toUpperCase()}</button>)}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '13px 0', borderRadius: 11, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: '#9a90b8', font: "800 10.5px 'Orbitron',sans-serif", letterSpacing: '0.1em' }}>SKIP</button>
            <button onClick={() => onAdd(buildAddon())} style={{ flex: 1.7, padding: '13px 0', borderRadius: 11, cursor: 'pointer', border: 'none', background: `linear-gradient(135deg, ${ORANGE}, #f4602a)`, color: '#180a06', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.08em', boxShadow: '0 0 18px rgba(255,138,74,0.35)' }}>✓ ADD TO WORKOUT</button>
          </div>
        </div>
      </div>
    </div>
  );
}
