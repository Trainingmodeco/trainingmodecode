import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import SafeImage from './SafeImage';
import TrainingHeader from './TrainingHeader';
import { ChevronRight } from 'lucide-react';
import { C } from './Styles';
import { IMG } from './data/optimizedImageMap';
import { loadStats, getLevel, getStreak } from './data/userStats';

const RANKS = ['Combat Rookie', 'Combat Novice', 'Combat Warrior', 'Combat Elite', 'Combat Champion'];
const rankFor = (lvl) => RANKS[Math.min(Math.floor((lvl - 1) / 3), RANKS.length - 1)];

const hubCSS = `
.train-hub-card {
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  cursor: pointer;
}
.train-hub-card:hover {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 0 24px var(--card-glow), 0 8px 24px rgba(0,0,0,0.4) !important;
  border-color: var(--card-glow) !important;
}
.train-hub-card:active {
  transform: scale(0.97);
  transition-duration: 0.1s;
}
`;

export default function TrainingHub({ onHome, onFightMode, onFitMode, onTrainingArcade, onCombatConditioning, onProfile, profile }) {
  const stats = loadStats();
  const level = getLevel(stats.xp);
  const rank = rankFor(level);
  const streak = getStreak(stats);
  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: hubCSS }}/>
      <Embers count={3}/>

      {/* Training Mode header — logo + back to home */}
      <TrainingHeader
        title="TRAINING MODE"
        subtitle="Choose your path."
        onHome={onHome}
        showBack
        onBack={onHome}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh',
        padding: '10px 14px calc(160px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Page title */}
        <div style={{ marginBottom: 12 }}>
          <h1 style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 22,
            color: '#fff', letterSpacing: '0.06em', margin: '0 0 4px',
            textTransform: 'uppercase',
          }}>CHOOSE YOUR PATH</h1>
          <p style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 600,
            color: C.muted, margin: 0,
          }}>Level {level} · {rank} · <span style={{ color: '#ff8a4a' }}>🔥 {streak} streak</span></p>
        </div>

        {/* === FIGHT MODE === */}
        <div
          className="train-hub-card"
          data-tour="mode-fight"
          onClick={onFightMode}
          style={{
            '--card-glow': 'rgba(239,68,68,0.5)',
            position: 'relative', height: 126, borderRadius: 14, overflow: 'hidden',
            border: '1px solid rgba(239,68,68,0.25)',
            boxShadow: '0 0 12px rgba(239,68,68,0.08)',
            marginBottom: 12,
          }}
        >
          <SafeImage src={IMG.hub.fight} alt="Fight Mode" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(8,0,18,0.88) 0%, rgba(8,0,18,0.4) 55%, transparent 100%)',
          }}/>
          <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 5 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
              color: '#fff', letterSpacing: '0.08em', lineHeight: 1,
              textShadow: '0 0 14px rgba(239,68,68,0.5)',
            }}>FIGHT MODE</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11,
              color: C.muted, marginTop: 4, letterSpacing: '0.02em',
            }}>Striking, rounds, combos &amp; skill work.</div>
          </div>
          <div style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ChevronRight size={14} color={C.red}/>
          </div>
        </div>

        {/* === FIT MODE === */}
        <div
          className="train-hub-card"
          data-tour="mode-fit"
          onClick={onFitMode}
          style={{
            '--card-glow': 'rgba(168,85,247,0.5)',
            position: 'relative', height: 126, borderRadius: 14, overflow: 'hidden',
            border: '1px solid rgba(168,85,247,0.25)',
            boxShadow: '0 0 12px rgba(168,85,247,0.08)',
            marginBottom: 12,
          }}
        >
          <SafeImage src={IMG.hub.fit} alt="Fit Mode" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(8,0,18,0.88) 0%, rgba(8,0,18,0.4) 55%, transparent 100%)',
          }}/>
          <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 5 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
              color: '#fff', letterSpacing: '0.08em', lineHeight: 1,
              textShadow: '0 0 14px rgba(168,85,247,0.5)',
            }}>FIT MODE</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11,
              color: C.muted, marginTop: 4, letterSpacing: '0.02em',
            }}>Strength, quick workouts &amp; conditioning.</div>
          </div>
          <div style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ChevronRight size={14} color={C.violet}/>
          </div>
        </div>

        {/* === COMBAT CONDITIONING === */}
        <div
          className="train-hub-card"
          onClick={onCombatConditioning}
          style={{
            '--card-glow': 'rgba(255,138,74,0.5)',
            position: 'relative', height: 126, borderRadius: 14, overflow: 'hidden',
            border: '1px solid rgba(239,68,68,0.2)',
            boxShadow: '0 0 10px rgba(255,138,74,0.06)',
            marginBottom: 12,
          }}
        >
          <SafeImage src={IMG.hub.combatBanner} alt="Combat Conditioning" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(8,0,18,0.88) 0%, rgba(8,0,18,0.4) 55%, transparent 100%)',
          }}/>
          <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 5 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
              color: '#fff', letterSpacing: '0.08em', lineHeight: 1,
              textShadow: '0 0 14px rgba(255,138,74,0.5)',
            }}>COMBAT CONDITIONING</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11,
              color: C.cardio, marginTop: 4, letterSpacing: '0.02em',
            }}>Fit + Fight crossover &middot; reachable from both</div>
          </div>
          <div style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(255,138,74,0.15)', border: '1px solid rgba(255,138,74,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ChevronRight size={14} color={C.cardio}/>
          </div>
        </div>

        {/* === TRAINING ARCADE === */}
        <div
          className="train-hub-card"
          data-tour="mode-arcade"
          onClick={onTrainingArcade}
          style={{
            '--card-glow': 'rgba(34,197,94,0.5)',
            position: 'relative', height: 126, borderRadius: 14, overflow: 'hidden',
            border: '1px solid rgba(34,197,94,0.25)',
            boxShadow: '0 0 12px rgba(34,197,94,0.08)',
          }}
        >
          <SafeImage src={IMG.hub.arcade} alt="Training Arcade" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(8,0,18,0.88) 0%, rgba(8,0,18,0.4) 55%, transparent 100%)',
          }}/>
          <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 5 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16,
              color: '#fff', letterSpacing: '0.08em', lineHeight: 1,
              textShadow: '0 0 14px rgba(34,197,94,0.5)',
            }}>TRAINING ARCADE</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11,
              color: C.muted, marginTop: 4, letterSpacing: '0.02em',
            }}>Stage-based challenges. Earn XP, clear bosses.</div>
          </div>
          <div style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ChevronRight size={14} color={C.green}/>
          </div>
        </div>

      </div>
    </PhoneFrame>
  );
}
