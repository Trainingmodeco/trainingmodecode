import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import SafeImage from './SafeImage';
import { C } from './Styles';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import { IMG } from './data/optimizedImageMap';
import TrainingCTA from './shared/TrainingCTA';
import FightRingBackdrop from './shared/FightRingBackdrop';
import Stepper from './shared/Stepper';
import RushModeRow from './shared/RushMode';

const GOLD = C.gold;
const VIOLET = C.violet;
const BLUE = '#4f8cff';

const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Advanced'];

const fmtMin = (v) => `${Math.floor(v)}:${String(Math.round((v - Math.floor(v)) * 60)).padStart(2, '0')}`;
// Cadence seconds → speed word (drives voice pacing + colour in the player).
const speedFor = (sec) => (sec >= 5.5 ? 'slow' : sec <= 3.5 ? 'turbo' : 'medium');

const setupCSS = `
.cc-seg { transition: all 0.18s ease; cursor: pointer; }
.cc-seg:active { transform: scale(0.97); }
`;

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: '#c4a4d8', fontSize: 8, letterSpacing: '0.16em', marginBottom: 7 }}>{children}</div>
  );
}

function Segmented({ label, options, value, onChange, accent }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(o => {
          const active = o === value;
          return (
            <button key={o} className="cc-seg" onClick={() => onChange(o)} style={{
              flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 8,
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, letterSpacing: '0.03em',
              background: active ? accent : 'rgba(16,4,30,0.8)',
              border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
              color: active ? '#0a0014' : '#d9d1ef',
            }}>{o.toUpperCase()}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function ComboCoachSetup({ discipline, onBack, onStart, profile }) {
  const [cfg, setCfg] = useState({
    difficulty: 'Normal', rounds: 3, roundMin: 3, restSec: 60, cadenceSec: 4,
    rush: { on: false, pattern: 'endRound' },
  });
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const totalEst = Math.round((cfg.rounds * (cfg.roundMin * 60 + cfg.restSec)) / 60);

  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: setupCSS }}/>
      <Embers count={3}/>

      <TrainingHeader
        title="COMBO COACH"
        subtitle={`${discipline} — strike combos at cadence`}
        onHome={onBack}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '10px 14px 0',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Banner (identical to Fight Focus, dimmed) */}
        <div style={{ width: '100%', height: 56, borderRadius: 12, overflow: 'hidden', marginBottom: 12, position: 'relative', border: '1px solid rgba(253,224,71,0.2)' }}>
          <SafeImage src={IMG.hub.fight} alt="Combo Coach" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.5 }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,0,20,0.86) 0%, rgba(10,0,20,0.5) 55%, rgba(10,0,20,0.3) 100%)' }}/>
          <div style={{ position: 'absolute', bottom: 10, left: 14, zIndex: 2 }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, color: VIOLET, letterSpacing: '0.1em', textShadow: '0 0 10px rgba(168,85,247,0.4)' }}>COMBO COACH</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>Flash combos, build flow</div>
          </div>
        </div>

        {/* Difficulty on top */}
        <div style={{ marginBottom: 12 }}>
          <Segmented label="DIFFICULTY" options={DIFFICULTIES} value={cfg.difficulty} onChange={v => set('difficulty', v)} accent={GOLD}/>
        </div>

        {/* Rounds + Round Length steppers */}
        <div style={{ display: 'flex', gap: 11, marginBottom: 11 }}>
          <Stepper label="ROUNDS" value={cfg.rounds} min={1} max={12} step={1} onChange={v => set('rounds', v)} accent={GOLD}/>
          <Stepper label="ROUND LENGTH" value={cfg.roundMin} min={0.5} max={8} step={0.5} display={fmtMin} onChange={v => set('roundMin', v)} accent={GOLD}/>
        </div>

        {/* Round Rest + Cadence steppers */}
        <div style={{ display: 'flex', gap: 11, marginBottom: 12 }}>
          <Stepper label="ROUND REST" value={cfg.restSec} unit="s" min={0} max={120} step={5} onChange={v => set('restSec', v)} accent={BLUE}/>
          <Stepper label="CADENCE" value={cfg.cadenceSec} unit="s" min={2} max={8} step={0.5} display={v => v.toFixed(1)} onChange={v => set('cadenceSec', v)} accent={VIOLET}/>
        </div>

        {/* Estimated time */}
        <div style={{ textAlign: 'center', marginBottom: 12, fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 600, color: C.faint }}>
          EST. {totalEst} MIN · 1 combo / {cfg.cadenceSec.toFixed(1)}s
        </div>

        {/* Rush mode (opens the flame popup) */}
        <div style={{ marginBottom: 14 }}>
          <RushModeRow rush={cfg.rush} onChange={r => set('rush', r)}/>
        </div>

        {/* Start */}
        <TrainingCTA
          variant="gold" label="START COMBOS" icon="⚡" height={50}
          style={{ width: '100%', fontSize: 13, letterSpacing: '0.1em' }}
          onClick={async () => {
            setVoiceGender(profile?.voiceCoach || 'FEMALE');
            await primeSpeech();
            const speed = speedFor(cfg.cadenceSec);
            onStart({
              discipline, difficulty: cfg.difficulty,
              speed, speedLabel: `${cfg.cadenceSec.toFixed(1)}s`, ms: Math.round(cfg.cadenceSec * 1000),
              rounds: cfg.rounds, roundMin: cfg.roundMin, restSec: cfg.restSec,
              voiceOn: true, rushMode: cfg.rush.on, rushPattern: cfg.rush.pattern,
              encouragement: profile?.encouragement || 'normal',
            });
          }}
        />

      </div>
    </PhoneFrame>
  );
}
