import { useState, useMemo, useRef } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
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
.ladder-node { cursor: pointer; }
.ladder-node-inner { width: 100%; height: 100%; position: relative; border-radius: 9px; overflow: hidden; transition: transform .15s ease; }
.ladder-node:active .ladder-node-inner { transform: scale(0.94); }
.ladder-dim { filter: brightness(0.45); }
.ladder-layer { transition: filter .2s ease; }
@keyframes node-pulse { 0%,100% { box-shadow: 0 0 10px rgba(253,224,71,0.45); } 50% { box-shadow: 0 0 24px rgba(253,224,71,0.85); } }
@keyframes node-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
.stage-modal { animation: modal-pop .22s cubic-bezier(.2,.8,.25,1) forwards; }
@keyframes modal-pop { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes toast-in { from { opacity: 0; transform: translate(-50%, -6px); } to { opacity: 1; transform: translate(-50%, 0); } }
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
    return <StageLadder series={series} progress={progress} arcadeSettings={arcadeSettings} onHome={onHome} onBack={onBack} onStartStage={onStartStage} />;
  }
  return <DefaultSeriesDetail series={series} progress={progress} arcadeSettings={arcadeSettings} onHome={onHome} onBack={onBack} onStartStage={onStartStage} />;
}

// ── 30b: branching ladder + stage accordion modal ─────────────────────────────
// Stage-card sizes: portrait art at 971:1619, sized up a touch per feedback.
const NODE_W = 52;
const CUR_W = 66;
const BOSS_W = 62;
const ART_AR = 1619 / 971;
// Node centres as a fraction of the ladder-box height, so all stages always
// fit on one screen (no scroll) regardless of viewport size.
const CF_TOP = 0.085;
const CF_SPAN = 0.85;
// Branch lanes off the centre spine: even stages LEFT, odd stages RIGHT;
// stage 1 and the boss sit on the spine itself.
const LANE_L = 0.26;
const LANE_R = 0.74;
const MODAL_H = 300; // approximate popup height used for clamping

function StageLadder({ series, progress, arcadeSettings, onHome, onBack, onStartStage }) {
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

  // Modal state: { idx, top, side ('L'|'R'|'C'), notchY, notch ('side'|'top'|'bottom') }
  const [openInfo, setOpenInfo] = useState(null);
  const [shakeIdx, setShakeIdx] = useState(null);
  const [toast, setToast] = useState(null);
  const boxRef = useRef(null);
  const shakeTimer = useRef(null);
  const toastTimer = useRef(null);

  const stageState = (idx) => {
    if (completedSet.has(stages[idx].id)) return 'complete';
    if (idx < highestUnlocked) return 'current';
    return 'locked';
  };
  const accessible = (idx) => idx < highestUnlocked;

  // Render boss (last) at the top, stage 1 at the bottom.
  const rendered = useMemo(() => stages.map((stage, idx) => ({ stage, idx })).reverse(), [stages]);
  const N = rendered.length;
  const cf = (j) => CF_TOP + (N > 1 ? (j / (N - 1)) * CF_SPAN : 0);
  // Stage 1 and the boss sit on the spine; even stages branch LEFT, odd RIGHT.
  const laneFor = (stage, idx) => {
    if (idx === 0 || stage.isFinalRound) return 0.5;
    return (stage.stageNumber || idx + 1) % 2 === 0 ? LANE_L : LANE_R;
  };

  // Contiguously-cleared count drives the green spine fill.
  let clearedRun = 0;
  while (clearedRun < stages.length && completedSet.has(stages[clearedRun].id)) clearedRun++;
  const clearedCount = completedSet.size;

  const openIdx = openInfo?.idx ?? null;
  const selected = openIdx != null ? stages[openIdx] : null;
  const canEnter = openIdx != null && accessible(openIdx);

  function onNodeTap(e, idx) {
    if (!accessible(idx)) {
      // Locked: brief shake + unlock hint toast instead of the modal.
      setShakeIdx(idx);
      setToast(`CLEAR STAGE ${(stages[idx].stageNumber || idx + 1) - 1} TO UNLOCK`);
      clearTimeout(shakeTimer.current); clearTimeout(toastTimer.current);
      shakeTimer.current = setTimeout(() => setShakeIdx(null), 500);
      toastTimer.current = setTimeout(() => setToast(null), 1800);
      return;
    }
    const btn = e.currentTarget;
    const boxH = boxRef.current ? boxRef.current.clientHeight : 600;
    const nodeY = btn.offsetTop + btn.offsetHeight / 2;
    const stage = stages[idx];
    const lane = laneFor(stage, idx);
    let side, top, notch;
    if (lane === 0.5) {
      if (stage.isFinalRound) { side = 'C'; notch = 'top'; top = Math.min(nodeY + btn.offsetHeight / 2 + 12, Math.max(6, boxH - MODAL_H - 6)); }
      else { side = 'C'; notch = 'bottom'; top = Math.max(6, nodeY - btn.offsetHeight / 2 - MODAL_H - 12); }
    } else {
      // Modal opens on the opposite side of the spine, aligned with the node.
      side = lane === LANE_R ? 'L' : 'R';
      notch = 'side';
      top = Math.min(Math.max(6, nodeY - MODAL_H / 2), Math.max(6, boxH - MODAL_H - 6));
    }
    const notchY = Math.min(Math.max(nodeY - top - 6, 14), MODAL_H - 40);
    setOpenInfo({ idx, top, side, notchY, notch });
  }

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

  // ── Modal content data ──
  const objectives = selected ? getStageObjectives(selected) : [];
  const difficulty = selected ? Math.min(5, Math.max(1, Math.ceil((selected.stageNumber || 1) / 2))) : 1;
  const baseXp = selected?.rewards?.xp || 100;
  const isCleared = selected ? completedSet.has(selected.id) : false;
  const compData = selected ? progress.completedStages[selected.id] : null;
  const bestSec = compData?.bestTimeSeconds ?? compData?.timeSeconds ?? compData?.durationSeconds ?? null;
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const targetMin = selected?.scoringTiers?.find(t => Number.isFinite(t.maxMinutes))?.maxMinutes ?? null;
  const timeTiers = (selected?.scoringTiers || []).filter(t => Number.isFinite(t.maxMinutes));
  const starGoals = timeTiers.length >= 3
    ? [{ n: 1, label: `< ${timeTiers[2].maxMinutes}:00` }, { n: 2, label: `< ${timeTiers[1].maxMinutes}:00` }, { n: 3, label: `< ${timeTiers[0].maxMinutes}:00` }]
    : [{ n: 1, label: `CLEAR +${baseXp}` }, { n: 2, label: `+${Math.round(baseXp * 1.5)}` }, { n: 3, label: `+${baseXp * 2}` }];
  const earnedStars = isCleared ? 1 : 0;

  // Modal horizontal placement per side.
  const modalPos = openInfo
    ? openInfo.side === 'L' ? { left: 8, width: '55%' }
      : openInfo.side === 'R' ? { right: 8, width: '55%' }
      : { left: '22%', width: '56%' }
    : null;

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
        {/* Standard app header (TT logo) */}
        <TrainingHeader
          title={series.title.toUpperCase()}
          subtitle={`THE CLIMB · ${clearedCount} of ${stages.length} · tap a stage`}
          onHome={onHome}
          showBack
          onBack={onBack}
          rightSlot={(
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: GOLD, letterSpacing: '0.06em', background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.28)', borderRadius: 8, padding: '5px 9px' }}>
              {clearedCount}<span style={{ color: 'rgba(200,170,255,0.6)' }}>/{stages.length}</span>
            </span>
          )}
        />
        <div style={{ height: 6, flexShrink: 0 }} />

        {/* Ladder box — compact, no scroll */}
        <div ref={boxRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {/* Everything dimmable lives in this layer */}
          <div className={`ladder-layer${openInfo ? ' ladder-dim' : ''}`} style={{ position: 'absolute', inset: 0 }}>
            {/* Centre spine: gold → violet, green over the cleared lower section */}
            <div style={{
              position: 'absolute', left: 'calc(50% - 1.5px)', width: 3, borderRadius: 2,
              top: `${cf(0) * 100}%`, height: `${(cf(N - 1) - cf(0)) * 100}%`,
              background: 'linear-gradient(180deg, rgba(250,204,21,0.5), rgba(168,85,247,0.35))',
            }} />
            {clearedRun > 0 && (
              <div style={{
                position: 'absolute', left: 'calc(50% - 1.5px)', width: 3, borderRadius: 2,
                top: `${cf(N - clearedRun) * 100}%`, height: `${(cf(N - 1) - cf(N - clearedRun)) * 100}%`,
                background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.6)',
                transition: 'top .8s ease, height .8s ease',
              }} />
            )}

            {/* Branches + nodes */}
            {rendered.map(({ stage, idx }, j) => {
              const st = stageState(idx);
              const isOpen = idx === openIdx;
              const isBoss = stage.isFinalRound;
              const lane = laneFor(stage, idx);
              const src = `/static/series/stages/stage-${Math.min(idx + 1, 10)}.webp`;
              const w = isBoss ? BOSS_W : st === 'current' ? CUR_W : NODE_W;
              const h = Math.round(w * ART_AR);
              const border = isOpen ? '2px solid #fff'
                : st === 'current' ? '2px solid #fde047'
                : st === 'complete' ? '1.5px solid rgba(34,197,94,0.8)'
                : isBoss ? '1.5px solid rgba(253,224,71,0.55)'
                : '1.5px solid rgba(168,85,247,0.28)';
              return (
                <div key={stage.id}>
                  {/* Branch line from the spine */}
                  {lane !== 0.5 && (
                    <div style={{
                      position: 'absolute', top: `calc(${(cf(j) * 100).toFixed(3)}% - 1px)`, height: 2,
                      left: lane < 0.5 ? `${lane * 100}%` : '50%', width: `${Math.abs(lane - 0.5) * 100}%`,
                      background: st === 'complete' ? 'rgba(34,197,94,0.5)' : 'rgba(168,85,247,0.3)',
                    }} />
                  )}
                  <button
                    className="ladder-node"
                    onClick={(e) => onNodeTap(e, idx)}
                    aria-label={isBoss ? 'Boss stage' : `Stage ${stage.stageNumber || idx + 1}`}
                    style={{
                      position: 'absolute', top: `calc(${(cf(j) * 100).toFixed(3)}% - ${h / 2}px)`, left: `${lane * 100}%`,
                      transform: 'translateX(-50%)', width: Math.max(w, 44), height: h,
                      padding: 0, border: 'none', background: 'transparent', zIndex: isOpen ? 4 : 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <div
                      className="ladder-node-inner"
                      style={{
                        width: w, height: h, background: '#0a0014', border,
                        boxShadow: isOpen ? '0 0 18px rgba(255,255,255,0.5)' : isBoss ? '0 0 14px rgba(253,224,71,0.3)' : '0 3px 10px rgba(0,0,0,0.5)',
                        animation: shakeIdx === idx ? 'node-shake 0.45s ease' : st === 'current' ? 'node-pulse 2.2s ease-in-out infinite' : 'none',
                      }}
                    >
                      <SafeImage src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: st === 'locked' ? 'grayscale(1) brightness(0.45)' : 'none' }} />
                      <div style={{ position: 'absolute', inset: 0, background: st === 'locked' ? 'rgba(6,0,14,0.4)' : 'linear-gradient(to top, rgba(5,0,12,0.75), transparent 60%)' }} />
                      <div style={{ position: 'absolute', top: 2, left: 4, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: isBoss ? 8 : 10, color: isBoss ? GOLD : '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                        {isBoss ? 'BOSS' : stage.stageNumber || idx + 1}
                      </div>
                      {st === 'complete' && (
                        <div style={{ position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={9} color="#04140c" strokeWidth={3} />
                        </div>
                      )}
                      {st === 'locked' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🔒</div>
                      )}
                      {isBoss && (
                        <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', fontSize: 11 }}>👑</div>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Tap-outside catcher while the modal is open */}
          {openInfo && (
            <div onClick={() => setOpenInfo(null)} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'transparent' }} />
          )}

          {/* Side-anchored glass stage modal */}
          {openInfo && selected && (
            <div key={selected.id} className="stage-modal" style={{
              position: 'absolute', top: openInfo.top, ...modalPos, zIndex: 20,
              background: 'rgba(16,9,31,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              border: '1.5px solid rgba(253,224,71,0.45)', borderRadius: 18,
              boxShadow: '0 14px 36px rgba(0,0,0,0.6)',
              padding: '10px 12px 12px',
            }}>
              {/* Pointer notch toward the tapped node */}
              {openInfo.notch === 'side' && (
                <div style={{
                  position: 'absolute', top: openInfo.notchY, width: 11, height: 11,
                  background: 'rgba(16,9,31,0.9)', transform: 'rotate(45deg)',
                  ...(openInfo.side === 'L'
                    ? { right: -7, borderTop: '1.5px solid rgba(253,224,71,0.45)', borderRight: '1.5px solid rgba(253,224,71,0.45)' }
                    : { left: -7, borderBottom: '1.5px solid rgba(253,224,71,0.45)', borderLeft: '1.5px solid rgba(253,224,71,0.45)' }),
                }} />
              )}
              {openInfo.notch === 'bottom' && (
                <div style={{ position: 'absolute', bottom: -7, left: 'calc(50% - 6px)', width: 11, height: 11, background: 'rgba(16,9,31,0.9)', transform: 'rotate(45deg)', borderBottom: '1.5px solid rgba(253,224,71,0.45)', borderRight: '1.5px solid rgba(253,224,71,0.45)' }} />
              )}
              {openInfo.notch === 'top' && (
                <div style={{ position: 'absolute', top: -7, left: 'calc(50% - 6px)', width: 11, height: 11, background: 'rgba(16,9,31,0.9)', transform: 'rotate(45deg)', borderTop: '1.5px solid rgba(253,224,71,0.45)', borderLeft: '1.5px solid rgba(253,224,71,0.45)' }} />
              )}

              <button onClick={() => setOpenInfo(null)} aria-label="Close" style={{ position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={12} color="rgba(235,225,255,0.8)" />
              </button>

              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7, color: GOLD, letterSpacing: '0.18em' }}>
                SELECTED · {selected.isFinalRound ? 'FINAL BOSS' : `STAGE ${selected.stageNumber}`}
              </div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15, color: GOLD, letterSpacing: '0.02em', lineHeight: 1.08, marginTop: 2, paddingRight: 20 }}>
                {selected.title.toUpperCase()}
              </div>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9, color: '#c4a4d8', margin: '4px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                Difficulty
                <span style={{ display: 'inline-flex', gap: 1.5 }}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} style={{ width: 6, height: 9, borderRadius: 1.5, background: i < difficulty ? 'linear-gradient(180deg,#fde047,#f59e0b)' : 'rgba(255,255,255,0.14)' }} />
                  ))}
                </span>
                {bestSec != null && <span>· Best {fmtTime(bestSec)}</span>}
              </div>

              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 7, color: 'rgba(200,170,255,0.7)', letterSpacing: '0.16em', marginBottom: 4 }}>MISSION OBJECTIVES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                {objectives.map((o, i) => {
                  const isLast = i === objectives.length - 1;
                  const right = i === 0 && targetMin != null ? `${targetMin}:00 ⏱` : isLast ? `+${baseXp} XP` : (o.detail || '');
                  const rightGold = isLast || (i === 0 && targetMin != null);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}>
                      <span style={{ color: GOLD, fontSize: 8, flexShrink: 0 }}>◈</span>
                      <span style={{ flex: 1, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: '#f2ecff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.label}{o.detail && (i === 0 && targetMin != null) ? ` · ${o.detail}` : ''}
                      </span>
                      {right && <span style={{ flexShrink: 0, fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, color: rightGold ? GOLD : 'rgba(200,170,255,0.7)', letterSpacing: '0.04em' }}>{right}</span>}
                    </div>
                  );
                })}
              </div>

              {/* Star goals */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {starGoals.map(t => (
                  <div key={t.n} style={{ flex: 1, textAlign: 'center', padding: '5px 0 4px', borderRadius: 8, background: 'rgba(253,224,71,0.05)', border: '1px solid rgba(253,224,71,0.16)' }}>
                    <div style={{ fontSize: 8, letterSpacing: 1, color: t.n <= earnedStars ? GOLD : 'rgba(255,255,255,0.28)' }}>
                      {'★'.repeat(t.n)}
                    </div>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7, color: 'rgba(230,215,255,0.75)', letterSpacing: '0.04em', marginTop: 2 }}>{t.label}</div>
                  </div>
                ))}
              </div>

              <TrainingCTA label={canEnter ? 'ENTER STAGE' : 'LOCKED'} icon={canEnter ? '▶' : '🔒'} variant="gold" disabled={!canEnter} onClick={handleStart} height={44} />
            </div>
          )}

          {/* Locked-stage toast */}
          {toast && (
            <div style={{
              position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
              padding: '7px 14px', borderRadius: 9, background: 'rgba(20,4,10,0.92)',
              border: '1px solid rgba(239,68,68,0.55)', boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: '#fca5a5', letterSpacing: '0.12em',
              whiteSpace: 'nowrap', animation: 'toast-in .2s ease forwards',
            }}>
              🔒 {toast}
            </div>
          )}
        </div>

        {/* A little breathing room above the footer tabs */}
        <div style={{ height: '5dvh', flexShrink: 0 }} />
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
