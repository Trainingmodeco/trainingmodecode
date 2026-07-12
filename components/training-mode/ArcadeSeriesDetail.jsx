import { useState, useMemo, useRef, useEffect } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import SafeImage from './SafeImage';
import FightRingBackdrop from './shared/FightRingBackdrop';
import TrainingCTA from './shared/TrainingCTA';
import { ChevronLeft, Lock, Check, Trophy, CheckCircle, Star } from 'lucide-react';
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
const ROW = 88;
const NODE_W = 62;
const NODE_H = 78;
const TOP_PAD = 12;
const MODAL_APPROX = 420; // reserve scroll space so bottom nodes clear the floating modal + nav

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

  const [selectedIdx, setSelectedIdx] = useState(() => {
    for (let i = 0; i < stages.length; i++) {
      if (!completedSet.has(stages[i].id)) return Math.min(i, Math.max(0, highestUnlocked - 1));
    }
    return stages.length - 1;
  });

  const ladderRef = useRef(null);
  const nodeRefs = useRef({});

  const stageState = (idx) => {
    if (completedSet.has(stages[idx].id)) return 'complete';
    if (idx < highestUnlocked) return 'current';
    return 'locked';
  };
  const accessible = (idx) => idx < highestUnlocked;

  // Render boss (last) at the top, stage 1 at the bottom — a straight central climb.
  const rendered = useMemo(() => stages.map((stage, idx) => ({ stage, idx })).reverse(), [stages]);
  const laneX = () => 0.5;
  const ladderHeight = TOP_PAD + rendered.length * ROW + 20;

  // Centre the selected node on mount.
  useEffect(() => {
    const el = nodeRefs.current[selectedIdx];
    const c = ladderRef.current;
    // Centre the selected node within the region visible above the modal.
    if (el && c) c.scrollTop = Math.max(0, el.offsetTop - (c.clientHeight - MODAL_APPROX) / 2 - NODE_H / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = stages[selectedIdx];
  const canEnter = accessible(selectedIdx);
  const clearedCount = completedSet.size;

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
  const tiers = [
    { stars: 1, label: 'CLEAR', xp: baseXp },
    { stars: 2, label: 'GREAT', xp: Math.round(baseXp * 1.5) },
    { stars: 3, label: 'PERFECT', xp: baseXp * 2 },
  ];

  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop opacity={0.12} />
      <style dangerouslySetInnerHTML={{ __html: detailStyles }} />
      <Embers count={3} />

      <div style={{ position: 'relative', zIndex: 10, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ position: 'relative', flexShrink: 0, padding: '12px 16px 8px', textAlign: 'center' }}>
          <button onClick={onBack} aria-label="Back" style={{ position: 'absolute', left: 12, top: 10, width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(253,224,71,0.28)', background: 'rgba(14,3,26,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={18} color={GOLD} />
          </button>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: '0.08em', background: 'linear-gradient(180deg,#fff6c2,#fde047 45%,#f59e0b 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 0 12px rgba(253,224,71,0.35))' }}>{series.title.toUpperCase()}</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8.5, color: 'rgba(230,215,255,0.6)', letterSpacing: '0.14em', marginTop: 4 }}>
            THE CLIMB · {clearedCount} of {stages.length} · tap a stage
          </div>
        </div>

        {/* Ladder */}
        <div ref={ladderRef} className="ladder-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ position: 'relative', height: ladderHeight + MODAL_APPROX }}>
            {/* Connector path */}
            <svg width="100%" height={ladderHeight} viewBox={`0 0 100 ${ladderHeight}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <defs>
                <linearGradient id="ladderPath" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(253,224,71,0.55)" />
                  <stop offset="100%" stopColor="rgba(168,85,247,0.45)" />
                </linearGradient>
              </defs>
              <polyline
                points={rendered.map((_, j) => `${laneX(j) * 100},${TOP_PAD + j * ROW + NODE_H / 2}`).join(' ')}
                fill="none" stroke="url(#ladderPath)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray="2 5" vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Nodes */}
            {rendered.map(({ stage, idx }, j) => {
              const st = stageState(idx);
              const isSel = idx === selectedIdx;
              const isBoss = stage.isFinalRound;
              const src = `/static/series/stages/stage-${Math.min(idx + 1, 10)}.webp`;
              const w = isBoss ? NODE_W + 10 : NODE_W;
              const h = isBoss ? NODE_H + 8 : NODE_H;
              return (
                <button
                  key={stage.id}
                  ref={el => { nodeRefs.current[idx] = el; }}
                  className="ladder-node"
                  onClick={() => accessible(idx) && setSelectedIdx(idx)}
                  style={{
                    position: 'absolute', top: TOP_PAD + j * ROW - (h - NODE_H) / 2, left: `${laneX(j) * 100}%`, transform: 'translateX(-50%)',
                    width: w, height: h, padding: 0, borderRadius: 12, overflow: 'hidden', background: '#0a0014',
                    border: isSel ? '2px solid #fde047' : st === 'complete' ? '1.5px solid rgba(52,211,153,0.6)' : isBoss ? '1.5px solid rgba(253,224,71,0.5)' : '1.5px solid rgba(168,85,247,0.3)',
                    boxShadow: isSel ? '0 0 18px rgba(253,224,71,0.6)' : isBoss ? '0 0 16px rgba(253,224,71,0.3)' : '0 4px 12px rgba(0,0,0,0.5)',
                    cursor: accessible(idx) ? 'pointer' : 'default', zIndex: 2,
                  }}
                >
                  <SafeImage src={src} alt={`Stage ${idx + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: st === 'locked' ? 'grayscale(0.9) brightness(0.4)' : 'none' }} />
                  <div style={{ position: 'absolute', inset: 0, background: st === 'locked' ? 'rgba(6,0,14,0.5)' : 'linear-gradient(to top, rgba(5,0,12,0.85), transparent 60%)' }} />
                  {/* number / boss badge */}
                  <div style={{ position: 'absolute', top: 3, left: 4, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: isBoss ? 9 : 11, color: isBoss ? GOLD : '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    {isBoss ? 'BOSS' : idx + 1}
                  </div>
                  {st === 'complete' && (
                    <div style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: '50%', background: 'rgba(52,211,153,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={11} color="#04140c" strokeWidth={3} />
                    </div>
                  )}
                  {st === 'locked' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={16} color="rgba(255,255,255,0.6)" />
                    </div>
                  )}
                  {isBoss && st !== 'locked' && (
                    <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)' }}>
                      <Trophy size={13} color={GOLD} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stage accordion modal */}
        {selected && (
          <div key={selected.id} className="stage-modal" style={{
            position: 'absolute', left: 10, right: 10, bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))', zIndex: 20,
            background: 'linear-gradient(180deg, rgba(20,6,38,0.98), rgba(10,2,20,0.99))',
            border: '1.5px solid rgba(253,224,71,0.32)', borderRadius: 20,
            boxShadow: '0 14px 36px rgba(0,0,0,0.6)',
            padding: '7px 14px 13px',
          }}>
            <div style={{ width: 34, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.22)', margin: '0 auto 8px' }} />

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: GOLD, letterSpacing: '0.14em' }}>
                SELECTED · {selected.isFinalRound ? 'FINAL BOSS' : `STAGE ${selected.stageNumber}`}
              </span>
            </div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '0.02em', lineHeight: 1.05 }}>
              {selected.title.toUpperCase()}
            </div>

            {/* Difficulty + best */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0 9px' }}>
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10, color: C.muted, letterSpacing: '0.04em' }}>Difficulty</span>
              <span style={{ display: 'inline-flex', gap: 2 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} style={{ width: 8, height: 12, borderRadius: 2, background: i < difficulty ? 'linear-gradient(180deg,#fde047,#f59e0b)' : 'rgba(255,255,255,0.14)' }} />
                ))}
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10, color: 'rgba(200,170,255,0.7)' }}>
                {clearedCount >= (selected.stageNumber || 0) ? '✓ Cleared' : `+${baseXp} XP on clear`}
              </span>
            </div>

            {/* Objectives */}
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: 'rgba(200,170,255,0.65)', letterSpacing: '0.16em', marginBottom: 5 }}>MISSION OBJECTIVES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
              {objectives.map((o, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(168,85,247,0.16)' }}>
                  <span style={{ color: GOLD, fontSize: 9 }}>◆</span>
                  <span style={{ flex: 1, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: '#f2ecff' }}>{o.label}</span>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10, color: C.muted }}>{o.detail}</span>
                </div>
              ))}
            </div>

            {/* Star reward tiers */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 11 }}>
              {tiers.map(t => (
                <div key={t.stars} style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 9, background: 'rgba(253,224,71,0.05)', border: '1px solid rgba(253,224,71,0.18)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 1, marginBottom: 3 }}>
                    {Array.from({ length: t.stars }, (_, i) => <Star key={i} size={9} fill={GOLD} color={GOLD} strokeWidth={0} />)}
                  </div>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7, color: 'rgba(230,215,255,0.7)', letterSpacing: '0.06em' }}>{t.label}</div>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9, color: GOLD, marginTop: 1 }}>+{t.xp}</div>
                </div>
              ))}
            </div>

            <TrainingCTA label={canEnter ? 'ENTER STAGE' : 'LOCKED'} icon={canEnter ? '▶' : '🔒'} variant="gold" disabled={!canEnter} onClick={handleStart} height={48} />
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
