import { useState, useMemo } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import SafeImage from './SafeImage';
import FightRingBackdrop from './shared/FightRingBackdrop';
import { ChevronLeft, Lock, CheckCircle, Trophy, Play } from 'lucide-react';
import { C } from './Styles';
import { ArcadeStatusChip, ArcadeSectionLabel } from './ArcadeUI';
import { getSeriesProgress, setActiveChallenge } from './data/arcadeProgress';
import { isSeriesPlayable } from './data/trainingArcadeData';

const GOLD = C.yellow;

const detailStyles = `
.stage-cell {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}
.stage-cell:hover {
  transform: scale(1.04);
}
.stage-cell:active {
  transform: scale(0.96);
}
.stage-cell-locked {
  opacity: 0.4;
  filter: grayscale(0.7);
  cursor: not-allowed;
}
.stage-cell-locked:hover {
  transform: none;
}
.stage-detail-card {
  animation: detail-slide-in 0.2s ease forwards;
}
@keyframes detail-slide-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

const CADENCE_MS_MAP = { slow: 3500, moderate: 2000, fast: 1000 };

const REST_OPTIONS = ['short', 'normal', 'extended'];
const REST_LABELS = { short: 'SHORT', normal: 'NORMAL', extended: 'EXTENDED' };
const REST_MS_MAP = { short: 15, normal: 30, extended: 60 };

function StageDetailCard({ stage, onStart, disabled }) {
  const stageNum = stage.stageNumber || 1;
  const imgSrc = `/static/stages/s${Math.min(stageNum, 10)}.webp`;

  return (
    <div className="stage-detail-card" style={{
      borderRadius: 12, overflow: 'hidden',
      background: 'rgba(12,2,24,0.9)',
      border: '1px solid rgba(253,224,71,0.25)',
      boxShadow: '0 0 20px rgba(253,224,71,0.08)',
      padding: '14px',
    }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        {/* Badge */}
        <div style={{
          width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
          border: '1.5px solid rgba(253,224,71,0.3)',
          background: 'rgba(10,0,20,0.8)',
        }}>
          <SafeImage
            src={imgSrc}
            alt={`Stage ${stageNum}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Title + XP */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
              color: GOLD, letterSpacing: '0.06em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {stage.isFinalRound ? 'FINAL BOSS' : `STAGE ${stageNum}`} &middot; {stage.title}
            </span>
          </div>
          <ArcadeStatusChip tone="gold" style={{ marginBottom: 4 }}>
            +{stage.rewards?.xp || 0} XP
          </ArcadeStatusChip>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted,
            fontWeight: 500, lineHeight: 1.3, marginTop: 2,
          }}>
            {stage.focus}
          </div>
        </div>
      </div>

      {/* Target time (if scoring tiers exist) */}
      {stage.scoringTiers && stage.scoringTiers.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderRadius: 8, marginBottom: 10,
          background: 'rgba(253,224,71,0.04)',
          border: '1px solid rgba(253,224,71,0.12)',
        }}>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
            color: C.muted, letterSpacing: '0.1em',
          }}>TARGET TIME</span>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 900,
            color: GOLD,
          }}>
            S-Rank: {stage.scoringTiers[0].maxMinutes}min
          </span>
        </div>
      )}

      {/* Start button */}
      <button
        onClick={onStart}
        disabled={disabled}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 10,
          background: disabled
            ? 'rgba(255,255,255,0.04)'
            : 'linear-gradient(135deg, #fde047, #f59e0b)',
          color: disabled ? C.muted : '#0a0014',
          border: disabled ? '1px solid rgba(255,255,255,0.1)' : 'none',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
          letterSpacing: '0.12em',
          boxShadow: disabled ? 'none' : '0 0 20px rgba(253,224,71,0.4)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        <Play size={14} fill={disabled ? C.muted : '#0a0014'} strokeWidth={0}/>
        START STAGE {stage.stageNumber || 1}
      </button>
    </div>
  );
}

export default function ArcadeSeriesDetail({ onHome, series, onBack, onStartStage, arcadeSettings }) {
  const progress = getSeriesProgress(series.id);
  const isOnePunch = series.id === 'one-punch-protocol';

  if (!isSeriesPlayable(series)) {
    return (
      <PhoneFrame useBrandBg>
        <div style={{
          position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', padding: '20px 14px',
        }}>
          <Lock size={32} color={C.muted} style={{ marginBottom: 12 }}/>
          <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 14, color: C.text, margin: '0 0 8px', textAlign: 'center' }}>
            {series.title}
          </h2>
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, textAlign: 'center', maxWidth: 260, margin: '0 0 20px', lineHeight: 1.5 }}>
            Arcade series coming soon. Workouts and banners are being programmed.
          </p>
          <button onClick={onBack} style={{
            padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(253,224,71,0.3)',
            background: 'rgba(253,224,71,0.08)', cursor: 'pointer',
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
            color: C.yellow, letterSpacing: '0.08em',
          }}>GO BACK</button>
        </div>
      </PhoneFrame>
    );
  }

  if (isOnePunch) {
    return <OnePunchSetup series={series} progress={progress} arcadeSettings={arcadeSettings} onBack={onBack} onStartStage={onStartStage} />;
  }

  return <DefaultSeriesDetail series={series} progress={progress} arcadeSettings={arcadeSettings} onHome={onHome} onBack={onBack} onStartStage={onStartStage} />;
}

function OnePunchSetup({ series, progress, arcadeSettings, onBack, onStartStage }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stages = series.stages || [];
  const completedStageIds = useMemo(() =>
    Object.keys(progress.completedStages || {}).filter(id => progress.completedStages[id]?.completed),
    [progress]
  );

  const highestUnlocked = useMemo(() => {
    for (let i = 0; i < stages.length; i++) {
      if (i === 0) continue;
      const prev = stages[i - 1];
      const prevData = progress.completedStages[prev.id];
      if (!prevData || !prevData.completed) return i;
    }
    return stages.length;
  }, [stages, progress]);

  const completedSet = new Set(completedStageIds);

  const [selectedStageIdx, setSelectedStageIdx] = useState(() => {
    for (let i = 0; i < stages.length; i++) {
      if (!completedSet.has(stages[i].id)) {
        return i < highestUnlocked ? i : Math.max(0, highestUnlocked - 1);
      }
    }
    return stages.length - 1;
  });

  // Difficulty, cadence, voice, and cardio are embedded in the workout / handled
  // on the timer page — the only session choice here is REST.
  const [rest, setRest] = useState(arcadeSettings?.rest || 'normal');

  const selectedStage = stages[selectedStageIdx];

  function isStageAccessible(idx) {
    return idx < highestUnlocked;
  }

  function getStageState(idx) {
    const stage = stages[idx];
    if (completedSet.has(stage.id)) return 'complete';
    if (idx < highestUnlocked) return 'current';
    return 'locked';
  }

  function handleStart() {
    if (!selectedStage) return;
    if (!isStageAccessible(selectedStageIdx)) return;

    const settings = {
      difficulty: arcadeSettings?.difficulty || 'standard',
      cadence: arcadeSettings?.cadence || 'moderate',
      cadenceMs: arcadeSettings?.cadenceMs || CADENCE_MS_MAP.moderate,
      rest,
      restSeconds: REST_MS_MAP[rest] || 30,
      voiceCoach: true,
      cadenceCount: true,
      cardioFinisher: true,
      sound: 'on',
    };
    setActiveChallenge({ seriesId: series.id, stageId: selectedStage.id, selectedMode: 'fit', lastPlayedAt: Date.now() });
    onStartStage(series, selectedStage, 'fit', null, settings);
  }

  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop opacity={0.14}/>
      <style dangerouslySetInnerHTML={{ __html: detailStyles }}/>
      <Embers count={3}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', padding: '12px 16px 0',
      }}>

        {/* Nav Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: '6px', color: C.text, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={22}/>
          </button>
          <ArcadeStatusChip tone="gold">
            {completedStageIds.length}/{stages.length} COMPLETE
          </ArcadeStatusChip>
        </div>

        <div className="no-scrollbar" style={{ flex: 1, overflowX: 'hidden', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>

          {/* Series title */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h1 style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
              fontSize: 16, letterSpacing: '0.1em', margin: 0,
              background: 'linear-gradient(180deg, #fff6c2 0%, #fde047 38%, #facc15 62%, #a8780a 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text',
              WebkitTextFillColor: 'transparent', color: 'transparent',
              filter: 'drop-shadow(0 0 14px rgba(253,224,71,0.4))',
            }}>{series.title.toUpperCase()}</h1>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted, marginTop: 3, fontWeight: 600 }}>
              {series.subtitle}
            </div>
          </div>

          {/* Horizontal stage map */}
          <ArcadeSectionLabel style={{ marginBottom: 8 }}>STAGE MAP &middot; {completedStageIds.length}/{stages.length}</ArcadeSectionLabel>
          <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
            {stages.map((stage, idx) => {
              const st = getStageState(idx);
              const selected = idx === selectedStageIdx;
              const accessible = isStageAccessible(idx);
              const src = `/static/series/stages/stage-${Math.min(idx + 1, 10)}.webp`;
              return (
                <button key={stage.id} onClick={() => accessible && setSelectedStageIdx(idx)} style={{
                  position: 'relative', flexShrink: 0, width: 60, aspectRatio: '0.6', borderRadius: 10, overflow: 'hidden', padding: 0, background: '#0a0014',
                  border: selected ? '2px solid #fde047' : st === 'complete' ? '1.5px solid rgba(34,197,94,0.55)' : '1.5px solid rgba(168,85,247,0.25)',
                  boxShadow: selected ? '0 0 14px rgba(253,224,71,0.5)' : 'none',
                  cursor: accessible ? 'pointer' : 'default',
                }}>
                  <SafeImage src={src} alt={`Stage ${idx + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: st === 'locked' ? 'grayscale(0.85) brightness(0.4)' : 'none' }}/>
                  {st === 'complete' && (
                    <div style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: '50%', background: 'rgba(34,197,94,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle size={11} color="#fff"/>
                    </div>
                  )}
                  {st === 'locked' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={14} color="rgba(255,255,255,0.55)"/>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Rest — fight-mode style segmented */}
          <ArcadeSectionLabel style={{ marginBottom: 7 }}>REST</ArcadeSectionLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {REST_OPTIONS.map(o => {
              const active = o === rest;
              return (
                <button key={o} onClick={() => setRest(o)} style={{
                  flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8,
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9.5, letterSpacing: '0.04em',
                  background: active ? GOLD : 'rgba(16,4,30,0.8)',
                  border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
                  color: active ? '#0a0014' : '#d9d1ef', cursor: 'pointer',
                }}>{REST_LABELS[o]}</button>
              );
            })}
          </div>

          {/* Selected stage detail card (includes START) */}
          {selectedStage && (
            <StageDetailCard
              stage={selectedStage}
              onStart={handleStart}
              disabled={!isStageAccessible(selectedStageIdx)}
            />
          )}
        </div>
      </div>
    </PhoneFrame>
  );
}

function DefaultSeriesDetail({ series, progress, arcadeSettings, onHome, onBack, onStartStage }) {
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
      <style dangerouslySetInnerHTML={{ __html: detailStyles }}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', overflowX: 'hidden',
        padding: '20px 14px calc(170px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', padding: '6px', color: C.text, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={22}/>
          </button>
          <div>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 900, color: C.text, letterSpacing: '0.06em' }}>
              {series.title}
            </span>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted }}>Arcade Series</div>
          </div>
        </div>

        {/* Banner */}
        <div style={{
          width: '100%', height: 60, borderRadius: 10, marginBottom: 12, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(253,224,71,0.1), rgba(20,0,35,0.95))',
          border: '1px solid rgba(253,224,71,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, color: C.yellow, fontWeight: 900, letterSpacing: '0.12em' }}>
            {series.title.toUpperCase()}
          </div>
        </div>

        {/* Description */}
        <p style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: 'rgba(245,233,255,0.65)',
          lineHeight: 1.4, margin: '0 0 12px', fontWeight: 400,
        }}>{series.description}</p>

        {/* Mode Selection */}
        {series.availableModes?.length > 1 && (
          <div style={{
            background: 'rgba(14,0,28,0.9)', borderRadius: 10, padding: 10,
            border: '1px solid rgba(253,224,71,0.12)', marginBottom: 12,
          }}>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
              color: C.muted, letterSpacing: '0.12em', display: 'block', marginBottom: 8,
            }}>SELECT MODE</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {series.availableModes.map(mode => (
                <button key={mode} onClick={() => { setSelectedMode(mode); setModeOrder(null); }} style={{
                  flex: 1, padding: '9px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: selectedMode === mode ? 'rgba(253,224,71,0.08)' : 'rgba(255,255,255,0.02)',
                  borderWidth: 1, borderStyle: 'solid',
                  borderColor: selectedMode === mode ? 'rgba(253,224,71,0.4)' : 'rgba(255,255,255,0.08)',
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
                  color: selectedMode === mode ? C.yellow : C.muted, letterSpacing: '0.04em',
                }}>
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>

            {selectedMode === 'both' && !modeOrder && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted, fontWeight: 600, display: 'block', marginBottom: 5 }}>
                  What do you want to complete first?
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setModeOrder('fit-first')} style={{
                    flex: 1, padding: '7px', borderRadius: 6, border: '1px solid rgba(168,85,247,0.3)',
                    background: 'rgba(168,85,247,0.06)', cursor: 'pointer',
                    fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 10, color: '#a855f7',
                  }}>Start with Fit</button>
                  <button onClick={() => setModeOrder('fight-first')} style={{
                    flex: 1, padding: '7px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
                    background: 'rgba(239,68,68,0.06)', cursor: 'pointer',
                    fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 10, color: '#ef4444',
                  }}>Start with Fight</button>
                </div>
              </div>
            )}
          </div>
        )}

        {!selectedMode && series.availableModes?.length > 1 && (
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted, textAlign: 'center', margin: '8px 0' }}>
            Select a mode above to unlock stages.
          </p>
        )}

        {/* Stage List */}
        {selectedMode && (selectedMode !== 'both' || modeOrder) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stages.map((stage, idx) => {
              const accessible = isStageAccessible(idx);
              const locked = !isPro && idx >= freeLimit;
              const status = getStageStatus(stage.id);

              return (
                <button
                  key={stage.id}
                  onClick={() => accessible && !locked && handleStageSelect(stage, idx)}
                  disabled={!accessible || locked || !selectedMode}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: status === 'complete' ? 'rgba(34,197,94,0.04)' : 'rgba(14,0,28,0.9)',
                    border: stage.isFinalRound ? '1px solid rgba(253,224,71,0.3)' :
                            status === 'complete' ? '1px solid rgba(34,197,94,0.2)' :
                            '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8, padding: '9px 10px', cursor: accessible && !locked ? 'pointer' : 'not-allowed',
                    width: '100%', textAlign: 'left', opacity: (!accessible || locked) ? 0.45 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: stage.isFinalRound ? 'rgba(253,224,71,0.1)' :
                                status === 'complete' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                    border: stage.isFinalRound ? '1px solid rgba(253,224,71,0.3)' : 'none',
                    flexShrink: 0,
                  }}>
                    {locked ? <Lock size={11} color={C.muted}/> :
                     status === 'complete' ? <CheckCircle size={11} color="#22c55e"/> :
                     stage.isFinalRound ? <Trophy size={11} color={C.yellow}/> :
                     <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700, color: C.text }}>{stage.stageNumber}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
                      color: stage.isFinalRound ? C.yellow : C.text, marginBottom: 1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {stage.isFinalRound ? 'FINAL ROUND' : `Stage ${stage.stageNumber}`}: {stage.title}
                    </div>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 400 }}>
                      {stage.focus}
                    </div>
                  </div>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.yellow, fontWeight: 700, flexShrink: 0 }}>
                    +{stage.rewards.xp}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
