import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { canRunRounds, GATES } from './data/entitlements';
import ProGateOverlay from './shared/ProGateOverlay';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import TrainingCTA from './shared/TrainingCTA';
import { StepperRow, TotalRow } from './shared/Stepper';
import RushModeRow from './shared/RushMode';
import WarmupRow, { loadWarmup } from './shared/WarmupRow';
import { FightBackdrop, FightHeader, FightLabel, fightTimerCSS } from './shared/FightTimerKit';

// Just Train — a plain round timer for bag work, pads or sparring: pick the
// rounds and go. New in the Simplify revamp (Fight Mode row 01).
//
// It is not a new timer. It runs the same FightFocusTimer as Fight Focus, fed
// its own rounds instead of generated focuses. Those rounds carry no combos
// and a neutral "Free flow" title, so nothing is called and nothing flashes;
// the bells and the clock are all there is. Voice is off unless Rush Mode is
// on — a surge is a spoken cue, so asking for rushes is asking for the coach.

// The design's four starters. Tabata runs 20-second rounds, below the ROUND
// LENGTH stepper's 30-second floor; a preset may sit outside the stepper range.
const BUILT_IN = [
  { label: 'Bag 6×3', rounds: 6, lenSec: 180, restSec: 60 },
  { label: 'Pads 8×2', rounds: 8, lenSec: 120, restSec: 45 },
  { label: 'Spar 5×3', rounds: 5, lenSec: 180, restSec: 60 },
  { label: 'Tabata 8×0:20', rounds: 8, lenSec: 20, restSec: 10 },
];

const SAVED_KEY = 'tm_just_train_presets';
const MAX_SAVED = 3;
const loadSaved = () => {
  try { const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); return Array.isArray(v) ? v.slice(0, MAX_SAVED) : []; } catch { return []; }
};

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const sameShape = (a, b) => a.rounds === b.rounds && a.lenSec === b.lenSec && a.restSec === b.restSec;

// Every round is the same "Free flow" round: FightFocusTimer shows the title
// on its round card and, only when voice is on, reads it at the bell.
const freeFlowRounds = (n) => Array.from({ length: n }, () => ({
  round_title: 'Free flow', coach_prompt: 'Your round, your pace.', description: '', session_type: 'Just Train',
}));

export default function JustTrainSetup({ discipline, onBack, onStart, onPaywall, profile }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [proGateOpen, setProGateOpen] = useState(false);
  const [saved, setSaved] = useState(loadSaved);
  const [cfg, setCfg] = useState({
    ...BUILT_IN[0], preset: BUILT_IN[0].label,
    rush: { on: false, pattern: 'endRound' },
    warmupMin: loadWarmup('justTrain'),
  });
  // Touching a stepper means the values no longer match any preset.
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v, preset: null }));
  const pick = (p) => setCfg(c => ({ ...c, rounds: p.rounds, lenSec: p.lenSec, restSec: p.restSec, preset: p.label }));

  const saveCurrent = () => {
    const shape = { rounds: cfg.rounds, lenSec: cfg.lenSec, restSec: cfg.restSec };
    const label = `${shape.rounds}×${mmss(shape.lenSec)}`;
    const next = [{ label, ...shape }, ...saved.filter(s => !sameShape(s, shape))].slice(0, MAX_SAVED);
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* best-effort */ }
    setCfg(c => ({ ...c, preset: label }));
  };
  const alreadySaved = BUILT_IN.concat(saved).some(p => sameShape(p, cfg));

  const totalSec = cfg.warmupMin * 60 + cfg.rounds * cfg.lenSec + Math.max(0, cfg.rounds - 1) * cfg.restSec;

  const chip = (p) => {
    const on = cfg.preset === p.label;
    return (
      <button key={p.label} type="button" className="ftk-hit" onClick={() => pick(p)} aria-pressed={on} style={{
        height: 36, padding: '0 12px', borderRadius: 3, cursor: 'pointer',
        background: on ? 'rgba(61,123,255,0.22)' : '#0F1328',
        border: `1px solid ${on ? 'rgba(110,155,255,0.7)' : 'transparent'}`,
        color: on ? '#8FB4FF' : '#E6E2F5', font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.12em',
      }}>{p.label.toUpperCase()}</button>
    );
  };

  const start = async () => {
    if (!canRunRounds(cfg.rounds)) { setProGateOpen(true); return; }
    const voiceOn = cfg.rush.on;
    if (voiceOn) { setVoiceGender(profile?.voiceCoach || 'FEMALE'); await primeSpeech(); }
    onStart({
      mode: 'Just Train', difficulty: 'Normal',
      rounds: cfg.rounds, roundMin: cfg.lenSec / 60, restSec: cfg.restSec,
      blockRounds: freeFlowRounds(cfg.rounds),
      voiceOn, encouragement: 'off',
      rushMode: cfg.rush.on, rushPattern: cfg.rush.pattern, rushMix: cfg.rush.mix || 'explosive',
      warmupMin: cfg.warmupMin,
    });
  };

  return (
    <PhoneFrame useBrandBg>
      <FightBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: fightTimerCSS }}/>

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12,
        padding: '10px 16px 0',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
      }}>
        <FightHeader title="JUST TRAIN" sub={`${discipline} · round timer · fast start`} onBack={onBack} onHelp={() => setHelpOpen(true)}/>

        <div data-guide="jt-presets" style={{ display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <FightLabel>SAVED PRESETS</FightLabel>
            {/* Hidden when the current numbers are already a preset, so it
                never saves a duplicate chip. */}
            {!alreadySaved && (
              <button type="button" className="ftk-tog" onClick={saveCurrent} style={{
                height: 28, padding: 0, background: 'transparent', border: 0, cursor: 'pointer',
                color: '#8FB4FF', font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.12em',
              }}>+ SAVE CURRENT</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {BUILT_IN.map(chip)}
            {saved.map(chip)}
          </div>
        </div>

        <div data-guide="jt-steppers" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <WarmupRow feature="justTrain" value={cfg.warmupMin} onChange={v => setCfg(c => ({ ...c, warmupMin: v }))}/>
          <StepperRow label="ROUNDS" value={cfg.rounds} min={1} max={20} step={1} parse={s => parseInt(s, 10)} onChange={v => set('rounds', v)}/>
          {/* Edited in minutes like the other timers ("3" means 3:00). */}
          <StepperRow
            label="ROUND LENGTH" value={cfg.lenSec} min={10} max={600} step={30} display={mmss}
            editDisplay={v => String(+(v / 60).toFixed(2))} parse={s => Math.round(parseFloat(s) * 60)}
            onChange={v => set('lenSec', v)}
          />
          <StepperRow label="ROUND REST" value={cfg.restSec} unit="S" min={0} max={300} step={15} parse={s => parseInt(s, 10)} onChange={v => set('restSec', v)}/>
          <TotalRow label="TOTAL" value={`${Math.round(totalSec / 60)} MIN`}/>
        </div>

        <div data-guide="jt-rush">
          <RushModeRow rush={cfg.rush} onChange={r => setCfg(c => ({ ...c, rush: r }))} discipline={discipline}/>
        </div>

        <div data-guide="jt-start">
          <TrainingCTA
            variant="gold" label="START TIMER" icon="⏱" height={50}
            style={{ width: '100%', fontSize: 13, letterSpacing: '0.1em' }}
            onClick={start}
          />
        </div>
      </div>

      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.just_train_setup} onClose={() => setHelpOpen(false)}/>}
      <ProGateOverlay
        open={proGateOpen}
        title={`${cfg.rounds}-round session is Pro.`}
        body={`Free members run up to ${GATES.freeRoundsPerSession} rounds. Pro takes the cap off, so a full card just starts.`}
        freeLine={`Up to ${GATES.freeRoundsPerSession} rounds per session.`}
        proLine={`Any round count. Any format.`}
        onGoPro={() => { setProGateOpen(false); onPaywall?.(); }}
        onClose={() => setProGateOpen(false)}
      />
    </PhoneFrame>
  );
}
