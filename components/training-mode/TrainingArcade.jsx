import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import SafeImage from './SafeImage';
import FightRingBackdrop from './shared/FightRingBackdrop';
import { Star, Lock, Play } from 'lucide-react';
import { C } from './Styles';
import { VISIBLE_ARCADE_SERIES, isSeriesPlayable } from './data/trainingArcadeData';
import { getSeriesProgress } from './data/arcadeProgress';

const arcadeStyles = `
.arcade-card {
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  cursor: pointer;
}
.arcade-card:hover { transform: translateY(-2px); }
.arcade-card:active { transform: scale(0.985); transition-duration: 0.1s; }
.arcade-card-locked { cursor: default; }
.arcade-card-locked:hover { transform: none; }
`;

const SERIES_BANNER_MAP = {
  'one-punch-protocol': '/static/series/one-punch.webp',
  'dark-knight-protocol': '/static/series/dark-knight.webp',
  'demon-back-protocol': '/static/series/demon-back.webp',
  'ultra-instinct-protocol': '/static/series/ultra-instinct.webp',
};

function StarRating({ count, size = 11 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} fill={i < count ? C.gold : 'transparent'} color={i < count ? C.gold : 'rgba(255,255,255,0.22)'} strokeWidth={1.5}/>
      ))}
    </div>
  );
}

function SeriesCard({ series, onSelect }) {
  const playable = isSeriesPlayable(series);
  const progress = getSeriesProgress(series.id);
  const totalStages = series.stages?.length || 0;
  const clearedCount = Object.values(progress.completedStages || {}).filter(s => s.completed).length;
  const pct = totalStages ? Math.round((clearedCount / totalStages) * 100) : 0;
  const bannerSrc = SERIES_BANNER_MAP[series.id] || null;

  return (
    <button
      className={`arcade-card${!playable ? ' arcade-card-locked' : ''}`}
      onClick={() => playable && onSelect?.(series)}
      style={{
        position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 15,
        overflow: 'hidden', padding: 0, display: 'block', background: '#0a0014',
        border: `1.5px solid ${playable ? 'rgba(253,224,71,0.5)' : 'rgba(168,85,247,0.22)'}`,
        boxShadow: playable ? '0 0 22px rgba(253,224,71,0.18), 0 6px 18px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.45)',
      }}
    >
      {bannerSrc ? (
        <SafeImage src={bannerSrc} alt={series.title} loading="lazy" decoding="async"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', filter: playable ? 'none' : 'grayscale(0.7) brightness(0.6)' }}/>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 50% 40%, rgba(60,20,90,0.55), rgba(8,1,18,0.96) 72%)' }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 18, color: 'rgba(200,170,255,0.5)', letterSpacing: '0.06em', textAlign: 'center', padding: '0 20px', filter: playable ? 'none' : 'grayscale(0.5)' }}>{series.title.toUpperCase()}</span>
        </div>
      )}

      {playable ? (
        <>
          {/* Bottom scrim + progress */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 13px 10px', background: 'linear-gradient(to top, rgba(6,0,14,0.92) 0%, rgba(6,0,14,0.55) 55%, transparent 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <StarRating count={series.difficultyStars}/>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: C.gold, letterSpacing: '0.08em' }}>{clearedCount}/{totalStages} CLEARED</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#fde047,#f59e0b)' }}/>
            </div>
          </div>
          {/* Play chip */}
          <div style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%', background: 'rgba(253,224,71,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(253,224,71,0.5)' }}>
            <Play size={14} fill="#0a0014" color="#0a0014" style={{ marginLeft: 2 }}/>
          </div>
        </>
      ) : (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,0,14,0.5)' }}/>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(16,4,30,0.85)', border: '1px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={18} color="rgba(200,170,255,0.7)"/>
            </div>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, color: 'rgba(200,170,255,0.75)', letterSpacing: '0.16em', background: 'rgba(8,1,18,0.7)', borderRadius: 5, padding: '3px 9px' }}>COMING SOON</span>
          </div>
        </>
      )}
    </button>
  );
}

export default function TrainingArcade({ onHome, onBack, onSelectSeries }) {
  return (
    <PhoneFrame useBrandBg>
      <FightRingBackdrop opacity={0.16}/>
      <style dangerouslySetInnerHTML={{ __html: arcadeStyles }}/>

      <TrainingHeader
        title="TRAINING ARCADE"
        subtitle="Stage-based workout series"
        onHome={onHome}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', overflowX: 'hidden',
        padding: '14px 14px calc(120px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700, color: C.gold, letterSpacing: '0.2em', marginBottom: 4 }}>SELECT PROTOCOL</div>
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted, lineHeight: 1.4, margin: 0, fontWeight: 500 }}>
            Pick a series. Clear its stages. Earn XP and bosses.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {VISIBLE_ARCADE_SERIES.map(series => (
            <SeriesCard key={series.id} series={series} onSelect={onSelectSeries}/>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}
