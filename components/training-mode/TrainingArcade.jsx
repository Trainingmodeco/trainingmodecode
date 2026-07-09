import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import SafeImage from './SafeImage';
import { Star, Lock, ChevronRight } from 'lucide-react';
import { C } from './Styles';
import { VISIBLE_ARCADE_SERIES, isSeriesPlayable } from './data/trainingArcadeData';
import { getSeriesProgress } from './data/arcadeProgress';

const arcadeStyles = `
.arcade-row {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
}
.arcade-row:hover {
  transform: scale(1.01) translateY(-1px);
  border-color: rgba(253,224,71,0.4) !important;
  box-shadow: 0 0 20px rgba(253,224,71,0.12) !important;
}
.arcade-row:active {
  transform: scale(0.98);
  transition-duration: 0.1s;
}
.arcade-row-locked {
  opacity: 0.45;
  filter: grayscale(0.6);
  cursor: default;
}
.arcade-row-locked:hover {
  transform: none !important;
  border-color: rgba(255,255,255,0.08) !important;
  box-shadow: none !important;
}
`;

const SERIES_BANNER_MAP = {
  'one-punch-protocol': '/static/series/one-punch.webp',
  'dark-knight-protocol': '/static/series/dark-knight.webp',
  'demon-back-protocol': '/static/series/demon-back.webp',
  'ultra-instinct-protocol': '/static/series/ultra-instinct.webp',
};

function StarRating({ count }) {
  return (
    <div style={{ display: 'flex', gap: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={10}
          fill={i < count ? C.gold : 'transparent'}
          color={i < count ? C.gold : 'rgba(255,255,255,0.15)'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

function SeriesRow({ series, onSelect }) {
  const playable = isSeriesPlayable(series);
  const progress = getSeriesProgress(series.id);
  const totalStages = series.stages?.length || 0;
  const clearedCount = Object.values(progress.completedStages || {}).filter(s => s.completed).length;
  const bannerSrc = SERIES_BANNER_MAP[series.id] || null;

  return (
    <div
      className={`arcade-row${!playable ? ' arcade-row-locked' : ''}`}
      onClick={() => playable && onSelect?.(series)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'rgba(10,0,20,0.8)',
        border: `1px solid ${playable ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.06)'}`,
        height: 80,
      }}
    >
      {/* Banner image */}
      <div style={{
        width: 100,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(20,0,40,0.5)',
      }}>
        {bannerSrc ? (
          <SafeImage
            src={bannerSrc}
            alt={series.title}
            loading="lazy"
            decoding="async"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
            }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(5,0,16,0.9))',
          }}>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
              fontSize: 9, color: 'rgba(168,85,247,0.4)', letterSpacing: '0.06em',
              textAlign: 'center', padding: '0 4px',
            }}>{series.title}</span>
          </div>
        )}
        {!playable && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(5,0,15,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={16} color="rgba(255,255,255,0.3)"/>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{
        flex: 1, padding: '10px 12px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        minWidth: 0,
      }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
          color: '#fff', letterSpacing: '0.04em', lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 4,
        }}>{series.title}</div>

        <StarRating count={series.difficultyStars}/>

        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10,
          color: C.muted, marginTop: 4,
        }}>
          {playable
            ? `${clearedCount}/${totalStages} cleared`
            : 'Coming Soon'
          }
        </div>
      </div>

      {/* Right arrow / status */}
      <div style={{
        width: 36, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {playable ? (
          <ChevronRight size={16} color={C.gold}/>
        ) : (
          <Lock size={14} color="rgba(255,255,255,0.2)"/>
        )}
      </div>
    </div>
  );
}

export default function TrainingArcade({ onHome, onBack, onSelectSeries }) {
  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: arcadeStyles }}/>

      <TrainingHeader
        title="TRAINING ARCADE"
        subtitle="Workout Series"
        onHome={onHome}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', overflowX: 'hidden',
        padding: '16px 14px calc(170px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Section label */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
            color: C.gold, letterSpacing: '0.2em', marginBottom: 4,
          }}>SELECT PROTOCOL</div>
          <p style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted,
            lineHeight: 1.4, margin: 0, fontWeight: 400,
          }}>
            Select a workout series. Train through stages. Earn XP.
          </p>
        </div>

        {/* Series rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {VISIBLE_ARCADE_SERIES.map(series => (
            <SeriesRow
              key={series.id}
              series={series}
              onSelect={onSelectSeries}
            />
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}
