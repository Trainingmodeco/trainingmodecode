import { useState, useEffect, useRef } from 'react';
import PhoneFrame from '../PhoneFrame';
import Embers from '../Embers';
import SafeImage from '../SafeImage';
import SharePromptModal from '../SharePromptModal';
import MissionIntegrityBanner from '../MissionIntegrityBanner';
import CardioFinisherSummaryCard from '../CardioFinisherSummaryCard';
import { Trophy } from 'lucide-react';
import { loadStats, getStreak, getLevel, getLevelProgress, getWeeklySessions } from '../data/userStats';
import { getCurrentTier, tierImage } from '../data/tiers';
import { loadProfile } from '../data/userProfile';
import { BETA_FEEDBACK_FORM_URL, openExternalUrl } from '../data/links';

// Design 24f — shared Mission Complete screen for every mode. A celebratory
// medal hero with an animated XP count-up, a mode-tinted headline, a stat
// grid, an optional extra card (round recap / muscle chips), the shared
// YOUR PROGRESS roundup, and per-mode CTAs. One look across the whole app.
const GOLD = '#fde047';

const mcCSS = `
@keyframes mc-medal-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 22px var(--mc-glow-a), 0 0 44px var(--mc-glow-b); }
  50%      { transform: scale(1.05); box-shadow: 0 0 30px var(--mc-glow-a), 0 0 60px var(--mc-glow-b); }
}
@keyframes mc-rays-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes mc-pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
`;

function Stat({ value, label, color = '#fff', highlight }) {
  return (
    <div style={{ background: highlight ? 'rgba(253,224,71,0.08)' : 'rgba(8,2,18,0.88)', border: `1px solid ${highlight ? 'rgba(253,224,71,0.4)' : 'rgba(168,85,247,0.25)'}`, borderRadius: 11, padding: 11, textAlign: 'center' }}>
      <div style={{ font: "900 20px 'Orbitron',sans-serif", color }}>{value}</div>
      <div style={{ font: "600 8px 'Orbitron',sans-serif", color: highlight ? '#facc15' : '#c4a4d8', letterSpacing: '0.08em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// Animated XP count-up.
function useCountUp(target, ms = 900) {
  const [n, setN] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return n;
}

export default function MissionComplete({
  variant = 'success',      // 'success' | 'partial'
  eyebrow,                  // optional override for the ◈ … ◈ line
  title,
  subtitle,
  accent = GOLD,
  xp = 0,
  integrityResult,
  stats = [],               // [{ value, label, color, highlight }]
  extra = null,             // optional ReactNode (recap / chips)
  cardioResult,
  shareData,
  heroImage,                // optional badge art (replaces the trophy medal)
  actions = [],             // [{ label, onClick, kind: 'primary'|'secondary'|'ghost' }]
}) {
  const partial = variant === 'partial';
  const label = eyebrow || (partial ? 'GOOD EFFORT' : 'MISSION COMPLETE');
  const displayXp = useCountUp(xp);

  const [stats0] = useState(() => loadStats());
  const streak = getStreak(stats0);
  const level = getLevel(stats0.xp);
  const lp = getLevelProgress(stats0.xp);
  const sex = String(loadProfile()?.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const tier = getCurrentTier(stats0);
  const weekSess = getWeeklySessions(stats0);
  const weekXp = weekSess.reduce((a, s) => a + (s.xpEarned || 0), 0);
  const weekModes = new Set(weekSess.map(s => s.type)).size;
  const pct = lp.needed ? Math.round((lp.current / lp.needed) * 100) : 100;

  const glowA = partial ? 'rgba(168,85,247,0.4)' : hexA(accent, 0.5);
  const glowB = partial ? 'rgba(168,85,247,0.18)' : hexA(accent, 0.22);

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: mcCSS }}/>
      <Embers count={5}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '18px 16px calc(24px + env(safe-area-inset-bottom,0px))' }}>

          {/* Medal hero */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
            {heroImage ? (
              // Mode badge art (transparent PNG/WebP over the dark bg). Kept
              // compact so it never dominates the screen; a soft accent glow
              // grounds it and a gentle pop plays it in.
              <div style={{ position: 'relative', height: 122, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'mc-pop 0.5s ease both' }}>
                <SafeImage src={heroImage} alt="" style={{ height: '100%', width: 'auto', objectFit: 'contain', filter: `drop-shadow(0 0 16px ${hexA(accent, 0.45)}) drop-shadow(0 4px 10px rgba(0,0,0,0.5))` }}/>
              </div>
            ) : (
            <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 10 }}>
              {!partial && (
                <div aria-hidden style={{ position: 'absolute', inset: -14, borderRadius: '50%', background: `conic-gradient(from 0deg, transparent 0deg, ${hexA(accent, 0.28)} 20deg, transparent 40deg, transparent 180deg, ${hexA(accent, 0.28)} 200deg, transparent 220deg)`, animation: 'mc-rays-spin 9s linear infinite', filter: 'blur(1px)' }}/>
              )}
              <div style={{
                position: 'relative', width: 96, height: 96, borderRadius: '50%',
                background: 'radial-gradient(circle at 50% 35%, rgba(30,10,50,0.95), rgba(8,2,18,0.95))',
                border: `2px solid ${partial ? 'rgba(168,85,247,0.5)' : accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                ['--mc-glow-a']: glowA, ['--mc-glow-b']: glowB,
                animation: partial ? 'none' : 'mc-medal-pulse 2.5s ease-in-out infinite',
              }}>
                <Trophy size={44} color={partial ? '#b06aff' : accent} strokeWidth={1.6}/>
              </div>
            </div>
            )}
            <div style={{ font: "700 8px 'Press Start 2P',monospace", color: partial ? '#c9a6ff' : '#facc15', letterSpacing: '0.16em', marginBottom: 8 }}>◈ {label} ◈</div>
            <div style={{ font: "900 21px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.03em', textAlign: 'center', lineHeight: 1.12 }}>{title}</div>
            {subtitle && <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 3, textAlign: 'center' }}>{subtitle}</div>}
          </div>

          {integrityResult && <div style={{ marginBottom: 12 }}><MissionIntegrityBanner integrityResult={integrityResult} xpAwarded={xp}/></div>}

          {/* XP hero */}
          <div style={{ borderRadius: 14, border: `1px solid ${hexA(accent, 0.4)}`, background: `linear-gradient(135deg, ${hexA(accent, 0.12)}, rgba(8,2,18,0.6))`, padding: '14px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'mc-pop 0.5s ease both' }}>
            <div style={{ font: "700 9px 'Orbitron',sans-serif", color: '#facc15', letterSpacing: '0.14em' }}>XP EARNED</div>
            <div style={{ font: "900 30px 'Orbitron',sans-serif", color: accent, textShadow: `0 0 18px ${hexA(accent, 0.5)}` }}>+{displayXp}</div>
          </div>

          {/* Stat grid */}
          {stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
              {stats.map((s, i) => <Stat key={i} {...s}/>)}
            </div>
          )}

          {extra && <div style={{ marginBottom: 14 }}>{extra}</div>}

          <CardioFinisherSummaryCard cardioResult={cardioResult}/>

          {/* Your progress */}
          <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(176,106,255,0.3)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#b06aff', letterSpacing: '0.16em', marginBottom: 9 }}>YOUR PROGRESS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(253,224,71,0.5)', flexShrink: 0 }}>
                <SafeImage src={tierImage(tier.id, sex)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 10px 'Orbitron',sans-serif", color: tier.secret ? tier.color : '#fde047', marginBottom: 3 }}><span>LEVEL {level} · {tier.label.toUpperCase()}</span><span style={{ color: '#c4a4d8', fontWeight: 600 }}>{lp.current}/{lp.needed} XP</span></div>
                <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#b06aff,#fde047)' }}/></div>
              </div>
            </div>
            <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#9a90b8' }}>This week: <span style={{ color: '#fff', fontWeight: 700 }}>{weekSess.length} sessions</span> · <span style={{ color: '#fde047', fontWeight: 700 }}>{weekXp.toLocaleString()} XP</span> · <span style={{ color: '#fff', fontWeight: 700 }}>{weekModes} mode{weekModes === 1 ? '' : 's'}</span></div>
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {actions.map((a, i) => {
              if (a.kind === 'ghost') {
                return <button key={i} onClick={a.onClick} style={{ width: '100%', height: 44, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, background: 'transparent', color: '#9a90b8', font: "700 11px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer' }}>{a.label}</button>;
              }
              if (a.kind === 'secondary') {
                return <button key={i} onClick={a.onClick} style={{ width: '100%', height: 46, border: '1px solid rgba(176,106,255,0.4)', borderRadius: 12, background: 'rgba(176,106,255,0.08)', color: '#b06aff', font: "800 12px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer' }}>{a.label}</button>;
              }
              return <button key={i} onClick={a.onClick} style={{ width: '100%', height: 50, border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 13px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer', boxShadow: '0 0 20px rgba(253,224,71,0.35)' }}>{a.label}</button>;
            })}
          </div>

          {/* Share your win */}
          {shareData && (
            <div style={{ marginTop: 14 }}>
              <SharePromptModal placement="inline" shareData={{ ...shareData, xpEarned: xp, streak, level }}/>
            </div>
          )}

          <button onClick={() => openExternalUrl(BETA_FEEDBACK_FORM_URL)} style={{ margin: '12px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(253,224,71,0.06)', cursor: 'pointer' }}>
            <span style={{ font: "700 8px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.08em' }}>💬 GIVE BETA FEEDBACK</span>
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

// Small helper: turn a #rrggbb into rgba() with the given alpha (falls back to gold).
function hexA(hex, a) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return `rgba(253,224,71,${a})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
}
