import { useState, useMemo } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import SafeImage from './SafeImage';
import FightRingBackdrop from './shared/FightRingBackdrop';
import TrainingCTA from './shared/TrainingCTA';
import { ChevronLeft, Lock, Check, Trophy, CheckCircle, X } from 'lucide-react';
import { C } from './Styles';
import { getSeriesProgress, setActiveChallenge } from './data/arcadeProgress';
import { isSeriesPlayable } from './data/trainingArcadeData';

const GOLD = C.yellow;
const CADENCE_MS_MAP = { slow: 3500, moderate: 2000, fast: 1000 };

const detailStyles = `
.ladder-scroll { -ms-overflow-style: none; scrollbar-width: none; }
.ladder-scroll::-webkit-scrollbar { display: none; }
.ladder-node { transition: transform .16s ease, box-shadow .2s ease; cursor: pointer; }
.ladder-node:active { transform: translateX(-50%) scale(0.94); }
.stage-modal { animation: modal-rise .28s cubic-bezier(.2,.8,.25,1) forwards; }
@keyframes modal-rise { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;

// Derive the headline objectives for a stage from its fit / cardio blocks.
function getStageObjectives(stage) {
  const out = [];
  const fb = stage.fitBlock;
  const tr = fb?.totalReps;
  if (tr) {
    if (tr.pushUps) out.push({ label: `${tr.pushUps} Push-Ups`, detail: 'cadence-paced' });
    if (tr.squats) out.push({ label: `${tr.squats} Squats`, detail: 'full depth' });
    if (tr.sitUps) out.push({ label: `${tr.sitUps} Sit-Ups`, detail: 'full range' });
    if (tr.backWork) out.push({ label: `${tr.backWork} Back reps`, detail: 'balance' });
  } else if (fb?.tasks) {
    fb.tasks.slice(0, 3).forEach(t => out.push({ label: t.reps ? `${t.reps} ${t.title}` : t.title, detail: t.sets ? `${t.sets} sets` : '' }));
  }
  const cb = stage.cardioBlock;
  const mins = cb?.durationMinutes || cb?.totalDurationMinutes;
  if (mins) out.push({ label: `${mins} min Cardio`, detail: cb.distanceEquivalent || 'steady pace' });
  return out.slice(0, 3);
}

export default function ArcadeSeriesDetail({ onHome, series, onBack, onStartStage, arcadeSettings }) {
  const progress = getSeriesProgress(series.id);
  const isOnePunch = series.id === 'one-punch-protocol';

  if (!isSeriesPlayable(series)) {
    return (
      <PhoneFrame useBrandBg>
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '20px 14px' }}>
          <Lock size={32} color={C.muted} style={{ marginBottom: 12 }} />
          <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 14, color: C.text, margin: '0 0 8px', textAlign: 'center' }}>{series.title}</h2>
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, textAlign: 'center', maxWidth: 260, margin: '0 0 20px', lineHeight: 1.5 }}>
            Arcade series coming soon. Workouts and banners are being programmed.
          </p>
          <button onClick={onBack} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(253,224,71,0.3)', background: 'rgba(253,224,71,0.08)', cursor: 'pointer', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10, color: C.yellow, letterSpacing: '0.08em' }}>GO BACK</button>
        </div>
      </PhoneFrame>
    );
  }

  if (isOnePunch) {
    return <StageLadder series={series} progress={progress} arcadeSettings={arcadeSettings} onBack={onBack} onStartStage={onStartStage} />;
  }
  return <DefaultSeriesDetail series={series} progress={progress} arcadeSettings={arcadeSettings} onHome={onHome} onBack={onBack} onStartStage={onStartStage} />;
}

// ── 30b: branching ladder + stage accordion modal ─────────────────────────────
const NODE_W = 40;
const NODE_H = 50;
const BOSS_W = 50;
const BOSS_H = 60;
// Node centres as a fraction of the ladder height, so all stages always fit
// on one screen (no scroll) regardless of viewport size.
const CF_TOP = 0.06;
const CF_SPAN = 0.9;
// Zig-zag lanes: boss centred at the top, the rest alternate left/right.
const laneX = (j) => (j === 0 ? 0.5 : j % 2 === 1 ? 0.24 : 0.76);

function StageLadder({ series, progress, arcadeSettings, onBack, onStartStage }) {
  const stages = useMemo(() => series.stages || [], [series]);

  const completedSet = useMemo(() => new Set(
    Object.keys(progress.completedStages || {}).filter(id => progress.completedStages[id]?.completed)
  ), [progress]);

  const highestUnlocked = useMemo(() => {
    for (let i = 1; i < stages.length; i++) {
      const prev = stages[i - 1];
      const prevData = progress.completedStages[prev.id];
      if (!prevData || !prevData.completed) return i;
    }
    return stages.length;
  }, [stages, progress]);

  // The modal is closed until a stage is tapped.
  const [openIdx, setOpenIdx] = useState(null);

  const stageState = (idx) => {
    if (completedSet.has(stages[idx].id)) return 'complete';
    if (idx < highestUnlocked) return 'current';
    return 'locked';
  };
  const accessible = (idx) => idx < highestUnlocked;

  // Render boss (last) at the top, stage 1 at the bottom.
  const rendered = useMemo(() => stages.map((stage, idx) => ({ stage, idx })).reverse(), [stages]);
  const cf = (j) => CF_TOP + (rendered.length > 1 ? (j / (rendered.length - 1)) * CF_SPAN : 0);

  const clearedCount = completedSet.size;
  const selected = openIdx != null ? stages[openIdx] : null;
  const canEnter = openIdx != null && accessible(openIdx);

  function handleStart() {
    if (!selected || !canEnter) return;
    const settings = {
      difficulty: arcadeSettings?.difficulty || 'standard',
      cadence: arcadeSettings?.cadence || 'moderate',
      cadenceMs: arcadeSettings?.cadenceMs || CADENCE_MS_MAP.moderate,
      rest: 'normal', restSeconds: 30,
      voiceCoach: true, cadenceCount: true, cardioFinisher: true, sound: 'on',
    };
    setActiveChallenge({ seriesId: series.id, stageId: selected.id, selectedMode: 'fit', lastPlayedAt: Date.now() });
    onStartStage(series, selected, 'fit', null, settings);
  }

  const objectives = selected ? getStageObjectives(selected) : [];
  const difficulty = selected ? Math.min(5, Math.max(1, Math.ceil((selected.stageNumber || 1) / 2))) : 1;
  const baseXp = selected?.rewards?.xp || 100;

  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop opacity={0.12} />
      <style dangerouslySetInnerHTML={{ __html: detailStyles }} />
      <Embers count={3} />

      <div style={{
        position: 'relative', zIndex: 10, height: '100dvh', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
      }}>
        {/* Header */}
        <div style={{ position: 'relative', flexShrink: 0, padding: '12px 16px 6px', textAlign: 'center' }}>
          <button onClick={onBack} aria-label="Back" style={{ position: 'absolute', left: 12, top: 10, width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(253,224,71,0.28)', background: 'rgba(14,3,26,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={18} color={GOLD} />
          </button>
          <div style={{ position: 'absolute', right: 12, top: 12, fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: GOLD, letterSpacing: '0.06em', background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.28)', borderRadius: 8, padding: '5px 9px' }}>
            {clearedCount}<span style={{ color: 'rgba(200,170,255,0.6)' }}>/{stages.length}</span>
          </div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: '0.08em', background: 'linear-gradient(180deg,#fff6c2,#fde047 45%,#f59e0b 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 0 12px rgba(253,224,71,0.35))' }}>{series.title.toUpperCase()}</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8.5, color: 'rgba(230,215,255,0.6)', letterSpacing: '0.14em', marginTop: 3 }}>
            THE CLIMB · {clearedCount} of {stages.length} · tap a stage
          </div>
        </div>

        {/* Ladder — fixed, no scroll; nodes distributed by % of the height */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          {/* Connector zig-zag */}
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <defs>
              <linearGradient id="ladderPath" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(253,224,71,0.55)" />
                <stop offset="100%" stopColor="rgba(168,85,247,0.45)" />
              </linearGradient>
            </defs>
            <polyline
              points={rendered.map((_, j) => `${laneX(j) * 100},${cf(j) * 100}`).join(' ')}
              fill="none" stroke="url(#ladderPath)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray="2 5" vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Nodes */}
          {rendered.map(({ stage, idx }, j) => {
            const st = stageState(idx);
            const isOpen = idx === openIdx;
            const isBoss = stage.isFinalRound;
            const src = `/static/series/stages/stage-${Math.min(idx + 1, 10)}.webp`;
            const w = isBoss ? BOSS_W : NODE_W;
            const h = isBoss ? BOSS_H : NODE_H;
            return (
              <button
                key={stage.id}
                className="ladder-node"
                onClick={() => setOpenIdx(idx)}
                style={{
                  position: 'absolute', top: `calc(${(cf(j) * 100).toFixed(3)}% - ${h / 2}px)`, left: `${laneX(j) * 100}%`,
                  transform: isOpen ? 'translateX(-50%) scale(1.12)' : 'translateX(-50%)',
                  width: w, height: h, padding: 0, borderRadius: 10, overflow: 'hidden', background: '#0a0014',
                  border: isOpen ? '2px solid #fff' : st === 'complete' ? '1.5px solid rgba(52,211,153,0.65)' : st === 'current' ? '2px solid #fde047' : isBoss ? '1.5px solid rgba(253,224,71,0.5)' : '1.5px solid rgba(168,85,247,0.3)',
                  boxShadow: isOpen ? '0 0 18px rgba(255,255,255,0.5)' : st === 'current' ? '0 0 16px rgba(253,224,71,0.55)' : isBoss ? '0 0 14px rgba(253,224,71,0.3)' : '0 3px 10px rgba(0,0,0,0.5)',
                  cursor: 'pointer', zIndex: isOpen ? 4 : 2,
                }}
              >
                <SafeImage src={src} alt={`Stage ${idx + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: st === 'locked' ? 'grayscale(0.9) brightness(0.4)' : 'none' }} />
                <div style={{ position: 'absolute', inset: 0, background: st === 'locked' ? 'rgba(6,0,14,0.45)' : 'linear-gradient(to top, rgba(5,0,12,0.8), transparent 62%)' }} />
                <div style={{ position: 'absolute', top: 2, left: 4, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: isBoss ? 8 : 11, color: isBoss ? GOLD : '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                  {isBoss ? 'BOSS' : idx + 1}
                </div>
                {st === 'complete' && (
                  <div style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: 'rgba(52,211,153,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={9} color="#04140c" strokeWidth={3} />
                  </div>
                )}
                {st === 'locked' && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Lock size={14} color="rgba(255,255,255,0.6)" />
                  </div>
                )}
                {isBoss && st !== 'locked' && (
                  <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)' }}>
                    <Trophy size={11} color={GOLD} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Compact stage popup — opens on tap */}
        {selected && (
          <div key={selected.id} className="stage-modal" style={{
            position: 'absolute', left: 10, right: 10, bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))', zIndex: 20,
            background: 'linear-gradient(180deg, rgba(22,7,40,0.98), rgba(10,2,20,0.99))',
            border: '1.5px solid rgba(253,224,71,0.34)', borderRadius: 18,
            boxShadow: '0 14px 36px rgba(0,0,0,0.65)',
            padding: '10px 14px 12px',
          }}>
            <button onClick={() => setOpenIdx(null)} aria-label="Close" style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={14} color="rgba(235,225,255,0.8)" />
            </button>

            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: GOLD, letterSpacing: '0.14em' }}>
              {selected.isFinalRound ? 'FINAL BOSS' : `STAGE ${selected.stageNumber}`}
            </div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: '0.02em', lineHeight: 1.05, marginTop: 1, paddingRight: 22 }}>
              {selected.title.toUpperCase()}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0 8px' }}>
              <span style={{ display: 'inline-flex', gap: 2 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} style={{ width: 7, height: 11, borderRadius: 2, background: i < difficulty ? 'linear-gradient(180deg,#fde047,#f59e0b)' : 'rgba(255,255,255,0.14)' }} />
                ))}
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: GOLD, letterSpacing: '0.06em' }}>
                {clearedCount >= (selected.stageNumber || 0) ? '✓ CLEARED' : `+${baseXp} XP`}
              </span>
            </div>

            {/* Objectives as compact chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 11 }}>
              {objectives.map((o, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(168,85,247,0.2)', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: '#f2ecff' }}>
                  <span style={{ color: GOLD, fontSize: 8 }}>◆</span>{o.label}
                </span>
              ))}
            </div>

            <TrainingCTA label={canEnter ? 'ENTER STAGE' : 'LOCKED'} icon={canEnter ? '▶' : '🔒'} variant="gold" disabled={!canEnter} onClick={handleStart} height={46} />
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}

function DefaultSeriesDetail({ series, progress, arcadeSettings, onBack, onStartStage }) {
  const initialMode = series.availableModes?.length === 1 ? series.availableModes[0] : null;
  const [selectedMode, setSelectedMode] = useState(initialMode);
  const [modeOrder, setModeOrder] = useState(null);
  const isPro = true;

  const stages = series.stages;
  const freeLimit = series.freePreviewStages || 0;

  function handleStageSelect(stage, stageIdx) {
    if (!isPro && stageIdx >= freeLimit) return;
    if (!selectedMode) return;
    setActiveChallenge({ seriesId: series.id, stageId: stage.id, selectedMode, modeOrder, lastPlayedAt: Date.now() });
    onStartStage(series, stage, selectedMode, modeOrder, arcadeSettings);
  }

  function isStageAccessible(idx) {
    if (!isPro && idx >= freeLimit) return false;
    if (idx === 0) return true;
    const prev = stages[idx - 1];
    const prevData = progress.completedStages[prev.id];
    return prevData && prevData.completed;
  }

  function getStageStatus(stageId) {
    const data = progress.completedStages[stageId];
    if (!data) return 'locked';
    if (data.completed) return 'complete';
    if (data.fit || data.fight) return 'partial';
    return 'locked';
  }

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: detailStyles }} />
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh', overflowX: 'hidden', padding: '20px 14px calc(170px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: '6px', color: C.text, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={22} />
          </button>
          <div>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 900, color: C.text, letterSpacing: '0.06em' }}>{series.title}</span>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted }}>Arcade Series</div>
          </div>
        </div>

        <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: 'rgba(245,233,255,0.65)', lineHeight: 1.4, margin: '0 0 12px', fontWeight: 400 }}>{series.description}</p>

        {series.availableModes?.length > 1 && (
          <div style={{ background: 'rgba(14,0,28,0.9)', borderRadius: 10, padding: 10, border: '1px solid rgba(253,224,71,0.12)', marginBottom: 12 }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: C.muted, letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>SELECT MODE</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {series.availableModes.map(mode => (
                <button key={mode} onClick={() => { setSelectedMode(mode); setModeOrder(null); }} style={{ flex: 1, padding: '9px 8px', borderRadius: 8, cursor: 'pointer', background: selectedMode === mode ? 'rgba(253,224,71,0.08)' : 'rgba(255,255,255,0.02)', borderWidth: 1, borderStyle: 'solid', borderColor: selectedMode === mode ? 'rgba(253,224,71,0.4)' : 'rgba(255,255,255,0.08)', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, color: selectedMode === mode ? C.yellow : C.muted, letterSpacing: '0.04em' }}>
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
            {selectedMode === 'both' && !modeOrder && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5 }}>What do you want to complete first?</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setModeOrder('fit-first')} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.06)', cursor: 'pointer', fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 10, color: '#a855f7' }}>Start with Fit</button>
                  <button onClick={() => setModeOrder('fight-first')} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 10, color: '#ef4444' }}>Start with Fight</button>
                </div>
              </div>
            )}
          </div>
        )}

        {!selectedMode && series.availableModes?.length > 1 && (
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted, textAlign: 'center', margin: '8px 0' }}>Select a mode above to unlock stages.</p>
        )}

        {selectedMode && (selectedMode !== 'both' || modeOrder) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stages.map((stage, idx) => {
              const acc = isStageAccessible(idx);
              const locked = !isPro && idx >= freeLimit;
              const status = getStageStatus(stage.id);
              return (
                <button key={stage.id} onClick={() => acc && !locked && handleStageSelect(stage, idx)} disabled={!acc || locked || !selectedMode}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: status === 'complete' ? 'rgba(34,197,94,0.04)' : 'rgba(14,0,28,0.9)', border: stage.isFinalRound ? '1px solid rgba(253,224,71,0.3)' : status === 'complete' ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '9px 10px', cursor: acc && !locked ? 'pointer' : 'not-allowed', width: '100%', textAlign: 'left', opacity: (!acc || locked) ? 0.45 : 1 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: stage.isFinalRound ? 'rgba(253,224,71,0.1)' : status === 'complete' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)', border: stage.isFinalRound ? '1px solid rgba(253,224,71,0.3)' : 'none', flexShrink: 0 }}>
                    {locked ? <Lock size={11} color={C.muted} /> : status === 'complete' ? <CheckCircle size={11} color="#22c55e" /> : stage.isFinalRound ? <Trophy size={11} color={C.yellow} /> : <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700, color: C.text }}>{stage.stageNumber}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700, color: stage.isFinalRound ? C.yellow : C.text, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {stage.isFinalRound ? 'FINAL ROUND' : `Stage ${stage.stageNumber}`}: {stage.title}
                    </div>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 400 }}>{stage.focus}</div>
                  </div>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.yellow, fontWeight: 700, flexShrink: 0 }}>+{stage.rewards.xp}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
