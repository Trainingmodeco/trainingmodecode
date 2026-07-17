import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { ChevronLeft, Shuffle } from 'lucide-react';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { C } from './Styles';
import { CADENCE_PRESETS } from './shared/CadenceSlider';
import CardioFinisherSetup from './CardioFinisherSetup';
import TrainingCTA from './shared/TrainingCTA';

// Quick Mission — pixel match of design 14a ("one screen, one tap"):
// HOW LONG grid · FOCUS (optional) · INTENSITY · ADD CARDIO · sticky START.
// Plus the designer's "Surprise me" random quick-pick.
const GOLD = C.gold;
const VIOLET = '#b06aff';
const LENGTHS = [5, 10, 15, 20, 30];
const FOCI = ['FULL BODY', 'UPPER', 'LOWER', 'CORE', 'COMBAT'];
const INTENSITY = ['EASY', 'NORMAL', 'HARD'];
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default function QuickMissionSetup({ onBack, onHome, onStart, onCardioOnly }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [duration, setDuration] = useState(10);
  const [custom, setCustom] = useState(false);
  const [focus, setFocus] = useState('FULL BODY');
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  void onCardioOnly;

  const surprise = () => { setCustom(false); setDuration(rand(LENGTHS)); setFocus(rand(FOCI)); setDifficulty(rand(INTENSITY)); };

  const handleStart = () => {
    onStart?.({
      workoutType: 'Bodyweight', duration, difficulty: cap(difficulty),
      focus: focus === 'FULL BODY' ? 'Full Body' : cap(focus), format: 'Auto',
      cardioFinisher: false, cadenceCount: true, cadencePreset: 'moderate',
      cadenceMs: CADENCE_PRESETS.moderate, voiceOn: true, cardioAddon,
    });
  };

  const Label = ({ children, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ font: "600 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.18em' }}>{children}</span>
      {right}
    </div>
  );

  const chip = (active) => ({
    color: active ? '#0a0014' : '#d9d1ef', background: active ? GOLD : 'rgba(16,4,30,0.8)',
    border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
  });

  return (
    <PhoneFrame useBrandBg>
      <Embers count={3}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 8px' }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><ChevronLeft size={20}/></button>
          <div style={{ flex: 1 }}>
            <div style={{ font: "900 15px 'Orbitron',sans-serif", color: VIOLET, letterSpacing: '0.06em' }}>QUICK MISSION</div>
            <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8' }}>No planning. Pick time, train.</div>
          </div>
          <HelpButton onClick={() => setHelpOpen(true)}/>
          <SafeImage src="/static/timer-quick-purple.png" alt="" style={{ width: 46, height: 46, objectFit: 'contain', opacity: 0.85 }}/>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '2px 14px', paddingBottom: 'calc(96px + env(safe-area-inset-bottom,0px))' }}>
          {/* HOW LONG */}
          <div data-guide="qm-length">
          <Label right={<button onClick={surprise} style={{ display: 'flex', alignItems: 'center', gap: 4, font: "800 8px 'Orbitron',sans-serif", color: VIOLET, background: 'rgba(176,106,255,0.1)', border: '1px solid rgba(176,106,255,0.35)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', letterSpacing: '0.06em' }}><Shuffle size={10}/> SURPRISE ME</button>}>HOW LONG?</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 16 }}>
            {LENGTHS.map(len => {
              const active = !custom && len === duration;
              return (
                <button key={len} onClick={() => { setCustom(false); setDuration(len); }} style={{ textAlign: 'center', borderRadius: 10, padding: '13px 0', cursor: 'pointer', boxShadow: active ? '0 0 12px rgba(253,224,71,.4)' : 'none', ...chip(active) }}>
                  <span style={{ font: "800 14px 'Orbitron',sans-serif" }}>{len}</span>
                  <span style={{ font: "700 7px 'Orbitron',sans-serif", opacity: 0.7 }}> MIN</span>
                </button>
              );
            })}
            <button onClick={() => { setCustom(true); setDuration(45); }} style={{ textAlign: 'center', borderRadius: 10, padding: '14px 0', cursor: 'pointer', font: "800 10px 'Orbitron',sans-serif", ...chip(custom) }}>CUSTOM</button>
          </div>

          {/* FOCUS */}
          <Label><span>FOCUS <span style={{ color: '#6d5a8f' }}>· optional</span></span></Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {FOCI.map(f => {
              const active = f === focus;
              return <button key={f} onClick={() => setFocus(f)} style={{ font: "800 9px 'Orbitron',sans-serif", borderRadius: 8, padding: '8px 12px', cursor: 'pointer', ...chip(active) }}>{f}</button>;
            })}
          </div>

          </div>
          {/* INTENSITY */}
          <div data-guide="qm-intensity">
          <Label>INTENSITY</Label>
          <div style={{ display: 'flex', gap: 7, marginBottom: 16 }}>
            {INTENSITY.map(d => {
              const active = d === difficulty;
              return <button key={d} onClick={() => setDifficulty(d)} style={{ flex: 1, textAlign: 'center', font: "800 9px 'Orbitron',sans-serif", borderRadius: 9, padding: '10px 0', cursor: 'pointer', ...chip(active) }}>{d}</button>;
            })}
          </div>

          </div>
          {/* ADD CARDIO */}
          <div data-guide="qm-cardio">
          <button onClick={() => setCardioSheetOpen(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 11, border: '1px solid rgba(253,224,71,0.4)', background: 'linear-gradient(90deg,rgba(253,224,71,0.08),rgba(168,85,247,0.06))', padding: '11px 13px', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>❤</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: "800 10px 'Orbitron',sans-serif", color: GOLD }}>{cardioAddon ? 'CARDIO FINISHER ADDED' : 'ADD CARDIO'}</div>
              <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8' }}>{cardioAddon ? (cardioAddon.method || 'Cardio finisher') : 'Finish with a run or intervals'}</div>
            </div>
            <span style={{ font: "900 14px 'Orbitron',sans-serif", color: GOLD }}>›</span>
          </button>
          </div>

          {/* Start — inline, right under Add Cardio so it's never hidden */}
          <div style={{ textAlign: 'center', font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8', margin: '18px 0 8px' }}>{duration} min · {focus === 'FULL BODY' ? 'Full Body' : cap(focus)} · {cap(difficulty)}</div>
          <div data-guide="qm-start">
          <TrainingCTA variant="gold" label="START MISSION" icon="▶" height={48} onClick={handleStart} style={{ fontSize: 14, letterSpacing: '0.08em' }}/>
          </div>
        </div>
      </div>

      {cardioSheetOpen && (
        <CardioFinisherSetup
          initialAddon={cardioAddon}
          sourceMode="Quick Mission"
          onSave={(addon) => { setCardioAddon(addon); setCardioSheetOpen(false); }}
          onClose={() => setCardioSheetOpen(false)}
        />
      )}
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.quick_mission_setup} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
