import { useState, useMemo } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import SafeImage from './SafeImage';
import { ChevronLeft, Lock, CheckCircle, Trophy, Crown, Zap, Play } from 'lucide-react';
import { C } from './Styles';
import { ArcadeStatusChip, ArcadeSectionLabel, ArcadePrimaryButton, ArcadeHudPanel, ARCADE } from './ArcadeUI';
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

const DIFFICULTIES = ['rookie', 'standard', 'heroic', 'boss'];
const DIFFICULTY_LABELS = { rookie: 'ROOKIE', standard: 'STANDARD', heroic: 'HEROIC', boss: 'BOSS' };

const CADENCE_PRESETS = ['slow', 'moderate', 'fast', 'custom'];
const CADENCE_LABELS = { slow: 'SLOW', moderate: 'MODERATE', fast: 'FAST', custom: 'CUSTOM' };
const CADENCE_MS_MAP = { slow: 3500, moderate: 2000, fast: 1000 };

const REST_OPTIONS = ['short', 'normal', 'extended'];
const REST_LABELS = { short: 'SHORT', normal: 'NORMAL', extended: 'EXTENDED' };
const REST_MS_MAP = { short: 15, normal: 30, extended: 60 };

function SegmentedRow({ options, labels, value, onChange, small }) {
  return (
    <div style={{
      display: 'flex', borderRadius: 10, overflow: 'hidden',
      border: `1px solid ${ARCADE.violetBorderSoft}`,
    }}>
      {options.map((o, idx) => {
        const active = o === value;
        return (
          <button key={o} onClick={() => onChange(o)} style={{
            flex: 1, padding: small ? '9px 4px' : '11px 8px', border: 'none',
            borderRight: idx < options.length - 1 ? `1px solid ${ARCADE.violetBorderSoft}` : 'none',
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
            fontSize: small ? 8 : 9, letterSpacing: '0.06em',
            transition: 'all 0.2s ease',
            background: active ? 'rgba(253,224,71,0.15)' : 'rgba(10,0,20,0.5)',
            color: active ? GOLD : 'rgba(196,181,253,0.7)',
            boxShadow: active ? 'inset 0 0 12px rgba(253,224,71,0.18)' : 'none',
            cursor: 'pointer',
          }}>
            {(labels && labels[o]) || o.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }) {
  return (
    <div style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(10,0,20,0.6)', borderRadius: 10, padding: '10px 12px',
      marginBottom: 12,
      border: `1px solid ${value ? ARCADE.goldBorderSoft : ARCADE.violetBorderSoft}`,
      transition: 'border-color 0.2s ease',
    }}>
      <div>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: C.text, fontSize: 10, letterSpacing: '0.06em' }}>{label}</div>
        {description && <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted, marginTop: 2 }}>{description}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div className={`tm-toggle ${value ? 'on' : ''}`}><div className="tm-toggle-knob"/></div>
      </button>
    </div>
  );
}

function StageCell({ stage, idx, state, isBoss, isSelected, onSelect }) {
  const stageNum = stage.stageNumber || (idx + 1);
  const imgSrc = `/static/stages/s${Math.min(stageNum, 10)}.webp`;
  const isLocked = state === 'locked';
  const isComplete = state === 'complete';
  const isCurrent = state === 'current';

  const borderColor = isComplete
    ? 'rgba(34,197,94,0.6)'
    : isCurrent
      ? 'rgba(253,224,71,0.7)'
      : 'rgba(168,85,247,0.15)';

  const boxShadow = isCurrent
    ? '0 0 14px rgba(253,224,71,0.3)'
    : isComplete
      ? '0 0 8px rgba(34,197,94,0.2)'
      : 'none';

  return (
    <button
      className={`stage-cell${isLocked ? ' stage-cell-locked' : ''}`}
      onClick={() => !isLocked && onSelect(idx)}
      disabled={isLocked}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        background: isSelected ? 'rgba(253,224,71,0.08)' : 'rgba(10,0,20,0.6)',
        boxShadow: isSelected ? '0 0 16px rgba(253,224,71,0.35)' : boxShadow,
        overflow: 'hidden',
        padding: 0,
      }}
    >
      {/* Stage art - FULL, no crop, no overlay */}
      <SafeImage
        src={imgSrc}
        alt={`Stage ${stageNum}`}
        loading="lazy"
        decoding="async"
        style={{
          width: '100%', height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />

      {/* State indicators */}
      {isComplete && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: 18, height: 18, borderRadius: '50%',
          background: 'rgba(34,197,94,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 6px rgba(34,197,94,0.5)',
        }}>
          <CheckCircle size={11} color="#fff" strokeWidth={2.5}/>
        </div>
      )}

      {isCurrent && (
        <div style={{
          position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(253,224,71,0.9)', color: '#0a0014',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 6,
          letterSpacing: '0.06em', whiteSpace: 'nowrap',
        }}>CURRENT</div>
      )}

      {isLocked && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(5,0,15,0.4)',
        }}>
          <Lock size={16} color="rgba(255,255,255,0.3)"/>
        </div>
      )}

      {isBoss && (
        <div style={{
          position: 'absolute', top: 4, left: 4,
          width: 16, height: 16, borderRadius: '50%',
          background: 'rgba(253,224,71,0.15)', border: '1px solid rgba(253,224,71,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Crown size={9} color={GOLD}/>
        </div>
      )}
    </button>
  );
}

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

  const [difficulty, setDifficulty] = useState(arcadeSettings?.difficulty || 'standard');
  const [cadencePreset, setCadencePreset] = useState(arcadeSettings?.cadence || 'moderate');
  const [customCadenceMs, setCustomCadenceMs] = useState(arcadeSettings?.cadenceMs || 2000);
  const [rest, setRest] = useState(arcadeSettings?.rest || 'normal');
  const [voiceCoach, setVoiceCoach] = useState(arcadeSettings?.voiceCoach !== false);
  const [cadenceCount, setCadenceCount] = useState(arcadeSettings?.cadenceCount !== false);
  const [cardioFinisher, setCardioFinisher] = useState(arcadeSettings?.cardioFinisher !== false);

  const selectedStage = stages[selectedStageIdx];
  const stageHasCardio = !!selectedStage?.cardioBlock;
  const cardioRequired = !!selectedStage?.cardioBlock?.cardioRequired;
  const isBenchmarkStage = selectedStage?.stageType === 'benchmark';
  const cadenceLocked = selectedStage?.cadenceLocked || false;

  const cadenceMs = cadencePreset === 'custom' ? customCadenceMs : (CADENCE_MS_MAP[cadencePreset] || 2000);

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
      difficulty,
      cadence: cadencePreset,
      cadenceMs,
      rest,
      restSeconds: REST_MS_MAP[rest] || 30,
      voiceCoach,
      cadenceCount,
      cardioFinisher,
      sound: voiceCoach ? 'on' : 'off',
    };
    setActiveChallenge({ seriesId: series.id, stageId: selectedStage.id, selectedMode: 'fit', lastPlayedAt: Date.now() });
    onStartStage(series, selectedStage, 'fit', null, settings);
  }

  return (
    <PhoneFrame useBrandBg>
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

        <div className="no-scrollbar" style={{ flex: 1, overflowX: 'hidden', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(180px + env(safe-area-inset-bottom, 0px))' }}>

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

          {/* 3-column stage grid */}
          <ArcadeSectionLabel style={{ marginBottom: 8 }}>STAGE SELECT</ArcadeSectionLabel>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            marginBottom: 16,
          }}>
            {stages.map((stage, idx) => (
              <StageCell
                key={stage.id}
                stage={stage}
                idx={idx}
                state={getStageState(idx)}
                isBoss={stage.isFinalRound}
                isSelected={idx === selectedStageIdx}
                onSelect={setSelectedStageIdx}
              />
            ))}
          </div>

          {/* Selected stage detail card */}
          {selectedStage && (
            <StageDetailCard
              stage={selectedStage}
              onStart={handleStart}
              disabled={!isStageAccessible(selectedStageIdx)}
            />
          )}

          {/* Settings section */}
          <div style={{ marginTop: 18 }}>
            <ArcadeSectionLabel style={{ marginBottom: 6 }}>DIFFICULTY</ArcadeSectionLabel>
            <div style={{ marginBottom: 14 }}>
              <SegmentedRow options={DIFFICULTIES} labels={DIFFICULTY_LABELS} value={difficulty} onChange={setDifficulty} small/>
            </div>

            <ArcadeSectionLabel style={{ marginBottom: 6 }}>CADENCE</ArcadeSectionLabel>
            {cadenceLocked ? (
              <div style={{
                padding: '10px 12px', borderRadius: 10, marginBottom: 14,
                background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: 'rgba(239,68,68,0.8)', fontWeight: 600 }}>
                  Cadence locked for this stage.
                </span>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 8 }}>
                  <SegmentedRow options={CADENCE_PRESETS} labels={CADENCE_LABELS} value={cadencePreset} onChange={setCadencePreset}/>
                </div>
                {cadencePreset === 'custom' && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(10,0,20,0.6)', border: `1px solid ${ARCADE.violetBorderSoft}`,
                    marginBottom: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20, color: GOLD }}>
                        {(customCadenceMs / 1000).toFixed(2)}
                      </span>
                      <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: C.muted }}>
                        sec / rep
                      </span>
                    </div>
                    <input
                      type="range"
                      min={750}
                      max={4000}
                      step={250}
                      value={customCadenceMs}
                      onChange={e => setCustomCadenceMs(Number(e.target.value))}
                      style={{
                        width: '100%', height: 6, appearance: 'none', borderRadius: 3,
                        background: `linear-gradient(to right, ${GOLD} 0%, ${GOLD} ${((customCadenceMs - 750) / (4000 - 750)) * 100}%, rgba(255,255,255,0.08) ${((customCadenceMs - 750) / (4000 - 750)) * 100}%, rgba(255,255,255,0.08) 100%)`,
                        cursor: 'pointer',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted }}>0.75s FAST</span>
                      <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted }}>4.00s SLOW</span>
                    </div>
                  </div>
                )}
                {cadencePreset !== 'custom' && <div style={{ marginBottom: 14 }}/>}
              </>
            )}

            <ArcadeSectionLabel style={{ marginBottom: 6 }}>REST</ArcadeSectionLabel>
            <div style={{ marginBottom: 14 }}>
              <SegmentedRow options={REST_OPTIONS} labels={REST_LABELS} value={rest} onChange={setRest}/>
            </div>

            <ToggleRow
              label="VOICE COACH"
              description="Audio prompts and rep guidance"
              value={voiceCoach}
              onChange={setVoiceCoach}
            />
            <ToggleRow
              label="CADENCE COUNT"
              description="Coach counts your reps automatically"
              value={cadenceCount}
              onChange={setCadenceCount}
            />
            {isBenchmarkStage ? (
              <div style={{
                width: '100%', borderRadius: 10, padding: '10px 12px', marginBottom: 12,
                background: 'rgba(10,0,20,0.6)', border: `1px solid ${ARCADE.violetBorderSoft}`,
              }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: C.text, fontSize: 10, letterSpacing: '0.06em' }}>CARDIO</div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>
                  Stage 1 is benchmark only. Cardio unlocks in Stage 2.
                </div>
              </div>
            ) : stageHasCardio && cardioRequired ? (
              <div style={{
                width: '100%', borderRadius: 10, padding: '10px 12px', marginBottom: 12,
                background: 'rgba(253,224,71,0.06)', border: `1px solid ${ARCADE.goldBorderSoft}`,
              }}>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: GOLD, fontSize: 10, letterSpacing: '0.06em' }}>CARDIO BLOCK — REQUIRED</div>
                <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>
                  Cardio runs after your rep work to complete this stage.
                </div>
              </div>
            ) : stageHasCardio ? (
              <ToggleRow
                label="CARDIO FINISHER"
                description="Optional cardio block after rep work"
                value={cardioFinisher}
                onChange={setCardioFinisher}
              />
            ) : null}
          </div>
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
