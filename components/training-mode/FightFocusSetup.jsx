import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import Embers from './Embers';
import SafeImage from './SafeImage';
import { C } from './Styles';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import { IMG } from './data/optimizedImageMap';
import TrainingCTA from './shared/TrainingCTA';
import FightRingBackdrop from './shared/FightRingBackdrop';
import { StepperRow, TotalRow } from './shared/Stepper';
import RushModeRow from './shared/RushMode';
import WarmupRow, { loadWarmup } from './shared/WarmupRow';

const GOLD = C.gold;
const BLUE = '#4f8cff';

const DIFFICULTIES = ['Easy', 'Normal', 'Hard'];
const DIFF_DESC = {
  Easy: 'Fundamental focuses — clean technique, one cue at a time.',
  Normal: 'Balanced focuses & combinations across your discipline.',
  Hard: 'Tougher focuses, faster combinations — sharper pace.',
};

const fmtMin = (v) => `${Math.floor(v)}:${String(Math.round((v - Math.floor(v)) * 60)).padStart(2, '0')}`;
const toInt = (s) => parseInt(s, 10);

const setupCSS = `
.ff-seg { transition: all 0.18s ease; cursor: pointer; }
.ff-seg:active { transform: scale(0.97); }
`;

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: '#c4a4d8', fontSize: 8.5, letterSpacing: '0.16em', marginBottom: 7 }}>{children}</div>
  );
}

function Segmented({ label, options, value, onChange, accent }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(o => {
          const active = o === value;
          return (
            <button key={o} className="ff-seg" onClick={() => onChange(o)} style={{
              flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8,
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: '0.04em',
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

export default function FightFocusSetup({ discipline, onBack, onStart, profile }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [cfg, setCfg] = useState({
    difficulty: 'Normal', mode: 'Technical', rounds: 3,
    roundMin: 3, restSec: 60, voiceOn: true,
    rush: { on: false, pattern: 'endRound' },
    encouragement: profile?.encouragement || 'normal',
    warmupMin: loadWarmup('fightFocus'),
  });
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const totalEst = Math.round((cfg.rounds * (cfg.roundMin * 60 + cfg.restSec)) / 60);

  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: setupCSS }}/>
      <Embers count={3}/>

      <TrainingHeader
        title="FIGHT FOCUS"
        subtitle={`${discipline} — voice-coached rounds`}
        onHome={onBack}
        showBack
        onBack={onBack}
        rightSlot={<HelpButton onClick={() => setHelpOpen(true)}/>}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '10px 14px 0',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Banner (dimmed, bigger title) */}
        <div style={{ width: '100%', height: 62, borderRadius: 12, overflow: 'hidden', marginBottom: 13, position: 'relative', border: '1px solid rgba(253,224,71,0.2)' }}>
          <SafeImage src={IMG.hub.fight} alt="Fight Focus" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.5 }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,0,20,0.86) 0%, rgba(10,0,20,0.5) 55%, rgba(10,0,20,0.3) 100%)' }}/>
          <div style={{ position: 'absolute', bottom: 11, left: 15, zIndex: 2 }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 18, color: GOLD, letterSpacing: '0.08em', textShadow: '0 0 10px rgba(253,224,71,0.4)' }}>FIGHT FOCUS</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: 'rgba(255,255,255,0.72)', marginTop: 1 }}>Round timer with focus calls</div>
          </div>
        </div>

        {/* Difficulty + explanation */}
        <div style={{ marginBottom: 6 }}>
          <div data-guide="ff-difficulty"><Segmented label="DIFFICULTY" options={DIFFICULTIES} value={cfg.difficulty} onChange={v => set('difficulty', v)} accent={GOLD}/></div>
        </div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: '#a99cc4', lineHeight: 1.35, marginBottom: 14, minHeight: 26 }}>
          <span style={{ color: GOLD, fontWeight: 700 }}>{cfg.difficulty.toUpperCase()}:</span> {DIFF_DESC[cfg.difficulty]}
        </div>

        {/* Stacked steppers — WARM-UP first, since it's the first thing that
            happens in the session. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <div data-guide="ff-steppers">
          <WarmupRow feature="fightFocus" value={cfg.warmupMin} onChange={v => set('warmupMin', v)}/>
          <StepperRow label="ROUNDS" value={cfg.rounds} min={1} max={12} step={1} parse={toInt} onChange={v => set('rounds', v)} accent={GOLD}/>
          <StepperRow label="ROUND LENGTH" value={cfg.roundMin} min={0.5} max={8} step={0.5} display={fmtMin} editDisplay={v => String(v)} parse={parseFloat} onChange={v => set('roundMin', v)} accent={GOLD}/>
          <StepperRow label="ROUND REST" value={cfg.restSec} unit="s" min={0} max={120} step={5} parse={toInt} onChange={v => set('restSec', v)} accent={BLUE}/>
          <TotalRow label="TOTAL" value={`${totalEst} MIN`}/>
          </div>
        </div>

        {/* Rush mode (opens the flame popup) */}
        <div style={{ marginBottom: 9 }}>
          <RushModeRow rush={cfg.rush} onChange={r => set('rush', r)}/>
        </div>

        {/* Start — inline, right under Rush Mode so it's never hidden */}
        <div data-guide="ff-start">
        <TrainingCTA
          variant="gold" label="START SESSION" icon="🎯" height={50}
          style={{ width: '100%', fontSize: 13, letterSpacing: '0.1em' }}
          onClick={async () => {
            setVoiceGender(profile?.voiceCoach || 'FEMALE');
            await primeSpeech();
            onStart({
              difficulty: cfg.difficulty, mode: cfg.mode, rounds: cfg.rounds,
              roundMin: cfg.roundMin, restSec: cfg.restSec, voiceOn: true,
              rushMode: cfg.rush.on, rushPattern: cfg.rush.pattern,
              encouragement: cfg.encouragement,
              warmupMin: cfg.warmupMin,
            });
          }}
        />
        </div>

      </div>
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.fight_focus_setup} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
