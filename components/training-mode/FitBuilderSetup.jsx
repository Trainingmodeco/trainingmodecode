import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { ChevronLeft, Home } from 'lucide-react';
import { C } from './Styles';
import CardioFinisherSetup from './CardioFinisherSetup';
import TrainingCTA from './shared/TrainingCTA';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ProgressionNudgeCard from './shared/ProgressionNudgeCard';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { loadRoutines, deleteRoutine } from './data/savedRoutines';

// Workout Builder — pixel match of design 11a ("streamlined manual"):
// TYPE segmented · TARGET MUSCLES chip grid + two body maps · EQUIPMENT ·
// DIFFICULTY · ADD CARDIO banner · sticky GENERATE with a summary line.
const GOLD = C.gold;

// 7 design chips -> the app's granular muscle groups (fed to the generator).
const CHIPS = [
  { id: 'CHEST', groups: ['Chest'] },
  { id: 'BACK', groups: ['Back'] },
  { id: 'SHOULDERS', groups: ['Shoulders'] },
  { id: 'ARMS', groups: ['Biceps', 'Triceps'] },
  { id: 'CORE', groups: ['Core'] },
  { id: 'LEGS', groups: ['Quads', 'Hamstrings'] },
  { id: 'GLUTES', groups: ['Glutes'], span2: true },
];
// CARDIO removed from the builder — it only jumped out to the dedicated
// Cardio Mode (reachable from its own Fit-hub banner) and collapsed the
// screen. STRENGTH vs HYBRID still generate genuinely different workouts.
const TYPES = [
  { id: 'STRENGTH', focus: 'Strength' },
  { id: 'HYBRID', focus: 'Hybrid' },
];
const EQUIPMENT = ['BODYWEIGHT', 'WEIGHTED', 'HYBRID'];
const DIFFICULTY = ['EASY', 'NORMAL', 'HARD'];

const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();

// 38b — set schemes applied to every weighted lift in the generated workout.
// AUTO keeps the generator's own numbers; Custom opens numeric inputs.
const SET_SCHEMES = [
  { id: 'auto', label: 'AUTO', sub: 'Generator' },
  { id: '3x10', label: '3×10', sub: 'Hypertrophy', sets: 3, reps: 10, restSeconds: 60 },
  { id: '5x5', label: '5×5', sub: 'Strength', sets: 5, reps: 5, restSeconds: 90 },
  { id: '4x8', label: '4×8', sub: 'Build', sets: 4, reps: 8, restSeconds: 75 },
  { id: '3x15', label: '3×15', sub: 'Endurance', sets: 3, reps: 15, restSeconds: 45 },
  { id: 'custom', label: 'CUSTOM', sub: '✎' },
];

// 38b — popular program shortcuts over the existing generator. Split programs
// rotate their day each tap (counter in localStorage) so "3-day" means it.
const ALL_CHIP_IDS = ['CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'CORE', 'LEGS', 'GLUTES'];
const PROGRAMS = [
  { id: 'fullbody', title: 'FULL BODY', meta: 'All groups · 3×10 · ~40 min', scheme: { id: '3x10', sets: 3, reps: 10, restSeconds: 60 }, duration: 40, days: [{ label: '', chips: ALL_CHIP_IDS }] },
  { id: 'ppl', title: 'PUSH / PULL / LEGS', meta: '3-day · 4×8', rotateKey: 'tm_prog_ppl', scheme: { id: '4x8', sets: 4, reps: 8, restSeconds: 75 }, duration: 35,
    days: [{ label: 'PUSH', chips: ['CHEST', 'SHOULDERS', 'ARMS'] }, { label: 'PULL', chips: ['BACK', 'ARMS'] }, { label: 'LEGS', chips: ['LEGS', 'GLUTES', 'CORE'] }] },
  { id: 'ul', title: 'UPPER / LOWER', meta: '2-day · 5×5', rotateKey: 'tm_prog_ul', scheme: { id: '5x5', sets: 5, reps: 5, restSeconds: 90 }, duration: 35,
    days: [{ label: 'UPPER', chips: ['CHEST', 'BACK', 'SHOULDERS', 'ARMS'] }, { label: 'LOWER', chips: ['LEGS', 'GLUTES', 'CORE'] }] },
  { id: 'bro', title: 'BRO SPLIT', meta: '1 group/day · 4×10', rotateKey: 'tm_prog_bro', scheme: { id: '4x10', sets: 4, reps: 10, restSeconds: 60 }, duration: 30,
    days: [{ label: 'CHEST', chips: ['CHEST'] }, { label: 'BACK', chips: ['BACK'] }, { label: 'SHOULDERS', chips: ['SHOULDERS'] }, { label: 'ARMS', chips: ['ARMS'] }, { label: 'LEGS', chips: ['LEGS'] }] },
];

const programDayIndex = (p) => {
  if (!p.rotateKey) return 0;
  try { return (parseInt(localStorage.getItem(p.rotateKey), 10) || 0) % p.days.length; } catch { return 0; }
};

// Glow spots per muscle chip, as %-of-figure coordinates on the front/back
// anatomy (the 450x600 body maps place the figure centred in-frame). Same
// layout works for the male and female art. Bilateral muscles get two spots.
const GLOW_MAP = {
  CHEST:     { front: [[42, 30], [58, 30]], back: [] },
  BACK:      { front: [], back: [[42, 33], [58, 33], [50, 44]] },
  SHOULDERS: { front: [[32, 25], [68, 25]], back: [[33, 26], [67, 26]] },
  ARMS:      { front: [[25, 40], [75, 40]], back: [[26, 41], [74, 41]] },
  CORE:      { front: [[50, 45]], back: [[50, 47]] },
  LEGS:      { front: [[43, 65], [57, 65]], back: [[43, 66], [57, 66]] },
  GLUTES:    { front: [], back: [[43, 55], [57, 55]] },
};

const bodymapCSS = `
@keyframes bm-glow {
  0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.9); }
  50%      { opacity: 1;    transform: translate(-50%, -50%) scale(1.12); }
}
`;

function MuscleGlow({ x, y }) {
  return (
    <span aria-hidden style={{
      position: 'absolute', left: `${x}%`, top: `${y}%`,
      width: 22, height: 27, borderRadius: '50%',
      background: 'radial-gradient(ellipse, rgba(253,224,71,0.95) 0%, rgba(253,224,71,0.4) 45%, transparent 72%)',
      filter: 'blur(0.5px)', mixBlendMode: 'screen', pointerEvents: 'none',
      animation: 'bm-glow 1.8s ease-in-out infinite',
    }}/>
  );
}

function Segmented({ options, value, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 7 }}>
      {options.map(o => {
        const active = o === value;
        return (
          <button key={o} onClick={() => onPick(o)} style={{
            flex: 1, textAlign: 'center', font: "800 9px 'Orbitron',sans-serif", padding: '9px 0', borderRadius: 8, cursor: 'pointer',
            color: active ? '#0a0014' : '#d9d1ef', background: active ? GOLD : 'rgba(16,4,30,0.8)', border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
          }}>{o}</button>
        );
      })}
    </div>
  );
}

export default function FitBuilderSetup({ onBack, onHome, onGenerate, onCardioOnly, profileSex }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [type, setType] = useState('STRENGTH');
  const [chips, setChips] = useState(['CHEST', 'BACK']);
  const [equipment, setEquipment] = useState('BODYWEIGHT');
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  const [routines, setRoutines] = useState(() => loadRoutines());
  const [schemeId, setSchemeId] = useState('auto');
  const [customScheme, setCustomScheme] = useState({ sets: 4, reps: 10, restSeconds: 60 });

  // Resolve the selected chip into the config's setScheme (null = generator).
  const resolveScheme = () => {
    if (schemeId === 'auto') return null;
    if (schemeId === 'custom') return { id: 'custom', ...customScheme };
    const s = SET_SCHEMES.find(x => x.id === schemeId);
    return s ? { id: s.id, sets: s.sets, reps: s.reps, restSeconds: s.restSeconds } : null;
  };

  const sex = String(profileSex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const isCardio = type === 'CARDIO';

  const toggleChip = (id) => setChips(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const summary = () => {
    const parts = [];
    if (!isCardio) parts.push(chips.length ? chips.map(cap).join(', ') : 'Full body');
    parts.push(cap(equipment), cap(difficulty));
    if (cardioAddon) parts.push('+Cardio');
    return parts.join(' · ');
  };

  const generate = () => {
    if (isCardio) { onCardioOnly?.(); return; }
    const muscleGroups = chips.flatMap(id => CHIPS.find(c => c.id === id)?.groups || []);
    if (!muscleGroups.length) return;
    onGenerate?.({ muscleGroups, equipment: cap(equipment), difficulty: cap(difficulty), focus: TYPES.find(t => t.id === type)?.focus || 'Strength', duration: 30, cardioAddon, addCardio: false, setScheme: resolveScheme() });
  };

  // 38b — program shortcut: pre-fill targets + scheme + duration, advance the
  // split's day counter, and route straight to Generate. Still goes through
  // the normal generator with focus + setScheme in the config.
  const launchProgram = (p) => {
    const dayIdx = programDayIndex(p);
    const day = p.days[dayIdx];
    const muscleGroups = day.chips.flatMap(id => CHIPS.find(c => c.id === id)?.groups || []);
    if (p.rotateKey) { try { localStorage.setItem(p.rotateKey, String(dayIdx + 1)); } catch { /* noop */ } }
    onGenerate?.({ muscleGroups, equipment: cap(equipment), difficulty: cap(difficulty), focus: 'Strength', duration: p.duration, cardioAddon, addCardio: false, setScheme: p.scheme });
  };

  const Label = ({ children, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
      <span style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em' }}>{children}</span>
      {right}
    </div>
  );

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: bodymapCSS }}/>
      <Embers count={2}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 8px' }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><ChevronLeft size={20}/></button>
          <div style={{ flex: 1 }}>
            <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#facc15', letterSpacing: '0.06em' }}>WORKOUT BUILDER</div>
            <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8' }}>Target muscles, pick gear, generate.</div>
          </div>
          <HelpButton onClick={() => setHelpOpen(true)}/>
          <button onClick={onHome || onBack} aria-label="Home" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><Home size={17}/></button>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2px 14px', paddingBottom: 'calc(96px + env(safe-area-inset-bottom,0px))' }}>
          <ProgressionNudgeCard lane="strength"/>
          {/* TYPE */}
          <div data-guide="wb-type" style={{ display: 'flex', gap: 6, background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10, padding: 4, marginBottom: 13 }}>
            {TYPES.map(t => {
              const active = t.id === type;
              return (
                <button key={t.id} onClick={() => setType(t.id)} style={{ flex: 1, textAlign: 'center', font: "800 9px 'Orbitron',sans-serif", color: active ? '#0a0014' : '#c4a4d8', background: active ? GOLD : 'transparent', border: 'none', borderRadius: 7, padding: '7px 0', cursor: 'pointer' }}>{t.id}</button>
              );
            })}
          </div>

          {!isCardio && (
            <>
              {/* TARGET MUSCLES */}
              <div data-guide="wb-muscles">
              <Label right={<span style={{ font: "800 8px 'Orbitron',sans-serif", color: GOLD }}>{chips.length} SELECTED</span>}>TARGET MUSCLES</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
                {CHIPS.map(c => {
                  const active = chips.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggleChip(c.id)} style={{
                      gridColumn: c.span2 ? 'span 2' : undefined, textAlign: 'center', font: "800 8px 'Orbitron',sans-serif", padding: '7px 2px', borderRadius: 7, cursor: 'pointer',
                      color: active ? '#0a0014' : '#d9d1ef', background: active ? GOLD : 'rgba(16,4,30,0.8)', border: active ? 'none' : '1px solid rgba(168,85,247,0.3)', boxShadow: active ? '0 0 8px rgba(253,224,71,.4)' : 'none',
                    }}>{c.id}</button>
                  );
                })}
              </div>
              {/* Body maps — selected muscle chips light up the anatomy */}
              <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
                {['front', 'back'].map(v => {
                  const spots = chips.flatMap(id => GLOW_MAP[id]?.[v] || []);
                  return (
                    <div key={v} style={{ flex: 1, position: 'relative', borderRadius: 11, overflow: 'hidden', border: '1px solid rgba(34,211,238,0.3)', background: '#050010', display: 'flex', justifyContent: 'center' }}>
                      {/* Figure box — glows are positioned relative to the image itself */}
                      <div style={{ position: 'relative', height: 168 }}>
                        <SafeImage src={`/static/bodymap/${sex}-${v}.webp`} alt={v} style={{ height: 168, width: 'auto', objectFit: 'contain', display: 'block' }}/>
                        {spots.map(([x, y], i) => <MuscleGlow key={i} x={x} y={y}/>)}
                      </div>
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', font: "800 7px 'Orbitron',sans-serif", color: '#5fd0e0', letterSpacing: '0.16em', background: 'linear-gradient(0deg,rgba(8,1,15,.9),transparent)', padding: '5px 0 3px' }}>{v.toUpperCase()}</div>
                    </div>
                  );
                })}
              </div>
              </div>
            </>
          )}

          {/* EQUIPMENT */}
          <div data-guide="wb-equipment">
          <Label>EQUIPMENT</Label>
          <div style={{ marginBottom: 13 }}><Segmented options={EQUIPMENT} value={equipment} onPick={setEquipment}/></div>
          </div>

          {/* DIFFICULTY */}
          <div data-guide="wb-difficulty">
          <Label>DIFFICULTY</Label>
          <div style={{ marginBottom: 13 }}><Segmented options={DIFFICULTY} value={difficulty} onPick={setDifficulty}/></div>
          </div>

          {/* 38b — SET SCHEME: one scrollable chip row for all weighted lifts */}
          {!isCardio && (
            <>
              <Label right={<span style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8' }}>weighted lifts</span>}>SET SCHEME</Label>
              <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: schemeId === 'custom' ? 8 : 13 }}>
                {SET_SCHEMES.map(s => {
                  const active = s.id === schemeId;
                  return (
                    <button key={s.id} onClick={() => setSchemeId(s.id)} style={{
                      flexShrink: 0, padding: '7px 11px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                      background: active ? GOLD : 'rgba(16,4,30,0.8)',
                      border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
                      boxShadow: active ? '0 0 8px rgba(253,224,71,.4)' : 'none',
                    }}>
                      <div style={{ font: "800 10px 'Orbitron',sans-serif", color: active ? '#0a0014' : '#fff', letterSpacing: '0.04em' }}>{s.label}</div>
                      <div style={{ font: "600 7.5px 'Rajdhani',sans-serif", color: active ? 'rgba(10,0,20,0.7)' : '#9a90b8', marginTop: 1 }}>{s.sub}</div>
                    </button>
                  );
                })}
              </div>
              {schemeId === 'custom' && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 13 }}>
                  {[['SETS', 'sets', 1, 8], ['REPS', 'reps', 1, 50], ['REST s', 'restSeconds', 15, 300]].map(([lab, key, min, max]) => (
                    <div key={key} style={{ flex: 1 }}>
                      <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.14em', marginBottom: 3 }}>{lab}</div>
                      <input type="number" inputMode="numeric" value={customScheme[key]}
                        onChange={e => { const n = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min)); setCustomScheme(cs => ({ ...cs, [key]: n })); }}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 6px', textAlign: 'center', borderRadius: 8, background: 'rgba(16,4,30,0.85)', border: '1px solid rgba(168,85,247,0.35)', color: '#fff', font: "800 13px 'Orbitron',sans-serif", outline: 'none' }}/>
                    </div>
                  ))}
                </div>
              )}

              {/* 38b — POPULAR PROGRAMS: 4 thin shortcut rows over the generator */}
              <Label>POPULAR PROGRAMS</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
                {PROGRAMS.map(p => {
                  const day = p.days[programDayIndex(p)];
                  return (
                    <button key={p.id} onClick={() => launchProgram(p)} style={{
                      display: 'flex', alignItems: 'center', gap: 9, borderRadius: 9, padding: '8px 11px', cursor: 'pointer', textAlign: 'left',
                      background: 'rgba(16,4,30,0.8)', border: '1px solid rgba(168,85,247,0.28)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ font: "800 9.5px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.05em' }}>{p.title}</span>
                        {day.label ? <span style={{ font: "800 8px 'Orbitron',sans-serif", color: GOLD, marginLeft: 7 }}>· TODAY: {day.label}</span> : null}
                        <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 1 }}>{p.meta}</div>
                      </div>
                      <span style={{ font: "900 12px 'Orbitron',sans-serif", color: '#b06aff', flexShrink: 0 }}>›</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ADD CARDIO */}
          <div data-guide="wb-cardio">
          <button onClick={() => setCardioSheetOpen(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 11, border: '1px solid rgba(253,224,71,0.4)', background: 'linear-gradient(90deg,rgba(253,224,71,0.08),rgba(168,85,247,0.06))', padding: '11px 13px', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>❤</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: "800 11px 'Orbitron',sans-serif", color: GOLD }}>{cardioAddon ? 'CARDIO FINISHER ADDED' : 'ADD CARDIO'}</div>
              <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 1 }}>{cardioAddon ? `${cardioAddon.method || 'Cardio'}` : 'Tack on a run, intervals, or Tabata finisher'}</div>
            </div>
            <span style={{ font: "900 15px 'Orbitron',sans-serif", color: GOLD }}>›</span>
          </button>
          </div>

          {/* Saved routines — load a named workout exactly as it was saved */}
          {!isCardio && routines.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <Label>SAVED ROUTINES</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {routines.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: '1px solid rgba(253,224,71,0.3)', background: 'rgba(16,4,30,0.8)', padding: '9px 11px' }}>
                    <button onClick={() => onGenerate?.({ ...r.cfg, savedExercises: r.exercises })} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                      <div style={{ font: "800 10px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔖 {r.name.toUpperCase()}</div>
                      <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 1 }}>{r.exercises?.length || 0} exercises · {r.cfg?.equipment || ''} · {r.cfg?.difficulty || ''}</div>
                    </button>
                    <button onClick={() => setRoutines(list => { deleteRoutine(r.id); return list.filter(x => x.id !== r.id); })} aria-label={`Delete ${r.name}`}
                      style={{ width: 26, height: 26, borderRadius: 6, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', font: "700 11px 'Rajdhani',sans-serif", flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate — inline, right under Add Cardio so it's never hidden */}
          <div style={{ textAlign: 'center', font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8', margin: '18px 0 8px' }}>{summary()}</div>
          <div data-guide="wb-generate">
          <TrainingCTA variant="gold" label={isCardio ? 'START CARDIO' : 'GENERATE WORKOUT'} icon={isCardio ? '❤' : '⚙'} height={48} onClick={generate} style={{ fontSize: 13.5, letterSpacing: '0.06em' }}/>
          </div>
        </div>
      </div>

      {cardioSheetOpen && (
        <CardioFinisherSetup
          initialAddon={cardioAddon}
          sourceMode="Workout Builder"
          onSave={(addon) => { setCardioAddon(addon); setCardioSheetOpen(false); }}
          onClose={() => setCardioSheetOpen(false)}
        />
      )}
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.workout_builder} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
