import { useState, useRef, useEffect, useCallback } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import SafeImage from './SafeImage';
import FightRingBackdrop from './shared/FightRingBackdrop';
import TrainingCTA from './shared/TrainingCTA';
import { Star, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { C } from './Styles';
import { VISIBLE_ARCADE_SERIES, isSeriesPlayable } from './data/trainingArcadeData';
import { getSeriesProgress } from './data/arcadeProgress';

// Full-bleed saga poster art (918x1713), one per visible series.
const POSTER_MAP = {
  'one-punch-protocol': '/static/series/posters/one-punch.png',
  'hyperbolic-time-chamber': '/static/series/posters/hyperbolic-gravity.png',
  'blue-blur-speed-protocol': '/static/series/posters/blue-blur.png',
  'dark-knight-protocol': '/static/series/posters/dark-knight.png',
  'demon-back-protocol': '/static/series/posters/demon-back.png',
  'ultra-instinct-protocol': '/static/series/posters/ultra-instinct.png',
  'ultra-ego-style': '/static/series/posters/ultra-ego.png',
};

const arcadeStyles = `
.saga-scroller { scroll-snap-type: x mandatory; -ms-overflow-style: none; scrollbar-width: none; }
.saga-scroller::-webkit-scrollbar { display: none; }
.saga-slide { scroll-snap-align: center; transition: transform .3s ease, opacity .3s ease; }
.saga-arrow { transition: opacity .2s ease, transform .12s ease; }
.saga-arrow:active { transform: translateY(-50%) scale(0.9); }
`;

function StarRating({ count = 0, size = 12 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} fill={i < count ? C.gold : 'transparent'}
          color={i < count ? C.gold : 'rgba(255,255,255,0.25)'} strokeWidth={1.5} />
      ))}
    </div>
  );
}

function Dot() {
  return <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(200,170,255,0.5)' }} />;
}

export default function TrainingArcade({ onHome, onBack, onSelectSeries }) {
  const series = VISIBLE_ARCADE_SERIES;
  const [active, setActive] = useState(0);
  const [padInline, setPadInline] = useState(24);
  const scrollerRef = useRef(null);
  const slideRefs = useRef([]);
  const rafRef = useRef(0);

  // Side padding so the first/last poster can sit dead-centre (enables peek).
  const measure = useCallback(() => {
    const c = scrollerRef.current;
    const s0 = slideRefs.current[0];
    if (!c || !s0) return;
    const cardW = s0.clientWidth;
    setPadInline(Math.max(14, (c.clientWidth - cardW) / 2));
  }, []);

  useEffect(() => {
    measure();
    const id = requestAnimationFrame(measure); // re-measure once posters lay out
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', measure); };
  }, [measure]);

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const c = scrollerRef.current;
      if (!c) return;
      const center = c.scrollLeft + c.clientWidth / 2;
      let best = 0, bestD = Infinity;
      slideRefs.current.forEach((el, i) => {
        if (!el) return;
        const mid = el.offsetLeft + el.clientWidth / 2;
        const d = Math.abs(mid - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      setActive(best);
    });
  }, []);

  const scrollToIndex = useCallback((i) => {
    const c = scrollerRef.current;
    const el = slideRefs.current[i];
    if (!c || !el) return;
    const target = el.offsetLeft - (c.clientWidth - el.clientWidth) / 2;
    c.scrollTo({ left: target, behavior: 'smooth' });
  }, []);

  const activeSeries = series[active] || series[0];
  const activePlayable = isSeriesPlayable(activeSeries);
  const activeProgress = getSeriesProgress(activeSeries.id);
  const totalStages = activeSeries.stages?.length || 0;
  const clearedCount = Object.values(activeProgress.completedStages || {}).filter(s => s.completed).length;

  const handleCTA = () => { if (activePlayable) onSelectSeries?.(activeSeries); };

  return (
    <PhoneFrame>
      <FightRingBackdrop opacity={0.1} />
      <style dangerouslySetInnerHTML={{ __html: arcadeStyles }} />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        height: '100dvh', boxSizing: 'border-box',
        paddingBottom: 'calc(74px + env(safe-area-inset-bottom, 0px))',
      }}>
        <TrainingHeader title="TRAINING ARCADE" subtitle="Select your saga" onHome={onHome} showBack onBack={onBack} />

        {/* Section label + counter */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 18px 8px' }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700, color: C.gold, letterSpacing: '0.2em' }}>SAGA SELECT</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700, color: 'rgba(200,170,255,0.75)', letterSpacing: '0.14em' }}>
            {active + 1} <span style={{ color: 'rgba(200,170,255,0.4)' }}>/ {series.length}</span>
          </div>
        </div>

        {/* Carousel */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
          <div
            ref={scrollerRef}
            className="saga-scroller"
            onScroll={handleScroll}
            style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', overflowX: 'auto', overflowY: 'hidden',
              paddingLeft: padInline, paddingRight: padInline, paddingTop: 10, paddingBottom: 10,
            }}
          >
            {series.map((s, i) => {
              const playable = isSeriesPlayable(s);
              const isActive = i === active;
              const poster = POSTER_MAP[s.id];
              return (
                <button
                  key={s.id}
                  ref={el => { slideRefs.current[i] = el; }}
                  className="saga-slide"
                  onClick={() => (isActive ? handleCTA() : scrollToIndex(i))}
                  style={{
                    flex: '0 0 auto', height: '100%', maxHeight: 560, aspectRatio: '918 / 1713',
                    padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
                    transform: isActive ? 'scale(1)' : 'scale(0.86)',
                    opacity: isActive ? 1 : 0.48,
                  }}
                >
                  <div style={{
                    position: 'relative', width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden',
                    border: isActive
                      ? (playable ? '1.5px solid rgba(255,238,150,0.75)' : '1.5px solid rgba(176,106,255,0.55)')
                      : '1px solid rgba(168,85,247,0.22)',
                    boxShadow: isActive
                      ? (playable
                        ? '0 0 26px rgba(253,224,71,0.4), 0 12px 30px rgba(0,0,0,0.6)'
                        : '0 0 22px rgba(168,85,247,0.35), 0 12px 30px rgba(0,0,0,0.6)')
                      : '0 6px 18px rgba(0,0,0,0.5)',
                  }}>
                    {poster ? (
                      <SafeImage src={poster} alt={s.title} loading="lazy" decoding="async"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: playable ? 'none' : 'grayscale(0.6) brightness(0.5)' }} />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 50% 40%, rgba(60,20,90,0.6), rgba(8,1,18,0.96) 72%)' }}>
                        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, color: 'rgba(200,170,255,0.55)', letterSpacing: '0.06em', textAlign: 'center', padding: '0 16px' }}>{s.title.toUpperCase()}</span>
                      </div>
                    )}

                    {!playable && (
                      <>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,0,14,0.35)' }} />
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(16,4,30,0.85)', border: '1px solid rgba(168,85,247,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Lock size={19} color="rgba(210,185,255,0.85)" />
                          </div>
                          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: 'rgba(210,185,255,0.9)', letterSpacing: '0.16em', background: 'rgba(8,1,18,0.78)', borderRadius: 6, padding: '4px 10px' }}>COMING SOON</span>
                        </div>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Arrows */}
          <button
            className="saga-arrow"
            aria-label="Previous saga"
            onClick={() => scrollToIndex(Math.max(0, active - 1))}
            style={{
              position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
              width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.4)',
              background: 'rgba(8,1,18,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 5, opacity: active === 0 ? 0.25 : 1, pointerEvents: active === 0 ? 'none' : 'auto',
            }}
          >
            <ChevronLeft size={19} color="#e6d4ff" />
          </button>
          <button
            className="saga-arrow"
            aria-label="Next saga"
            onClick={() => scrollToIndex(Math.min(series.length - 1, active + 1))}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.4)',
              background: 'rgba(8,1,18,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 5, opacity: active === series.length - 1 ? 0.25 : 1, pointerEvents: active === series.length - 1 ? 'none' : 'auto',
            }}
          >
            <ChevronRight size={19} color="#e6d4ff" />
          </button>
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '10px 0 8px' }}>
          {series.map((s, i) => (
            <button
              key={s.id}
              aria-label={`Go to ${s.title}`}
              onClick={() => scrollToIndex(i)}
              style={{
                width: i === active ? 18 : 6, height: 6, borderRadius: 99, padding: 0, border: 'none', cursor: 'pointer',
                background: i === active ? C.gold : 'rgba(255,255,255,0.25)', transition: 'width .25s ease, background .25s ease',
              }}
            />
          ))}
        </div>

        {/* Active saga meta + CTA */}
        <div style={{ padding: '0 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15, letterSpacing: '0.04em', color: activePlayable ? C.gold : '#c9a6ff' }}>
              {activeSeries.title.toUpperCase()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
              <StarRating count={activeSeries.difficultyStars} />
              <Dot />
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{activeSeries.type}</span>
              <Dot />
              {activePlayable ? (
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: C.gold, letterSpacing: '0.08em' }}>{clearedCount}/{totalStages} CLEARED</span>
              ) : (
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: '#c9a6ff', letterSpacing: '0.12em' }}>COMING SOON</span>
              )}
            </div>
          </div>

          <TrainingCTA
            label={activePlayable ? 'ENTER SAGA' : 'COMING SOON'}
            icon={activePlayable ? '▶' : '🔒'}
            variant="gold"
            disabled={!activePlayable}
            onClick={handleCTA}
            height={52}
          />
        </div>
      </div>
    </PhoneFrame>
  );
}
