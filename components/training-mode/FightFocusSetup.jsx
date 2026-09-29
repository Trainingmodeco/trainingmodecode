import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import ScreenGuide from './shared/ScreenGuide';
import CodeEntryModal from './shared/CodeEntryModal';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { getMyBestGhost, importGhostCode, exportGhostCode } from './data/ghostBattles';
import { canRunRounds, GATES } from './data/entitlements';
import ProGateOverlay from './shared/ProGateOverlay';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import TrainingCTA from './shared/TrainingCTA';
import { StepperRow, TotalRow } from './shared/Stepper';
import RushModeRow from './shared/RushMode';
import WarmupRow, { loadWarmup } from './shared/WarmupRow';
import { FightBackdrop, FightHeader, FightDifficulty, fightTimerCSS } from './shared/FightTimerKit';

// Fight Focus setup — the Simplify revamp reskin (royal blue + gold, no
// banner, one screen). The session it starts is unchanged: same config, same
// FightFocusTimer.

const DIFFICULTIES = ['Easy', 'Normal', 'Hard'];
// Kept from before rather than the mock's copy: the mock's Hard line promises
// "less recovery", but rest is whatever ROUND REST is set to.
const DIFF_DESC = {
  Easy: 'Fundamental focuses — clean technique, one cue at a time.',
  Normal: 'Balanced focuses & combinations across your discipline.',
  Hard: 'Tougher focuses, faster combinations — sharper pace.',
};

const fmtMin = (v) => `${Math.floor(v)}:${String(Math.round((v - Math.floor(v)) * 60)).padStart(2, '0')}`;
const toInt = (s) => parseInt(s, 10);

// A ghost challenge (data/ghostChallenges) opens this screen with the ghost
// already chosen: its rounds and level preset, and surprise rushes locked on
// in place of the Rush Mode row, per the design.
const levelOf = (d) => {
  const v = String(d || '').charAt(0).toUpperCase() + String(d || '').slice(1).toLowerCase();
  return DIFFICULTIES.includes(v) ? v : 'Normal';
};
const SURPRISE_RUSH = { on: true, pattern: 'random', mix: 'explosive' };

export default function FightFocusSetup({ discipline, onBack, onStart, onPaywall, profile, challenge = null }) {
  const [helpOpen, setHelpOpen] = useState(false);
  // Ghost Battles — the chosen opponent (null = plain session).
  const [ghost, setGhost] = useState(() => challenge?.ghost || null);
  const [ghostCodeOpen, setGhostCodeOpen] = useState(false); // in-app code entry (RN Web has no prompt)
  const [ghostToast, setGhostToast] = useState('');
  const myBest = getMyBestGhost('fight_focus', discipline);
  const [proGateOpen, setProGateOpen] = useState(false);
  const [cfg, setCfg] = useState(() => {
    const rc = challenge?.ghost?.source?.roundsConfig;
    return {
      difficulty: challenge ? levelOf(challenge.ghost.source?.difficulty) : 'Normal', mode: 'Technical',
      rounds: rc?.rounds || 3,
      roundMin: rc?.roundSec ? rc.roundSec / 60 : 3,
      restSec: rc?.restSec ?? 60, voiceOn: true,
      rush: challenge ? SURPRISE_RUSH : { on: false, pattern: 'endRound' },
      encouragement: profile?.encouragement || 'normal',
      warmupMin: loadWarmup('fightFocus'),
    };
  });
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const totalEst = Math.round((cfg.rounds * (cfg.roundMin * 60 + cfg.restSec)) / 60);

  return (
    <PhoneFrame useBrandBg>
      <FightBackdrop/>
      <style dangerouslySetInnerHTML={{ __html: fightTimerCSS }}/>

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12,
        padding: '10px 16px 0',
        paddingBottom: 'calc(max(96px, var(--tm-resume-top, 0px)) + env(safe-area-inset-bottom, 0px))',
      }}>
        <FightHeader title="FIGHT FOCUS" sub={`${discipline} · round timer with focus calls`} onBack={onBack} onHelp={() => setHelpOpen(true)}/>

        <FightDifficulty levels={DIFFICULTIES} value={cfg.difficulty} onChange={v => set('difficulty', v)} desc={DIFF_DESC[cfg.difficulty]} guide="ff-difficulty"/>

        {/* Stacked steppers — WARM-UP first, since it's the first thing that
            happens in the session. */}
        <div data-guide="ff-steppers" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <WarmupRow feature="fightFocus" value={cfg.warmupMin} onChange={v => set('warmupMin', v)}/>
          <StepperRow label="ROUNDS" value={cfg.rounds} min={1} max={12} step={1} parse={toInt} onChange={v => set('rounds', v)}/>
          <StepperRow label="ROUND LENGTH" value={cfg.roundMin} min={0.5} max={8} step={0.5} display={fmtMin} editDisplay={v => String(v)} parse={parseFloat} onChange={v => set('roundMin', v)}/>
          <StepperRow label="ROUND REST" value={cfg.restSec} unit="S" min={0} max={120} step={5} parse={toInt} onChange={v => set('restSec', v)}/>
          <TotalRow label="TOTAL" value={`${totalEst} MIN`}/>
        </div>

        {/* Rush mode (opens the flame popup) — unchanged, per the design.
            A ghost challenge takes its place: surprise rushes, locked on. */}
        {challenge ? (
          <div data-guide="ff-rush" style={{
            display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '8px 12px', borderRadius: 12, boxSizing: 'border-box',
            background: 'linear-gradient(90deg, rgba(36,88,224,.28), rgba(11,15,34,.92))', border: '1px solid rgba(110,155,255,.6)',
            boxShadow: '0 0 16px rgba(61,123,255,.25)',
          }}>
            <span style={{ fontSize: 22 }}>👻</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 13px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', color: '#fff' }}>GHOST CHALLENGE</div>
              <div style={{ fontSize: 12, color: '#A9B4D6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                VS {challenge.ghost.ownerName} · {challenge.ghost.totalStrikes} strikes · surprise rushes locked on
              </div>
            </div>
            <span style={{ font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', color: '#F2BE45', border: '1px solid rgba(242,190,69,.55)', borderRadius: 6, padding: '4px 7px', flexShrink: 0 }}>⚡ ON</span>
          </div>
        ) : (
          <div data-guide="ff-rush">
            <RushModeRow rush={cfg.rush} onChange={r => set('rush', r)} discipline={discipline}/>
          </div>
        )}

        {/* Ghost Battles (specs 18/24) — race the replay of a verified past
            session. MY BEST is always available once one exists; a friend's
            challenge code pastes in. The battle inherits this session's format. */}
        {!challenge && <div data-tour="ghost-battle" data-guide="ff-ghost" style={{ borderRadius: 12, border: `1px solid ${ghost ? 'rgba(176,106,255,0.65)' : 'rgba(168,85,247,0.28)'}`, background: ghost ? 'linear-gradient(90deg,rgba(88,28,135,0.35),rgba(16,4,30,0.85))' : 'rgba(16,4,30,0.8)', padding: '10px 13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 15 }}>👻</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "800 10px 'Orbitron',sans-serif", color: '#c9a6ff', letterSpacing: '0.06em' }}>
                {ghost ? `VS ${ghost.ownerName} · ${ghost.totalStrikes} STRIKES` : 'GHOST BATTLE'}
              </div>
              <div style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 1 }}>
                {ghost ? 'Race is on — most verified strikes wins.' : myBest ? 'Race your best verified run — or paste a friend’s code.' : 'Finish a session to create your first ghost, then race it.'}
              </div>
            </div>
            {ghost ? (
              <button onClick={() => setGhost(null)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7, color: '#9a90b8', cursor: 'pointer', font: "800 8px 'Orbitron',sans-serif", padding: '5px 8px' }}>CLEAR</button>
            ) : (
              <>
                {myBest && <button onClick={() => setGhost(myBest)} style={{ background: 'rgba(176,106,255,0.16)', border: '1px solid rgba(176,106,255,0.5)', borderRadius: 7, color: '#c9a6ff', cursor: 'pointer', font: "800 8px 'Orbitron',sans-serif", padding: '5px 8px' }}>MY BEST</button>}
                <button onClick={() => setGhostCodeOpen(true)} style={{ background: 'none', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 7, color: '#9a90b8', cursor: 'pointer', font: "800 8px 'Orbitron',sans-serif", padding: '5px 8px' }}>CODE</button>
              </>
            )}
          </div>
          {myBest && !ghost && (
            <button onClick={() => {
              const code = exportGhostCode(myBest);
              if (code && typeof navigator !== 'undefined' && navigator.clipboard) { navigator.clipboard.writeText(code).catch(() => {}); }
              setGhostToast(code ? 'Challenge code copied — send it to a friend so they can race YOUR ghost.' : 'Couldn’t copy the code.');
              setTimeout(() => setGhostToast(''), 3200);
            }} style={{ marginTop: 7, width: '100%', background: 'none', border: '1px dashed rgba(176,106,255,0.35)', borderRadius: 8, color: '#8b83a8', cursor: 'pointer', font: "700 8px 'Orbitron',sans-serif", letterSpacing: '0.06em', padding: '6px 0' }}>⚔️ SET MY BEST AS A CHALLENGE (COPY CODE)</button>
          )}
          {ghostToast && <div style={{ marginTop: 7, font: "600 9px 'Rajdhani',sans-serif", color: '#c9a6ff', textAlign: 'center' }}>{ghostToast}</div>}
        </div>}

        {/* Start — inline, right under Rush Mode so it's never hidden */}
        <div data-guide="ff-start">
        <TrainingCTA
          variant="gold" label="START SESSION" icon="🎯" height={50}
          style={{ width: '100%', fontSize: 13, letterSpacing: '0.1em' }}
          onClick={async () => {
            if (!canRunRounds(cfg.rounds)) { setProGateOpen(true); return; }
            setVoiceGender(profile?.voiceCoach || 'FEMALE');
            await primeSpeech();
            onStart({
              difficulty: cfg.difficulty, mode: cfg.mode, rounds: cfg.rounds,
              roundMin: cfg.roundMin, restSec: cfg.restSec, voiceOn: true,
              rushMode: cfg.rush.on, rushPattern: cfg.rush.pattern, rushMix: cfg.rush.mix || 'explosive',
              encouragement: cfg.encouragement,
              warmupMin: cfg.warmupMin,
              ghost,
              ghostChallengeId: challenge?.id || null,
            });
          }}
        />
        </div>

      </div>
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.fight_focus_setup} onClose={() => setHelpOpen(false)}/>}
      {ghostCodeOpen && (
        <CodeEntryModal
          title="👻 PASTE A GHOST CODE"
          label="Paste a friend's ghost challenge code to race their run."
          submitLabel="LOAD GHOST"
          onSubmit={(code) => { const g = importGhostCode(code); if (!g) return false; setGhost(g); return true; }}
          onClose={() => setGhostCodeOpen(false)}
        />
      )}

      <ProGateOverlay
        open={proGateOpen}
        title={`${cfg.rounds}-round session is Pro.`}
        body={`Free members train up to ${GATES.freeRoundsPerSession} rounds of Fight Focus. Pro removes the cap so a full 12-round card runs end to end.`}
        freeLine={`Up to ${GATES.freeRoundsPerSession} rounds per session.`}
        proLine={`Any round count. Any format.`}
        onGoPro={() => { setProGateOpen(false); onPaywall?.(); }}
        onClose={() => setProGateOpen(false)}
      />
    </PhoneFrame>
  );
}
