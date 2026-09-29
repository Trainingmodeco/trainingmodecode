import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { canRunRounds, GATES } from './data/entitlements';
import ProGateOverlay from './shared/ProGateOverlay';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import TrainingCTA from './shared/TrainingCTA';
import { StepperRow, TotalRow } from './shared/Stepper';
import WarmupRow, { loadWarmup } from './shared/WarmupRow';
import RushModeRow from './shared/RushMode';
import { getEffectiveArsenal } from './data/arsenal';
import { isBeginnerLearner, saveProfile, loadProfile } from './data/userProfile';
import { CALL_STYLES, callStyleOf } from './data/strikeNumbering';
import { FightBackdrop, FightHeader, FightDifficulty, FightToggle, fightTimerCSS } from './shared/FightTimerKit';

// Combo Coach setup — the Simplify revamp reskin (royal blue + gold, no
// banner, one screen). What it starts is unchanged: same config, same runner.

const GOLD = '#F2BE45';

const DIFFICULTIES = ['Easy', 'Normal', 'Hard', 'Advanced'];
// The design drops MODE's description line to keep the screen to one page;
// the two words carry it and the ? guide explains the difference.
const MODES = ['Technical', 'Combo'];
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

export default function ComboCoachSetup({ discipline, onBack, onStart, onPaywall, profile }) {
  const [helpOpen, setHelpOpen] = useState(false);
  // 1.2 — beginner learners are LOCKED to Basic Mode: starter basics + strikes
  // learned in Practice (no ALL STRIKES escape hatch). Experienced users see no
  // gating UI at all and always drill the full pool.
  const beginner = isBeginnerLearner(profile);
  const arsenal = getEffectiveArsenal(discipline);
  const arsenalOnly = beginner;
  const [proGateOpen, setProGateOpen] = useState(false);
  const [cfg, setCfg] = useState({
    difficulty: 'Normal', mode: 'Combo', rounds: 3, roundMin: 3, restSec: 60, cadenceSec: 3.5,
    rush: { on: false, pattern: 'endRound' }, warmupMin: loadWarmup('comboCoach'),
  });
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  // PROMPT N — CALL STYLE lives on the profile (shared with Camp/Arcade), so
  // picking here persists immediately, same as the Audio Settings row.
  const [callStyle, setCallStyle] = useState(profile?.callStyle || loadProfile()?.callStyle || 'names');
  const pickCallStyle = (id) => {
    setCallStyle(id);
    saveProfile({ ...loadProfile(), callStyle: id });
  };

  const totalEst = Math.round((cfg.rounds * (cfg.roundMin * 60 + cfg.restSec)) / 60);

  const callStyleId = callStyleOf(callStyle).id;
  // Numbers is a boxing system: kicks, knees and elbows have no standard
  // number, so combos containing them are called by name rather than as a
  // half-number hybrid. Say so up front, or a kickboxing athlete picks NUMBERS
  // and thinks it failed.
  const numbersNote = String(discipline).toLowerCase() === 'boxing'
    ? 'Punch combos are called 1-2-3; ones with slips or rolls by name.'
    : 'Punch-only combos are called 1-2-3; kicks, knees and elbows by name.';

  return (
    <PhoneFrame useBrandBg>
      <FightBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: fightTimerCSS }}/>

      <div style={{
        // 8, not 12: with six stepper rows this is the one fight setup that
        // ran START under the tab bar on a 667px phone.
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 7,
        padding: '6px 16px 0',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
      }}>
        <FightHeader title="COMBO COACH" sub={`${discipline} · strike combos at cadence`} onBack={onBack} onHelp={() => setHelpOpen(true)}/>

        {/* Difficulty also sets a default cadence (faster as it gets harder);
            the CADENCE stepper can still override it. */}
        <FightDifficulty
          levels={DIFFICULTIES} value={cfg.difficulty} desc={DIFF_DESC[cfg.difficulty]} guide="cc-difficulty"
          onChange={v => setCfg(c => ({ ...c, difficulty: v, cadenceSec: CADENCE_BY_DIFF[v] ?? c.cadenceSec }))}
        />

        {/* CALL STYLE lives on the profile (shared with Camp and Arcade), so a
            pick persists immediately. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
            <FightToggle
              label="CALL STYLE" guide="cc-callstyle"
              options={CALL_STYLES.map(cs => cs.id)} value={callStyleId} onChange={pickCallStyle}
              format={id => CALL_STYLES.find(cs => cs.id === id)?.label || id}
            />
            <FightToggle label="MODE" guide="cc-mode" options={MODES} value={cfg.mode} onChange={v => set('mode', v)}/>
          </div>
          {callStyleId === 'numbers' && (
            <div style={{ fontSize: 12, color: '#A9B4D6', lineHeight: 1.3 }}>{numbersNote}</div>
          )}
          {/* Beginner learners are locked to basics plus strikes learned in
              Practice, with the way to unlock combos spelled out. */}
          {beginner && (
            <div style={{ fontSize: 12, color: '#A9B4D6', lineHeight: 1.3 }}>
              <span style={{ font: "700 11px 'Chakra Petch',sans-serif", color: '#8FB4FF', letterSpacing: '0.08em' }}>🔒 BASIC MODE</span>{' '}
              Basic strikes plus what you&apos;ve learned in Practice. <span style={{ color: GOLD }}>More Practice unlocks combos.</span>
            </div>
          )}
        </div>

        {/* Stacked steppers — WARM-UP first, since it's the first thing that
            happens in the session. */}
        <div data-guide="cc-steppers" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <WarmupRow feature="comboCoach" value={cfg.warmupMin} onChange={v => set('warmupMin', v)}/>
          <StepperRow label="ROUNDS" value={cfg.rounds} min={1} max={12} step={1} parse={toInt} onChange={v => set('rounds', v)}/>
          <StepperRow label="ROUND LENGTH" value={cfg.roundMin} min={0.5} max={8} step={0.5} display={fmtMin} editDisplay={v => String(v)} parse={parseFloat} onChange={v => set('roundMin', v)}/>
          <StepperRow label="ROUND REST" value={cfg.restSec} unit="S" min={0} max={120} step={5} parse={toInt} onChange={v => set('restSec', v)}/>
          <StepperRow label="CADENCE" value={cfg.cadenceSec} unit="S" min={2} max={8} step={0.5} display={v => v.toFixed(1)} editDisplay={v => String(v)} parse={parseFloat} onChange={v => set('cadenceSec', v)}/>
          <TotalRow label="TOTAL" value={`${totalEst} MIN`}/>
        </div>

        {/* Rush mode (opens the flame popup) — unchanged, per the design. */}
        <div data-guide="cc-rush">
          <RushModeRow rush={cfg.rush} onChange={r => set('rush', r)} discipline={discipline}/>
        </div>

        {/* Start */}
        <div data-guide="cc-start">
        <TrainingCTA
          variant="gold" label="START COMBOS" icon="⚡" height={48}
          style={{ width: '100%', fontSize: 13, letterSpacing: '0.1em' }}
          onClick={async () => {
            if (!canRunRounds(cfg.rounds)) { setProGateOpen(true); return; }
            setVoiceGender(profile?.voiceCoach || 'FEMALE');
            await primeSpeech();
            const speed = speedFor(cfg.cadenceSec);
            onStart({
              discipline, difficulty: cfg.difficulty, mode: cfg.mode,
              speed, speedLabel: `${cfg.cadenceSec.toFixed(1)}s`, ms: Math.round(cfg.cadenceSec * 1000),
              rounds: cfg.rounds, roundMin: cfg.roundMin, restSec: cfg.restSec,
              voiceOn: true, rushMode: cfg.rush.on, rushPattern: cfg.rush.pattern, rushMix: cfg.rush.mix || 'explosive',
              encouragement: profile?.encouragement || 'normal',
              arsenalOnly, arsenal, warmupMin: cfg.warmupMin,
            });
          }}
        />
        </div>

      </div>
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.combo_coach_setup} onClose={() => setHelpOpen(false)}/>}

      <ProGateOverlay
        open={proGateOpen}
        title={`${cfg.rounds}-round session is Pro.`}
        body={`Free members run up to ${GATES.freeRoundsPerSession} rounds of the coach. Pro takes the cap off, so a five-round Muay Thai session or a full boxing card just starts.`}
        freeLine={`Up to ${GATES.freeRoundsPerSession} rounds per session.`}
        proLine={`Any round count. Any format.`}
        onGoPro={() => { setProGateOpen(false); onPaywall?.(); }}
        onClose={() => setProGateOpen(false)}
      />
    </PhoneFrame>
  );
}
