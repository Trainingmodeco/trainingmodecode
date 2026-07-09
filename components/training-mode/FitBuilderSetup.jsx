import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { ChevronLeft, Home } from 'lucide-react';
import { C } from './Styles';
import CardioFinisherSetup from './CardioFinisherSetup';

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
const TYPES = [
  { id: 'STRENGTH', focus: 'Strength' },
  { id: 'HYBRID', focus: 'Hybrid' },
  { id: 'CARDIO', focus: 'Cardio Only' },
];
const EQUIPMENT = ['BODYWEIGHT', 'WEIGHTED', 'HYBRID'];
const DIFFICULTY = ['EASY', 'NORMAL', 'HARD'];

const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();

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
  const [type, setType] = useState('STRENGTH');
  const [chips, setChips] = useState(['CHEST', 'BACK']);
  const [equipment, setEquipment] = useState('BODYWEIGHT');
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);

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
    onGenerate?.({ muscleGroups, equipment: cap(equipment), difficulty: cap(difficulty), focus: TYPES.find(t => t.id === type)?.focus || 'Strength', duration: 30, cardioAddon, addCardio: false });
  };

  const Label = ({ children, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
      <span style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em' }}>{children}</span>
      {right}
    </div>
  );

  return (
    <PhoneFrame useBrandBg>
      <Embers count={2}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 8px' }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><ChevronLeft size={20}/></button>
          <div style={{ flex: 1 }}>
            <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#facc15', letterSpacing: '0.06em' }}>WORKOUT BUILDER</div>
            <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8' }}>Target muscles, pick gear, generate.</div>
          </div>
          <button onClick={onHome || onBack} aria-label="Home" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><Home size={17}/></button>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2px 14px', paddingBottom: 'calc(140px + env(safe-area-inset-bottom,0px))' }}>
          {/* TYPE */}
          <div style={{ display: 'flex', gap: 6, background: 'rgba(8,2,18,0.7)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10, padding: 4, marginBottom: 13 }}>
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
              {/* Body maps */}
              <div style={{ display: 'flex', gap: 9, marginBottom: 14 }}>
                {['front', 'back'].map(v => (
                  <div key={v} style={{ flex: 1, position: 'relative', borderRadius: 11, overflow: 'hidden', border: '1px solid rgba(34,211,238,0.3)', background: '#050010' }}>
                    <SafeImage src={`/static/bodymap/${sex}-${v}.webp`} alt={v} style={{ width: '100%', display: 'block' }}/>
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', font: "800 7px 'Orbitron',sans-serif", color: '#5fd0e0', letterSpacing: '0.16em', background: 'linear-gradient(0deg,rgba(8,1,15,.9),transparent)', padding: '5px 0 3px' }}>{v.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* EQUIPMENT */}
          <Label>EQUIPMENT</Label>
          <div style={{ marginBottom: 13 }}><Segmented options={EQUIPMENT} value={equipment} onPick={setEquipment}/></div>

          {/* DIFFICULTY */}
          <Label>DIFFICULTY</Label>
          <div style={{ marginBottom: 13 }}><Segmented options={DIFFICULTY} value={difficulty} onPick={setDifficulty}/></div>

          {/* ADD CARDIO */}
          <button onClick={() => setCardioSheetOpen(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 11, border: '1px solid rgba(253,224,71,0.4)', background: 'linear-gradient(90deg,rgba(253,224,71,0.08),rgba(168,85,247,0.06))', padding: '11px 13px', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>❤</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: "800 11px 'Orbitron',sans-serif", color: GOLD }}>{cardioAddon ? 'CARDIO FINISHER ADDED' : 'ADD CARDIO'}</div>
              <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 1 }}>{cardioAddon ? `${cardioAddon.method || 'Cardio'}` : 'Tack on a run, intervals, or Tabata finisher'}</div>
            </div>
            <span style={{ font: "900 15px 'Orbitron',sans-serif", color: GOLD }}>›</span>
          </button>
        </div>

        {/* Sticky GENERATE */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 14px calc(14px + env(safe-area-inset-bottom,0px))', background: 'linear-gradient(0deg,#080012 70%,transparent)' }}>
          <button onClick={generate} style={{ width: '100%', height: 54, border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', cursor: 'pointer', boxShadow: '0 0 22px rgba(253,224,71,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <span style={{ font: "900 14px 'Orbitron',sans-serif", letterSpacing: '0.06em' }}>{isCardio ? '❤ START CARDIO' : '⚙ GENERATE WORKOUT'}</span>
            {!isCardio && <span style={{ font: "600 8px 'Rajdhani',sans-serif", opacity: 0.75 }}>{summary()}</span>}
          </button>
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
    </PhoneFrame>
  );
}
