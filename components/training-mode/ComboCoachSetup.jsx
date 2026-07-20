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
import { getEffectiveArsenal } from './data/arsenal';
import { isBeginnerLearner } from './data/userProfile';

const GOLD = C.gold;
const VIOLET = C.violet;
const BLUE = '#4f8cff';

const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Advanced'];
const MODES = ['Technical', 'Combo'];
const MODE_DESC = {
  Technical: 'Single strikes on the beat — drill clean technique one shot at a time.',
  Combo: 'Full combinations on the beat — chain strikes together for flow & speed.',
};
// Picking a difficulty sets a default cadence (faster as it gets harder); the
// user can still adjust the CADENCE stepper afterward.
const CADENCE_BY_DIFF = { Easy: 4, Normal: 3.5, Hard: 3, Advanced: 2.5 };
const DIFF_DESC = {
  Easy: 'Base single strikes & simple combos — relaxed pace.',
  Normal: 'Singles and combinations, about half and half — steady pace.',
  Hard: 'Adds advanced strikes & longer combos — semi fight pace.',
  Advanced: 'Advanced strikes & full combos — fight pace.',
};

const fmtMin = (v) => `${Math.floor(v)}:${String(Math.round((v - Math.floor(v)) * 60)).padStart(2, '0')}`;
const toInt = (s) => parseInt(s, 10);
// Cadence seconds → speed word (drives voice pacing + colour in the player).
const speedFor = (sec) => (sec >= 5.5 ? 'slow' : sec <= 3.5 ? 'turbo' : 'medium');

const setupCSS = `
.cc-seg { transition: all 0.18s ease; cursor: pointer; }
.cc-seg:active { transform: scale(0.97); }
`;

function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: '#c4a4d8', fontSize: 8.5, letterSpacing: '0.16em', marginBottom: 5 }}>{children}</div>
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
            <button key={o} className="cc-seg" onClick={() => onChange(o)} style={{
              flex: 1, textAlign: 'center', padding: '8px 0', borderRadius: 8,
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9.5, letterSpacing: '0.03em',
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
  const [helpOpen, setHelpOpen] = useState(false);
  // 1.2 — beginner learners are LOCKED to Basic Mode: starter basics + strikes
  // learned in Practice (no ALL STRIKES escape hatch). Experienced users see no
  // gating UI at all and always drill the full pool.
  const beginner = isBeginnerLearner(profile);
  const arsenal = getEffectiveArsenal(discipline);
  const arsenalOnly = beginner;
  const [cfg, setCfg] = useState({
    difficulty: 'Normal', mode: 'Combo', rounds: 3, roundMin: 3, restSec: 60, cadenceSec: 3.5,
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
        rightSlot={<HelpButton onClick={() => setHelpOpen(true)}/>}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '8px 14px 0',
        paddingBottom: 'calc(92px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Banner (identical to Fight Focus, dimmed, bigger title) */}
        <div style={{ width: '100%', height: 52, borderRadius: 12, overflow: 'hidden', marginBottom: 10, position: 'relative', border: '1px solid rgba(253,224,71,0.2)' }}>
          <SafeImage src={IMG.hub.fight} alt="Combo Coach" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.5 }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,0,20,0.86) 0%, rgba(10,0,20,0.5) 55%, rgba(10,0,20,0.3) 100%)' }}/>
          <div style={{ position: 'absolute', bottom: 8, left: 15, zIndex: 2 }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 17, color: VIOLET, letterSpacing: '0.08em', textShadow: '0 0 10px rgba(168,85,247,0.4)' }}>COMBO COACH</div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10, color: 'rgba(255,255,255,0.72)', marginTop: 0 }}>Flash combos, build flow</div>
          </div>
        </div>

        {/* Difficulty + explanation (also sets a default cadence) */}
        <div style={{ marginBottom: 5 }}>
          <div data-guide="cc-difficulty"><Segmented label="DIFFICULTY" options={DIFFICULTIES} value={cfg.difficulty} onChange={v => setCfg(c => ({ ...c, difficulty: v, cadenceSec: CADENCE_BY_DIFF[v] ?? c.cadenceSec }))} accent={GOLD}/></div>
        </div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: '#a99cc4', lineHeight: 1.3, marginBottom: 8, minHeight: 20 }}>
          <span style={{ color: GOLD, fontWeight: 700 }}>{cfg.difficulty.toUpperCase()}:</span> {DIFF_DESC[cfg.difficulty]}
        </div>

        {/* Mode + explanation */}
        <div style={{ marginBottom: 5 }}>
          <div data-guide="cc-mode"><Segmented label="MODE" options={MODES} value={cfg.mode} onChange={v => set('mode', v)} accent={VIOLET}/></div>
        </div>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: '#a99cc4', lineHeight: 1.3, marginBottom: 9, minHeight: 20 }}>
          <span style={{ color: VIOLET, fontWeight: 700 }}>{cfg.mode.toUpperCase()}:</span> {MODE_DESC[cfg.mode]}
        </div>

        {/* 1.2 — Basic Mode (beginner learners only): locked to starter basics
            + Practice-learned strikes, with the unlock path spelled out. */}
        {beginner && (
          <>
            <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7.5, color: '#e6d4ff', background: 'rgba(168,85,247,0.16)', border: '1px solid rgba(168,85,247,0.5)', borderRadius: 5, padding: '4px 8px', letterSpacing: '0.06em', flexShrink: 0 }}>🔒 BASIC MODE</span>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7.5, color: '#0a0014', background: GOLD, borderRadius: 5, padding: '4px 8px', letterSpacing: '0.06em', flexShrink: 0 }}>🥊 YOUR ARSENAL: {arsenal.length}</span>
            </div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: '#a99cc4', lineHeight: 1.3, marginBottom: 9 }}>
              Calling basic strikes plus ones you&apos;ve learned through Practice. <span style={{ color: GOLD, fontWeight: 700 }}>Do more Practice Mode training to unlock combos.</span>
            </div>
          </>
        )}

        {/* Stacked steppers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 9 }}>
          <div data-guide="cc-steppers">
          <StepperRow label="ROUNDS" value={cfg.rounds} min={1} max={12} step={1} parse={toInt} onChange={v => set('rounds', v)} accent={GOLD}/>
          <StepperRow label="ROUND LENGTH" value={cfg.roundMin} min={0.5} max={8} step={0.5} display={fmtMin} editDisplay={v => String(v)} parse={parseFloat} onChange={v => set('roundMin', v)} accent={GOLD}/>
          <StepperRow label="ROUND REST" value={cfg.restSec} unit="s" min={0} max={120} step={5} parse={toInt} onChange={v => set('restSec', v)} accent={BLUE}/>
          <StepperRow label="CADENCE" value={cfg.cadenceSec} unit="s" min={2} max={8} step={0.5} display={v => v.toFixed(1)} editDisplay={v => String(v)} parse={parseFloat} onChange={v => set('cadenceSec', v)} accent={VIOLET}/>
          <TotalRow label="TOTAL" value={`${totalEst} MIN`}/>
          </div>
        </div>

        {/* Rush mode (opens the flame popup) */}
        <div style={{ marginBottom: 10 }}>
          <RushModeRow rush={cfg.rush} onChange={r => set('rush', r)}/>
        </div>

        {/* Start */}
        <div data-guide="cc-start">
        <TrainingCTA
          variant="gold" label="START COMBOS" icon="⚡" height={48}
          style={{ width: '100%', fontSize: 13, letterSpacing: '0.1em' }}
          onClick={async () => {
            setVoiceGender(profile?.voiceCoach || 'FEMALE');
            await primeSpeech();
            const speed = speedFor(cfg.cadenceSec);
            onStart({
              discipline, difficulty: cfg.difficulty, mode: cfg.mode,
              speed, speedLabel: `${cfg.cadenceSec.toFixed(1)}s`, ms: Math.round(cfg.cadenceSec * 1000),
              rounds: cfg.rounds, roundMin: cfg.roundMin, restSec: cfg.restSec,
              voiceOn: true, rushMode: cfg.rush.on, rushPattern: cfg.rush.pattern,
              encouragement: profile?.encouragement || 'normal',
              arsenalOnly, arsenal,
            });
          }}
        />
        </div>

      </div>
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.combo_coach_setup} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
