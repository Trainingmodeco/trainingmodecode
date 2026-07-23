import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import SafeImage from './SafeImage';
import ArcadeConstellationMap from './ArcadeConstellationMap';
import ArcadeDifficultySelector from './ArcadeDifficultySelector';
import { C } from './Styles';
import { Star, ChevronRight, Lock, Trophy, Zap, Target } from 'lucide-react';
import { getSeriesProgress } from './data/arcadeProgress';
import { isSeriesPlayable } from './data/trainingArcadeData';

function StarRow({ count, accent }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={11} fill={i < count ? accent : 'transparent'} color={i < count ? accent : 'rgba(255,255,255,0.15)'} strokeWidth={1.5}/>
      ))}
    </div>
  );
}

function InfoSection({ title, children }) {
  return (
    <div style={{
      background: 'rgba(14,0,28,0.7)', borderRadius: 10, padding: '8px 12px',
      border: '1px solid rgba(168,85,247,0.12)', marginBottom: 8,
    }}>
      <span style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
        color: C.muted, letterSpacing: '0.12em', display: 'block', marginBottom: 6,
      }}>{title}</span>
      {children}
    </div>
  );
}

export default function ArcadeSeriesIntroPage({ series, onHome, onBack, onContinue }) {
  const safeSeries = series || {};

  const [settings, setSettings] = useState(() => {
    const cadenceOpts = safeSeries.cadenceOptions || [];
    const diffOpts = safeSeries.difficultyOptions || [];
    const restOpts = safeSeries.restOptions || [];
    const soundOpts = safeSeries.soundOptions || [];
    const modeOpts = safeSeries.modeOptions || [];
    return {
      // 2.10 — v2 campaigns add a PATH (mode) selector; default to fight if present.
      mode: modeOpts.includes('fight') ? 'fight' : (modeOpts[0] || undefined),
      difficulty: diffOpts.includes('normal') ? 'normal' : diffOpts.includes('standard') ? 'standard' : (diffOpts[0] || 'standard'),
      cadence: cadenceOpts.includes('moderate') ? 'moderate' : cadenceOpts.includes('normal') ? 'normal' : (cadenceOpts[0] || 'normal'),
      rest: restOpts.includes('normal') ? 'normal' : (restOpts[0] || 'normal'),
      sound: soundOpts.includes('on') ? 'on' : (soundOpts[0] || 'on'),
    };
  });

  if (!series) {
    return (
      <PhoneFrame useBrandBg>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', padding: 24, gap: 16,
        }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 900, color: '#fff' }}>
            Series unavailable
          </span>
          <button onClick={onBack || onHome} style={{
            padding: '12px 24px', borderRadius: 8, background: 'rgba(253,224,71,0.15)',
            border: '1px solid rgba(253,224,71,0.4)', cursor: 'pointer',
            fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700, color: '#fde047',
          }}>
            Return to Arcade
          </button>
        </div>
      </PhoneFrame>
    );
  }

  const title = series.title || 'Training Arcade Series';
  const subtitle = series.subtitle || 'Arcade Challenge';
  const description = series.description || 'Series details coming soon.';
  const equipment = series.equipment || 'None';
  const difficultyStars = series.difficultyStars || 1;
  const stages = series.stages || [];

  const playable = isSeriesPlayable(series);
  const progress = getSeriesProgress(series.id);
  const currentStage = progress.currentStage || 1;
  const completedStageIds = Object.keys(progress.completedStages || {}).filter(
    id => progress.completedStages[id]?.completed
  );

  const accent = '#fde047';

  return (
    <PhoneFrame useBrandBg>
      <TrainingHeader
        title={title}
        subtitle="Training Arcade"
        onHome={onHome}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', overflowX: 'hidden',
        padding: '12px 14px calc(170px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Banner */}
        <div style={{
          width: '100%', height: 120, borderRadius: 12, marginBottom: 12,
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(145deg, rgba(168,85,247,0.08), #050010)',
          border: '1px solid rgba(253,224,71,0.2)',
        }}>
          {series.bannerImage ? (
            <SafeImage
              src={series.bannerImage}
              alt={title}
              loading="eager"
              decoding="async"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(20,0,50,0.9), rgba(5,0,16,1))',
            }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 900, color: accent, opacity: 0.5 }}>{title}</span>
            </div>
          )}
        </div>

        {/* Title + Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 900,
            color: '#fff', margin: 0, letterSpacing: '0.06em',
            textShadow: `0 0 12px ${accent}40`,
          }}>{title}</h2>
          <div style={{
            padding: '3px 8px', borderRadius: 5,
            background: playable ? 'rgba(34,197,94,0.1)' : 'rgba(253,224,71,0.06)',
            border: playable ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(253,224,71,0.25)',
          }}>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700,
              color: playable ? '#22c55e' : accent, letterSpacing: '0.1em',
            }}>{playable ? 'ACTIVE' : 'COMING SOON'}</span>
          </div>
        </div>

        <p style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: 'rgba(245,233,255,0.7)',
          margin: '0 0 4px', fontWeight: 600,
        }}>{subtitle}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <StarRow count={difficultyStars} accent={accent}/>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted }}>{equipment}</span>
        </div>

        {/* Description */}
        <InfoSection title="ABOUT THIS SERIES">
          <p style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 11.5, color: C.text,
            lineHeight: 1.4, margin: 0, fontWeight: 400,
          }}>{description}</p>
        </InfoSection>

        {/* Base Workout */}
        {series.baseWorkoutDescription && (
          <InfoSection title="BASE WORKOUT">
            <p style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: 'rgba(245,233,255,0.65)',
              lineHeight: 1.4, margin: 0, fontWeight: 400,
            }}>{series.baseWorkoutDescription}</p>
          </InfoSection>
        )}

        {/* Rewards */}
        {series.rewards && (
          <InfoSection title="REWARDS">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {series.rewards.badge && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Trophy size={12} color={accent}/>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.text, fontWeight: 600 }}>{series.rewards.badge}</span>
                </div>
              )}
              {series.rewards.statBoost && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Zap size={12} color="#a855f7"/>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.text, fontWeight: 600 }}>{series.rewards.statBoost}</span>
                </div>
              )}
              {series.rewards.xp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Target size={12} color="#3b82f6"/>
                  <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.text, fontWeight: 600 }}>{series.rewards.xp} XP</span>
                </div>
              )}
            </div>
          </InfoSection>
        )}

        {/* Difficulty Selector (only for playable series) */}
        {playable && (series.difficultyOptions || series.cadenceOptions || series.restOptions) && (
          <ArcadeDifficultySelector
            series={series}
            settings={settings}
            onSettingsChange={setSettings}
          />
        )}

        {/* Constellation Map */}
        {stages.length > 0 && (
          <>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 900,
              color: C.yellow, letterSpacing: '0.12em', display: 'block', marginBottom: 8,
            }}>STAGE MAP</span>
            <ArcadeConstellationMap
              stages={stages}
              currentStage={currentStage}
              completedStageIds={completedStageIds}
            />
          </>
        )}

        {/* Action Button */}
        {playable ? (
          <button onClick={() => onContinue(series, settings)} style={{
            width: '100%', padding: '14px 0', borderRadius: 10,
            background: 'linear-gradient(135deg, #fde047, #f59e0b)',
            border: '1px solid rgba(253,224,71,0.5)',
            boxShadow: '0 0 20px rgba(253,224,71,0.3), 0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
            color: '#0a0014', letterSpacing: '0.12em',
          }}>
            {completedStageIds.length > 0 ? 'CONTINUE' : 'START SERIES'} <ChevronRight size={14}/>
          </button>
        ) : (
          <button disabled style={{
            width: '100%', padding: '14px 0', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
            color: C.muted, letterSpacing: '0.1em', opacity: 0.6,
          }}>
            <Lock size={13}/> COMING SOON
          </button>
        )}
      </div>
    </PhoneFrame>
  );
}