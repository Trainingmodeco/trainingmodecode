import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import Embers from './Embers';
import SafeImage from './SafeImage';
import { ChevronRight } from 'lucide-react';
import { C } from './Styles';
import { IMG } from './data/optimizedImageMap';

const fitCSS = `
.fit-hub-card {
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.fit-hub-card:hover {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 0 22px var(--card-glow), 0 6px 20px rgba(0,0,0,0.4) !important;
  border-color: var(--card-glow) !important;
}
.fit-hub-card:active {
  transform: scale(0.97);
  transition-duration: 0.1s;
}
`;

const CARDS = [
  {
    id: 'builder',
    title: 'WORKOUT BUILDER',
    desc: 'Build a custom session \u2014 pick focus, muscles & gear',
    img: IMG.fitMode.workoutBuilder,
    glow: 'rgba(253,224,71,0.45)',
    border: 'rgba(253,224,71,0.25)',
    accent: C.gold,
  },
  {
    id: 'quick',
    title: 'QUICK MISSION',
    desc: 'No-setup preset workout, start in one tap',
    img: IMG.fitMode.quickMission,
    glow: 'rgba(168,85,247,0.45)',
    border: 'rgba(168,85,247,0.25)',
    accent: C.violet,
  },
  {
    id: 'cardio',
    title: 'CARDIO MODE',
    desc: 'Run, treadmill & HIIT with voice coach',
    img: IMG.fitMode.cardioMode,
    glow: 'rgba(255,138,74,0.45)',
    border: 'rgba(255,138,74,0.25)',
    accent: C.cardio,
  },
  {
    id: 'combat',
    title: 'COMBAT CONDITIONING',
    desc: 'Hybrid strength \u00D7 striking circuits',
    img: IMG.fitMode.combatConditioning,
    glow: 'rgba(239,68,68,0.45)',
    border: 'rgba(239,68,68,0.25)',
    accent: C.red,
  },
];

export default function FitModeHub({ onHome, onBack, onWorkoutBuilder, onQuickMission, onCombatConditioning, onCardioMode, onWorkoutCodec }) {
  const handlers = {
    builder: onWorkoutBuilder,
    quick: onQuickMission,
    cardio: onCardioMode,
    combat: onCombatConditioning,
  };

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitCSS }}/>
      <Embers count={3}/>

      <TrainingHeader
        title="FIT MODE"
        subtitle="Build strength, endurance & conditioning."
        onHome={onHome}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '16px 14px 0',
        paddingBottom: 'calc(170px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Banner header area */}
        <div style={{
          position: 'relative', borderRadius: 14, overflow: 'hidden',
          height: 100, marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(253,224,71,0.06))',
          border: `1px solid ${C.cardBorder}`,
          display: 'flex', alignItems: 'center', padding: '0 20px',
        }}>
          <div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 20,
              color: '#fff', letterSpacing: '0.06em',
              textShadow: '0 0 16px rgba(168,85,247,0.4)',
            }}>FIT MODE</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12,
              color: C.muted, marginTop: 3,
            }}>Strength, cardio & combat conditioning</div>
          </div>
          <SafeImage src="/static/title-fit.png" alt="" style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            height: 70, width: 'auto', opacity: 0.5,
          }}/>
        </div>

        {/* Feature cards */}
        {CARDS.map(card => (
          <div
            key={card.id}
            className="fit-hub-card"
            onClick={() => handlers[card.id]?.()}
            style={{
              '--card-glow': card.glow,
              borderRadius: 12, height: 100, marginBottom: 10,
              border: `1px solid ${card.border}`,
              boxShadow: '0 0 8px rgba(0,0,0,0.3)',
              background: '#080012',
            }}
          >
            <SafeImage src={card.img} alt="" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center',
            }}/>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to right, rgba(8,0,18,0.9) 0%, rgba(8,0,18,0.5) 50%, rgba(8,0,18,0.2) 100%)',
            }}/>
            <div style={{
              position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)', zIndex: 5,
              maxWidth: '70%',
            }}>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
                color: '#fff', letterSpacing: '0.06em', lineHeight: 1,
                textShadow: `0 0 10px ${card.glow}`,
              }}>{card.title}</div>
              <div style={{
                fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11,
                color: C.muted, marginTop: 5, lineHeight: 1.3,
              }}>{card.desc}</div>
            </div>
            <div style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
              width: 26, height: 26, borderRadius: 7,
              background: `${card.glow.replace('0.45', '0.15')}`,
              border: `1px solid ${card.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ChevronRight size={13} color={card.accent}/>
            </div>
          </div>
        ))}

        {/* WORKOUT CODEX — beta, reduced opacity */}
        <div
          className="fit-hub-card"
          onClick={onWorkoutCodec}
          style={{
            '--card-glow': 'rgba(253,224,71,0.35)',
            borderRadius: 12, height: 100, marginBottom: 10,
            border: '1px solid rgba(253,224,71,0.15)',
            boxShadow: '0 0 8px rgba(0,0,0,0.3)',
            background: '#080012',
            opacity: 0.6,
          }}
        >
          <SafeImage src={IMG.fitMode.workoutCodex} alt="Workout Codex" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(8,0,18,0.9) 0%, rgba(8,0,18,0.5) 50%, rgba(8,0,18,0.2) 100%)',
          }}/>
          <div style={{
            position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)', zIndex: 5,
            maxWidth: '70%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
                color: '#fff', letterSpacing: '0.06em', lineHeight: 1,
              }}>WORKOUT CODEX</span>
              <span style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8,
                color: C.gold, letterSpacing: '0.08em',
                padding: '2px 7px', borderRadius: 4,
                background: 'rgba(253,224,71,0.12)', border: '1px solid rgba(253,224,71,0.3)',
              }}>BETA</span>
            </div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11,
              color: C.muted, marginTop: 5, lineHeight: 1.3,
            }}>Import workouts from text, photo or PDF</div>
          </div>
          <div style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 5,
            width: 26, height: 26, borderRadius: 7,
            background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ChevronRight size={13} color={C.gold}/>
          </div>
        </div>

      </div>
    </PhoneFrame>
  );
}
