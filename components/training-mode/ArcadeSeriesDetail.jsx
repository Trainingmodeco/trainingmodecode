import { useState, useMemo, useRef, useEffect } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import SafeImage from './SafeImage';
import FightRingBackdrop from './shared/FightRingBackdrop';
import TrainingCTA from './shared/TrainingCTA';
import { Lock, Check, X } from 'lucide-react';
import { C } from './Styles';
import { getSeriesProgress, setActiveChallenge } from './data/arcadeProgress';
import { isSeriesPlayable, getStarTiersForStage } from './data/trainingArcadeData';
import { canAccessStage, GATES } from './data/entitlements';

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

export default function ArcadeSeriesDetail({ onHome, series, onBack, onStartStage, onPaywall, arcadeSettings }) {
  const progress = getSeriesProgress(series.id);

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

  return <StageLadder series={series} progress={progress} arcadeSettings={arcadeSettings} onHome={onHome} onBack={onBack} onStartStage={onStartStage} onPaywall={onPaywall} />;
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

function StageLadder({ series, progress, arcadeSettings, onHome, onBack, onStartStage, onPaywall }) {
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
  const [boxH, setBoxH] = useState(0);
  const boxRef = useRef(null);
  const shakeTimer = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const measure = () => { if (boxRef.current) setBoxH(boxRef.current.clientHeight); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Contiguously-cleared count drives the green spine fill.
  let clearedRun = 0;
  while (clearedRun < stages.length && completedSet.has(stages[clearedRun].id)) clearedRun++;
  const clearedCount = completedSet.size;

  // Optional mythic / elite boss sits above the required stages (unlocks once
  // every required stage is cleared; not required for series completion).
  const mythic = series.mythicBoss || null;
  const nodes = useMemo(() => (mythic ? [...stages, mythic] : stages), [stages, mythic]);
  const mythicIdx = mythic ? stages.length : -1;

  const accessible = (idx) => (idx === mythicIdx ? clearedCount >= stages.length : idx < highestUnlocked);
  const stageState = (idx) => {
    if (completedSet.has(nodes[idx].id)) return 'complete';
    if (accessible(idx)) return 'current';
    return 'locked';
  };

  // Ladder layout. Top row: BOSS top-left + ELITE top-right when a mythic
  // exists (boss stays top-centre otherwise); below, the stages zig-zag down
  // the spine (even LEFT / odd RIGHT) and stage 1 sits bottom-centre.
  const bossIdx = stages.length - 1;
  const layout = useMemo(() => {
    const out = [];
    if (mythic) {
      out.push({ stage: stages[bossIdx], idx: bossIdx, lane: LANE_L, row: 0 });
      out.push({ stage: mythic, idx: mythicIdx, lane: LANE_R, row: 0 });
    } else {
      out.push({ stage: stages[bossIdx], idx: bossIdx, lane: 0.5, row: 0 });
    }
    for (let i = bossIdx - 1, r = 1; i >= 0; i--, r++) {
      const stage = stages[i];
      const lane = i === 0 ? 0.5 : ((stage.stageNumber || i + 1) % 2 === 0 ? LANE_L : LANE_R);
      out.push({ stage, idx: i, lane, row: r });
    }
    return out;
  }, [stages, mythic, mythicIdx, bossIdx]);

  // Row positions: sharing the top row keeps the row count at stages.length,
  // so nodes get their full size back. A wider first gap keeps the boss pair
  // clear of the first zig-zag node beneath them.
  const rowCount = Math.max(stages.length, 2);
  const firstGap = mythic ? 1.55 : 1;
  const totalUnits = firstGap + (rowCount - 2);
  const rowY = (row) => CF_TOP + ((row === 0 ? 0 : firstGap + (row - 1)) / totalUnits) * CF_SPAN;
  const unitPx = boxH > 0 ? (boxH * CF_SPAN) / totalUnits : 78;
  const laneOf = (idx) => layout.find(l => l.idx === idx)?.lane ?? 0.5;

  const openIdx = openInfo?.idx ?? null;
  const selected = openIdx != null ? nodes[openIdx] : null;
  const canEnter = openIdx != null && accessible(openIdx);
  // Free tier: stages 1..GATES.freeArcadeStages are free; higher stages + the
  // mythic boss are Pro. Progression already locks stages you haven't unlocked;
  // this is the SEPARATE paywall gate (only bites once the switch is on).
  const stageNumOf = (idx) => (idx == null ? 1 : (nodes[idx]?.stageNumber || (idx === mythicIdx ? stages.length + 1 : idx + 1)));
  const selectedGated = selected != null && !canAccessStage(stageNumOf(openIdx));

  function onNodeTap(e, idx) {
    if (!accessible(idx)) {
      // Locked: brief shake + unlock hint toast instead of the modal.
      setShakeIdx(idx);
      setToast(idx === mythicIdx ? 'CLEAR ALL STAGES TO UNLOCK' : `CLEAR STAGE ${(nodes[idx].stageNumber || idx + 1) - 1} TO UNLOCK`);
      clearTimeout(shakeTimer.current); clearTimeout(toastTimer.current);
      shakeTimer.current = setTimeout(() => setShakeIdx(null), 500);
      toastTimer.current = setTimeout(() => setToast(null), 1800);
      return;
    }
    const btn = e.currentTarget;
    const boxH = boxRef.current ? boxRef.current.clientHeight : 600;
    const nodeY = btn.offsetTop + btn.offsetHeight / 2;
    const stage = nodes[idx];
    const lane = laneOf(idx);
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

  // Play the fit block by default (every series here has one); the stage's own
  // fight block is a future toggle.
  const startMode = series.availableModes?.includes('fit') ? 'fit' : (series.availableModes?.[0] || 'fit');

  function handleStart() {
    if (!selected || !canEnter) return;
    // Paywall gate: a Pro stage routes to the paywall instead of starting.
    if (selectedGated) { onPaywall?.(); return; }
    const settings = {
      difficulty: arcadeSettings?.difficulty || 'standard',
      cadence: arcadeSettings?.cadence || 'moderate',
      cadenceMs: arcadeSettings?.cadenceMs || CADENCE_MS_MAP.moderate,
      rest: 'normal', restSeconds: 30,
      voiceCoach: true, cadenceCount: true, cardioFinisher: true, sound: 'on',
    };
    setActiveChallenge({ seriesId: series.id, stageId: selected.id, selectedMode: startMode, lastPlayedAt: Date.now() });
    onStartStage(series, selected, startMode, null, settings);
  }

  // ── Modal content data ──
  const objectives = selected ? getStageObjectives(selected) : [];
  const difficulty = selected ? Math.min(5, Math.max(1, Math.ceil((selected.stageNumber || 1) / 2))) : 1;
  const baseXp = selected?.rewards?.xp || 100;
  const isCleared = selected ? completedSet.has(selected.id) : false;
  const compData = selected ? progress.completedStages[selected.id] : null;
  const bestSec = compData?.bestTimeSeconds ?? compData?.timeSeconds ?? compData?.durationSeconds ?? null;
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  // Real per-stage time cutoffs (starTiers on stages 2-9, scoring tiers on
  // the benchmark/boss); XP labels only when a stage truly has no times.
  const starTierList = selected ? getStarTiersForStage(selected) : null;
  const targetMin = starTierList?.find(t => t.stars === 3)?.maxMinutes
    ?? selected?.scoringTiers?.find(t => Number.isFinite(t.maxMinutes))?.maxMinutes ?? null;
  const starGoals = starTierList
    ? [...starTierList].sort((a, b) => a.stars - b.stars).map(t => ({ n: t.stars, label: `< ${t.maxMinutes}:00` }))
    : [{ n: 1, label: `CLEAR +${baseXp}` }, { n: 2, label: `+${Math.round(baseXp * 1.5)}` }, { n: 3, label: `+${baseXp * 2}` }];
  const earnedStars = compData?.stars || (isCleared ? 1 : 0);

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
              top: `${rowY(0) * 100}%`, height: `${(rowY(rowCount - 1) - rowY(0)) * 100}%`,
              background: 'linear-gradient(180deg, rgba(250,204,21,0.5), rgba(168,85,247,0.35))',
            }} />
            {clearedRun > 0 && (
              <div style={{
                position: 'absolute', left: 'calc(50% - 1.5px)', width: 3, borderRadius: 2,
                top: `${rowY(clearedRun >= stages.length ? 0 : bossIdx - (clearedRun - 1)) * 100}%`,
                height: `${(rowY(rowCount - 1) - rowY(clearedRun >= stages.length ? 0 : bossIdx - (clearedRun - 1))) * 100}%`,
                background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.6)',
                transition: 'top .8s ease, height .8s ease',
              }} />
            )}

            {/* Branches + nodes */}
            {layout.map(({ stage, idx, lane, row }) => {
              const st = stageState(idx);
              const isOpen = idx === openIdx;
              const isMythic = idx === mythicIdx;
              const isBoss = stage.isFinalRound && !isMythic;
              const src = `/static/series/stages/stage-${Math.min(idx + 1, 10)}.webp`;
              // Full-size cards, aspect preserved: cap the height against the
              // row pitch and derive the width from it so nothing squashes.
              const idealW = isMythic || isBoss ? BOSS_W : st === 'current' ? CUR_W : NODE_W;
              const h = Math.min(Math.round(idealW * ART_AR), Math.max(52, Math.round(unitPx * 1.45)));
              const w = Math.round(h / ART_AR);
              const border = isOpen ? '2px solid #fff'
                : isMythic ? '2px solid #d946ef'
                : st === 'current' ? '2px solid #fde047'
                : st === 'complete' ? '1.5px solid rgba(34,197,94,0.8)'
                : isBoss ? '1.5px solid rgba(253,224,71,0.55)'
                : '1.5px solid rgba(168,85,247,0.28)';
              return (
                <div key={stage.id}>
                  {/* Branch line from the spine */}
                  {lane !== 0.5 && (
                    <div style={{
                      position: 'absolute', top: `calc(${(rowY(row) * 100).toFixed(3)}% - 1px)`, height: 2,
                      left: lane < 0.5 ? `${lane * 100}%` : '50%', width: `${Math.abs(lane - 0.5) * 100}%`,
                      background: st === 'complete' ? 'rgba(34,197,94,0.5)' : 'rgba(168,85,247,0.3)',
                    }} />
                  )}
                  <button
                    className="ladder-node"
                    onClick={(e) => onNodeTap(e, idx)}
                    aria-label={isMythic ? 'Elite boss' : isBoss ? 'Boss stage' : `Stage ${stage.stageNumber || idx + 1}`}
                    style={{
                      position: 'absolute', top: `calc(${(rowY(row) * 100).toFixed(3)}% - ${h / 2}px)`, left: `${lane * 100}%`,
                      transform: 'translateX(-50%)', width: Math.max(w, 44), height: h,
                      padding: 0, border: 'none', background: 'transparent', zIndex: isOpen ? 4 : 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <div
                      className="ladder-node-inner"
                      style={{
                        width: w, height: h, background: '#0a0014', border,
                        boxShadow: isOpen ? '0 0 18px rgba(255,255,255,0.5)' : isMythic ? '0 0 16px rgba(217,70,239,0.5)' : isBoss ? '0 0 14px rgba(253,224,71,0.3)' : '0 3px 10px rgba(0,0,0,0.5)',
                        animation: shakeIdx === idx ? 'node-shake 0.45s ease' : (st === 'current' || (isMythic && accessible(idx))) ? 'node-pulse 2.2s ease-in-out infinite' : 'none',
                      }}
                    >
                      <SafeImage src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: st === 'locked' ? 'grayscale(1) brightness(0.45)' : isMythic ? 'hue-rotate(35deg) saturate(1.3)' : 'none' }} />
                      <div style={{ position: 'absolute', inset: 0, background: st === 'locked' ? 'rgba(6,0,14,0.4)' : isMythic ? 'linear-gradient(to top, rgba(30,2,30,0.78), rgba(80,10,90,0.25) 60%)' : 'linear-gradient(to top, rgba(5,0,12,0.75), transparent 60%)' }} />
                      <div style={{ position: 'absolute', top: 2, left: 4, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: isMythic || isBoss ? 7.5 : 10, color: isMythic ? '#f0abfc' : isBoss ? GOLD : '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)', letterSpacing: '0.04em' }}>
                        {isMythic ? 'ELITE' : isBoss ? 'BOSS' : stage.stageNumber || idx + 1}
                      </div>
                      {st === 'complete' && (
                        <div style={{ position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={9} color="#04140c" strokeWidth={3} />
                        </div>
                      )}
                      {/* Earned stars under cleared stages (boss/mythic keep their crown/skull) */}
                      {st === 'complete' && !isBoss && !isMythic && (
                        <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 1, lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}>
                          {[1, 2, 3].map(n => (
                            <span key={n} style={{ fontSize: 8, color: n <= (progress.completedStages[stage.id]?.stars || 1) ? GOLD : 'rgba(255,255,255,0.3)' }}>★</span>
                          ))}
                        </div>
                      )}
                      {st === 'locked' && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🔒</div>
                      )}
                      {(isBoss || isMythic) && (
                        <div style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', fontSize: 11 }}>{isMythic ? '💀' : '👑'}</div>
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

              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7, color: openIdx === mythicIdx ? '#f0abfc' : GOLD, letterSpacing: '0.18em' }}>
                {openIdx === mythicIdx ? '💀 ELITE CHALLENGE · OPTIONAL' : `SELECTED · ${selected.isFinalRound ? 'FINAL BOSS' : `STAGE ${selected.stageNumber}`}`}
              </div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15, color: openIdx === mythicIdx ? '#f0abfc' : GOLD, letterSpacing: '0.02em', lineHeight: 1.08, marginTop: 2, paddingRight: 20 }}>
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

              {canEnter && selectedGated && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, padding: '6px 9px', borderRadius: 8, background: 'rgba(253,224,71,0.09)', border: '1px solid rgba(253,224,71,0.4)' }}>
                  <span style={{ fontSize: 12 }}>👑</span>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9, color: '#facc15', lineHeight: 1.25 }}>Stages 1–{GATES.freeArcadeStages} are free. Go Pro to unlock the full climb.</span>
                </div>
              )}
              <TrainingCTA
                label={!canEnter ? 'LOCKED' : selectedGated ? 'UNLOCK WITH PRO' : 'ENTER STAGE'}
                icon={!canEnter ? '🔒' : selectedGated ? '👑' : '▶'}
                variant="gold" disabled={!canEnter} onClick={handleStart} height={44} />
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
