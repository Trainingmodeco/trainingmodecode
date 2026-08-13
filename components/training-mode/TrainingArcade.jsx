import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { HelpButton } from './shared/WorkoutHelpPanel';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import ArcadeBackdrop from './shared/ArcadeBackdrop';
import { Star, Lock, ChevronLeft, ChevronRight, Gamepad2 } from 'lucide-react';
import { C } from './Styles';
import { VISIBLE_ARCADE_SERIES, isSeriesPlayable } from './data/trainingArcadeData';
import { getSeriesProgress } from './data/arcadeProgress';
import { loadStats, getLevel } from './data/userStats';
import { decodeChallenge, resolveChallenge } from './data/challengeCodes';
import CodeEntryModal from './shared/CodeEntryModal';
import ParQSheet from './shared/ParQSheet';
import { loadParq, saveParq } from './data/parq';

// Full-bleed saga poster art (918x1713), one per visible series.
const POSTER_MAP = {
  'one-punch-protocol': '/static/series/posters/one-punch.png',
  'hyperbolic-time-chamber': '/static/series/posters/hyperbolic-gravity.png',
  'blue-blur-speed-protocol': '/static/series/posters/blue-blur.png',
  'dark-knight-protocol': '/static/series/posters/dark-knight.png',
  'demon-back-protocol': '/static/series/posters/demon-back.png',
  'ultra-instinct-protocol': '/static/series/posters/ultra-instinct.png',
  'ultra-ego-style': '/static/series/posters/ultra-ego.png',
  'baki-grappler': '/static/series/posters/baki-grappler.png',
  'hero-hunter-protocol': '/static/series/posters/hero-hunter.png',
  'berserk-struggler': '/static/series/posters/berserk-struggler.png',
  'the-contender': '/static/series/posters/the-contender.png',
  'the-wall-crawler': '/static/series/posters/the-wall-crawler.png',
  'the-dragon': '/static/series/posters/the-dragon.png',
};

const RANKS = ['ROOKIE', 'NOVICE', 'WARRIOR', 'ELITE', 'CHAMPION'];
const TEAL = '#5eead4';

const arcadeStyles = `
.saga-scroller { scroll-snap-type: x mandatory; -ms-overflow-style: none; scrollbar-width: none; }
.saga-scroller::-webkit-scrollbar { display: none; }
.saga-slide { scroll-snap-align: center; transition: transform .3s ease, opacity .3s ease; }
.saga-arrow { transition: opacity .2s ease, transform .12s ease; }
.saga-arrow:active { transform: translateY(-50%) scale(0.9); }
@keyframes saga-hint { 0%,100%{opacity:0.55} 50%{opacity:1} }
@keyframes saga-shake {
  0%,100% { transform: translateX(0); }
  20% { transform: translateX(-6px); } 40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); } 80% { transform: translateX(4px); }
}
@keyframes saga-toast-in { from { opacity: 0; transform: translate(-50%, -6px); } to { opacity: 1; transform: translate(-50%, 0); } }
`;

function StarRow({ count = 0, size = 11 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1.5, verticalAlign: 'middle' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={size} fill={i < count ? C.gold : 'transparent'}
          color={i < count ? C.gold : 'rgba(255,255,255,0.55)'} strokeWidth={1.5} />
      ))}
    </span>
  );
}

export default function TrainingArcade({ onBack, onSelectSeries, onChallengeCode, onStartGuide }) {
  // Paste a friend's challenge code to jump into the exact stage they set.
  // (window.prompt is unsupported on RN Web — use an in-app modal.)
  const [codeOpen, setCodeOpen] = useState(false);
  // Beta ND-06 — the arcade is one of the two heavy modes (with Training
  // Camp), so it carries the PAR-Q safety net for profiles that predate the
  // onboarding screening. One-time ever: the record is shared app-wide.
  const [showParq, setShowParq] = useState(() => !loadParq().done);
  const submitChallengeCode = (raw) => {
    const resolved = resolveChallenge(decodeChallenge(raw));
    if (!resolved) return false;
    onChallengeCode?.(resolved);
    return true;
  };
  const series = VISIBLE_ARCADE_SERIES;
  const n = series.length;
  // Infinite loop: render 3 copies and silently recenter to the middle copy once
  // the scroll settles, so a swipe past either end wraps seamlessly. `active` is a
  // DISPLAY index (0..3n-1); the real saga is `slides[active]` / `active % n`.
  const slides = useMemo(() => (n ? [...series, ...series, ...series] : []), [series, n]);
  const [active, setActive] = useState(0);
  const [padInline, setPadInline] = useState(40);
  const [stats, setStats] = useState(null);
  const scrollerRef = useRef(null);
  const slideRefs = useRef([]);
  const rafRef = useRef(0);
  const idleRef = useRef(0);
  const didInitRef = useRef(false);
  // Locked saga feedback: the tapped card shakes and a COMING SOON toast pops.
  const [shakeIdx, setShakeIdx] = useState(null);
  const [toast, setToast] = useState(null);
  const shakeTimer = useRef(0);
  const toastTimer = useRef(0);
  useEffect(() => () => { clearTimeout(shakeTimer.current); clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    const s = loadStats();
    if (s && typeof s.then === 'function') s.then(setStats); else setStats(s);
  }, []);

  const level = stats ? getLevel(stats.xp) : 1;
  const rank = RANKS[Math.min(Math.floor((level - 1) / 3), 4)];

  const { totalCleared, totalStages } = useMemo(() => {
    let c = 0, t = 0;
    series.forEach(s => {
      t += s.stages?.length || 0;
      const p = getSeriesProgress(s.id);
      c += Object.values(p.completedStages || {}).filter(x => x.completed).length;
    });
    return { totalCleared: c, totalStages: t };
  }, [series]);

  // Side padding so the first/last poster can sit dead-centre (enables peek).
  const measure = useCallback(() => {
    const c = scrollerRef.current;
    const s0 = slideRefs.current[0];
    if (!c || !s0) return;
    setPadInline(Math.max(14, (c.clientWidth - s0.clientWidth) / 2));
  }, []);

  useEffect(() => {
    measure();
    const id = requestAnimationFrame(() => {
      measure();
      // Start centred on the middle copy so there's a full loop of runway each way.
      if (!didInitRef.current && n) {
        const c = scrollerRef.current, el = slideRefs.current[n];
        if (c && el) { c.scrollLeft = el.offsetLeft - (c.clientWidth - el.clientWidth) / 2; setActive(n); didInitRef.current = true; }
      }
    });
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(id); clearTimeout(idleRef.current); window.removeEventListener('resize', measure); };
  }, [measure, n]);

  // Index of the slide nearest the viewport centre (0..3n-1), or -1.
  const nearestSlide = useCallback(() => {
    const c = scrollerRef.current;
    if (!c) return -1;
    const center = c.scrollLeft + c.clientWidth / 2;
    let best = -1, bestD = Infinity;
    slideRefs.current.forEach((el, i) => {
      if (!el) return;
      const mid = el.offsetLeft + el.clientWidth / 2;
      const d = Math.abs(mid - center);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }, []);

  // Once scrolling settles, jump (no animation) to the same saga in the MIDDLE
  // copy so a full loop of runway is always available in both directions. The
  // target slide is visually identical, so there's no flicker.
  const recenter = useCallback(() => {
    const c = scrollerRef.current;
    if (!c || !n) return;
    const best = nearestSlide();
    if (best < 0) return;
    const target = n + (best % n);
    if (target === best) return;
    const from = slideRefs.current[best], to = slideRefs.current[target];
    if (from && to) { c.scrollLeft += (to.offsetLeft - from.offsetLeft); setActive(target); }
  }, [n, nearestSlide]);

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const best = nearestSlide();
      if (best >= 0) setActive(best);
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(recenter, 160);
    });
  }, [nearestSlide, recenter]);

  // Smooth-scroll to a DISPLAY index (0..3n-1).
  const scrollToDisplay = useCallback((i) => {
    const c = scrollerRef.current;
    const el = slideRefs.current[i];
    if (!c || !el) return;
    c.scrollTo({ left: el.offsetLeft - (c.clientWidth - el.clientWidth) / 2, behavior: 'smooth' });
  }, []);

  // Arrows: step one slide; the loop keeps runway on both sides so this wraps.
  const rotate = useCallback((dir) => { scrollToDisplay(active + dir); }, [active, scrollToDisplay]);

  // Playable → open the saga. Locked → shake the card + toast why, so a tap
  // never reads as the app ignoring you.
  const enter = useCallback((s, i) => {
    if (isSeriesPlayable(s)) { onSelectSeries?.(s); return; }
    setShakeIdx(i);
    setToast(s.construction ? '🚧 UNDER CONSTRUCTION' : 'COMING SOON');
    clearTimeout(shakeTimer.current); clearTimeout(toastTimer.current);
    shakeTimer.current = setTimeout(() => setShakeIdx(null), 500);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, [onSelectSeries]);

  return (
    <PhoneFrame>
      {/* Saga select — the trophy-podium arena, sparks kept over it. */}
      <ArcadeBackdrop image="/static/arcade/arcade-bg-saga.png" imageOpacity={0.56} />
      <style dangerouslySetInnerHTML={{ __html: arcadeStyles }} />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        height: '100dvh', boxSizing: 'border-box',
        paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
      }}>
        {/* Header — teal */}
        <div style={{ position: 'relative', padding: '14px 16px 8px', textAlign: 'center' }}>
          <button aria-label="Back" onClick={onBack} style={{ position: 'absolute', left: 12, top: 12, width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(94,234,212,0.3)', background: 'rgba(8,20,20,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronLeft size={18} color={TEAL} />
          </button>
          {/* The arcade guide crosses into the stage ladder, so App hosts it. */}
          <HelpButton onClick={onStartGuide} style={{ position: 'absolute', right: 12, top: 12 }}/>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: '0.06em', background: 'linear-gradient(90deg,#5eead4,#2dd4bf)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textShadow: '0 0 18px rgba(45,212,191,0.35)' }}>TRAINING ARCADE</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8.5, color: 'rgba(94,234,212,0.75)', letterSpacing: '0.24em', marginTop: 4 }}>‹ SWIPE TO CHOOSE YOUR SAGA ›</div>
          <button data-tour="challenge-code" onClick={() => setCodeOpen(true)} style={{ marginTop: 7, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 8, color: '#c9a6ff', font: "800 8px 'Orbitron',sans-serif", letterSpacing: '0.08em', padding: '6px 12px', cursor: 'pointer' }}>⚔️ ENTER A CHALLENGE CODE</button>
        </div>

        {/* Player bar */}
        <div data-guide="ar-player" style={{ margin: '2px 14px 4px', padding: '8px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(12,4,26,0.72)', border: '1px solid rgba(168,85,247,0.28)' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#a855f7,#5b21b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 10px rgba(168,85,247,0.4)' }}>
            <Gamepad2 size={16} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10, color: '#f5e9ff', letterSpacing: '0.06em' }}>
              PLAYER <span style={{ color: 'rgba(200,170,255,0.5)' }}>·</span> LV {level} <span style={{ color: C.gold }}>{rank}</span>
            </div>
          </div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 12, color: C.gold, letterSpacing: '0.04em' }}>
            {totalCleared}<span style={{ fontSize: 9, color: 'rgba(200,170,255,0.55)' }}> /{totalStages} STAGES</span>
          </div>
        </div>

        {/* Carousel */}
        <div data-guide="ar-carousel" style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
          <div
            ref={scrollerRef}
            className="saga-scroller"
            onScroll={handleScroll}
            style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', overflowX: 'auto', overflowY: 'hidden',
              paddingLeft: padInline, paddingRight: padInline, paddingTop: 12, paddingBottom: 12,
            }}
          >
            {slides.map((s, i) => {
              const playable = isSeriesPlayable(s);
              const isActive = i === active;
              const poster = POSTER_MAP[s.id];
              const prog = getSeriesProgress(s.id);
              const stageCount = s.stages?.length || 0;
              const cleared = Object.values(prog.completedStages || {}).filter(x => x.completed).length;
              const status = !playable ? 'locked' : cleared >= stageCount && stageCount > 0 ? 'complete' : cleared > 0 ? 'progress' : 'new';
              const segCount = Math.min(stageCount || 10, 12);

              return (
                <button
                  key={i}
                  ref={el => { slideRefs.current[i] = el; }}
                  className="saga-slide"
                  onClick={() => (isActive ? enter(s, i) : scrollToDisplay(i))}
                  style={{
                    flex: '0 0 auto', height: '100%', maxHeight: 424, aspectRatio: '0.6',
                    padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
                    transform: isActive ? 'scale(1)' : 'scale(0.82)',
                    opacity: isActive ? 1 : 0.42,
                    animation: shakeIdx === i ? 'saga-shake 0.5s ease' : 'none',
                  }}
                >
                  <div style={{
                    position: 'relative', width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden',
                    border: isActive
                      ? (playable ? '2px solid rgba(255,224,110,0.9)' : '2px solid rgba(176,106,255,0.6)')
                      : '1px solid rgba(168,85,247,0.25)',
                    boxShadow: isActive
                      ? (playable
                        ? '0 0 30px rgba(253,224,71,0.45), 0 14px 34px rgba(0,0,0,0.65)'
                        : '0 0 24px rgba(168,85,247,0.4), 0 14px 34px rgba(0,0,0,0.65)')
                      : '0 6px 18px rgba(0,0,0,0.5)',
                  }}>
                    {poster ? (
                      <SafeImage src={poster} alt={s.title} loading="lazy" decoding="async"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 28%', filter: playable ? 'none' : 'grayscale(0.65) brightness(0.5)' }} />
                    ) : (
                      <>
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(60,20,90,0.6), rgba(8,1,18,0.96) 72%)' }} />
                        {/* No banner yet: render the title so the card still reads. */}
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '19%', padding: '0 18px', textAlign: 'center' }}>
                          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 25, lineHeight: 1.08, color: 'rgba(232,216,255,0.92)', letterSpacing: '0.03em', textShadow: '0 2px 18px rgba(168,85,247,0.55)' }}>{(s.title || '').toUpperCase()}</span>
                        </div>
                      </>
                    )}

                    {/* Status pill */}
                    {isActive && playable && (
                      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7, background: 'linear-gradient(180deg,#ffe574,#f7c33f)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                        <span style={{ fontSize: 8, color: '#2a1400' }}>{status === 'complete' ? '★' : '▶'}</span>
                        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 8, color: '#2a1400', letterSpacing: '0.1em' }}>{status === 'complete' ? 'COMPLETE' : status === 'progress' ? 'IN PROGRESS' : 'START'}</span>
                      </div>
                    )}

                    {/* Locked overlay */}
                    {!playable && (
                      <>
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,0,14,0.32)' }} />
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '42%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16,4,30,0.85)', border: '1px solid rgba(168,85,247,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Lock size={18} color="rgba(210,185,255,0.85)" />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Bottom info strip — poster art carries the title */}
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '40px 12px 11px', background: 'linear-gradient(to top, rgba(4,0,10,0.96) 0%, rgba(4,0,10,0.82) 42%, rgba(4,0,10,0.35) 74%, transparent 100%)' }}>
                      {playable ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 7 }}>
                            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: 'rgba(235,225,255,0.85)', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subtitle}</span>
                            <StarRow count={s.difficultyStars} />
                          </div>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {Array.from({ length: segCount }, (_, k) => (
                              <div key={k} style={{ flex: 1, height: 4, borderRadius: 99, background: k < cleared ? 'linear-gradient(90deg,#34d399,#fde047)' : 'rgba(255,255,255,0.18)' }} />
                            ))}
                          </div>
                          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: C.gold, letterSpacing: '0.1em', marginTop: 6, textAlign: 'center' }}>{cleared} / {stageCount} CLEARED</div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: 'rgba(210,185,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subtitle}</span>
                          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8, color: s.construction ? '#fca5a5' : '#c9a6ff', letterSpacing: '0.1em', flexShrink: 0 }}>{s.construction ? '🚧 UNDER CONSTRUCTION' : 'COMING SOON'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Arrows */}
          <button className="saga-arrow" aria-label="Previous saga" onClick={() => rotate(-1)}
            style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(8,1,18,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5 }}>
            <ChevronLeft size={18} color="#e6d4ff" />
          </button>
          <button className="saga-arrow" aria-label="Next saga" onClick={() => rotate(1)}
            style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(8,1,18,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5 }}>
            <ChevronRight size={18} color="#e6d4ff" />
          </button>

          {/* Locked-saga toast */}
          {toast && (
            <div style={{
              position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', zIndex: 8,
              padding: '8px 16px', borderRadius: 9, whiteSpace: 'nowrap', pointerEvents: 'none',
              background: 'rgba(16,4,30,0.95)', border: '1px solid rgba(168,85,247,0.5)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9,
              color: '#e6d4ff', letterSpacing: '0.12em',
              animation: 'saga-toast-in 0.2s ease',
            }}>
              {toast}
            </div>
          )}
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '10px 0 6px' }}>
          {series.map((s, i) => (
            <button key={s.id} aria-label={`Go to ${s.title}`} onClick={() => scrollToDisplay(n + i)}
              style={{ width: i === active % n ? 18 : 6, height: 6, borderRadius: 99, padding: 0, border: 'none', cursor: 'pointer', background: i === active % n ? C.gold : 'rgba(255,255,255,0.25)', transition: 'width .25s ease, background .25s ease' }} />
          ))}
        </div>

        <div style={{ textAlign: 'center', fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, color: 'rgba(94,234,212,0.85)', letterSpacing: '0.22em', paddingBottom: 6, animation: 'saga-hint 2.4s ease-in-out infinite' }}>
          TAP CARD TO ENTER SAGA
        </div>
      </div>
      {codeOpen && (
        <CodeEntryModal
          title="⚔️ ENTER A CHALLENGE CODE"
          label="Paste a friend's challenge code to jump into their exact stage."
          submitLabel="▶ START CHALLENGE"
          onSubmit={submitChallengeCode}
          onClose={() => setCodeOpen(false)}
        />
      )}
      {showParq && (
        <ParQSheet ctaLabel="▶ ENTER THE ARCADE ON EASY" onDone={(anyYes) => {
          saveParq(anyYes);
          setShowParq(false);
        }}/>
      )}
    </PhoneFrame>
  );
}
